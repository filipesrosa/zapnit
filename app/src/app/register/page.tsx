"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { setToken, setUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Erro ao criar conta.");
        return;
      }
      const { token, user } = await res.json();
      setToken(token);
      setUser(user);
      router.push("/dashboard/company");
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-dark-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-dark-900">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/8 blur-[100px]" />

        <div className="relative z-10 p-10">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center glow-green-sm group-hover:scale-105 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="white" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">
              Zap<span className="text-brand-400">nit</span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 pb-16">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-3.5 py-1.5 text-brand-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 pulse-dot" />
              Comece gratuitamente
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              Crie sua conta e conecte seu{" "}
              <span className="gradient-text">WhatsApp agora</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Gerencie múltiplas instâncias de WhatsApp, automatize atendimentos e escale sua comunicação.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                "Conecte via QR Code em segundos",
                "Envie e receba mensagens pela API",
                "Instâncias independentes por conta",
                "Suporte a múltiplos números",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col w-full lg:w-[480px] flex-shrink-0">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center glow-green-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="white" />
              </svg>
            </div>
            <span className="text-slate-900 dark:text-white font-semibold tracking-tight">
              Zap<span className="text-brand-500">nit</span>
            </span>
          </Link>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Já tem conta?{" "}
              <Link href="/login" className="text-brand-500 dark:text-brand-400 hover:underline font-medium">
                Entrar
              </Link>
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 pb-12">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Criar sua conta</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                Preencha os dados abaixo para começar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seu nome"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="voce@exemplo.com"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="Repita a senha"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-70 text-white font-medium py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] glow-green flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar conta
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
              Ao criar uma conta, você concorda com os{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">Termos de uso</Link>
              {" "}e{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">Política de privacidade</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
