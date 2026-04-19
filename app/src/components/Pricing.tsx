const plans = [
  {
    name: "Starter",
    price: "Grátis",
    period: "",
    description: "Para testar e projetos pessoais",
    quota: "500 mensagens/mês",
    highlight: false,
    features: [
      "1 número WhatsApp",
      "500 mensagens por mês",
      "Chatbot IA básico",
      "API REST completa",
      "Rastreamento de entrega",
      "Suporte por email",
    ],
    cta: "Começar grátis",
  },
  {
    name: "Pro",
    price: "R$ 149",
    period: "/mês",
    description: "Para negócios em crescimento",
    quota: "5.000 mensagens/mês",
    highlight: true,
    features: [
      "3 números WhatsApp",
      "5.000 mensagens por mês",
      "Chatbot IA avançado",
      "Templates de mensagem",
      "Histórico de conversas",
      "Suporte prioritário",
      "SLA 99.5%",
    ],
    cta: "Começar agora",
  },
  {
    name: "Premium",
    price: "R$ 399",
    period: "/mês",
    description: "Para operações de alto volume",
    quota: "Ilimitado",
    highlight: false,
    features: [
      "Números ilimitados",
      "Mensagens ilimitadas",
      "Multi-tenant completo",
      "Integração personalizada",
      "Painel de analytics",
      "Suporte dedicado 24/7",
      "SLA 99.9%",
      "Onboarding guiado",
    ],
    cta: "Falar com vendas",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-brand-400 text-sm font-medium uppercase tracking-widest mb-4">
            Planos
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Preço justo para{" "}
            <span className="gradient-text">cada etapa</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Comece grátis, escale conforme cresce. Sem taxas escondidas, sem
            surpresas na fatura.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                plan.highlight
                  ? "bg-gradient-to-b from-brand-500/20 to-dark-800/80 border border-brand-500/40 shadow-lg shadow-brand-500/10"
                  : "glass-card"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    MAIS POPULAR
                  </span>
                </div>
              )}

              <div className="p-8 flex flex-col gap-6 flex-1">
                {/* Plan header */}
                <div>
                  <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-bold ${plan.highlight ? "text-brand-400" : "text-white"}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-slate-400 text-sm mb-1">{plan.period}</span>
                  )}
                </div>

                {/* Quota badge */}
                <div className="flex items-center gap-2 bg-dark-800/60 rounded-lg px-3 py-2 border border-dark-600/50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                  </svg>
                  <span className="text-sm text-brand-400 font-medium">{plan.quota}</span>
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2.5"
                        className="flex-shrink-0 mt-0.5"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href="#"
                  className={`mt-4 text-center font-medium py-3 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    plan.highlight
                      ? "bg-brand-500 hover:bg-brand-600 text-white glow-green"
                      : "bg-dark-700/60 hover:bg-dark-700 border border-dark-600 text-slate-300 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-center text-sm text-slate-500 mt-8">
          Precisa de volume maior? {" "}
          <a href="#" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
            Entre em contato
          </a>{" "}
          para um plano personalizado.
        </p>
      </div>
    </section>
  );
}
