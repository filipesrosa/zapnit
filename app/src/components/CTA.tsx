export default function CTA() {
  return (
    <section className="py-24 relative">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-dark-800 to-dark-900" />
          <div className="absolute inset-0 bg-grid opacity-20" />

          {/* Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-brand-500/20 blur-[60px]" />
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-brand-700/15 blur-[80px]" />

          {/* Border */}
          <div className="absolute inset-0 rounded-3xl border border-brand-500/20" />

          {/* Content */}
          <div className="relative px-8 py-16 text-center flex flex-col items-center gap-6">
            <span className="text-5xl">💬</span>

            <div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                Chega de cliente{" "}
                <span className="gradient-text">sem resposta</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto">
                Comece hoje gratuitamente e veja como é ter seu WhatsApp
                respondendo clientes enquanto você faz o que ama.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green text-base"
              >
                Começar agora — é grátis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 bg-dark-700/60 hover:bg-dark-700 border border-dark-600/80 text-slate-300 hover:text-white font-medium px-8 py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-base"
              >
                Falar com a equipe
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500 pt-2">
              {["Sem cartão de crédito", "Configuração em minutos", "Suporte em português"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
