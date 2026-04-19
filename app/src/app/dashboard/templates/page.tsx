"use client";

import { useState } from "react";

type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED";
type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  status: TemplateStatus;
  createdAt: string;
};

const initial: Template[] = [
  {
    id: "t1",
    name: "lembrete_consulta",
    category: "UTILITY",
    language: "pt_BR",
    body: "Olá {{1}}! Lembramos que sua consulta está agendada para {{2}} às {{3}}. Confirme sua presença respondendo SIM ou ligue para nós.",
    status: "APPROVED",
    createdAt: "2026-02-10",
  },
  {
    id: "t2",
    name: "boas_vindas_novo_paciente",
    category: "MARKETING",
    language: "pt_BR",
    body: "Bem-vindo(a) à Zion Clínica, {{1}}! Estamos felizes em tê-lo(a) conosco. Para agendar sua primeira consulta, é só responder esta mensagem.",
    status: "APPROVED",
    createdAt: "2026-02-15",
  },
  {
    id: "t3",
    name: "promocao_check_up",
    category: "MARKETING",
    language: "pt_BR",
    body: "{{1}}, chegou a hora do seu check-up anual! Temos condições especiais esse mês. Agende agora e ganhe 10% de desconto.",
    status: "PENDING",
    createdAt: "2026-03-28",
  },
  {
    id: "t4",
    name: "codigo_verificacao",
    category: "AUTHENTICATION",
    language: "pt_BR",
    body: "Seu código de verificação é {{1}}. Válido por 10 minutos. Não compartilhe com ninguém.",
    status: "REJECTED",
    createdAt: "2026-03-30",
  },
];

const categoryLabels: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

const categoryColors: Record<TemplateCategory, string> = {
  MARKETING: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  UTILITY: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  AUTHENTICATION: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

const statusConfig: Record<TemplateStatus, { label: string; color: string; dot: string }> = {
  APPROVED: { label: "Aprovado", color: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20", dot: "bg-brand-400" },
  PENDING: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  REJECTED: { label: "Rejeitado", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: TemplateStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "PENDING" ? "pulse-dot" : ""}`} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: TemplateCategory }) {
  return (
    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[category]}`}>
      {categoryLabels[category]}
    </span>
  );
}

function BodyPreview({ body }: { body: string }) {
  const parts = body.split(/({{[0-9]+}})/g);
  return (
    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      {parts.map((part, i) =>
        /^{{[0-9]+}}$/.test(part) ? (
          <span key={i} className="bg-brand-500/20 text-brand-600 dark:text-brand-300 px-1 rounded font-mono text-xs">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

type FormData = { name: string; category: TemplateCategory; language: string; body: string };
const emptyForm: FormData = { name: "", category: "UTILITY", language: "pt_BR", body: "" };

const inputCls = "w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [preview, setPreview] = useState<Template | null>(null);

  const submit = () => {
    if (!form.name.trim() || !form.body.trim()) return;
    const t: Template = {
      id: `t${Date.now()}`,
      name: form.name.toLowerCase().replace(/\s+/g, "_"),
      category: form.category,
      language: form.language,
      body: form.body,
      status: "PENDING",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setTemplates((p) => [t, ...p]);
    setForm(emptyForm);
    setDrawerOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Templates de Mensagem</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Templates aprovados pela Meta para envio em massa.</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green-sm flex-shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          Novo Template
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {(["APPROVED", "PENDING", "REJECTED"] as TemplateStatus[]).map((s) => (
          <div key={s} className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{templates.filter((t) => t.status === s).length}</p>
            <div className="mt-1.5 flex justify-center"><StatusBadge status={s} /></div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="glass-card rounded-2xl overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-dark-700/50 bg-slate-50/50 dark:bg-transparent">
              {["Nome", "Categoria", "Idioma", "Status", "Criado em", ""].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700/30">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                <td className="px-5 py-3.5">
                  <code className="text-slate-800 dark:text-white font-mono text-xs bg-slate-100 dark:bg-dark-700/60 px-2 py-1 rounded">{t.name}</code>
                </td>
                <td className="px-5 py-3.5"><CategoryBadge category={t.category} /></td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">{t.language}</td>
                <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{t.createdAt}</td>
                <td className="px-5 py-3.5">
                  <button onClick={() => setPreview(t)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 px-2 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors">
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <code className="text-slate-800 dark:text-white font-mono text-xs bg-slate-100 dark:bg-dark-700/60 px-2 py-1 rounded">{t.name}</code>
              <StatusBadge status={t.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={t.category} />
              <span className="text-xs text-slate-500 py-1">{t.language}</span>
            </div>
            <div className="pt-1 border-t border-slate-100 dark:border-dark-700/30 flex items-center justify-between">
              <span className="text-xs text-slate-400">{t.createdAt}</span>
              <button onClick={() => setPreview(t)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 px-2 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors">
                Ver preview
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative flex flex-col bg-white dark:bg-dark-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-dark-700/50 w-full md:w-[420px] h-[90vh] md:h-full shadow-2xl overflow-y-auto rounded-t-2xl md:rounded-none">
            <div className="md:hidden w-10 h-1 bg-slate-200 dark:bg-dark-600 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-dark-700/50 flex-shrink-0">
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg">Novo Template</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Nome do template</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: lembrete_consulta" className={`${inputCls} font-mono`} />
                <p className="text-xs text-slate-400 mt-1">Apenas letras minúsculas, números e underscores.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })} className={selectCls}>
                    <option value="UTILITY">Utilidade</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Autenticação</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Idioma</label>
                  <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={selectCls}>
                    <option value="pt_BR">Português (BR)</option>
                    <option value="en_US">English (US)</option>
                    <option value="es_AR">Español (AR)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Corpo da mensagem
                  <span className="text-slate-400 font-normal ml-1.5">— use {"{{"} 1 {"}}"}, {"{{"} 2 {"}}"} para variáveis</span>
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={5}
                  placeholder="Olá {{1}}, sua consulta está confirmada para {{2}}."
                  className={`${inputCls} resize-none`}
                />
                <p className="text-xs text-slate-400 mt-1">{form.body.length} caracteres</p>
              </div>

              {form.body && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Preview</p>
                  <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-4 border border-slate-100 dark:border-dark-600/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#22c55e" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-white font-medium">Zion Clínica</p>
                    </div>
                    <div className="bg-[#005C4B] rounded-2xl rounded-bl-sm px-3 py-2.5 max-w-[85%]">
                      <BodyPreview body={form.body} />
                      <p className="text-[10px] text-green-200/60 mt-1.5 text-right">agora ✓✓</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-700/50 flex gap-3 flex-shrink-0">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-dark-700/60 text-sm py-2.5 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!form.name.trim() || !form.body.trim()}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Enviar para aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative glass-card border border-slate-200 dark:border-dark-600/60 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <code className="text-xs text-slate-500 font-mono">{preview.name}</code>
                <div className="flex items-center gap-2 mt-1">
                  <CategoryBadge category={preview.category} />
                  <StatusBadge status={preview.status} />
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-4 border border-slate-100 dark:border-dark-600/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#22c55e" />
                  </svg>
                </div>
                <p className="text-xs text-slate-700 dark:text-white font-medium">Zion Clínica</p>
              </div>
              <div className="bg-[#005C4B] rounded-2xl rounded-bl-sm px-3 py-2.5 max-w-[90%]">
                <BodyPreview body={preview.body} />
                <p className="text-[10px] text-green-200/60 mt-1.5 text-right">agora ✓✓</p>
              </div>
            </div>
            {preview.status === "REJECTED" && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 text-xs text-red-600 dark:text-red-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Template rejeitado pela Meta. Revise o conteúdo e reenvie.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
