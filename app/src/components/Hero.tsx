import HeroVisual from "./HeroVisual";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-grid pt-16">
      {/* Radial glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] rounded-full bg-brand-700/5 blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div className="flex flex-col gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-brand-400 text-sm font-medium w-fit animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-brand-400 pulse-dot" />
            Atendimento automático via WhatsApp
          </div>

          {/* Headline */}
          <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight animate-fade-up-delay-1">
            Seu negócio{" "}
            <span className="gradient-text">atendendo 24h</span>{" "}
            no WhatsApp
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-slate-400 leading-relaxed max-w-lg animate-fade-up-delay-2">
            Automatize o atendimento, agendamentos e respostas do seu WhatsApp
            com inteligência artificial. Enquanto você descansa, a IA cuida dos seus clientes.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 animate-fade-up-delay-3">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] glow-green"
            >
              Quero automatizar meu WhatsApp
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 bg-dark-700/60 hover:bg-dark-700 border border-dark-600 text-slate-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Ver como funciona
            </a>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4 pt-2 animate-fade-up-delay-3">
            <div className="flex -space-x-2">
              {["#22c55e", "#16a34a", "#15803d", "#166534"].map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-dark-950 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: color }}
                >
                  {["Z", "M", "A", "L"][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-white font-medium">+50 negócios</span> já automatizaram com Zapnit
            </p>
          </div>
        </div>

        {/* Right — alternating visual */}
        <div className="animate-fade-up-delay-2">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
