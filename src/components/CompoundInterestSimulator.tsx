import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LineChart, Loader2, Sparkles } from "lucide-react";
import {
  calcularJurosCompostos,
  formatBRL,
  type FinancialResponse,
  type SimulationParams,
} from "../lib/knowledgeBase";

interface CompoundInterestSimulatorProps {
  params: SimulationParams;
  onChangeParams: (next: SimulationParams) => void;
  onSendResultToEdu: (prompt: string) => Promise<void>;
  showMissionBanner?: boolean;
  onReturnToMission?: () => void;
}

export function CompoundInterestSimulator({
  params,
  onChangeParams,
  onSendResultToEdu,
  showMissionBanner,
  onReturnToMission,
}: CompoundInterestSimulatorProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<FinancialResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const result = useMemo(() => calcularJurosCompostos(params), [params]);

  const handleAnalyzeInline = async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "juros",
          simulationInput: params,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível analisar a simulação.");
      }
      setAiAnalysis(data.analysis);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : "Erro ao gerar análise da simulação."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Build SVG coordinates
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 12;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 24;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const points = result.historico;
  const maxVal = Math.max(100, result.valor_final);
  const count = points.length;

  const getX = (idx: number) => {
    if (count <= 1) return padLeft + plotW;
    return padLeft + (idx / (count - 1)) * plotW;
  };
  const getY = (val: number) => {
    return padTop + plotH - (val / maxVal) * plotH;
  };

  const montantePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.montante).toFixed(1)}`)
    .join(" ");

  const depositadoPath = points
    .map(
      (pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.depositado).toFixed(1)}`
    )
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${montantePath} L ${getX(count - 1).toFixed(1)} ${(padTop + plotH).toFixed(
          1
        )} L ${getX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : "";

  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[count - 1];
  const activeX = hoverIdx !== null && points[hoverIdx] ? getX(hoverIdx) : getX(count - 1);

  const jurosPct =
    result.valor_final > 0
      ? Math.round((result.total_juros / result.valor_final) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {showMissionBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Missão da Trilha Guiada:</strong> Ajuste o aporte mensal para pelo menos{" "}
              <span className="font-mono font-semibold tabular-nums">R$ 300,00</span> e o prazo para{" "}
              <span className="font-mono font-semibold tabular-nums">60 meses</span> ou mais.
            </span>
          </div>
          {onReturnToMission && (
            <button
              type="button"
              onClick={onReturnToMission}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
            >
              Voltar à Trilha
            </button>
          )}
        </div>
      )}

      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Simulador de Juros Compostos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Explore o efeito do tempo e dos aportes mensais em Reais (R$) com cálculo determinístico mês a mês.
        </p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-slate-200 py-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Valor Final Projetado</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatBRL(result.valor_final)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Total Depositado</p>
          <p className="mt-1 font-mono text-xl font-medium text-slate-700 tabular-nums">
            {formatBRL(result.total_depositado)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">
            Juros Acumulados ({jurosPct}% do total)
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
            {formatBRL(result.total_juros)}
          </p>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="sim-inicial" className="font-medium text-slate-700">
              Valor inicial (R$)
            </label>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatBRL(params.valor_inicial)}
            </span>
          </div>
          <input
            id="sim-inicial"
            type="range"
            min={0}
            max={50000}
            step={500}
            value={Math.min(50000, params.valor_inicial)}
            onChange={(e) =>
              onChangeParams({ ...params, valor_inicial: Number(e.target.value) })
            }
            className="w-full accent-emerald-600"
          />
          <input
            type="number"
            min={0}
            step={100}
            aria-label="Digitar valor inicial em reais"
            value={params.valor_inicial}
            onChange={(e) =>
              onChangeParams({
                ...params,
                valor_inicial: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="sim-aporte" className="font-medium text-slate-700">
              Aporte mensal (R$)
            </label>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatBRL(params.aporte_mensal)}
            </span>
          </div>
          <input
            id="sim-aporte"
            type="range"
            min={0}
            max={5000}
            step={50}
            value={Math.min(5000, params.aporte_mensal)}
            onChange={(e) =>
              onChangeParams({ ...params, aporte_mensal: Number(e.target.value) })
            }
            className="w-full accent-emerald-600"
          />
          <input
            type="number"
            min={0}
            step={50}
            aria-label="Digitar aporte mensal em reais"
            value={params.aporte_mensal}
            onChange={(e) =>
              onChangeParams({
                ...params,
                aporte_mensal: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="sim-taxa" className="font-medium text-slate-700">
              Taxa anual (% a.a.)
            </label>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {params.taxa_anual_pct.toFixed(1).replace(".", ",")}% ({result.taxa_mensal_pct.toFixed(2).replace(".", ",")}% a.m.)
            </span>
          </div>
          <input
            id="sim-taxa"
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={Math.min(20, params.taxa_anual_pct)}
            onChange={(e) =>
              onChangeParams({ ...params, taxa_anual_pct: Number(e.target.value) })
            }
            className="w-full accent-emerald-600"
          />
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            aria-label="Digitar taxa anual em porcentagem"
            value={params.taxa_anual_pct}
            onChange={(e) =>
              onChangeParams({
                ...params,
                taxa_anual_pct: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="sim-meses" className="font-medium text-slate-700">
              Prazo (meses)
            </label>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {params.meses} meses ({(params.meses / 12).toFixed(1).replace(".", ",")} anos)
            </span>
          </div>
          <input
            id="sim-meses"
            type="range"
            min={6}
            max={360}
            step={6}
            value={Math.min(360, params.meses)}
            onChange={(e) =>
              onChangeParams({ ...params, meses: Number(e.target.value) })
            }
            className="w-full accent-emerald-600"
          />
          <input
            type="number"
            min={1}
            max={600}
            step={1}
            aria-label="Digitar prazo em meses"
            value={params.meses}
            onChange={(e) =>
              onChangeParams({
                ...params,
                meses: Math.max(1, Math.min(600, Math.round(Number(e.target.value) || 1))),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Interactive Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" aria-hidden="true" />
              Patrimônio Total
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
              <span className="h-0.5 w-3 bg-slate-400" aria-hidden="true" />
              Total Depositado
            </span>
          </div>
          {activePoint && (
            <div className="font-mono text-xs text-slate-700 tabular-nums">
              Mês {activePoint.mes}:{" "}
              <strong className="text-slate-900">{formatBRL(activePoint.montante)}</strong>{" "}
              <span className="text-slate-500">
                (aportado {formatBRL(activePoint.depositado)})
              </span>
            </div>
          )}
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-52 select-none overflow-visible"
          role="img"
          aria-label="Gráfico comparativo de evolução patrimonial versus total depositado"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            const ratio = Math.max(0, Math.min(1, (relX - padLeft) / plotW));
            const idx = Math.round(ratio * (count - 1));
            setHoverIdx(idx);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="eduEquityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padTop + plotH * (1 - frac);
            return (
              <line
                key={frac}
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#eduEquityFill)" />}
          {depositadoPath && (
            <path
              d={depositadoPath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          )}
          {montantePath && (
            <path
              d={montantePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {activePoint && (
            <>
              <line
                x1={activeX}
                x2={activeX}
                y1={padTop}
                y2={padTop + plotH}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <circle
                cx={activeX}
                cy={getY(activePoint.montante)}
                r="4.5"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
      </div>

      {/* Actions & AI Interpretation */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleAnalyzeInline()}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LineChart className="h-4 w-4" aria-hidden="true" />
          )}
          <span>Interpretar Simulação com IA</span>
        </button>

        <button
          type="button"
          onClick={() =>
            void onSendResultToEdu(
              `Acabei de simular juros compostos com valor inicial de ${formatBRL(
                params.valor_inicial
              )}, aporte mensal de ${formatBRL(params.aporte_mensal)}, taxa de ${
                params.taxa_anual_pct
              }% ao ano por ${params.meses} meses. O valor final deu ${formatBRL(
                result.valor_final
              )} (sendo ${formatBRL(
                result.total_juros
              )} de rendimentos). O que você recomenda para otimizar esse plano?`
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>Enviar para o Edu no Chat</span>
        </button>
      </div>

      {analyzeError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {analyzeError}
        </div>
      )}

      {aiAnalysis && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-slate-500">
            Leitura analítica · {aiAnalysis.modelo_utilizado ?? "gemini-4-argon"}
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">
            {aiAnalysis.resposta_contextualizada}
          </p>
          <div className="flex items-start gap-2 pt-1 text-xs text-emerald-800">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong>Próximo passo:</strong> {aiAnalysis.proximo_passo_recomendado}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
