"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { getUser, logout } from "@/lib/auth";

const titles: Record<string, string> = {
  "/dashboard/company": "Minha Empresa",
  "/dashboard/departments": "Departamentos",
  "/dashboard/phones": "Números de Telefone",
  "/dashboard/templates": "Templates de Mensagem",
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = titles[pathname] ?? "Dashboard";
  const user = getUser();
  const initials = user?.name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 dark:border-dark-700/50 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 -ml-1"
          aria-label="Abrir menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-slate-900 dark:text-white font-semibold text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-400 rounded-full" />
        </button>

        {/* Theme toggle — alongside the bell */}
        <ThemeToggle />

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 dark:bg-dark-700/50 mx-1" />

        {/* Avatar + dropdown */}
        <div className="relative pl-1">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-dark-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-500 dark:text-brand-400">
              {initials}
            </div>
            <span className="hidden md:block text-sm text-slate-700 dark:text-slate-300">{user?.name ?? "Utilizador"}</span>
            <svg className="hidden md:block text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700/50 shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-700/50">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Terminar sessão
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
