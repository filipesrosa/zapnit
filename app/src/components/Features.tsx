const features = [
  {
    emoji: "🕐",
    title: "Atendimento 24 horas por dia",
    description:
      "Sua empresa responde clientes às 2h da manhã, nos finais de semana e feriados — sem precisar de ninguém disponível. A IA nunca descansa.",
  },
  {
    emoji: "📅",
    title: "Agendamentos automáticos",
    description:
      "Clientes perguntam, escolhem horário e confirmam tudo pelo WhatsApp. Sem ligação, sem vai-e-vem de mensagem manual. Sua agenda sempre atualizada.",
  },
  {
    emoji: "💬",
    title: "Respostas inteligentes e naturais",
    description:
      "A IA entende o contexto da conversa e responde de forma humanizada. Não é aquele bot chato de menu com números — é uma conversa de verdade.",
  },
  {
    emoji: "📊",
    title: "Acompanhe cada mensagem",
    description:
      "Saiba exatamente quais mensagens foram enviadas, entregues e lidas. Histórico completo de todas as conversas em um só lugar.",
  },
  {
    emoji: "🔒",
    title: "Seus dados, só seus",
    description:
      "Cada empresa tem seu espaço isolado e protegido. As conversas dos seus clientes não se misturam com dados de ninguém.",
  },
  {
    emoji: "⚡",
    title: "Sem perder nenhuma mensagem",
    description:
      "Sistema robusto que garante entrega mesmo em picos de volume. Se algo falhar, a mensagem é reenviada automaticamente.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-brand-400 text-sm font-medium uppercase tracking-widest mb-4">
            O que você ganha
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Tudo para seu{" "}
            <span className="gradient-text">atendimento decolar</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Enquanto você foca no seu negócio, a Zapnit cuida de responder,
            engajar e converter seus clientes no WhatsApp.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-card rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-2xl group-hover:bg-brand-500/20 transition-colors">
                {feature.emoji}
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
