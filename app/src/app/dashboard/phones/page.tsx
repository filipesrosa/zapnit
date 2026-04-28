"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";
import { getToken, getUser } from "../../../lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "waba" | "qr";

// WABA (Meta official API)
type PhoneNumber = {
  id: string;
  displayNumber: string;
  phoneNumberId: string;
  wabaId: string;
  isActive: boolean;
  webhookVerifyToken: string;
  webhookUrl: string;
};

type FormData = {
  display_number: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
};

// Baileys (QR Code)
type BaileysInstance = {
  id: string;
  status: "disconnected" | "qr" | "connected";
  waNumber: string | null;
  waName: string | null;
  connectedAt: string | null;
  webhookUrl: string | null;
  webhookEvents: string[];
};

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  "messages.upsert": "Mensagem recebida",
  "messages.update": "Status da mensagem",
  "messages.reaction": "Reações",
  "message-receipt.update": "Confirmação de leitura",
  "messages.delete": "Mensagem apagada",
  "presence.update": "Presença (digitando...)",
  "call": "Chamadas",
};


// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const initialWaba: PhoneNumber[] = [
  {
    id: "pn_1",
    displayNumber: "+55 11 91234-5678",
    phoneNumberId: "109876543210001",
    wabaId: "220987654321",
    isActive: true,
    webhookVerifyToken: "vt_Ax9mKpQr3xNwT7vYjL2hZ",
    webhookUrl: "https://api.zapnit.com/webhook/tenant_k8mNpQr3xLwT9vYj",
  },
];

const emptyForm: FormData = {
  display_number: "",
  phone_number_id: "",
  waba_id: "",
  access_token: "",
};

const inputCls =
  "w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors";

// ─── Shared Components ────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors p-1.5 rounded-lg hover:bg-brand-500/10 flex-shrink-0"
      title="Copiar"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QrModal({
  instanceId,
  onClose,
  onConnected,
}: {
  instanceId: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("connecting");

  useEffect(() => {
    const token = getToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const es = new EventSource(`${API}/instances/${instanceId}/events${qs}`);

    es.addEventListener("status", (e) => {
      const { status } = JSON.parse(e.data);
      setStatus(status);
    });

    es.addEventListener("qr", (e) => {
      const { qr } = JSON.parse(e.data);
      setQr(qr);
      setStatus("qr");
    });

    es.addEventListener("connected", () => {
      setStatus("connected");
      es.close();
      setTimeout(() => onConnected(), 1200);
    });

    es.onerror = () => setStatus("error");

    return () => es.close();
  }, [instanceId, onConnected]);

  const statusLabel: Record<string, string> = {
    connecting: "Iniciando conexão...",
    qr: "Escaneie com o WhatsApp",
    connected: "Conectado com sucesso!",
    error: "Erro de conexão. Tente novamente.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-dark-950/85 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative glass-card rounded-2xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-6 border border-dark-600/60">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="#22c55e" strokeWidth="1.8" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="#22c55e" strokeWidth="1.8" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="#22c55e" strokeWidth="1.8" />
                <rect x="15" y="15" width="2" height="2" fill="#22c55e" />
                <rect x="19" y="15" width="2" height="2" fill="#22c55e" />
                <rect x="15" y="19" width="2" height="2" fill="#22c55e" />
                <rect x="19" y="19" width="2" height="2" fill="#22c55e" />
              </svg>
            </div>
            <span className="text-slate-900 dark:text-white font-semibold">QR Code</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR area */}
        <div className="w-56 h-56 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-dark-600">
          {status === "connected" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center glow-green-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-brand-500 dark:text-brand-400 text-sm font-medium">Conectado!</p>
            </div>
          ) : qr ? (
            <img
              src={qr}
              alt="QR Code WhatsApp"
              className="w-full h-full object-contain bg-white p-2"
            />
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-red-400 text-xs">Falha ao conectar</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg
                className="animate-spin"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              <span className="text-slate-500 dark:text-slate-400 text-xs">Gerando QR...</span>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center space-y-1">
          <p className="text-slate-700 dark:text-slate-300 text-sm">
            {statusLabel[status] ?? status}
          </p>
          {status === "qr" && (
            <p className="text-slate-500 dark:text-slate-500 text-xs">
              WhatsApp → Aparelhos conectados → Conectar aparelho
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Baileys Instance Card ────────────────────────────────────────────────────

function InstanceCard({
  instance,
  onDisconnect,
  onWebhookSaved,
}: {
  instance: BaileysInstance;
  onDisconnect: () => void;
  onWebhookSaved: (id: string, url: string | null, events: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState(instance.webhookUrl ?? "");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(instance.webhookEvents ?? []);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const toggleEvent = (ev: string) =>
    setWebhookEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );

  const saveWebhook = async () => {
    if (!webhookUrl || webhookEvents.length === 0) return;
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      await apiFetch(`/instances/${instance.id}/webhook`, {
        method: "PUT",
        body: JSON.stringify({ url: webhookUrl, events: webhookEvents }),
      });
      onWebhookSaved(instance.id, webhookUrl, webhookEvents);
    } catch (e: unknown) {
      setWebhookError(e instanceof Error ? e.message : "Erro ao salvar webhook");
    } finally {
      setSavingWebhook(false);
    }
  };

  const clearWebhook = async () => {
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      await apiFetch(`/instances/${instance.id}/webhook`, { method: "DELETE" });
      setWebhookUrl("");
      setWebhookEvents([]);
      onWebhookSaved(instance.id, null, []);
    } catch (e: unknown) {
      setWebhookError(e instanceof Error ? e.message : "Erro ao remover webhook");
    } finally {
      setSavingWebhook(false);
    }
  };

  const statusConfig = {
    connected: {
      label: "Conectado",
      dot: "bg-brand-400 pulse-dot",
      badge: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    },
    qr: {
      label: "Aguardando QR",
      dot: "bg-amber-400",
      badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    disconnected: {
      label: "Desconectado",
      dot: "bg-slate-400 dark:bg-slate-600",
      badge: "bg-slate-100 dark:bg-dark-600/50 text-slate-500 border-slate-200 dark:border-dark-600",
    },
  };

  const cfg = statusConfig[instance.status];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.21 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-slate-900 dark:text-white font-medium">
              {instance.waNumber ? `+${instance.waNumber}` : `Instância ${instance.id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {instance.waName ?? "Sem nome · Baileys"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-dark-700/40 pt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3.5 space-y-1 border border-slate-100 dark:border-transparent">
              <p className="text-xs text-slate-500">ID da instância</p>
              <div className="flex items-center gap-1">
                <code className="text-xs text-slate-700 dark:text-slate-300 font-mono flex-1 truncate">
                  {instance.id}
                </code>
                <CopyButton value={instance.id} />
              </div>
            </div>
            {instance.connectedAt && (
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3.5 space-y-1 border border-slate-100 dark:border-transparent">
                <p className="text-xs text-slate-500">Conectado em</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                  {new Date(instance.connectedAt).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </div>


          {/* Webhook config */}
          <div className="space-y-3 border-t border-slate-100 dark:border-dark-700/40 pt-4">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Webhook de eventos</p>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://seu-servidor.com/webhook"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(WEBHOOK_EVENT_LABELS).map(([ev, label]) => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="w-3.5 h-3.5 accent-brand-500 rounded"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {webhookError && (
              <p className="text-xs text-red-500">{webhookError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={saveWebhook}
                disabled={savingWebhook || !webhookUrl || webhookEvents.length === 0}
                className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {savingWebhook ? "Salvando..." : "Salvar webhook"}
              </button>
              {(instance.webhookUrl || webhookUrl) && (
                <button
                  onClick={clearWebhook}
                  disabled={savingWebhook}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 border border-slate-200 dark:border-dark-600 hover:border-red-300 dark:hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Confirmar desconexão?</span>
                <button
                  onClick={() => { setConfirming(false); onDisconnect(); }}
                  className="text-xs text-red-500 border border-red-300 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Sim, desconectar
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-slate-500 border border-slate-200 dark:border-dark-600 hover:bg-slate-50 dark:hover:bg-dark-700/60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-dark-600 hover:border-red-300 dark:hover:border-red-500/30 px-3 py-2 rounded-xl transition-colors"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PhonesPage() {
  const [tab, setTab] = useState<Tab>("waba");

  // WABA state
  const [phones, setPhones] = useState<PhoneNumber[]>(initialWaba);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Baileys state
  const [instances, setInstances] = useState<BaileysInstance[]>([]);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);

  const fetchInstances = useCallback(async () => {
    try {
      const data = await apiFetch<BaileysInstance[]>("/instances");
      setInstances(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (tab !== "qr") return;
    fetchInstances();
    const interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(interval);
  }, [tab, fetchInstances]);

  const createInstance = async () => {
    setCreatingInstance(true);
    try {
      const { id } = await apiFetch<{ id: string }>("/instances", { method: "POST" });
      setQrInstanceId(id);
      await fetchInstances();
    } finally {
      setCreatingInstance(false);
    }
  };

  const disconnectInstance = async (id: string) => {
    await apiFetch(`/instances/${id}`, { method: "DELETE" });
    setInstances((prev) => prev.filter((i) => i.id !== id));
  };

  const handleWebhookSaved = (id: string, url: string | null, events: string[]) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, webhookUrl: url, webhookEvents: events } : i))
    );
  };

  // WABA handlers
  const toggleWaba = (id: string) => setExpanded((p) => (p === id ? null : id));
  const toggleActiveWaba = (id: string) =>
    setPhones((p) => p.map((ph) => (ph.id === id ? { ...ph, isActive: !ph.isActive } : ph)));
  const submitWaba = () => {
    if (!form.display_number || !form.phone_number_id || !form.waba_id || !form.access_token) return;
    const newPhone: PhoneNumber = {
      id: `pn_${Date.now()}`,
      displayNumber: form.display_number,
      phoneNumberId: form.phone_number_id,
      wabaId: form.waba_id,
      isActive: true,
      webhookVerifyToken: `vt_${Math.random().toString(36).slice(2, 18)}`,
      webhookUrl: "https://api.zapnit.com/webhook/tenant_k8mNpQr3xLwT9vYj",
    };
    setPhones((p) => [...p, newPhone]);
    setForm(emptyForm);
    setModalOpen(false);
  };

  const tabBtn = (t: Tab, label: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      tab === t
        ? "bg-brand-500 text-white shadow-sm"
        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
    }`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Números de Telefone
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tab === "waba"
              ? "Números WhatsApp Business vinculados via Meta API."
              : "Conexões WhatsApp via QR Code (Baileys)."}
          </p>
        </div>

        {tab === "waba" ? (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green-sm flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Vincular número
          </button>
        ) : (
          <button
            onClick={createInstance}
            disabled={creatingInstance}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green-sm flex-shrink-0"
          >
            {creatingInstance ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            Nova conexão QR
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-dark-800/60 rounded-xl border border-slate-200 dark:border-dark-700/50 w-fit">
        <button onClick={() => setTab("waba")} className={tabBtn("waba", "Meta API")}>
          <span className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Meta API
          </span>
        </button>
        <button onClick={() => setTab("qr")} className={tabBtn("qr", "QR Code")}>
          <span className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="15" y="15" width="2" height="2" fill="currentColor" />
              <rect x="19" y="15" width="2" height="2" fill="currentColor" />
              <rect x="15" y="19" width="2" height="2" fill="currentColor" />
              <rect x="19" y="19" width="2" height="2" fill="currentColor" />
            </svg>
            QR Code
          </span>
        </button>
      </div>

      {/* ── WABA TAB ── */}
      {tab === "waba" && (
        <div className="space-y-4">
          {phones.map((ph) => (
            <div key={ph.id} className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.21 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 dark:text-white font-medium">{ph.displayNumber}</p>
                    <p className="text-xs text-slate-500 truncate">WABA ID: {ph.wabaId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      ph.isActive
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
                        : "bg-slate-100 dark:bg-dark-600/50 text-slate-500 border border-slate-200 dark:border-dark-600"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${ph.isActive ? "bg-brand-400 pulse-dot" : "bg-slate-400 dark:bg-slate-600"}`} />
                    {ph.isActive ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => toggleWaba(ph.id)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
                  >
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`transition-transform duration-200 ${expanded === ph.id ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {expanded === ph.id && (
                <div className="px-5 pb-5 border-t border-slate-100 dark:border-dark-700/40 space-y-4 pt-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3.5 space-y-1 border border-slate-100 dark:border-transparent">
                      <p className="text-xs text-slate-500">Phone Number ID</p>
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-slate-700 dark:text-slate-300 font-mono flex-1 truncate">{ph.phoneNumberId}</code>
                        <CopyButton value={ph.phoneNumberId} />
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3.5 space-y-1 border border-slate-100 dark:border-transparent">
                      <p className="text-xs text-slate-500">Verify Token</p>
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-slate-700 dark:text-slate-300 font-mono flex-1 truncate">{ph.webhookVerifyToken}</code>
                        <CopyButton value={ph.webhookVerifyToken} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3.5 space-y-1 border border-slate-100 dark:border-transparent">
                    <p className="text-xs text-slate-500">URL do Webhook</p>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-brand-500 dark:text-brand-400 font-mono flex-1 break-all">{ph.webhookUrl}</code>
                      <CopyButton value={ph.webhookUrl} />
                    </div>
                  </div>
                  <div className="bg-brand-500/5 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex gap-2 border border-brand-500/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Configure esta URL e o verify token no Meta for Developers → WhatsApp → Configuração → Webhooks.
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => toggleActiveWaba(ph.id)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-dark-600 hover:border-red-300 dark:hover:border-red-500/30 px-3 py-2 rounded-xl transition-colors"
                    >
                      {ph.isActive ? "Desativar número" : "Reativar número"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── QR CODE TAB ── */}
      {tab === "qr" && (
        <div className="space-y-4">
          {/* Client Token do usuário */}
          {(() => {
            const user = getUser();
            if (!user?.clientToken) return null;
            return (
              <div className="glass-card rounded-2xl p-4 border border-brand-500/15">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Client Token — use no header <code className="font-mono">X-Client-Token</code> para enviar mensagens via API
                </p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-800/60 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-transparent">
                  <code className="text-xs text-brand-500 dark:text-brand-400 font-mono flex-1 truncate">
                    {user.clientToken}
                  </code>
                  <CopyButton value={user.clientToken} />
                </div>
              </div>
            );
          })()}
          {instances.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.6">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="15" y="15" width="2" height="2" fill="#22c55e" />
                  <rect x="19" y="15" width="2" height="2" fill="#22c55e" />
                  <rect x="15" y="19" width="2" height="2" fill="#22c55e" />
                  <rect x="19" y="19" width="2" height="2" fill="#22c55e" />
                </svg>
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-medium">Nenhuma conexão ativa</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Clique em &quot;Nova conexão QR&quot; para conectar um número via WhatsApp.
                </p>
              </div>
              <button
                onClick={createInstance}
                disabled={creatingInstance}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green-sm mt-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nova conexão QR
              </button>
            </div>
          ) : (
            instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onDisconnect={() => disconnectInstance(instance.id)}
                onWebhookSaved={handleWebhookSaved}
              />
            ))
          )}
        </div>
      )}

      {/* ── WABA Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card border border-slate-200 dark:border-dark-600/60 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg">Vincular número</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-brand-500/5 border border-brand-500/15 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Encontre esses dados no Meta for Developers → seu App → WhatsApp → API Setup.
            </div>

            <div className="space-y-3">
              {(
                [
                  { key: "display_number", label: "Número de exibição", placeholder: "+55 11 99999-0000", type: "text" },
                  { key: "phone_number_id", label: "Phone Number ID", placeholder: "ID fornecido pela Meta", type: "text" },
                  { key: "waba_id", label: "WhatsApp Business Account ID", placeholder: "WABA ID da Meta", type: "text" },
                  { key: "access_token", label: "Access Token", placeholder: "Token de acesso permanente", type: "password" },
                ] satisfies { key: keyof FormData; label: string; placeholder: string; type: string }[]
              ).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-dark-700/60 text-sm py-2.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitWaba}
                disabled={!form.display_number || !form.phone_number_id || !form.waba_id || !form.access_token}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {qrInstanceId && (
        <QrModal
          instanceId={qrInstanceId}
          onClose={() => setQrInstanceId(null)}
          onConnected={async () => {
            setQrInstanceId(null);
            await fetchInstances();
          }}
        />
      )}
    </div>
  );
}
