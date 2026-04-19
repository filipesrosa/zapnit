"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { setToken, setUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (!res.ok) {
        setError("E-mail ou senha incorretos.");
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
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/8 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-brand-700/5 blur-[80px]" />

        {/* Logo */}
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

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 pb-16">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-3.5 py-1.5 text-brand-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 pulse-dot" />
              Atendimento automático 24h
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              Bem-vindo de volta ao seu{" "}
              <span className="gradient-text">painel Zapnit</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Gerencie seu atendimento via WhatsApp, templates de mensagem e muito mais.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-3">
              {[
                "Atendimento automático com IA",
                "Templates aprovados pela Meta",
                "Múltiplos números de WhatsApp",
                "Histórico completo de conversas",
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

        {/* Bottom testimonial */}
        <div className="relative z-10 px-12 pb-10">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-slate-300 text-sm leading-relaxed italic">
              &ldquo;Desde que implementamos o Zapnit, nosso tempo de resposta caiu de horas para segundos. Os pacientes adoraram.&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300">
                A
              </div>
              <div>
                <p className="text-white text-xs font-medium">Ana Lima</p>
                <p className="text-slate-500 text-xs">Recepcionista, Zion Clínica</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col w-full lg:w-[480px] flex-shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between p-6">
          {/* Mobile logo */}
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
              Não tem conta?{" "}
              <Link href="/register" className="text-brand-500 dark:text-brand-400 hover:underline font-medium">
                Criar conta
              </Link>
            </span>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 pb-12">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entrar na sua conta</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                Acesse o painel de gerenciamento do seu WhatsApp.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-mail */}
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
                  placeholder="voce@empresa.com"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Senha
                  </label>
                  <Link href="#" className="text-xs text-brand-500 dark:text-brand-400 hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors shadow-sm"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
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
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-200 dark:bg-dark-700/50" />
              <span className="text-xs text-slate-400">ou continue com</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-dark-700/50" />
            </div>

            {/* Google SSO placeholder */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-dark-700/60 text-slate-700 dark:text-slate-300 text-sm font-medium py-3 rounded-xl transition-colors shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </button>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
              Ao entrar, você concorda com os{" "}
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
