"use client";

import { useEffect, useState, useCallback } from "react";

type Tone = "profissional" | "amigavel" | "formal" | "empatico";

type BotConfig = {
  enabled: boolean;
  context: string;
  tone: Tone;
};

type PhoneEntry = {
  id: string;
  displayNumber: string;
  wabaId: string;
  bot: BotConfig;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
};

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: "profissional", label: "Profissional", description: "Objetivo e eficiente, mantendo respeito." },
  { value: "amigavel",     label: "Amigável",     description: "Caloroso e próximo, como um atendente simpático." },
  { value: "formal",       label: "Formal",        description: "Linguagem formal e respeitosa, mais conservador." },
  { value: "empatico",     label: "Empático",      description: "Acolhedor e compreensivo, ideal para saúde ou suporte." },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const textareaCls =
  "w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors resize-none leading-relaxed";

const selectCls =
  "w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-colors appearance-none cursor-pointer";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-brand-500" : "bg-slate-200 dark:bg-dark-600"
      }`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export default function AutomationPage() {
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/api/v1/tenants/phone-numbers");
      setPhones(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((p: any) => ({
          id:            p.id,
          displayNumber: p.display_number,
          wabaId:        p.waba_id,
          bot: {
            enabled: p.bot.enabled,
            context: p.bot.context,
            tone:    p.bot.tone as Tone,
          },
          dirty:  false,
          saving: false,
          saved:  false,
        }))
      );
    } catch {
      setError("Não foi possível carregar os números. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateBot = (id: string, patch: Partial<BotConfig>) => {
    setPhones((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, bot: { ...p.bot, ...patch }, dirty: true, saved: false } : p
      )
    );
  };

  const toggleEnabled = async (id: string) => {
    const phone = phones.find((p) => p.id === id)!;
    const next = !phone.bot.enabled;
    updateBot(id, { enabled: next });
    if (next && expanded !== id) setExpanded(id);
    // Persist toggle immediately
    try {
      await apiFetch(`/api/v1/tenants/phone-numbers/${id}/bot`, {
        method: "PATCH",
        body: JSON.stringify({ bot_enabled: next }),
      });
    } catch {
      // Revert on failure
      updateBot(id, { enabled: !next });
    }
  };

  const save = async (id: string) => {
    const phone = phones.find((p) => p.id === id)!;
    setPhones((prev) => prev.map((p) => p.id === id ? { ...p, saving: true } : p));
    try {
      await apiFetch(`/api/v1/tenants/phone-numbers/${id}/bot`, {
        method: "PATCH",
        body: JSON.stringify({
          bot_enabled: phone.bot.enabled,
          bot_context: phone.bot.context,
          bot_tone:    phone.bot.tone,
        }),
      });
      setPhones((prev) =>
        prev.map((p) => p.id === id ? { ...p, saving: false, dirty: false, saved: true } : p)
      );
      setTimeout(() => {
        setPhones((prev) => prev.map((p) => p.id === id ? { ...p, saved: false } : p));
      }, 3000);
    } catch {
      setPhones((prev) => prev.map((p) => p.id === id ? { ...p, saving: false } : p));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Automação com IA</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure o assistente virtual Claude para responder automaticamente às mensagens dos seus números.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 bg-brand-500/5 border border-brand-500/15 rounded-2xl px-5 py-4">
        <div className="flex-shrink-0 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white">Como funciona</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Quando ativado, o bot responde automaticamente às novas mensagens recebidas neste número.
            Novas conversas entram no modo <strong className="text-slate-700 dark:text-slate-300">BOT</strong>.
            Você pode transferir para atendimento humano a qualquer momento alterando o status da conversa.
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card rounded-2xl p-8 flex items-center justify-center gap-3 text-slate-400">
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span className="text-sm">Carregando números...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-5 flex items-center gap-3 border border-red-200 dark:border-red-500/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="text-sm text-slate-700 dark:text-slate-300">{error}</span>
          <button onClick={load} className="ml-auto text-xs text-brand-500 hover:text-brand-600 font-medium">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Phone cards */}
      {!loading && !error && (
        <div className="space-y-4">
          {phones.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center space-y-2">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhum número vinculado.</p>
              <p className="text-xs text-slate-400">
                Adicione um número em{" "}
                <a href="/dashboard/phones" className="text-brand-500 hover:underline">Números de Telefone</a>{" "}
                para configurar o bot.
              </p>
            </div>
          )}

          {phones.map((ph) => {
            const isExpanded = expanded === ph.id;

            return (
              <div key={ph.id} className="glass-card rounded-2xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.21 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white font-medium">{ph.displayNumber}</p>
                    <p className="text-xs text-slate-500 truncate">WABA ID: {ph.wabaId}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                        {ph.bot.enabled ? "Bot ativo" : "Bot inativo"}
                      </span>
                      <Toggle checked={ph.bot.enabled} onChange={() => toggleEnabled(ph.id)} />
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : ph.id)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
                    >
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded config */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-dark-700/40 px-5 pb-5 pt-5 space-y-5">

                    {/* Status indicator */}
                    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl w-fit ${
                      ph.bot.enabled
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
                        : "bg-slate-100 dark:bg-dark-700/50 text-slate-500 border border-slate-200 dark:border-dark-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ph.bot.enabled ? "bg-brand-400 pulse-dot" : "bg-slate-400 dark:bg-slate-600"}`} />
                      {ph.bot.enabled
                        ? "Respondendo automaticamente"
                        : "Bot desativado — mensagens não são respondidas automaticamente"}
                    </div>

                    {/* Tone selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Tom de resposta
                      </label>
                      <div className="relative">
                        <select
                          value={ph.bot.tone}
                          onChange={(e) => updateBot(ph.id, { tone: e.target.value as Tone })}
                          className={selectCls}
                        >
                          {TONES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {TONES.find((t) => t.value === ph.bot.tone)?.description}
                      </p>
                    </div>

                    {/* Company context */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Contexto da empresa
                      </label>
                      <textarea
                        rows={6}
                        value={ph.bot.context}
                        onChange={(e) => updateBot(ph.id, { context: e.target.value })}
                        placeholder={`Descreva sua empresa para o bot entender o contexto. Exemplos:\n\n• Nome e segmento: "Somos a Clínica Zion, especializada em odontologia estética."\n• Serviços: "Oferecemos clareamento, implantes, ortodontia e limpeza."\n• Horário de atendimento: "Funcionamos de seg a sex, das 8h às 18h."\n• Agendamento: "Agende pelo site clinicazion.com.br ou ligue (11) 1234-5678."\n• Regras do bot: "Nunca informe preços. Se o cliente perguntar sobre valores, diga que nossa equipe entrará em contato."`}
                        className={textareaCls}
                      />
                    </div>

                    {/* Save section */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2 min-h-[20px]">
                        {ph.saved && (
                          <span className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Configurações salvas
                          </span>
                        )}
                        {ph.dirty && !ph.saved && (
                          <span className="text-xs text-slate-400">Alterações não salvas</span>
                        )}
                      </div>
                      <button
                        onClick={() => save(ph.id)}
                        disabled={!ph.dirty || ph.saving}
                        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {ph.saving ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                          </svg>
                        )}
                        {ph.saving ? "Salvando..." : "Salvar configurações"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help card */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">Dicas para um bot eficiente</p>
        </div>
        <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0">•</span>
            <span>Quanto mais contexto você fornecer, mais preciso e útil será o bot.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0">•</span>
            <span>Inclua perguntas frequentes dos seus clientes para que o bot as responda automaticamente.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0">•</span>
            <span>Use o campo de contexto para definir limites claros — o que o bot deve e não deve responder.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0">•</span>
            <span>Você pode pausar o bot a qualquer momento desativando o toggle no número desejado.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
