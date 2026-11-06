"""
Preenchimento do portal Conecta Saúde (Benner / IASEP) — "Solicitar Eletiva" SP/SADT.

Mesmos passos validados no robô local (autorizacao-conecta/robo.py), separados
aqui para o agente que conversa com o CRM. Cada método recebe a página do
Playwright; o agente decide a ordem, o andamento e a confirmação.
"""
import re
import time

class ErroPortal(RuntimeError):
    """O portal recusou avançar de passo; .alerta guarda a mensagem da caixa vermelha."""
    def __init__(self, msg, alerta=""):
        super().__init__(msg)
        self.alerta = alerta or ""


def msg_curta(e, atual=None):
    """Mensagem resumida para a tela; o texto técnico completo fica no log."""
    if isinstance(e, RuntimeError):
        return str(e)
    etapa = f" (etapa: {atual.get('passo_texto')})" if atual else ""
    primeira = (str(e).strip().splitlines() or ["erro desconhecido"])[0]
    if "Timeout" in type(e).__name__ or "timeout" in primeira.lower() or "to_be_visible" in str(e) \
            or "expected to" in primeira:
        return f"o portal não mostrou o que o robô esperava{etapa}; veja o print e o registro"
    return primeira[:200] + etapa


class ConectaPortal:
    def __init__(self, cfg, timeout_ms, log, url_portal, usuario, senha):
        self.cfg = cfg
        self.timeout = timeout_ms
        self.log = log
        self.usuario = usuario
        self.senha = senha
        self.url_nova_guia = url_portal.rstrip("/") + "/Guias/SpSadt/NovaGuiaEletiva"

    def _esperar_passo(self, page, n):
        from playwright.sync_api import expect
        padrao = re.compile(rf"Passo\s+{n}\s+de\s+5")
        titulo = page.locator("#descricao-etapa-wizard")   # título da etapa no portal
        if titulo.count():
            expect(titulo.first).to_have_text(padrao, timeout=self.timeout)
        else:
            expect(page.get_by_text(padrao).first).to_be_visible(timeout=self.timeout)

    @staticmethod
    def _alerta(page):
        """Texto das mensagens de erro de validação mostradas pelo portal (caixa vermelha)."""
        try:
            textos = page.locator(".alert-danger:visible, .validation-summary-errors:visible").all_inner_texts()
        except Exception:
            return ""
        return " ".join(" ".join(t.split()) for t in textos if t.strip())

    def _no_passo(self, page, n):
        padrao = re.compile(rf"Passo\s+{n}\s+de\s+5")
        titulo = page.locator("#descricao-etapa-wizard")
        try:
            if titulo.count():
                return bool(padrao.search(titulo.first.inner_text()))
            return page.get_by_text(padrao).first.is_visible()
        except Exception:
            return False

    def _proximo(self, page, passo_seguinte=None):
        """Clica em Próximo. Se o portal recusar, levanta ErroPortal com a mensagem da caixa vermelha."""
        page.locator("a:visible, button:visible").filter(has_text=re.compile(r"^\s*Próximo")).first.click()
        if not passo_seguinte:
            return
        inicio = time.time()
        while time.time() - inicio < self.timeout / 1000:
            if self._no_passo(page, passo_seguinte):
                return
            if time.time() - inicio > 2.5:          # dá tempo do portal validar
                alerta = self._alerta(page)
                if alerta:
                    raise ErroPortal(f"o portal não avançou para o passo {passo_seguinte}: {alerta}", alerta)
            time.sleep(0.3)
        raise ErroPortal(f"o portal não avançou para o passo {passo_seguinte} "
                         "(algum campo obrigatório deve ter ficado com erro)", self._alerta(page))

    @staticmethod
    def _grupo(page, rotulo):
        """Devolve (label, bloco do campo) a partir do texto do rótulo (texto parcial ou regex)."""
        padrao = rotulo if isinstance(rotulo, re.Pattern) else re.compile(re.escape(rotulo), re.I)
        label = page.locator("label:visible").filter(has_text=padrao).first
        if not label.count():
            raise RuntimeError(f"não encontrei o campo '{getattr(rotulo, 'pattern', rotulo)}' na tela")
        grupo = label.locator("xpath=ancestor::*[contains(@class,'form-group') or contains(@class,'col-')][1]")
        if not grupo.count():
            grupo = label.locator("xpath=..")
        return label, grupo

    @staticmethod
    def _texto_campo(grupo, label):
        """Texto que está escolhido/preenchido no campo (sem o rótulo)."""
        try:
            txt = grupo.inner_text()
            for inp in grupo.locator("input:visible").all():
                txt += " " + (inp.input_value() or "")
            return txt.replace(label.inner_text(), "", 1).strip()
        except Exception:
            return ""

    def _escolher_lista(self, page, rotulo, valor, modo="exato", texto_livre=False):
        """
        Escolhe uma opção numa lista suspensa com busca (select2 / ui-select), achando o campo pelo rótulo.
        modo "exato": opção igual ao valor ou começando por "VALOR -" (ex.: CRM -> "CRM - Conselho Regional...")
        modo "contem": opção que contém o valor (ex.: nome do profissional)
        texto_livre: se nenhuma opção bater, confirma o texto digitado (Enter)
        """
        label, grupo = self._grupo(page, rotulo)
        nome_campo = getattr(rotulo, "pattern", rotulo)
        nativo = grupo.locator("select:visible")
        if nativo.count():
            nativo.first.select_option(label=valor)
            return
        abridor = grupo.locator(".select2-choice:visible, .select2-selection:visible, .ui-select-toggle:visible, "
                                ".ui-select-match:visible, .select2-container:visible, "
                                ".ui-select-container:visible").first
        if abridor.count():
            abridor.click()
        else:
            label.locator("xpath=following::*[self::a or self::span or self::div][1]").click()
        page.wait_for_timeout(400)
        busca = self._busca_visivel(page)
        if busca.count():
            busca.fill("")
            busca.press_sequentially(valor, delay=40)
            page.wait_for_timeout(1000)
        v = " ".join(valor.split()).lower()
        alvo = self._opcao(page, valor, modo)
        if alvo is not None:
            alvo.click()
        elif texto_livre and busca.count():
            busca.press("Enter")
        else:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            raise RuntimeError(f"a opção '{valor}' não existe na lista '{nome_campo}' do portal")
        page.wait_for_timeout(500)
        if v not in self._texto_campo(grupo, label).lower():
            raise RuntimeError(f"não consegui marcar '{valor}' em '{nome_campo}'")

    def _nome_profissional(self, page, nome):
        """Cadeado (um clique) -> digita o nome na busca -> clica no nome que aparece embaixo."""
        label, grupo = self._grupo(page, "Nome do Profissional")
        alvo = " ".join(nome.split()).lower()
        if alvo in " ".join(self._texto_campo(grupo, label).split()).lower():
            return                                   # já está preenchido
        cadeado = grupo.locator("button:has(.fa-lock), button:has(.fa-unlock), button:has(.fa-unlock-alt), "
                                "a:has(.fa-lock), a:has(.fa-unlock), button:has(.glyphicon-lock)").first
        if not cadeado.count():
            cadeado = grupo.locator("button:visible, .input-group-btn a:visible").last
        if not cadeado.count():
            raise RuntimeError("não encontrei o cadeado do nome do profissional")
        cadeado.click()                              # só uma vez
        page.wait_for_timeout(800)

        busca = self._busca_visivel(page)
        if not busca.count():                        # lista não abriu sozinha: abre clicando no campo
            grupo.locator(".select2-choice:visible, .select2-selection:visible, .ui-select-toggle:visible, "
                          ".ui-select-match:visible, .select2-container:visible").first.click()
            page.wait_for_timeout(500)
            busca = self._busca_visivel(page)
        if not busca.count():
            raise RuntimeError("o campo do profissional não abriu depois do cadeado")
        busca.fill("")
        busca.press_sequentially(nome, delay=40)
        page.wait_for_timeout(1200)

        opcao = self._opcao(page, nome, "contem")
        if opcao is None:
            raise RuntimeError(f"o nome '{nome}' não apareceu na lista do profissional")
        opcao.click()                                # clica no nome que aparece embaixo
        page.wait_for_timeout(800)
        if alvo not in " ".join(self._texto_campo(grupo, label).split()).lower():
            raise RuntimeError(f"cliquei no nome '{nome}' mas ele não ficou no campo")

    @staticmethod
    def _busca_visivel(page):
        return page.locator(".select2-drop-active .select2-search input:visible, .select2-search input:visible, "
                            ".select2-search__field:visible, input.ui-select-search:visible").first

    @staticmethod
    def _opcao(page, valor, modo):
        opcoes = page.locator(".select2-drop-active .select2-results li:visible, .select2-results li:visible, "
                              ".select2-results__option:visible, .ui-select-choices-row:visible")
        v = " ".join(valor.split()).lower()
        for op in opcoes.all():
            t = " ".join((op.inner_text() or "").split()).lower()
            if not t or "nenhum" in t or "no matches" in t or "digite" in t:
                continue
            if modo == "exato" and (t == v or t.startswith(v + " -") or t.startswith(v + " |")):
                return op
            if modo == "contem" and v in t:
                return op
        return None

    def _campo_livre(self, page, rotulo, valor, so_digitos=False):
        """Lista com busca que aceita valor digitado (telefone / e-mail do atendente): digita e clica na opção."""
        norm = (lambda t: re.sub(r"\D", "", t)) if so_digitos else (lambda t: " ".join(t.split()).lower())
        alvo = norm(valor)
        label, grupo = self._grupo(page, rotulo)
        if alvo and alvo in norm(self._texto_campo(grupo, label)):
            return                                   # já está preenchido
        abridor = grupo.locator(".select2-choice:visible, .select2-selection:visible, .ui-select-toggle:visible, "
                                ".ui-select-match:visible, .select2-container:visible").first
        if abridor.count():
            abridor.click()
        else:
            grupo.locator("input:visible").first.click()
        page.wait_for_timeout(500)
        busca = self._busca_visivel(page)
        if not busca.count():
            # campo de texto simples
            campo = grupo.locator("input[type=text]:visible, input[type=email]:visible, input[type=tel]:visible").first
            campo.fill(valor)
            campo.press("Tab")
        else:
            busca.fill("")
            busca.press_sequentially(valor, delay=40)
            page.wait_for_timeout(1000)
            escolhida = None
            opcoes = page.locator(".select2-drop-active .select2-results li:visible, .select2-results li:visible, "
                                  ".select2-results__option:visible, .ui-select-choices-row:visible")
            for op in opcoes.all():
                t = op.inner_text() or ""
                if alvo and alvo in norm(t):
                    escolhida = op
                    break
            if escolhida is not None:
                escolhida.click()
            else:
                busca.press("Enter")
            page.wait_for_timeout(600)
        if alvo not in norm(self._texto_campo(grupo, label)):
            raise RuntimeError(f"não consegui preencher '{rotulo}' com '{valor}'")

    @staticmethod
    def _lupa(campo):
        grupo = campo.locator("xpath=ancestor::*[contains(@class,'input-group')][1]")
        lupa = grupo.locator("button:has(.fa-search), a:has(.fa-search), button:has(.glyphicon-search)")
        if lupa.count():
            lupa.first.click()
            return
        botoes = grupo.locator("button")
        if botoes.count() >= 2:
            botoes.nth(1).click()
            return
        raise RuntimeError("não encontrei o botão da lupa ao lado do campo")

    def _login(self, page):
        usuario, senha = self.usuario, self.senha
        for tentativa in range(1, 4):
            try:
                page.goto(self.url_nova_guia, wait_until="domcontentloaded")
                email = page.get_by_role("textbox", name="E-mail*")
                benef = page.get_by_role("textbox", name="Beneficiário*")
                email.or_(benef).first.wait_for(timeout=self.timeout)
                if email.is_visible():
                    self.log("Fazendo login no portal...")
                    email.fill(usuario)
                    page.get_by_role("textbox", name="Senha*").fill(senha)
                    try:
                        page.get_by_role("checkbox", name="Mantenha-me conectado").check()
                    except Exception:
                        pass
                    page.get_by_role("button", name="Acessar").click()
                    page.wait_for_load_state("networkidle", timeout=self.timeout)
                    if page.get_by_role("textbox", name="Senha*").is_visible():
                        raise PermissionError("o portal recusou o login: confira PORTAL_USUARIO e PORTAL_SENHA no .env do agente")
                return
            except PermissionError:
                raise
            except Exception as e:
                self.log(f"Falha ao abrir o portal (tentativa {tentativa}/3): {e}", "aviso")
                time.sleep(5)
        raise RuntimeError("não consegui abrir o portal depois de 3 tentativas")

    def _abrir_nova_guia(self, page):
        page.goto(self.url_nova_guia, wait_until="domcontentloaded")
        benef = page.get_by_role("textbox", name="Beneficiário*")
        try:
            benef.wait_for(timeout=15000)
        except Exception:
            page.get_by_role("link", name=re.compile(r"Pedir Autoriza")).click()
            page.get_by_role("link", name=re.compile(r"SP/SADT\s*$")).click()
            page.get_by_role("link", name=re.compile(r"Solicitar Eletiva")).click()
            benef.wait_for(timeout=self.timeout)
        self._esperar_passo(page, 1)

    # ------------------------------------------------------------ os 5 passos
    def _passo1(self, page, carteirinha):
        from playwright.sync_api import expect
        campo = page.get_by_role("textbox", name="Beneficiário*")
        campo.fill(carteirinha)
        self._lupa(campo)
        try:
            expect(campo).to_have_value(re.compile(r"\|"), timeout=20000)
        except AssertionError:
            raise RuntimeError("beneficiário não encontrado pela carteirinha")
        benef = campo.input_value().split("|", 1)[-1].strip()
        guia = ""
        try:
            guia = page.locator("label:has-text('Guia Prestador')").first \
                       .locator("xpath=following::input[1]").input_value()
        except Exception:
            pass
        try:
            self._proximo(page, 2)
        except ErroPortal as e:
            # alguns pacientes exigem a "Justificativa Ausência Biometria Facial"
            if "biometria" not in e.alerta.lower():
                raise
            just = (self.cfg.get("JUSTIFICATIVA_BIOMETRIA") or "").strip()
            if not just:
                raise RuntimeError("o portal exigiu a Justificativa Ausência Biometria Facial; "
                                   "defina qual usar em Configurações")
            self.log(f"   portal pediu justificativa de biometria: usando '{just}'", "aviso")
            self._escolher_lista(page, "Justificativa Ausência Biometria", just)
            self._proximo(page, 2)
        return benef, guia

    def _passo2(self, page, prof):
        # nome do profissional: um clique no cadeado, digita e clica no nome da lista
        self._nome_profissional(page, prof["nome"])
        page.wait_for_timeout(800)   # o portal pode preencher o resto sozinho se o profissional já existir

        # conselho (lista com busca)
        label, grupo = self._grupo(page, "Conselho Profissional")
        atual = self._texto_campo(grupo, label).upper()
        if not (atual == prof["conselho"].upper() or atual.startswith(prof["conselho"].upper() + " -")):
            self._escolher_lista(page, "Conselho Profissional", prof["conselho"])

        reg = page.get_by_role("textbox", name=re.compile(r"Número Registro"))
        if reg.input_value().strip() != prof["registro"]:
            reg.fill(prof["registro"])
            reg.press("Tab")
            page.wait_for_timeout(400)

        if prof.get("uf"):
            rot_uf = re.compile(r"^\s*Uf\*?\s*$", re.I)
            label, grupo = self._grupo(page, rot_uf)
            if self._texto_campo(grupo, label).upper() != prof["uf"].upper():
                self._escolher_lista(page, rot_uf, prof["uf"])

        cbo = page.locator("#CboExecutante")
        try:
            cbo.select_option(f"number:{prof['cbo']}")
        except Exception:
            valor = None
            for opt in cbo.locator("option").all():
                if (opt.inner_text() or "").strip().startswith(prof["cbo"]):
                    valor = opt.get_attribute("value")
                    break
            if not valor:
                raise RuntimeError(f"CBO {prof['cbo']} não existe na lista do portal")
            cbo.select_option(valor)

        # dados do atendente (obrigatórios no portal)
        self._campo_livre(page, "Telefone (com DDD)", self.cfg["TELEFONE_ATENDENTE"], so_digitos=True)
        self._campo_livre(page, "E-Mail do Atendente", self.cfg["EMAIL_ATENDENTE"])
        nome_at = page.get_by_role("textbox", name=re.compile(r"Nome do Atendente"))
        if nome_at.input_value().strip() != self.cfg["NOME_ATENDENTE"]:
            nome_at.fill(self.cfg["NOME_ATENDENTE"])
        self._proximo(page, 3)

    @staticmethod
    def _lixeiras(page):
        return page.locator(".fa-trash:visible, .fa-trash-o:visible, .glyphicon-trash:visible")

    def _passo3(self, page, cid, itens, observacao):
        from playwright.sync_api import expect
        # condição de atendimento (obrigatória em alguns pacientes)
        cond = (self.cfg.get("CONDICAO_ATENDIMENTO") or "Paciente no local").strip()
        label, grupo = self._grupo(page, "Condição Atendimento")
        atual = " ".join(self._texto_campo(grupo, label).replace("×", " ").split()).lower()
        if atual != cond.lower():
            self._escolher_lista(page, "Condição Atendimento", cond)
        page.get_by_role("textbox", name="Indicação Clínica").fill(cid)
        for codigo, qtd in itens:
            antes = self._lixeiras(page).count()
            campo = page.get_by_role("textbox", name="Procedimento ou Item")
            campo.fill(codigo)
            self._lupa(campo)
            try:
                expect(self._lixeiras(page)).to_have_count(antes + 1, timeout=20000)
            except AssertionError:
                raise RuntimeError(f"terapia {codigo} não foi adicionada (código não encontrado?)")
            linha = self._lixeiras(page).nth(antes).locator("xpath=ancestor::*[.//input][1]")
            conteudo = linha.inner_text() + " ".join(i.input_value() for i in linha.locator("input").all())
            if codigo not in conteudo:
                self.log(f"   aviso: não confirmei o código {codigo} na linha adicionada, confira no resumo", "aviso")
            q = linha.locator("input:not([readonly]):not([disabled])").last
            q.fill(str(qtd))
            q.press("Tab")
        if observacao:
            page.get_by_role("textbox", name=re.compile(r"Observação")).fill(observacao)
        self._proximo(page, 4)

    def _passo5(self, page, arquivo):
        from playwright.sync_api import expect
        if not arquivo.exists():
            raise RuntimeError("arquivo do laudo não encontrado")

        # 1) abre a janela de anexo pelo "+ Incluir" da linha "Documento" (não o menu "Documentos" da lateral)
        abriu = False
        candidatos = [
            page.locator("a:visible, button:visible").filter(has_text=re.compile(r"^\s*Documento\W*Incluir\s*$", re.I)),
            page.locator(":is(.panel-heading, .panel-title, .card-header, h4, h5, div):visible")
                .filter(has_text=re.compile(r"^\s*Documento\W*Incluir\s*$", re.I))
                .locator("a:visible, button:visible, span:visible").filter(has_text=re.compile(r"Incluir", re.I)),
            page.get_by_text(re.compile(r"^\s*Documento\s*$")).locator(
                "xpath=following::*[self::a or self::button or self::span][contains(., 'Incluir')][1]"),
        ]
        for c in candidatos:
            try:
                if c.count():
                    c.last.click(timeout=5000)
                    page.locator(".modal:visible").filter(has_text=re.compile(r"Anexo", re.I)).first \
                        .wait_for(state="visible", timeout=8000)
                    abriu = True
                    break
            except Exception:
                continue
        if not abriu:
            raise RuntimeError("não consegui abrir o 'Documento + Incluir' do passo 5")
        modal = page.locator(".modal:visible").filter(has_text=re.compile(r"Anexo", re.I)).first
        page.wait_for_timeout(600)

        # 2) clica na área "Clique aqui ou arraste um arquivo" e entrega o laudo direto
        #    (o robô intercepta a janela de escolher arquivo, ela não chega a abrir)
        area = modal.locator(".anexo-dropzone, .dropzone, .dz-clickable").first
        if not area.count():
            area = modal.get_by_text(re.compile(r"Clique aqui ou arraste", re.I)).first
        try:
            with page.expect_file_chooser(timeout=10000) as fc:
                area.click()
            fc.value.set_files(str(arquivo))
        except Exception:
            # plano B: manda o arquivo no campo escondido que a área usa
            page.locator('input[type="file"]').last.set_input_files(str(arquivo))
        page.wait_for_timeout(1000)

        # 3) tipo do documento (a lista aparece depois que o arquivo entra)
        tipo = self.cfg["TIPO_DOCUMENTO_ANEXO"]
        sel = modal.locator("select:visible")
        try:
            sel.first.wait_for(state="visible", timeout=15000)
        except Exception:
            raise RuntimeError("o arquivo foi enviado mas a lista de tipo de documento não apareceu")
        try:
            sel.first.select_option(tipo)
        except Exception:
            try:
                sel.first.select_option(label=tipo)
            except Exception:
                raise RuntimeError(f"não encontrei o tipo de documento '{tipo}' na janela de anexo")
        page.wait_for_timeout(500)
        escopo = modal

        # 4) Incluir e conferir que a janela fechou
        incluir = escopo.get_by_role("button", name=re.compile(r"^\s*Incluir\s*$"))
        incluir.first.click()
        try:
            expect(incluir.first).to_be_hidden(timeout=self.timeout)
        except AssertionError:
            alerta = self._alerta(page)
            raise RuntimeError("o portal não aceitou o anexo" + (f": {alerta}" if alerta else ""))
        page.wait_for_timeout(800)

        self._proximo(page)
        try:
            expect(page.get_by_role("button", name=re.compile(r"Autorizar"))).to_be_visible(timeout=self.timeout)
        except AssertionError:
            alerta = self._alerta(page)
            raise RuntimeError("o portal não abriu o resumo depois do anexo" + (f": {alerta}" if alerta else ""))

    def _autorizar(self, page):
        page.get_by_role("button", name=re.compile(r"Autorizar")).click()
        st = page.get_by_text(re.compile(r"em an[áa]lise|autorizad|negad|pendente|cancelad", re.I)).first
        st.wait_for(timeout=self.timeout)
        return st.inner_text().strip()
