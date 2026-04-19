"use client";

import { useState } from "react";

type Department = {
  id: string;
  name: string;
  responsible: string;
  members: number;
  active: boolean;
};

const initial: Department[] = [
  { id: "1", name: "Recepção", responsible: "Ana Lima", members: 3, active: true },
  { id: "2", name: "Consultório A", responsible: "Dr. Carlos Melo", members: 2, active: true },
  { id: "3", name: "Consultório B", responsible: "Dra. Fernanda Costa", members: 2, active: true },
  { id: "4", name: "Financeiro", responsible: "Marcos Silva", members: 1, active: false },
];

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${active ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" : "bg-slate-100 dark:bg-dark-600/50 text-slate-500 border border-slate-200 dark:border-dark-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-brand-400" : "bg-slate-400 dark:bg-slate-600"}`} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

const inputCls = "w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", responsible: "" });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", responsible: "" });
    setModalOpen(true);
  };

  const openEdit = (dep: Department) => {
    setEditTarget(dep);
    setForm({ name: dep.name, responsible: dep.responsible });
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.name.trim() || !form.responsible.trim()) return;
    if (editTarget) {
      setDepartments((prev) =>
        prev.map((d) => d.id === editTarget.id ? { ...d, name: form.name, responsible: form.responsible } : d)
      );
    } else {
      setDepartments((prev) => [
        ...prev,
        { id: String(Date.now()), name: form.name, responsible: form.responsible, members: 0, active: true },
      ]);
    }
    setModalOpen(false);
  };

  const toggle = (id: string) =>
    setDepartments((prev) => prev.map((d) => d.id === id ? { ...d, active: !d.active } : d));

  const actionBtn = "text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Departamentos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Organize sua equipe em departamentos.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green-sm flex-shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          Novo Departamento
        </button>
      </div>

      {/* Desktop table */}
      <div className="glass-card rounded-2xl overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-dark-700/50 bg-slate-50/50 dark:bg-transparent">
              {["Nome", "Responsável", "Membros", "Status", ""].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700/30">
            {departments.map((dep) => (
              <tr key={dep.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors">
                <td className="px-5 py-3.5 text-slate-900 dark:text-white font-medium">{dep.name}</td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{dep.responsible}</td>
                <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{dep.members}</td>
                <td className="px-5 py-3.5"><Badge active={dep.active} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(dep)} className={actionBtn} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => toggle(dep.id)} className={actionBtn} title={dep.active ? "Desativar" : "Ativar"}>
                      {dep.active ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {departments.map((dep) => (
          <div key={dep.id} className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-slate-900 dark:text-white font-medium">{dep.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{dep.responsible}</p>
              </div>
              <Badge active={dep.active} />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-dark-700/30">
              <span>{dep.members} {dep.members === 1 ? "membro" : "membros"}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(dep)} className={actionBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => toggle(dep.id)} className={actionBtn}>
                  {dep.active ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card border border-slate-200 dark:border-dark-600/60 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
                {editTarget ? "Editar Departamento" : "Novo Departamento"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Nome do departamento</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Recepção" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Responsável</label>
                <input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Nome do responsável" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-dark-700/60 text-sm py-2.5 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!form.name.trim() || !form.responsible.trim()}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {editTarget ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
