export default function LogoBar() {
  const segments = [
    { emoji: "💇", label: "Salões" },
    { emoji: "🏥", label: "Clínicas" },
    { emoji: "🐾", label: "Pet shops" },
    { emoji: "🏋️", label: "Academias" },
    { emoji: "🏠", label: "Imobiliárias" },
    { emoji: "🍕", label: "Restaurantes" },
    { emoji: "👗", label: "Lojas" },
    { emoji: "🦷", label: "Consultórios" },
  ];

  return (
    <section className="relative py-12 border-y border-dark-700/40 bg-dark-900/30">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs font-medium text-slate-500 uppercase tracking-widest mb-8">
          Negócios que já automatizam o atendimento com Zapnit
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {segments.map(({ emoji, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-dark-600/50 bg-dark-800/40 text-slate-400 text-sm"
            >
              <span>{emoji}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
