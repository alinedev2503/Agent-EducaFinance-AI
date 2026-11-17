import { ArrowRight, BookOpen } from "lucide-react";
import { KNOWLEDGE_BASE } from "../lib/knowledgeBase";

interface KnowledgeBasePanelProps {
  onAskEdu: (question: string) => Promise<void>;
  onOpenSimulator: () => void;
  onOpenBudgetTool: () => void;
}

export function KnowledgeBasePanel({
  onAskEdu,
  onOpenSimulator,
  onOpenBudgetTool,
}: KnowledgeBasePanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Base de Conhecimento Financeiro
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Diretrizes oficiais que fundamentam todas as respostas do Edu, sem invenção de taxas ou dados.
        </p>
      </div>

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {KNOWLEDGE_BASE.faq.map((item) => (
          <article key={item.id} className="p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{item.categoria}</span>
              <span aria-hidden="true">·</span>
              <span>Guia essencial</span>
            </div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {item.pergunta}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{item.resposta}</p>
            <p className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-700 leading-relaxed">
              {item.exemploPratico}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void onAskEdu(item.pergunta)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <span>Perguntar ao Edu com meu cenário</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ferramentas integradas no estúdio</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {KNOWLEDGE_BASE.produtos.map((prod) => (
            <div
              key={prod.id}
              className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <p className="text-xs text-slate-500">
                  {prod.tipo === "calculadora" ? "Calculadora determinística" : "Análise orçamentária"}
                </p>
                <h4 className="mt-1 font-display text-sm font-semibold text-slate-900">
                  {prod.nome}
                </h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {prod.descricao}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  prod.id === "simulador-juros-compostos"
                    ? onOpenSimulator()
                    : onOpenBudgetTool()
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:text-emerald-700"
              >
                <span>Abrir ferramenta</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
