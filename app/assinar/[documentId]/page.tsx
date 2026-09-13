"use client";

import { useEffect, useState, use } from "react";
import { 
  FileText, 
  ShieldCheck, 
  Smartphone, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  Lock, 
  Sparkles,
  ArrowRight,
  Download
} from "lucide-react";
import {
  getDocumentForSignature,
  sendSignatureOtpCode,
  confirmDocumentSignature,
  sendSignedDocumentEmail,
  type DocumentSignatureData,
} from "./signature-actions";

export default function DocumentSignaturePage({
  params: paramsPromise,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(paramsPromise);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docData, setDocData] = useState<DocumentSignatureData | null>(null);

  // Form states
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signerPhone, setSignerPhone] = useState("");

  // OTP states
  const [otpStep, setOtpStep] = useState<"initial" | "sent" | "confirmed">("initial");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Signature Result
  const [signatureResult, setSignatureResult] = useState<{
    signedAt: string;
    documentHash: string;
    validationCode: string;
  } | null>(null);

  // Email state
  const [emailInput, setEmailInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoc() {
      setLoading(true);
      const res = await getDocumentForSignature(documentId);
      if (!res.success || !res.data) {
        setError(res.error || "Não foi possível carregar o documento.");
      } else {
        setDocData(res.data);
        if (res.data.guardianName) setSignerName(res.data.guardianName);
        if (res.data.guardianCpf) setSignerCpf(res.data.guardianCpf);
        if (res.data.guardianPhone) setSignerPhone(res.data.guardianPhone);

        if (res.data.isSigned && res.data.signatureDetails) {
          setOtpStep("confirmed");
          setSignatureResult({
            signedAt: res.data.signatureDetails.signedAt,
            documentHash: res.data.signatureDetails.documentHash,
            validationCode: res.data.signatureDetails.validationCode,
          });
          if (res.data.signatureDetails.emailSentTo) {
            setEmailSuccess(`Cópia enviada para ${res.data.signatureDetails.emailSentTo}`);
          }
        }
      }
      setLoading(false);
    }
    loadDoc();
  }, [documentId]);

  // Disparar código OTP via SMS/WhatsApp
  const handleRequestOtp = async () => {
    if (!signerName.trim()) {
      setOtpError("Por favor, preencha o nome completo do responsável.");
      return;
    }
    if (!signerCpf.trim() || signerCpf.replace(/\D/g, "").length !== 11) {
      setOtpError("Informe um CPF válido com 11 dígitos.");
      return;
    }
    if (!signerPhone.trim()) {
      setOtpError("Informe um telefone de celular válido para receber o SMS.");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    const res = await sendSignatureOtpCode(signerPhone);
    setOtpLoading(false);

    if (!res.success) {
      setOtpError(res.error || "Falha ao enviar código OTP. Verifique o telefone.");
    } else {
      setOtpStep("sent");
      setOtpMessage(res.message || "Código enviado com sucesso! Verifique seu SMS/WhatsApp.");
    }
  };

  // Confirmar OTP de 6 dígitos
  const handleConfirmSignature = async () => {
    if (otpCode.trim().length !== 6) {
      setOtpError("Digite os 6 dígitos do código de verificação recebido.");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    const res = await confirmDocumentSignature({
      documentId,
      rawPhone: signerPhone,
      otpCode,
      signerName,
      signerCpf,
    });

    setOtpLoading(false);

    if (!res.success || !res.signatureDetails) {
      setOtpError(res.error || "Código de verificação incorreto ou expirado.");
    } else {
      setOtpStep("confirmed");
      setSignatureResult(res.signatureDetails);
    }
  };

  // Enviar e-mail ao pressionar Enter ou clicar no botão
  const handleSendEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!emailInput.trim() || !emailInput.includes("@")) {
      setEmailError("Digite um e-mail válido.");
      return;
    }

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(null);

    const res = await sendSignedDocumentEmail({
      documentId,
      recipientEmail: emailInput,
      signerName: signerName || "Responsável Legal",
      patientName: docData?.patientName || "Paciente",
    });

    setEmailLoading(false);

    if (!res.success) {
      setEmailError(res.error || "Não foi possível enviar o e-mail no momento.");
    } else {
      setEmailSuccess(res.message || `Cópia enviada com sucesso para ${emailInput}!`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-300 font-medium text-lg">Carregando documento da clínica...</p>
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800/80 border border-rose-500/30 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <AlertCircle className="w-14 h-14 text-rose-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-rose-200">Documento Indisponível</h2>
          <p className="text-slate-300 mb-6">{error || "Não foi possível localizar o termo solicitado."}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium px-5 py-2.5 rounded-xl transition"
          >
            Voltar ao Início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-16">
      {/* Header Institucional Faça Amigos */}
      <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b border-emerald-900/40 sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
                Clínica Faça Amigos
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                  Portal Seguro
                </span>
              </h1>
              <p className="text-xs text-slate-400">Assinatura Eletrônica de Documentos Terapêuticos</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            <span>Autenticação OTP SMS/WhatsApp</span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 pt-8">
        {/* Banner do Paciente */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block bg-teal-500/10 text-teal-300 text-xs font-semibold px-3 py-1 rounded-md border border-teal-500/20 uppercase tracking-wider mb-2">
                {docData.category}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {docData.title}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Paciente: <strong className="text-slate-200">{docData.patientName}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
              <p className="text-xs text-slate-400">Data de Emissão</p>
              <p className="text-sm font-semibold text-slate-200">
                {new Date(docData.uploadedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </div>

        {/* Leitor de Documento / Termo */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="bg-slate-800/60 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Conteúdo do Termo de Consentimento</span>
            </div>
            <span className="text-xs text-slate-400">Role para ler na íntegra</span>
          </div>

          <div className="p-6 max-h-[380px] overflow-y-auto font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap selection:bg-emerald-500/30 selection:text-emerald-200">
            {docData.content}
          </div>
        </div>

        {/* ÁREA DE ASSINATURA ELETRÔNICA */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/95 border border-emerald-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* CASO 1: AINDA NÃO ASSINADO - PREENCHIMENTO E OTP */}
          {otpStep !== "confirmed" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Assinar Eletronicamente</h3>
                  <p className="text-xs text-slate-400">
                    Insira os dados do responsável legal para receber o código de confirmação no celular.
                  </p>
                </div>
              </div>

              {otpError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-4 rounded-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>{otpError}</div>
                </div>
              )}

              {/* Formulário de Identificação do Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome Completo do Responsável *
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Ex: Maria da Silva"
                    disabled={otpStep === "sent"}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    CPF do Responsável *
                  </label>
                  <input
                    type="text"
                    value={signerCpf}
                    onChange={(e) => setSignerCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    disabled={otpStep === "sent"}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Celular (SMS / WhatsApp) *
                  </label>
                  <input
                    type="text"
                    value={signerPhone}
                    onChange={(e) => setSignerPhone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    disabled={otpStep === "sent"}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition"
                  />
                </div>
              </div>

              {/* Botão de Solicitação do OTP */}
              {otpStep === "initial" && (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {otpLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Gerando código de verificação...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Código de Confirmação no Celular</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}

              {/* Etapa 2: Inserção do Código OTP de 6 Dígitos */}
              {otpStep === "sent" && (
                <div className="bg-slate-950 border border-emerald-800/40 p-6 rounded-2xl">
                  {otpMessage && (
                    <p className="text-xs text-emerald-300 mb-4 bg-emerald-950/60 border border-emerald-800/40 p-3 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {otpMessage}
                    </p>
                  )}

                  <label className="block text-sm font-semibold text-slate-200 mb-2">
                    Digite o Código de 6 Dígitos Recebido:
                  </label>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full sm:w-48 bg-slate-900 border border-emerald-500 text-center font-mono text-2xl font-bold tracking-[0.3em] px-4 py-3 rounded-xl text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />

                    <button
                      type="button"
                      onClick={handleConfirmSignature}
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full sm:flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Validando Assinatura...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          <span>Confirmar e Assinar Documento</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => setOtpStep("initial")}
                      className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Alterar dados ou telefone
                    </button>
                    <span>Código expira em 5 minutos</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CASO 2: ASSINATURA CONFIRMADA COM SUCESSO - SELO E OPÇÃO DE E-MAIL */}
          {otpStep === "confirmed" && signatureResult && (
            <div>
              {/* Selo Visual de Validação Jurídica */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-6 rounded-2xl mb-8 relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-200">
                      Documento Assinado com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-400/80">
                      Autenticação válida registrada no Prontuário Único Unificado.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono bg-slate-950/70 p-4 rounded-xl border border-emerald-900/40">
                  <div>
                    <span className="text-slate-400 block">Assinado por:</span>
                    <strong className="text-slate-200 text-sm font-sans">{signerName || docData.guardianName}</strong>
                    <span className="text-slate-400 block mt-1">CPF: {signerCpf || docData.guardianCpf}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Data e Hora exatas:</span>
                    <strong className="text-slate-200 text-sm font-sans">
                      {new Date(signatureResult.signedAt).toLocaleString("pt-BR")}
                    </strong>
                    <span className="text-slate-400 block mt-1">
                      Código: {signatureResult.validationCode}
                    </span>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400 break-all">
                    <span>Hash SHA-256 da Assinatura: </span>
                    <span className="text-emerald-300">{signatureResult.documentHash}</span>
                  </div>
                </div>
              </div>

              {/* OFERECER RECEBIMENTO POR E-MAIL */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-5 h-5 text-teal-400" />
                  <h4 className="text-base font-bold text-white">
                    Deseja receber uma cópia assinada no seu e-mail?
                  </h4>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  Digite seu e-mail abaixo e pressione <kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> para receber o comprovante em PDF imediatamente.
                </p>

                {emailSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{emailSuccess}</span>
                  </div>
                )}

                {emailError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{emailError}</span>
                  </div>
                )}

                <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="seu.email@exemplo.com.br"
                    className="w-full sm:flex-1 bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {emailLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar por E-mail</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
