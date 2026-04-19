export default function CodePreview() {
  return (
    <div className="relative">
      {/* Glow behind card */}
      <div className="absolute inset-0 rounded-2xl bg-brand-500/10 blur-2xl scale-95" />

      <div className="relative glass-card rounded-2xl overflow-hidden border border-dark-600/50">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-dark-800/80 border-b border-dark-700/50">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-brand-500/70" />
          <span className="ml-2 text-xs text-slate-500 font-mono">zapnit-api.ts</span>
        </div>

        {/* Code */}
        <div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
          <div>
            <span className="text-slate-500">{"// 1. Autenticar"}</span>
          </div>
          <div className="mt-2">
            <span className="text-purple-400">const</span>
            <span className="text-white"> {"{ access_token }"} </span>
            <span className="text-slate-400">= await </span>
            <span className="text-brand-400">fetch</span>
            <span className="text-slate-400">(</span>
            <span className="text-yellow-300">{`"https://api.zapnit.com/auth/token"`}</span>
            <span className="text-slate-400">, {"{"}</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-300">method</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"POST"`}</span>
            <span className="text-slate-400">,</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-300">body</span>
            <span className="text-slate-400">: </span>
            <span className="text-brand-400">JSON</span>
            <span className="text-slate-400">.</span>
            <span className="text-blue-400">stringify</span>
            <span className="text-slate-400">{"({"}</span>
          </div>
          <div className="ml-8">
            <span className="text-slate-300">grant_type</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"client_credentials"`}</span>
            <span className="text-slate-400">,</span>
          </div>
          <div className="ml-8">
            <span className="text-slate-300">client_id</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"zap_xxxx"`}</span>
            <span className="text-slate-400">,</span>
          </div>
          <div className="ml-8">
            <span className="text-slate-300">client_secret</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"••••"`}</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-400">{"})"})</span>
          </div>
          <div>
            <span className="text-slate-400">{"});"}</span>
          </div>

          <div className="mt-4">
            <span className="text-slate-500">{"// 2. Enviar mensagem"}</span>
          </div>
          <div className="mt-2">
            <span className="text-purple-400">await </span>
            <span className="text-brand-400">fetch</span>
            <span className="text-slate-400">(</span>
            <span className="text-yellow-300">{`"/api/v1/messages/send"`}</span>
            <span className="text-slate-400">, {"{"}</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-300">method</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"POST"`}</span>
            <span className="text-slate-400">,</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-300">headers</span>
            <span className="text-slate-400">{": { "}</span>
            <span className="text-yellow-300">{`"Authorization"`}</span>
            <span className="text-slate-400">{`: \`Bearer \${access_token}\` },`}</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-300">body</span>
            <span className="text-slate-400">: </span>
            <span className="text-brand-400">JSON</span>
            <span className="text-slate-400">.</span>
            <span className="text-blue-400">stringify</span>
            <span className="text-slate-400">{"({"}</span>
          </div>
          <div className="ml-8">
            <span className="text-slate-300">to</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"5511999999999"`}</span>
            <span className="text-slate-400">,</span>
          </div>
          <div className="ml-8">
            <span className="text-slate-300">message</span>
            <span className="text-slate-400">: </span>
            <span className="text-yellow-300">{`"Olá! Consulta amanhã às 14h 👍"`}</span>
          </div>
          <div className="ml-4">
            <span className="text-slate-400">{"})"})</span>
          </div>
          <div>
            <span className="text-slate-400">{"});"}</span>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-5 py-3 bg-dark-800/60 border-t border-dark-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 pulse-dot" />
            <span className="text-xs text-slate-400 font-mono">mensagem enviada</span>
          </div>
          <span className="text-xs text-brand-400 font-mono bg-brand-500/10 px-2 py-0.5 rounded">
            200 OK · 87ms
          </span>
        </div>
      </div>

      {/* Floating notification */}
      <div className="absolute -bottom-4 -right-4 glass-card rounded-xl px-4 py-3 border border-brand-500/20 flex items-center gap-3 shadow-xl">
        <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#22c55e"/>
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium text-white">Mensagem entregue</p>
          <p className="text-xs text-slate-400">Status: delivered ✓✓</p>
        </div>
      </div>
    </div>
  );
}
