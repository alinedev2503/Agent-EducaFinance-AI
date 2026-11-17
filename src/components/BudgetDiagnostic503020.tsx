import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PieChart,
} from "lucide-react";
import {
  calcularDiagnostico503020,
  formatBRL,
  type BudgetInput,
  type BudgetStatus,
  type FinancialResponse,
} from "../lib/knowledgeBase";

interface BudgetDiagnostic503020Props {
  budget: BudgetInput;
  onChangeBudget: (next: BudgetInput) => void;
  onSendBudgetToEdu: (prompt: string) => Promise<void>;
}

const PRESETS: Array<{ label: string; data: BudgetInput }> = [
  {
    label: "Equilibrado (R$ 4.000)",
    data: { renda_liquida: 4000, necessidades: 2000, desejos: 1200, objetivos: 800 },
  },
  {
    label: "Aperto nos Desejos (R$ 3.500)",
    data: { renda_liquida: 3500, necessidades: 1950, desejos: 1350, objetivos: 200 },
  },
  {
    label: "Foco em Dívidas (R$ 5.000)",
    data: { renda_liquida: 5000, necessidades: 2600, desejos: 1100, objetivos: 1300 },
  },
];

function StatusBadge({ status, label }: { status: BudgetStatus; label: string }) {
  if (status === "no_alvo") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === "atencao") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function BudgetDiagnostic503020({
  budget,
  onChangeBudget,
  onSendBudgetToEdu,
}: BudgetDiagnostic503020Props) {
  const [aiResult, setAiResult] = useState<FinancialResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const analysis = useMemo(() => calcularDiagnostico503020(budget), [budget]);

  const handleDiagnoseAI = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "orcamento",
          budgetInput: budget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível gerar o diagnóstico.");
      }
      setAiResult(data.analysis);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erro ao gerar diagnóstico financeiro."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Diagnóstico Orçamentário 50/30/20
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Compare seus gastos mensais em R$ com a divisão clássica: 50% necessidades, 30% desejos e 20% objetivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChangeBudget(preset.data)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Numeric Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="bd-renda" className="block text-xs font-medium text-slate-700">
            Renda líquida (R$)
          </label>
          <input
            id="bd-renda"
            type="number"
            min={100}
            step={100}
            value={budget.renda_liquida}
            onChange={(e) =>
              onChangeBudget({
                ...budget,
                renda_liquida: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bd-nec" className="block text-xs font-medium text-slate-700">
            Necessidades (50%)
          </label>
          <input
            id="bd-nec"
            type="number"
            min={0}
            step={50}
            value={budget.necessidades}
            onChange={(e) =>
              onChangeBudget({
                ...budget,
                necessidades: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bd-des" className="block text-xs font-medium text-slate-700">
            Desejos (30%)
          </label>
          <input
            id="bd-des"
            type="number"
            min={0}
            step={50}
            value={budget.desejos}
            onChange={(e) =>
              onChangeBudget({
                ...budget,
                desejos: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bd-obj" className="block text-xs font-medium text-slate-700">
            Objetivos / Dívidas (20%)
          </label>
          <input
            id="bd-obj"
            type="number"
            min={0}
            step={50}
            value={budget.objetivos}
            onChange={(e) =>
              onChangeBudget({
                ...budget,
                objetivos: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Comparison Rows */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {analysis.categorias.map((cat) => {
          const barWidth = Math.min(100, Math.max(0, cat.percentualAtual));
          const barColor =
            cat.status === "no_alvo"
              ? "bg-emerald-600"
              : cat.status === "atencao"
              ? "bg-amber-500"
              : "bg-rose-600";

          return (
            <div key={cat.id} className="p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{cat.nome}</h3>
                  <p className="text-xs text-slate-500">
                    Meta: {cat.percentualMeta}% ({formatBRL(cat.valorMeta)})
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <StatusBadge status={cat.status} label={cat.statusLabel} />
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatBRL(cat.valor)}
                    </p>
                    <p className="text-xs text-slate-500">{cat.percentualAtual}% da renda</p>
                  </div>
                </div>
              </div>

              <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
                <span
                  aria-hidden="true"
                  title={`Referência ${cat.percentualMeta}%`}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50"
                  style={{ left: `${cat.percentualMeta}%` }}
                />
              </div>

              <p className="text-xs text-slate-600 font-mono tabular-nums">
                {cat.diferencaBRL === 0
                  ? "Exatamente alinhado à meta recomendada."
                  : cat.diferencaBRL > 0
                  ? `${formatBRL(cat.diferencaBRL)} acima da referência (${cat.percentualMeta}%).`
                  : `${formatBRL(Math.abs(cat.diferencaBRL))} abaixo da referência (${cat.percentualMeta}%).`}
              </p>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-4 py-3 text-xs">
          <span className="font-medium text-slate-600">
            Total alocado:{" "}
            <strong className="font-mono text-slate-900 tabular-nums">
              {formatBRL(analysis.totalAlocado)}
            </strong>
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              analysis.saldoRestante < 0 ? "text-rose-700" : "text-slate-700"
            }`}
          >
            {analysis.saldoRestante < 0
              ? `Excesso de ${formatBRL(Math.abs(analysis.saldoRestante))} sobre a renda`
              : `Saldo não alocado: ${formatBRL(analysis.saldoRestante)}`}
          </span>
        </div>
      </div>

      {/* Actions & AI Result */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleDiagnoseAI()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <PieChart className="h-4 w-4" aria-hidden="true" />
          )}
          <span>Gerar Diagnóstico com IA</span>
        </button>

        <button
          type="button"
          onClick={() =>
            void onSendBudgetToEdu(
              `Minha renda líquida é ${formatBRL(
                budget.renda_liquida
              )}. Gasto ${formatBRL(budget.necessidades)} em necessidades, ${formatBRL(
                budget.desejos
              )} em desejos e ${formatBRL(
                budget.objetivos
              )} em objetivos/investimentos. Como posso melhorar meu 50/30/20?`
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
        >
          <span>Discutir no Chat com o Edu</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      {aiResult && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-slate-500">
            Diagnóstico personalizado · {aiResult.modelo_utilizado ?? "gemini-4-argon"}
          </p>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
            {aiResult.resposta_contextualizada}
          </p>
          <div className="flex items-start gap-2 pt-1 text-xs text-emerald-800">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong>Próximo passo:</strong> {aiResult.proximo_passo_recomendado}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
