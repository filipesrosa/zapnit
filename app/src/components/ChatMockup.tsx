export default function ChatMockup() {
  const messages = [
    { from: "customer", text: "Oi! Quero agendar uma consulta para essa semana 😊", time: "14:02" },
    {
      from: "bot",
      text: "Olá! Temos horários disponíveis essa semana sim. Prefere manhã ou tarde?",
      time: "14:02",
    },
    { from: "customer", text: "Tarde, se possível quarta-feira", time: "14:03" },
    {
      from: "bot",
      text: "Perfeito! Na quarta tenho 14h e 16h disponíveis. Qual prefere?",
      time: "14:03",
    },
    { from: "customer", text: "14h tá ótimo!", time: "14:04" },
    {
      from: "bot",
      text: "Consulta confirmada para quarta às 14h ✅\n\nVou te enviar um lembrete na véspera. Posso ajudar com mais alguma coisa?",
      time: "14:04",
      isLast: true,
    },
  ];

  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute inset-0 rounded-3xl bg-brand-500/8 blur-3xl scale-95 pointer-events-none" />

      <div className="relative rounded-3xl overflow-hidden border border-dark-600/60 shadow-2xl" style={{ maxWidth: 360 }}>
        {/* WhatsApp-style header */}
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-400/30 border-2 border-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            Z
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm leading-tight">Assistente IA</p>
            <p className="text-green-200 text-xs">online agora</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
          </div>
        </div>

        {/* Chat area */}
        <div
          className="px-3 py-4 flex flex-col gap-2"
          style={{
            background: "linear-gradient(180deg, #0d1117 0%, #0a1628 100%)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322c55e' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                  msg.from === "customer"
                    ? "bg-[#005C4B] text-white rounded-br-sm"
                    : "bg-dark-700/90 text-slate-100 rounded-bl-sm border border-dark-600/40"
                }`}
              >
                {/* AI badge */}
                {msg.from === "bot" && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-brand-400 font-medium mb-1 block">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    IA
                  </span>
                )}
                <p style={{ whiteSpace: "pre-line" }}>{msg.text}</p>
                <div className={`flex items-center gap-1 mt-1 ${msg.from === "customer" ? "justify-end" : "justify-start"}`}>
                  <span className="text-[10px] text-slate-400">{msg.time}</span>
                  {msg.from === "customer" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="#53BDEB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 12l5 5L20 6" stroke="#53BDEB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          <div className="flex justify-start">
            <div className="bg-dark-700/90 border border-dark-600/40 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-400"
                  style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="bg-dark-900 px-3 py-2.5 flex items-center gap-2 border-t border-dark-700/50">
          <div className="flex-1 bg-dark-700/60 rounded-full px-4 py-2 text-xs text-slate-500">
            Digite uma mensagem
          </div>
          <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Floating stat cards */}
      <div className="absolute -left-12 top-1/4 glass-card rounded-xl px-3.5 py-2.5 border border-brand-500/20 shadow-xl hidden lg:block">
        <p className="text-xs text-slate-400">Respondido em</p>
        <p className="text-white font-bold text-lg">2 seg</p>
        <p className="text-[10px] text-brand-400">↑ 24h por dia</p>
      </div>

      <div className="absolute -right-12 bottom-1/4 glass-card rounded-xl px-3.5 py-2.5 border border-brand-500/20 shadow-xl hidden lg:block">
        <p className="text-xs text-slate-400">Satisfação</p>
        <p className="text-white font-bold text-lg">98%</p>
        <p className="text-[10px] text-brand-400">★ clientes felizes</p>
      </div>
    </div>
  );
}
