import { useCallback, useEffect, useMemo, useState } from "react";
import { BudgetDiagnostic503020 } from "./components/BudgetDiagnostic503020";
import { CompoundInterestSimulator } from "./components/CompoundInterestSimulator";
import { EduChatPanel } from "./components/EduChatPanel";
import { GuidedLearningMode } from "./components/GuidedLearningMode";
import { KnowledgeBasePanel } from "./components/KnowledgeBasePanel";
import { TopBar, type StudioTab } from "./components/TopBar";
import {
  formatBRL,
  type BudgetInput,
  type ChatMessage,
  type FinancialResponse,
  type LearningProgress,
  type SimulationParams,
} from "./lib/knowledgeBase";

const DEFAULT_PROGRESS: LearningProgress = {
  goal: null,
  activeModule: "regra-50-30-20",
  completedModules: [],
  moduleScores: {},
  lastFeedback: {},
  essentialMonthlyCost: 2800,
  stabilityType: "clt_estavel",
};

const DEFAULT_SIM: SimulationParams = {
  valor_inicial: 1000,
  aporte_mensal: 300,
  taxa_anual_pct: 10.5,
  meses: 60,
};

const DEFAULT_BUDGET: BudgetInput = {
  renda_liquida: 4000,
  necessidades: 2000,
  desejos: 1200,
  objetivos: 800,
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function loadStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [sessionId] = useState(() => `sess-${Date.now()}`);
  const [activeTab, setActiveTab] = useState<StudioTab>("trilha");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [deepThinking, setDeepThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [fromMissionSimulator, setFromMissionSimulator] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadStoredArray<ChatMessage>("educafinance_chat_v1", [])
  );
  const [progress, setProgress] = useState<LearningProgress>(() =>
    loadStored<LearningProgress>("educafinance_learning_v1", DEFAULT_PROGRESS)
  );
  const [simulationParams, setSimulationParams] = useState<SimulationParams>(() =>
    loadStored<SimulationParams>("educafinance_sim_v1", DEFAULT_SIM)
  );
  const [budgetInput, setBudgetInput] = useState<BudgetInput>(() =>
    loadStored<BudgetInput>("educafinance_budget_v1", DEFAULT_BUDGET)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem("educafinance_chat_v1", JSON.stringify(messages.slice(-40)));
    } catch {
      // Ignore storage quota errors
    }
  }, [messages]);

  useEffect(() => {
    try {
      window.localStorage.setItem("educafinance_learning_v1", JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  useEffect(() => {
    try {
      window.localStorage.setItem("educafinance_sim_v1", JSON.stringify(simulationParams));
    } catch {
      // Ignore storage quota errors
    }
  }, [simulationParams]);

  useEffect(() => {
    try {
      window.localStorage.setItem("educafinance_budget_v1", JSON.stringify(budgetInput));
    } catch {
      // Ignore storage quota errors
    }
  }, [budgetInput]);

  const learningSummary = useMemo(() => {
    const goalText = progress.goal ? `Objetivo principal: ${progress.goal}` : "Sem objetivo selecionado";
    const doneText =
      progress.completedModules.length > 0
        ? `Módulos concluídos: ${progress.completedModules.join(", ")}`
        : "Nenhum módulo concluído ainda";
    return `${goalText}. Módulo ativo: ${progress.activeModule}. ${doneText}. Custo essencial informado: ${formatBRL(
      progress.essentialMonthlyCost
    )}.`;
  }, [progress]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      setIsVoiceMode(false);

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: clean,
        timestamp: Date.now(),
        source: "text",
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      setSuggestions([]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: clean,
            deepThinking,
            learningSummary,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Não foi possível obter resposta do Edu.");
        }

        const structured = data as FinancialResponse;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: structured.resposta_contextualizada,
          structured,
          deepThinking,
          timestamp: Date.now(),
          source: "text",
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Fetch contextual follow-up suggestions asynchronously
        fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastUserMessage: clean,
            lastAssistantReply: structured.resposta_contextualizada,
            activeModule: progress.activeModule,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((sugData) => {
            if (sugData && Array.isArray(sugData.suggestions)) {
              setSuggestions(sugData.suggestions);
            }
          })
          .catch(() => undefined);
      } catch (err) {
        const errorText =
          err instanceof Error
            ? err.message
            : "Erro de comunicação com o servidor. Tente novamente em instantes.";
        const errorMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: errorText,
          structured: {
            resposta_contextualizada: `Não consegui processar sua solicitação agora: ${errorText}`,
            proximo_passo_recomendado:
              "Verifique se a chave da API está configurada em Settings > Secrets ou tente enviar novamente.",
            calculo_realizado: null,
            modelo_utilizado: "Aviso de sistema",
          },
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [deepThinking, learningSummary, progress.activeModule, sessionId]
  );

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setSuggestions([]);
    fetch("/api/chat/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined);
  }, [sessionId]);

  const handleSaveVoiceTranscript = useCallback(
    (items: Array<{ speaker: "user" | "edu"; text: string }>) => {
      const converted: ChatMessage[] = items.map((item, idx) => ({
        id: `v-${Date.now()}-${idx}`,
        role: item.speaker === "user" ? "user" : "assistant",
        content: item.text,
        timestamp: Date.now(),
        source: "voice",
      }));
      setMessages((prev) => [...prev, ...converted]);
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== "simulador") setFromMissionSimulator(false);
          setActiveTab(tab);
        }}
        isVoiceActive={isVoiceMode}
        onToggleVoice={() => setIsVoiceMode((prev) => !prev)}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Studio Column: Edu Hub (Chat & Live Voice) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <EduChatPanel
              messages={messages}
              suggestions={suggestions}
              isSending={isSending}
              deepThinking={deepThinking}
              onToggleDeepThinking={() => setDeepThinking((prev) => !prev)}
              onSendMessage={handleSendMessage}
              onResetChat={handleResetChat}
              isVoiceMode={isVoiceMode}
              onSetVoiceMode={setIsVoiceMode}
              learningSummary={learningSummary}
              onStartGuidedTrack={() => setActiveTab("trilha")}
              onSaveVoiceTranscript={handleSaveVoiceTranscript}
            />
          </div>

          {/* Right Studio Column: Interactive Learning & Financial Calculators */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              {activeTab === "trilha" && (
                <GuidedLearningMode
                  progress={progress}
                  onUpdateProgress={setProgress}
                  simulationParams={simulationParams}
                  onUpdateSimulationParams={setSimulationParams}
                  onOpenSimulator={() => {
                    setFromMissionSimulator(true);
                    setActiveTab("simulador");
                  }}
                  onOpenBudgetTool={() => setActiveTab("diagnostico")}
                  onAskEdu={handleSendMessage}
                />
              )}

              {activeTab === "simulador" && (
                <CompoundInterestSimulator
                  params={simulationParams}
                  onChangeParams={setSimulationParams}
                  onSendResultToEdu={handleSendMessage}
                  showMissionBanner={fromMissionSimulator}
                  onReturnToMission={() => {
                    setFromMissionSimulator(false);
                    setActiveTab("trilha");
                  }}
                />
              )}

              {activeTab === "diagnostico" && (
                <BudgetDiagnostic503020
                  budget={budgetInput}
                  onChangeBudget={setBudgetInput}
                  onSendBudgetToEdu={handleSendMessage}
                />
              )}

              {activeTab === "conhecimento" && (
                <KnowledgeBasePanel
                  onAskEdu={handleSendMessage}
                  onOpenSimulator={() => setActiveTab("simulador")}
                  onOpenBudgetTool={() => setActiveTab("diagnostico")}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>EducaFinance AI · Educação financeira em Português (PT-BR)</span>
          <span>Conteúdo educativo e simulações determinísticas em R$ — não constitui recomendação individual de investimento.</span>
        </div>
      </footer>
    </div>
  );
}
