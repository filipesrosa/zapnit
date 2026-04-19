const steps = [
  {
    number: "01",
    emoji: "📋",
    title: "Crie sua conta",
    description:
      "Cadastre-se em menos de 5 minutos. Sem burocracia, sem contrato de longo prazo. Você começa a usar no mesmo dia.",
  },
  {
    number: "02",
    emoji: "📱",
    title: "Conecte seu WhatsApp",
    description:
      "Vinculamos seu número WhatsApp Business à plataforma. Nosso time te ajuda em cada passo dessa configuração.",
  },
  {
    number: "03",
    emoji: "🤖",
    title: "Configure o atendimento",
    description:
      "Conte para a IA sobre o seu negócio: horários, serviços, perguntas frequentes. Ela aprende e já começa a responder.",
  },
  {
    number: "04",
    emoji: "🚀",
    title: "Pronto, é só crescer",
    description:
      "A IA atende seus clientes automaticamente. Você acompanha as conversas e foca no que realmente importa no seu negócio.",
  },
];

const useCases = [
  { emoji: "💇", label: "Salão de beleza", desc: "Agendamentos e confirmações automáticas" },
  { emoji: "🏥", label: "Clínica médica", desc: "Consultas e lembretes de retorno" },
  { emoji: "🐾", label: "Pet shop", desc: "Banho, tosa e acompanhamento pós-visita" },
  { emoji: "🏋️", label: "Academia", desc: "Matrículas e dúvidas sobre planos" },
  { emoji: "🏠", label: "Imobiliária", desc: "Qualificação de leads e agendamento de visitas" },
  { emoji: "🍕", label: "Restaurante", desc: "Pedidos, reservas e cardápio interativo" },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative bg-dark-900/40">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-brand-400 text-sm font-medium uppercase tracking-widest mb-4">
            Como funciona
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Comece a atender{" "}
            <span className="gradient-text">hoje mesmo</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Sem precisar de equipe técnica. Nosso time cuida de tudo para você.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative mb-20">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col gap-4">
              <div className="relative w-16 h-16 mx-auto lg:mx-0">
                <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-600 flex items-center justify-center glow-green relative z-10 text-2xl">
                  {step.emoji}
                </div>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-brand-400 text-xs font-bold mb-1 font-mono">{step.number}</p>
                <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Use cases */}
        <div className="glass-card rounded-2xl p-8">
          <h3 className="text-white font-semibold text-xl mb-2 text-center">
            Funciona para qualquer tipo de negócio
          </h3>
          <p className="text-slate-400 text-sm text-center mb-8">
            Se você atende clientes pelo WhatsApp, a Zapnit pode automatizar seu atendimento.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {useCases.map((uc) => (
              <div
                key={uc.label}
                className="flex items-center gap-3 bg-dark-800/60 rounded-xl p-4 border border-dark-600/50 hover:border-brand-500/20 transition-colors"
              >
                <span className="text-2xl flex-shrink-0">{uc.emoji}</span>
                <div>
                  <p className="text-white text-sm font-medium">{uc.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
