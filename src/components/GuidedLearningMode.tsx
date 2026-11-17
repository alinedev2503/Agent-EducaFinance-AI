import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  LEARNING_GOALS,
  calcularJurosCompostos,
  formatBRL,
  type AdaptiveFeedback,
  type GuidedModuleId,
  type LearningGoal,
  type LearningProgress,
  type SimulationParams,
} from "../lib/knowledgeBase";

interface GuidedLearningModeProps {
  progress: LearningProgress;
  onUpdateProgress: (updater: (prev: LearningProgress) => LearningProgress) => void;
  simulationParams: SimulationParams;
  onUpdateSimulationParams: (next: SimulationParams) => void;
  onOpenSimulator: () => void;
  onOpenBudgetTool: () => void;
  onAskEdu: (prompt: string) => Promise<void>;
}

interface ClassificationItem {
  id: string;
  label: string;
  valorBRL: number;
  expected: "necessidades" | "desejos" | "objetivos";
  hint: string;
}

const CLASSIFICATION_ITEMS: ClassificationItem[] = [
  {
    id: "aluguel",
    label: "Aluguel, luz e supermercado básico",
    valorBRL: 2200,
    expected: "necessidades",
    hint: "Despesas essenciais para morar, se alimentar e manter a rotina básica (50%).",
  },
  {
    id: "lazer",
    label: "Streaming, delivery de fim de semana e passeios",
    valorBRL: 650,
    expected: "desejos",
    hint: "Estilo de vida e lazer que podem ser ajustados sem afetar sua sobrevivência (30%).",
  },
  {
    id: "reserva",
    label: "Aporte mensal para Reserva de Emergência",
    valorBRL: 500,
    expected: "objetivos",
    hint: "Construção de patrimônio e proteção financeira fazem parte dos 20%.",
  },
  {
    id: "cartao",
    label: "Parcela para quitar rotativo do cartão de crédito",
    valorBRL: 450,
    expected: "objetivos",
    hint: "Quitar dívidas com juros altos também entra nos 20% de objetivos financeiros.",
  },
];

const MODULES: Array<{
  id: GuidedModuleId;
  numero: string;
  titulo: string;
  resumo: string;
}> = [
  {
    id: "regra-50-30-20",
    numero: "01",
    titulo: "Regra 50/30/20",
    resumo: "Classifique gastos reais em R$",
  },
  {
    id: "reserva-emergencia",
    numero: "02",
    titulo: "Reserva de Emergência",
    resumo: "Calcule sua meta e liquidez",
  },
  {
    id: "simulador-pratica",
    numero: "03",
    titulo: "Uso dos Simuladores",
    resumo: "Missão prática de juros compostos",
  },
];

export function GuidedLearningMode({
  progress,
  onUpdateProgress,
  simulationParams,
  onUpdateSimulationParams,
  onOpenSimulator,
  onOpenBudgetTool,
  onAskEdu,
}: GuidedLearningModeProps) {
  // Module 1 local selections
  const [classifications, setClassifications] = useState<
    Record<string, "necessidades" | "desejos" | "objetivos">
  >({});

  // Module 2 local selection
  const [liquidityChoice, setLiquidityChoice] = useState<
    "liquidez_diaria" | "acoes" | "prazo_fixo" | null
  >(null);

  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState<string | null>(null);

  const completedCount = progress.completedModules.length;
  const activeFeedback = progress.lastFeedback[progress.activeModule];

  const requestAdaptiveFeedback = async (payload: {
    moduleId: GuidedModuleId;
    userResponseSummary: string;
    scorePct: number;
    correctCount: number;
    totalCount: number;
  }) => {
    setIsAdapting(true);
    setAdaptError(null);
    try {
      const res = await fetch("/api/learn/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          goal: progress.goal,
          completedModules: progress.completedModules,
        }),
      });
      const data: AdaptiveFeedback & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível adaptar o conteúdo agora.");
      }

      onUpdateProgress((prev) => {
        const nextCompleted =
          data.acertou && !prev.completedModules.includes(payload.moduleId)
            ? [...prev.completedModules, payload.moduleId]
            : prev.completedModules;

        return {
          ...prev,
          completedModules: nextCompleted,
          moduleScores: {
            ...prev.moduleScores,
            [payload.moduleId]: payload.scorePct,
          },
          lastFeedback: {
            ...prev.lastFeedback,
            [payload.moduleId]: data,
          },
        };
      });
    } catch (err) {
      setAdaptError(
        err instanceof Error ? err.message : "Erro ao gerar feedback adaptativo."
      );
    } finally {
      setIsAdapting(false);
    }
  };

  // Module 1 submit handler
  const handleCheckModule1 = async () => {
    let correct = 0;
    const lines = CLASSIFICATION_ITEMS.map((item) => {
      const picked = classifications[item.id] ?? "não respondido";
      const ok = picked === item.expected;
      if (ok) correct++;
      return `- ${item.label} (${formatBRL(item.valorBRL)}): usuário marcou '${picked}', esperado '${item.expected}' (${
        ok ? "acertou" : "errou"
      })`;
    });
    const scorePct = Math.round((correct / CLASSIFICATION_ITEMS.length) * 100);
    await requestAdaptiveFeedback({
      moduleId: "regra-50-30-20",
      userResponseSummary: lines.join("\n"),
      scorePct,
      correctCount: correct,
      totalCount: CLASSIFICATION_ITEMS.length,
    });
  };

  // Module 2 submit handler
  const monthsTarget = progress.stabilityType === "clt_estavel" ? 6 : 12;
  const reserveTargetBRL = progress.essentialMonthlyCost * monthsTarget;

  const handleCheckModule2 = async () => {
    const isCorrectVehicle = liquidityChoice === "liquidez_diaria";
    const correct = isCorrectVehicle ? 1 : 0;
    const scorePct = isCorrectVehicle ? 100 : 40;
    const summary = [
      `Custo mensal essencial informado: ${formatBRL(progress.essentialMonthlyCost)}`,
      `Perfil de renda: ${
        progress.stabilityType === "clt_estavel"
          ? "CLT / renda mais estável (referência 6 meses)"
          : "Autônomo / renda variável (referência 12 meses)"
      }`,
      `Meta calculada de reserva: ${formatBRL(reserveTargetBRL)}`,
      `Aplicação escolhida pelo usuário: ${liquidityChoice ?? "nenhuma"} (ideal: Tesouro Selic ou CDB com liquidez diária)`,
    ].join("\n");

    await requestAdaptiveFeedback({
      moduleId: "reserva-emergencia",
      userResponseSummary: summary,
      scorePct,
      correctCount: correct,
      totalCount: 1,
    });
  };

  // Module 3 mission verification
  const simResult = calcularJurosCompostos(simulationParams);
  const critAporte = simulationParams.aporte_mensal >= 300;
  const critPrazo = simulationParams.meses >= 60;
  const critJuros = simResult.total_juros > 0;
  const missionMetCount = [critAporte, critPrazo, critJuros].filter(Boolean).length;

  const handleCheckModule3 = async () => {
    const scorePct = Math.round((missionMetCount / 3) * 100);
    const summary = [
      `Parâmetros testados pelo usuário no Simulador de Juros Compostos:`,
      `- Valor inicial: ${formatBRL(simulationParams.valor_inicial)}`,
      `- Aporte mensal: ${formatBRL(simulationParams.aporte_mensal)} (meta >= R$ 300: ${
        critAporte ? "cumprida" : "pendente"
      })`,
      `- Prazo: ${simulationParams.meses} meses (meta >= 60 meses: ${
        critPrazo ? "cumprida" : "pendente"
      })`,
      `- Taxa anual: ${simulationParams.taxa_anual_pct}% a.a.`,
      `- Resultado: valor final ${formatBRL(simResult.valor_final)} (depositado ${formatBRL(
        simResult.total_depositado
      )}, juros acumulados ${formatBRL(simResult.total_juros)})`,
    ].join("\n");

    await requestAdaptiveFeedback({
      moduleId: "simulador-pratica",
      userResponseSummary: summary,
      scorePct,
      correctCount: missionMetCount,
      totalCount: 3,
    });
  };

  const handleSelectGoal = (goal: LearningGoal) => {
    const recommendedModule: GuidedModuleId =
      goal === "montar-reserva"
        ? "reserva-emergencia"
        : goal === "fazer-render"
        ? "simulador-pratica"
        : "regra-50-30-20";

    onUpdateProgress((prev) => ({
      ...prev,
      goal,
      activeModule: recommendedModule,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header & Progress */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Modo de Aprendizado Guiado
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tutoriais interativos em PT-BR que se adaptam às suas respostas e ao seu ritmo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
            {completedCount} de 3 módulos concluídos
          </span>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onUpdateProgress((prev) => ({
                  ...prev,
                  completedModules: [],
                  moduleScores: {},
                  lastFeedback: {},
                }))
              }
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
              title="Reiniciar progresso da trilha"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reiniciar</span>
            </button>
          )}
        </div>
      </div>

      {/* Thin progress track */}
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-emerald-600 transition-all duration-200"
          style={{ width: `${Math.round((completedCount / 3) * 100)}%` }}
        />
      </div>

      {/* Adaptive Goal Picker */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">
            1. Qual é o seu principal objetivo agora? (O Edu adapta a trilha para você)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {LEARNING_GOALS.map((g) => {
            const selected = progress.goal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSelectGoal(g.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-emerald-600 bg-white ring-1 ring-emerald-600"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-slate-900">{g.titulo}</p>
                <p className="mt-0.5 text-xs text-slate-500">{g.descricao}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {MODULES.map((mod) => {
          const isActive = progress.activeModule === mod.id;
          const isDone = progress.completedModules.includes(mod.id);
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() =>
                onUpdateProgress((prev) => ({ ...prev, activeModule: mod.id }))
              }
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`font-mono font-semibold ${
                    isActive ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {mod.numero}
                </span>
                {isDone && (
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      isActive ? "text-emerald-300" : "text-emerald-700"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Concluído</span>
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-display text-sm font-semibold">{mod.titulo}</p>
              <p
                className={`mt-0.5 text-xs ${
                  isActive ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {mod.resumo}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Module Stage */}
      {progress.activeModule === "regra-50-30-20" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-slate-900">
              01. Prática da Regra 50/30/20
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Classifique cada lançamento mensal abaixo na categoria correta da metodologia
              50/30/20 para verificar como equilibrar seu orçamento.
            </p>
          </div>

          <div className="divide-y divide-slate-100 border-y border-slate-200">
            {CLASSIFICATION_ITEMS.map((item) => {
              const selected = classifications[item.id];
              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="font-mono text-xs text-slate-500 tabular-nums">
                      {formatBRL(item.valorBRL)}/mês
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(
                      [
                        { id: "necessidades", label: "50% Essencial" },
                        { id: "desejos", label: "30% Desejos" },
                        { id: "objetivos", label: "20% Objetivos" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setClassifications((prev) => ({ ...prev, [item.id]: opt.id }))
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                          selected === opt.id
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                            : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCheckModule1()}
              disabled={
                isAdapting || Object.keys(classifications).length < CLASSIFICATION_ITEMS.length
              }
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isAdapting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Compass className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Verificar e Adaptar Explicação</span>
            </button>

            <button
              type="button"
              onClick={onOpenBudgetTool}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 transition-colors"
            >
              <span>Testar Meu Orçamento Real</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {progress.activeModule === "reserva-emergencia" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-slate-900">
              02. Planejando sua Reserva de Emergência
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              A reserva protege contra imprevistos (desemprego ou saúde) cobrindo de 6 a 12
              meses do seu custo mensal essencial.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="gl-custo" className="font-medium text-slate-700">
                  Seu custo mensal essencial (R$)
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatBRL(progress.essentialMonthlyCost)}
                </span>
              </div>
              <input
                id="gl-custo"
                type="range"
                min={1000}
                max={12000}
                step={250}
                value={progress.essentialMonthlyCost}
                onChange={(e) =>
                  onUpdateProgress((prev) => ({
                    ...prev,
                    essentialMonthlyCost: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Estabilidade da renda</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProgress((prev) => ({
                      ...prev,
                      stabilityType: "clt_estavel",
                    }))
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    progress.stabilityType === "clt_estavel"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Mais estável (6 meses)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProgress((prev) => ({
                      ...prev,
                      stabilityType: "autonomo_variavel",
                    }))
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    progress.stabilityType === "autonomo_variavel"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Variável (12 meses)
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">
              Meta recomendada ({monthsTarget} meses de custo essencial):
            </span>
            <span className="font-mono text-lg font-semibold text-emerald-700 tabular-nums">
              {formatBRL(reserveTargetBRL)}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Onde é mais seguro guardar essa reserva?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: "liquidez_diaria",
                    title: "Tesouro Selic ou CDB liquidez diária",
                    desc: "Baixo risco e resgate rápido quando precisar.",
                  },
                  {
                    id: "acoes",
                    title: "Ações de alta oscilação",
                    desc: "Pode cair justamente na hora da emergência.",
                  },
                  {
                    id: "prazo_fixo",
                    title: "Título travado por 5 anos",
                    desc: "Não permite saque imediato sem perda.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLiquidityChoice(opt.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    liquidityChoice === opt.id
                      ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900">{opt.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCheckModule2()}
              disabled={isAdapting || !liquidityChoice}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isAdapting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Confirmar Escolha e Gerar Plano</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateSimulationParams({
                  valor_inicial: 0,
                  aporte_mensal: Math.max(300, Math.round(progress.essentialMonthlyCost * 0.2)),
                  taxa_anual_pct: 10.5,
                  meses: 36,
                });
                onOpenSimulator();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 transition-colors"
            >
              <span>Simular Aportes para a Reserva</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {progress.activeModule === "simulador-pratica" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-slate-900">
              03. Missão Prática no Simulador de Juros Compostos
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Experimente os controles reais do simulador para enxergar como aportes constantes
              e prazo multiplicam seu patrimônio ao longo do tempo.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              Critérios da missão ({missionMetCount}/3 concluídos)
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className={critAporte ? "text-emerald-800 font-medium" : "text-slate-600"}>
                  1. Definir aporte mensal de pelo menos R$ 300,00
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatBRL(simulationParams.aporte_mensal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={critPrazo ? "text-emerald-800 font-medium" : "text-slate-600"}>
                  2. Testar horizonte de 60 meses (5 anos) ou mais
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {simulationParams.meses} meses
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={critJuros ? "text-emerald-800 font-medium" : "text-slate-600"}>
                  3. Observar juros acumulados positivos no valor final
                </span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                  +{formatBRL(simResult.total_juros)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="gl-sim-aporte" className="font-medium text-slate-700">
                  Ajustar aporte mensal
                </label>
                <span className="font-mono font-semibold tabular-nums">
                  {formatBRL(simulationParams.aporte_mensal)}
                </span>
              </div>
              <input
                id="gl-sim-aporte"
                type="range"
                min={0}
                max={3000}
                step={50}
                value={Math.min(3000, simulationParams.aporte_mensal)}
                onChange={(e) =>
                  onUpdateSimulationParams({
                    ...simulationParams,
                    aporte_mensal: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="gl-sim-prazo" className="font-medium text-slate-700">
                  Ajustar prazo (meses)
                </label>
                <span className="font-mono font-semibold tabular-nums">
                  {simulationParams.meses} meses
                </span>
              </div>
              <input
                id="gl-sim-prazo"
                type="range"
                min={12}
                max={240}
                step={12}
                value={Math.min(240, simulationParams.meses)}
                onChange={(e) =>
                  onUpdateSimulationParams({
                    ...simulationParams,
                    meses: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCheckModule3()}
              disabled={isAdapting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isAdapting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Validar Missão com o Edu</span>
            </button>

            <button
              type="button"
              onClick={onOpenSimulator}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 transition-colors"
            >
              <span>Ver Gráfico Completo no Simulador</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {adaptError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {adaptError}
        </div>
      )}

      {/* Adaptive AI Feedback Card */}
      {activeFeedback && (
        <div
          className={`rounded-xl border p-5 space-y-3 ${
            activeFeedback.acertou
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-amber-200 bg-amber-50/60"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-sm font-semibold text-slate-900">
              {activeFeedback.titulo_feedback}
            </h4>
            <span className="text-xs font-medium text-slate-600">
              Nível atual:{" "}
              <strong className="text-slate-900">
                {activeFeedback.nivel_dominio === "consolidado"
                  ? "Consolidado"
                  : activeFeedback.nivel_dominio === "em_evolucao"
                  ? "Em evolução"
                  : "Iniciante"}
              </strong>
            </span>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed">
            {activeFeedback.explicacao_adaptada}
          </p>

          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900">Aplicação em R$: </strong>
            {activeFeedback.dica_pratica_brl}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-700">
              <strong>Próximo desafio: </strong>
              {activeFeedback.proximo_desafio}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void onAskEdu(
                    `Estou na etapa "${progress.activeModule}" da trilha guiada. ${activeFeedback.explicacao_adaptada} Pode me ajudar com o próximo passo: "${activeFeedback.proximo_desafio}"?`
                  )
                }
                className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap"
              >
                Aprofundar com o Edu no chat
              </button>
              {progress.activeModule !== "simulador-pratica" && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMod: GuidedModuleId =
                      progress.activeModule === "regra-50-30-20"
                        ? "reserva-emergencia"
                        : "simulador-pratica";
                    onUpdateProgress((prev) => ({ ...prev, activeModule: nextMod }));
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <span>Avançar Módulo</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
