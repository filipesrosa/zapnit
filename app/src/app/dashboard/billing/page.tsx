"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthly_quota: number;
  price: string;
  features: string[] | null;
  gateway_price_id: string | null;
  is_free: boolean;
}

interface Subscription {
  plan: { id: string; name: string; slug: string; price: string };
  payment_status: string;
  billing_cycle_end: string | null;
  has_active_subscription: boolean;
  quota: { used: number; limit: number; resets_at: string };
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
    past_due: { label: "Pagamento pendente", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
    canceled: { label: "Cancelada", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
    trialing: { label: "Trial", className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20" },
    pending: { label: "Pendente", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") setToast({ type: "success", message: "Assinatura ativada com sucesso!" });
    if (status === "canceled") setToast({ type: "error", message: "Checkout cancelado. Tente novamente quando quiser." });

    Promise.all([
      apiFetch<Plan[]>("/billing/plans"),
      apiFetch<Subscription>("/billing/subscription")
    ]).then(([p, s]) => {
      setPlans(p);
      setSubscription(s);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubscribe = async (plan: Plan) => {
    if (!plan.gateway_price_id) {
      setToast({ type: "error", message: "Este plano não está disponível para compra no momento." });
      return;
    }
    setCheckingOut(plan.id);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: plan.id }),
      });
      window.location.href = checkout_url;
    } catch {
      setToast({ type: "error", message: "Erro ao iniciar checkout. Tente novamente." });
      setCheckingOut(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura? Você perderá acesso ao plano pago no próximo ciclo.")) return;
    setCanceling(true);
    try {
      await apiFetch("/billing/cancel", { method: "POST" });
      setToast({ type: "success", message: "Assinatura cancelada. Você continua com acesso até o fim do período." });
      const sub = await apiFetch<Subscription>("/billing/subscription");
      setSubscription(sub);
    } catch {
      setToast({ type: "error", message: "Erro ao cancelar assinatura." });
    } finally {
      setCanceling(false);
    }
  };

  const currentPlanSlug = subscription?.plan.slug;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-fade-up ${
          toast.type === "success"
            ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
        }`}>
          {toast.type === "success"
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {toast.message}
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Planos & Billing</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie sua assinatura e escolha o plano ideal para o seu negócio.</p>
      </div>

      {/* Current subscription */}
      {!loading && subscription && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Assinatura atual</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{subscription.plan.name}</span>
                {statusBadge(subscription.payment_status)}
              </div>
            </div>
            {subscription.has_active_subscription && subscription.payment_status !== "canceled" && (
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 border border-red-200 dark:border-red-800 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {canceling ? "Cancelando..." : "Cancelar assinatura"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-dark-700/50">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Mensagens usadas</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {subscription.quota.used.toLocaleString("pt-BR")} / {subscription.quota.limit.toLocaleString("pt-BR")}
              </p>
            </div>
            {subscription.billing_cycle_end && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Próxima cobrança</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {new Date(subscription.billing_cycle_end).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor mensal</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {Number(subscription.plan.price) === 0 ? "Grátis" : `R$ ${Number(subscription.plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Todos os planos</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 space-y-3">
                <div className="h-5 w-24 bg-slate-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-8 w-20 bg-slate-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-3 w-full bg-slate-200 dark:bg-dark-700 rounded animate-pulse" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentPlanSlug;
              const isPopular = plan.slug === "pro";
              return (
                <div
                  key={plan.id}
                  className={`glass-card rounded-2xl p-6 flex flex-col gap-4 relative ${
                    isCurrent ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  {isPopular && !isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Mais popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Plano atual
                    </span>
                  )}

                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      {Number(plan.price) === 0 ? (
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">Grátis</span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-500">R$</span>
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-slate-500">/mês</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {plan.monthly_quota.toLocaleString("pt-BR")} mensagens/mês
                    </p>
                  </div>

                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="space-y-1.5 flex-1">
                      {(plan.features as string[]).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" className="flex-shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isCurrent || !!checkingOut || plan.is_free}
                    className={`w-full text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
                      isCurrent
                        ? "bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-slate-500 cursor-default"
                        : plan.is_free
                        ? "bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-slate-500 cursor-default"
                        : "bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
                    }`}
                  >
                    {checkingOut === plan.id ? "Redirecionando..." :
                     isCurrent ? "Plano atual" :
                     plan.is_free ? "Gratuito" : "Assinar agora"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Pagamentos processados com segurança pelo MercadoPago. Cancele quando quiser.
      </p>
    </div>
  );
}
