import { useEffect, useRef, useState } from "react";
import { ArrowRight, BrainCircuit, MessageSquare, Mic, RotateCcw, Send } from "lucide-react";
import { KNOWLEDGE_BASE, type ChatMessage } from "../lib/knowledgeBase";
import { LiveVoicePanel } from "./LiveVoicePanel";

interface EduChatPanelProps {
  messages: ChatMessage[];
  suggestions: string[];
  isSending: boolean;
  deepThinking: boolean;
  onToggleDeepThinking: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onResetChat: () => void;
  isVoiceMode: boolean;
  onSetVoiceMode: (active: boolean) => void;
  learningSummary: string;
  onStartGuidedTrack: () => void;
  onSaveVoiceTranscript: (items: Array<{ speaker: "user" | "edu"; text: string }>) => void;
}

export function EduChatPanel({
  messages,
  suggestions,
  isSending,
  deepThinking,
  onToggleDeepThinking,
  onSendMessage,
  onResetChat,
  isVoiceMode,
  onSetVoiceMode,
  learningSummary,
  onStartGuidedTrack,
  onSaveVoiceTranscript,
}: EduChatPanelProps) {
  const [input, setInput] = useState("");
  const [imgError, setImgError] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput("");
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <section
      aria-label="Assistente Edu"
      className="flex flex-col rounded-xl border border-slate-200 bg-white lg:h-[calc(100vh-6rem)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          {!imgError ? (
            <img
              src="/src/assets/images/avatar_edu_advisor_1794924490115.jpg"
              alt="Edu, educador financeiro do EducaFinance AI"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 font-display text-sm font-bold text-emerald-800 shrink-0">
              ED
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 truncate">
              Edu · Educador Financeiro
            </h2>
            <p className="text-xs text-slate-500 truncate">
              Orientação estruturada em R$ sem jargões complexos
            </p>
          </div>
        </div>

        {/* Mode switch */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 shrink-0">
          <button
            type="button"
            onClick={() => onSetVoiceMode(false)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              !isVoiceMode
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => onSetVoiceMode(true)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              isVoiceMode
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voz ao Vivo</span>
          </button>
        </div>
      </div>

      {isVoiceMode ? (
        <LiveVoicePanel
          learningSummary={learningSummary}
          onSaveTranscriptToChat={onSaveVoiceTranscript}
          onExitVoice={() => onSetVoiceMode(false)}
        />
      ) : (
        <>
          {/* Scrollable Thread */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {messages.length === 0 ? (
              <div className="space-y-6 py-2">
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold text-slate-900 text-balance">
                    Olá, eu sou o Edu. Vamos organizar sua vida financeira com clareza.
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Posso tirar dúvidas sobre a regra 50/30/20, calcular sua reserva de
                    emergência em R$, ajudar a sair de dívidas com juros altos ou analisar
                    suas simulações.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Primeira vez por aqui?
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Experimente a Trilha de Aprendizado Guiado ao lado para praticar o
                    método 50/30/20, reserva de emergência e simuladores com adaptação
                    personalizada.
                  </p>
                  <button
                    type="button"
                    onClick={onStartGuidedTrack}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <span>Ir para a Trilha Guiada</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">
                    Perguntas frequentes para começar
                  </p>
                  <div className="flex flex-col gap-2">
                    {KNOWLEDGE_BASE.faq.map((faq) => (
                      <button
                        key={faq.id}
                        type="button"
                        onClick={() => void onSendMessage(faq.pergunta)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                      >
                        <span>{faq.pergunta}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[85%] rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full space-y-3 border-b border-slate-100 pb-5 last:border-b-0">
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        {msg.structured?.resposta_contextualizada ?? msg.content}
                      </p>

                      {msg.structured?.calculo_realizado && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                          <p className="text-[11px] font-medium text-slate-500 mb-1">
                            Demonstração numérica
                          </p>
                          <p className="font-mono text-xs text-slate-800 tabular-nums whitespace-pre-line leading-relaxed">
                            {msg.structured.calculo_realizado}
                          </p>
                        </div>
                      )}

                      {msg.structured?.proximo_passo_recomendado && (
                        <div className="flex items-start gap-2 pt-1 text-xs text-emerald-800">
                          <ArrowRight
                            className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600"
                            aria-hidden="true"
                          />
                          <p className="leading-relaxed">
                            <span className="font-semibold">Próximo passo: </span>
                            {msg.structured.proximo_passo_recomendado}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Edu</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {msg.structured?.modelo_utilizado ??
                            (msg.source === "voice"
                              ? "Transcrição de voz"
                              : "EducaFinance AI")}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isSending && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {deepThinking
                  ? "Edu está realizando uma análise profunda no seu cenário..."
                  : "Edu está preparando sua resposta..."}
              </div>
            )}

            {!isSending && messages.length > 0 && suggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-slate-500">
                  Sugestões para continuar
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void onSendMessage(sug)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors text-left"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onToggleDeepThinking}
                aria-pressed={deepThinking}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  deepThinking
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                }`}
              >
                <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Análise Profunda {deepThinking ? "Ativa" : "Desligada"}
                </span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onResetChat}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Nova conversa</span>
                </button>
              )}
            </div>

            <div className="flex items-end gap-2">
              <label htmlFor="edu-chat-input" className="sr-only">
                Pergunte ao Edu sobre finanças pessoais
              </label>
              <textarea
                id="edu-chat-input"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex.: Ganho R$ 3.800 por mês e tenho dívida no cartão, por onde começo?"
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <span>Enviar</span>
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
