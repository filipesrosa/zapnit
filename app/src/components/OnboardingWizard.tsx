"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface MeResponse {
  name: string;
  tenant: { phone_numbers_count: number } | null;
}

const STORAGE_KEY = "onboarding_dismissed";

export default function OnboardingWizard() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [connectionMode, setConnectionMode] = useState<"qr" | "waba" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) return;

    apiFetch<MeResponse>("/auth/me").then((data) => {
      if (!data.tenant || data.tenant.phone_numbers_count === 0) {
        setShow(true);
      }
    }).catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const goToPhones = () => {
    dismiss();
    router.push("/dashboard/phones");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-dark-700/50">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-brand-500 w-6" : "bg-slate-200 dark:bg-dark-700 w-3"
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Boas-vindas ao Zapnit!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Vamos configurar seu número WhatsApp em menos de 2 minutos. Você pode pular e fazer isso depois.
                </p>
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2"><span className="text-brand-500 font-bold">1.</span> Escolha como conectar seu WhatsApp</div>
                <div className="flex items-center gap-2"><span className="text-brand-500 font-bold">2.</span> Escaneie o QR code ou insira credenciais WABA</div>
                <div className="flex items-center gap-2"><span className="text-brand-500 font-bold">3.</span> Comece a enviar mensagens</div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                  Começar configuração
                </button>
                <button onClick={dismiss} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
                  Depois
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Como você quer conectar?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Escolha o método mais adequado para o seu caso.</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setConnectionMode("qr")}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    connectionMode === "qr"
                      ? "border-brand-500 bg-brand-500/5"
                      : "border-slate-200 dark:border-dark-700 hover:border-brand-400"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📱</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">QR Code (Baileys)</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Conecte qualquer número escaneando um QR code. Ideal para começar rápido e para uso pessoal/desenvolvedor.
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setConnectionMode("waba")}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    connectionMode === "waba"
                      ? "border-brand-500 bg-brand-500/5"
                      : "border-slate-200 dark:border-dark-700 hover:border-brand-400"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🏢</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp Business API (WABA)</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        API oficial da Meta. Requer conta Business verificada. Recomendado para uso em produção.
                      </div>
                    </div>
                  </div>
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(3)}
                  disabled={!connectionMode}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  Continuar
                </button>
                <button onClick={() => setStep(1)} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
                  Voltar
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tudo pronto para conectar!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {connectionMode === "qr"
                    ? "Na próxima tela, clique em \"Nova conexão QR\" e escaneie o código com seu WhatsApp."
                    : "Na próxima tela, vá até a aba \"WABA\" e insira as credenciais da sua conta Meta Business."}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p>💡 Após conectar, você poderá:</p>
                <p>• Enviar e receber mensagens via API</p>
                <p>• Ativar o bot de IA para responder automaticamente</p>
                <p>• Configurar webhooks para integrar com seus sistemas</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={goToPhones} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                  Ir para Números
                </button>
                <button onClick={dismiss} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
                  Depois
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
