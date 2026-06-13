"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface MeResponse {
  id: string;
  name: string;
  email: string;
  clientToken: string;
  tenant: {
    id: string;
    name: string;
    client_id: string;
    plan: { id: string; name: string; slug: string; price: string };
    quota: { used: number; limit: number; resets_at: string };
    billing: { payment_status: string | null; billing_cycle_end: string | null };
    phone_numbers_count: number;
  } | null;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors px-2 py-1 rounded-lg hover:bg-brand-500/10"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          Copiado
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          Copiar
        </>
      )}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-4 border-b border-slate-100 dark:border-dark-700/50 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium flex-shrink-0 sm:w-40">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="py-4 border-b border-slate-100 dark:border-dark-700/50 last:border-0">
      <div className="h-4 bg-slate-200 dark:bg-dark-700 rounded animate-pulse w-1/2" />
    </div>
  );
}

export default function CompanyPage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<MeResponse>("/auth/me")
      .then((res) => {
        setData(res);
        setDraft(res.name);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!data || !draft.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: draft.trim() }),
      });
      setData((prev) => prev ? { ...prev, name: draft.trim(), tenant: prev.tenant ? { ...prev.tenant, name: draft.trim() } : null } : prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const tenant = data?.tenant;
  const quota = tenant?.quota;
  const quotaPct = quota ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const quotaColor = quotaPct >= 90 ? "bg-red-500" : quotaPct >= 70 ? "bg-yellow-500" : "bg-brand-500";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Informações da Empresa</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os dados do seu negócio na plataforma.</p>
      </div>

      <div className="glass-card rounded-2xl p-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (
          <>
            <InfoRow label="Nome da empresa">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="flex-1 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white outline-none transition-colors"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => { setDraft(data?.name ?? ""); setEditing(false); }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-slate-900 dark:text-white font-medium">{data?.name}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              )}
            </InfoRow>

            <InfoRow label="Client ID">
              <div className="flex items-center gap-2">
                <code className="text-sm text-brand-500 dark:text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg font-mono">
                  {tenant?.client_id ?? "—"}
                </code>
                {tenant?.client_id && <CopyButton value={tenant.client_id} />}
              </div>
            </InfoRow>

            <InfoRow label="Plano atual">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white bg-brand-500/10 border border-brand-500/25 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  {tenant?.plan.name ?? "—"}
                </span>
                <Link href="/dashboard/billing" className="text-xs text-brand-500 hover:text-brand-600 transition-colors">
                  Ver planos
                </Link>
              </div>
            </InfoRow>

            <InfoRow label="E-mail">
              <span className="text-sm text-slate-900 dark:text-white">{data?.email}</span>
            </InfoRow>
          </>
        )}
      </div>

      {/* Quota card */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 dark:text-white font-medium">Uso de mensagens</h3>
            {quota && (
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Reset em {new Date(quota.resets_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-slate-200 dark:bg-dark-700 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {quotaPct}<span className="text-sm font-normal text-slate-400">%</span>
            </span>
          )}
        </div>

        <div className="w-full h-2.5 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${quotaColor}`}
            style={{ width: loading ? "0%" : `${quotaPct}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          {loading ? (
            <div className="h-3 w-32 bg-slate-200 dark:bg-dark-700 rounded animate-pulse" />
          ) : (
            <>
              <span><span className="text-slate-900 dark:text-white font-medium">{(quota?.used ?? 0).toLocaleString("pt-BR")}</span> usadas</span>
              <span>limite: <span className="text-slate-900 dark:text-white font-medium">{(quota?.limit ?? 0).toLocaleString("pt-BR")}</span></span>
            </>
          )}
        </div>

        {!loading && quotaPct >= 80 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Você está usando {quotaPct}% da sua quota.{" "}
            <Link href="/dashboard/billing" className="underline">Fazer upgrade</Link>
          </div>
        )}
      </div>
    </div>
  );
}
