#!/usr/bin/env python3
"""
Agente do robô de autorização — roda num computador da clínica.

Fica perguntando ao CRM (rotas /api/portal-robot/*) se há guia para enviar ao
plano. Quando há, abre o portal Conecta Saúde (IASEP), preenche os 5 passos,
anexa o laudo, para no resumo e espera a recepção confirmar NA TELA DO CRM.
Só então clica em Autorizar e devolve ao CRM o resultado e o print da tela.

A senha do portal fica só no .env deste computador; o CRM nunca a recebe.
Ver docs/portal-robot.md no projeto do CRM.
"""
import json
import os
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from conecta_portal import ConectaPortal, msg_curta

VERSAO = "1.0.0"
PASTA = Path(__file__).resolve().parent
load_dotenv(PASTA / ".env")


def env(nome, padrao=""):
    return (os.getenv(nome) or padrao).strip()


CRM_URL = env("CRM_URL").rstrip("/")
AGENT_TOKEN = env("AGENT_TOKEN")
INTERVALO = float(env("INTERVALO_SEGUNDOS", "10"))
CONFIRMACAO_MAX = float(env("CONFIRMACAO_MAX_MINUTOS", "20")) * 60
TIMEOUT_MS = int(env("TIMEOUT_PADRAO_SEGUNDOS", "60")) * 1000
HEADLESS = env("HEADLESS", "0") == "1"
PASTA_SESSAO = PASTA / "sessao_navegador"
LOG_ARQUIVO = PASTA / "agente.log"

CFG = {
    "TELEFONE_ATENDENTE": env("TELEFONE_ATENDENTE"),
    "EMAIL_ATENDENTE": env("EMAIL_ATENDENTE"),
    "NOME_ATENDENTE": env("NOME_ATENDENTE"),
    "TIPO_DOCUMENTO_ANEXO": env("TIPO_DOCUMENTO_ANEXO", "2661"),
    "JUSTIFICATIVA_BIOMETRIA": env("JUSTIFICATIVA_BIOMETRIA", "Validação Pelo Call Center"),
    "CONDICAO_ATENDIMENTO": env("CONDICAO_ATENDIMENTO", "Paciente no local"),
}


class Cancelado(Exception):
    pass


def log(msg, nivel="info"):
    linha = f"[{datetime.now():%d/%m/%Y %H:%M:%S}] {msg}"
    print(linha, flush=True)
    with open(LOG_ARQUIVO, "a", encoding="utf-8") as f:
        f.write(linha + "\n")


# ------------------------------------------------------------------ conversa com o CRM
def _requisicao(caminho, corpo=None, content_type="application/json", timeout=60):
    req = urllib.request.Request(
        f"{CRM_URL}/api/portal-robot/{caminho}",
        data=corpo if corpo is not None else b"{}",
        method="POST",
        headers={
            "Authorization": f"Bearer {AGENT_TOKEN}",
            "Content-Type": content_type,
            "X-Agent-Version": VERSAO,
            "User-Agent": f"agente-robo-portal/{VERSAO}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        corpo_erro = e.read().decode("utf-8", "replace")[:300]
        if e.code == 401:
            raise SystemExit("O CRM recusou o token do agente (AGENT_TOKEN). Confira o .env.")
        raise RuntimeError(f"CRM respondeu {e.code} em {caminho}: {corpo_erro}")
    except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as e:
        # Internet caiu, CRM fora do ar ou resposta estranha: o laço principal espera e tenta de novo.
        raise RuntimeError(f"sem resposta do CRM em {caminho}: {e}")


def reservar():
    return _requisicao("claim").get("job")


def andamento(job_id, step=None, label=None, status=None, resumo=None):
    corpo = {"job_id": job_id}
    if step is not None:
        corpo["step"] = step
    if label:
        corpo["step_label"] = label
    if status:
        corpo["status"] = status
    if resumo:
        corpo["portal_summary"] = resumo
    st = _requisicao("progress", json.dumps(corpo).encode("utf-8")).get("status")
    return st


def resultado(job_id, outcome, portal_status=None, guide_number=None, message=None, print_png=None):
    limite = uuid.uuid4().hex
    partes = []
    for nome, valor in (("job_id", job_id), ("outcome", outcome), ("portal_status", portal_status),
                        ("guide_number", guide_number), ("message", message)):
        if valor:
            partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="{nome}"\r\n\r\n{valor}\r\n'.encode("utf-8"))
    if print_png:
        partes.append(
            f'--{limite}\r\nContent-Disposition: form-data; name="screenshot"; filename="print.png"\r\n'
            f"Content-Type: image/png\r\n\r\n".encode("utf-8") + print_png + b"\r\n"
        )
    partes.append(f"--{limite}--\r\n".encode("utf-8"))
    for tentativa in range(3):  # o resultado é o que mais importa não perder
        try:
            return _requisicao("result", b"".join(partes), f"multipart/form-data; boundary={limite}")
        except RuntimeError as e:
            log(f"   falha ao enviar resultado ({tentativa + 1}/3): {e}", "aviso")
            time.sleep(5)
    log("   ATENÇÃO: não consegui avisar o CRM do resultado. Confira o pedido na tela.", "erro")
    return None


def baixar_laudo(job):
    laudo = job["payload"]["laudo"]
    if not job.get("laudo_url"):
        raise RuntimeError("o CRM não entregou o link do laudo")
    sufixo = Path(laudo.get("name") or "laudo.pdf").suffix.lower() or ".pdf"
    if sufixo not in (".pdf", ".jpg", ".jpeg", ".png"):
        sufixo = ".pdf"
    destino = Path(tempfile.mkdtemp(prefix="laudo_")) / f"laudo{sufixo}"
    with urllib.request.urlopen(job["laudo_url"], timeout=120) as r, open(destino, "wb") as f:
        f.write(r.read())
    return destino


# ------------------------------------------------------------------ um pedido
def processar(page, portal, job):
    jid = job["id"]
    p = job["payload"]
    nome = p.get("patient_name") or p["card_number"]
    log(f"Pedido {jid[:8]} · {nome} · {job['mode']} · " + ", ".join(f"{t['code']} x{t['quantity']}" for t in p["procedures"]))

    def passo(n, texto):
        st = andamento(jid, n, texto)
        if st == "cancelado":
            raise Cancelado()

    print_png = None
    try:
        arquivo = baixar_laudo(job)
        portal._login(page)
        portal._abrir_nova_guia(page)
        passo(1, "Beneficiário")
        benef, guia = portal._passo1(page, p["card_number"])
        log(f"   beneficiário: {benef} | guia prestador: {guia or '?'}")
        passo(2, "Solicitante")
        prof = p["professional"]
        portal._passo2(page, {"nome": prof["name"], "conselho": prof["council"], "registro": prof["register"],
                              "uf": prof.get("uf") or "", "cbo": prof["cbo"]})
        passo(3, "Solicitação (CID e terapias)")
        portal._passo3(page, p["cid"], [(t["code"], int(t["quantity"])) for t in p["procedures"]], p.get("observation"))
        passo(4, "Executante")
        portal._proximo(page, 5)
        passo(5, "Anexando o laudo")
        portal._passo5(page, arquivo)
        print_png = page.screenshot(full_page=True)
    except Cancelado:
        log("   cancelado pela recepção antes do envio.", "aviso")
        resultado(jid, "erro", message="Cancelado pela recepção.", print_png=_print(page))
        return
    except Exception as e:  # nada foi enviado ao plano
        log(f"   ERRO (nada foi enviado): {e}", "erro")
        traceback.print_exc()
        resultado(jid, "erro", message=msg_curta(e), print_png=_print(page))
        return

    resumo = {"beneficiary": benef, "provider_guide": guia}
    if job["mode"] == "simular":
        log("   simulação: parou no resumo, nada enviado.")
        resultado(jid, "simulado", guide_number=guia, message="Simulação: preencheu tudo e parou no resumo.", print_png=print_png)
        return

    st = andamento(jid, 6, "Resumo — aguardando confirmação", status="aguardando_confirmacao", resumo=resumo)
    log("   no resumo: aguardando confirmação da recepção no CRM...")
    inicio = time.time()
    while st == "aguardando_confirmacao" and time.time() - inicio < CONFIRMACAO_MAX:
        time.sleep(3)
        st = andamento(jid)
    if st != "confirmado":
        motivo = "Cancelado pela recepção." if st == "cancelado" else "Ninguém confirmou a tempo. Nada foi enviado."
        log(f"   {motivo}", "aviso")
        resultado(jid, "erro", message=motivo, print_png=print_png)
        return

    # A partir daqui a solicitação pode ser criada no portal: nunca repetir sozinho.
    andamento(jid, 6, "Clicando em Autorizar")
    try:
        status_portal = portal._autorizar(page)
    except Exception as e:
        log(f"   ATENÇÃO: cliquei em Autorizar mas não li o resultado: {e}", "erro")
        resultado(jid, "verificar", guide_number=guia,
                  message="Cliquei em Autorizar mas não consegui ler a resposta do portal. Confira no portal.",
                  print_png=_print(page))
        return
    log(f"   OK: {status_portal}")
    resultado(jid, "enviado", portal_status=status_portal, guide_number=guia, print_png=_print(page))


def _print(page):
    try:
        return page.screenshot(full_page=True)
    except Exception:
        return None


# ------------------------------------------------------------------ laço principal
def conferir_config():
    faltando = [n for n in ("CRM_URL", "AGENT_TOKEN", "PORTAL_USUARIO", "PORTAL_SENHA",
                            "TELEFONE_ATENDENTE", "EMAIL_ATENDENTE", "NOME_ATENDENTE") if not env(n)]
    if faltando:
        raise SystemExit("Preencha no .env do agente: " + ", ".join(faltando))
    if not CRM_URL.startswith("https://") and "localhost" not in CRM_URL and "127.0.0.1" not in CRM_URL:
        raise SystemExit("CRM_URL precisa começar com https:// (o token e os laudos não podem trafegar sem criptografia).")


def main():
    conferir_config()
    from playwright.sync_api import sync_playwright

    portal = ConectaPortal(CFG, TIMEOUT_MS, log, env("PORTAL_URL", "https://portalconectasaude.com.br/"),
                           env("PORTAL_USUARIO"), env("PORTAL_SENHA"))
    log(f"Agente {VERSAO} ligado. CRM: {CRM_URL}. Esperando pedidos (Ctrl+C para parar).")
    with sync_playwright() as pw:
        ctx = None
        try:
            while True:
                try:
                    job = reservar()
                except RuntimeError as e:
                    log(f"Sem conexão com o CRM: {e}", "aviso")
                    time.sleep(max(INTERVALO, 30))
                    continue
                if not job:
                    time.sleep(INTERVALO)
                    continue
                if ctx is None:
                    ctx = pw.chromium.launch_persistent_context(str(PASTA_SESSAO), headless=HEADLESS,
                                                                viewport={"width": 1400, "height": 900})
                page = ctx.pages[0] if ctx.pages else ctx.new_page()
                page.set_default_timeout(TIMEOUT_MS)
                try:
                    processar(page, portal, job)
                except Exception as e:
                    log(f"Falha inesperada: {e}", "erro")
                    traceback.print_exc()
                    try:
                        ctx.close()
                    except Exception:
                        pass
                    ctx = None
                time.sleep(float(env("PAUSA_ENTRE_PEDIDOS_SEGUNDOS", "3")))
        except KeyboardInterrupt:
            log("Agente desligado.")
        finally:
            if ctx is not None:
                ctx.close()


if __name__ == "__main__":
    sys.exit(main())
