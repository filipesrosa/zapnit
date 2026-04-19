"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";

const links = [
  {
    href: "/dashboard/company",
    label: "Minha Empresa",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/dashboard/departments",
    label: "Departamentos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    href: "/dashboard/phones",
    label: "Números de Telefone",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.21 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/templates",
    label: "Templates",
    hidden: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="13" y2="14" />
      </svg>
    ),
  },
  {
    href: "/dashboard/automation",
    label: "Automação com IA",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z" />
        <path d="M12 16a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2v-2a2 2 0 012-2z" />
        <path d="M4 10a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2H6a2 2 0 01-2-2z" />
        <path d="M14 10a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        <path d="M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42" />
      </svg>
    ),
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const nav = (
    <nav className="flex flex-col gap-1 px-3 flex-1">
      {links.filter(link => !link.hidden).map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              active
                ? "bg-brand-500/10 text-slate-900 dark:text-white border-l-2 border-brand-500 pl-[10px]"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-700/60"
            }`}
          >
            <span className={active ? "text-brand-500 dark:text-brand-400" : ""}>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-dark-700/50 h-screen sticky top-0">
        <Logo />
        {nav}
        <SidebarFooter />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-dark-700/50 h-full z-50">
            <div className="flex items-center justify-between pr-4">
              <Logo />
              <button
                onClick={onClose}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700/60"
                aria-label="Fechar menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {nav}
            <SidebarFooter />
          </aside>
        </div>
      )}
    </>
  );
}

function Logo() {
  return (
    <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-dark-700/50 flex-shrink-0">
      <Link href="/dashboard/company">
        <Image src="/zapnit_logo.png" alt="Zapnit" width={48} height={48} className="rounded-xl" />
      </Link>
    </div>
  );
}

function SidebarFooter() {
  const router = useRouter();
  const user = getUser();
  const initials = user?.name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="px-4 py-4 border-t border-slate-200 dark:border-dark-700/50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-500 dark:text-brand-400 flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{user?.name ?? "Utilizador"}</p>
          <p className="text-slate-500 dark:text-slate-500 text-xs truncate">{user?.email ?? ""}</p>
        </div>
        <button
          onClick={handleLogout}
          title="Terminar sessão"
          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
