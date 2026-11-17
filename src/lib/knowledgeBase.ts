export interface FaqItem {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  exemploPratico: string;
}

export interface ProdutoItem {
  id: string;
  nome: string;
  descricao: string;
  tipo: "calculadora" | "analise";
}

export interface KnowledgeBase {
  faq: FaqItem[];
  produtos: ProdutoItem[];
}

export const KNOWLEDGE_BASE: KnowledgeBase = {
  faq: [
    {
      id: "regra-50-30-20",
      categoria: "Orçamento",
      pergunta: "Como funciona a regra 50/30/20?",
      resposta:
        "A regra 50/30/20 divide sua renda líquida em três categorias: 50% para necessidades essenciais (moradia, saúde, alimentação, transporte básico), 30% para desejos e estilo de vida (lazer, assinaturas, restaurantes) e 20% para objetivos financeiros e investimentos (reserva de emergência, aposentadoria, quitação de dívidas).",
      exemploPratico:
        "Em uma renda líquida de R$ 4.000,00: R$ 2.000,00 para necessidades, R$ 1.200,00 para desejos e R$ 800,00 para objetivos financeiros.",
    },
    {
      id: "reserva-emergencia",
      categoria: "Proteção",
      pergunta: "O que é a reserva de emergência?",
      resposta:
        "É um montante equivalente a 6 a 12 meses do seu custo de vida mensal essencial, guardado em aplicações de alta liquidez e baixo risco (como Tesouro Selic ou CDB com liquidez diária) para proteger contra imprevistos como desemprego ou emergências médicas.",
      exemploPratico:
        "Se seus gastos essenciais somam R$ 2.500,00/mês, sua reserva ideal fica entre R$ 15.000,00 (6 meses) e R$ 30.000,00 (12 meses).",
    },
    {
      id: "sair-das-dividas",
      categoria: "Dívidas",
      pergunta: "Como sair das dívidas com juros altos?",
      resposta:
        "O método recomendado é o mapeamento total das dívidas, priorizando a quitação daquelas com maior taxa de juros (como cartão de crédito rotativo e cheque especial) através do método da avalanche ou consolidação de dívidas com taxas menores.",
      exemploPratico:
        "Liste todas as parcelas com saldo devedor e taxa mensal. Direcione todo excedente dos 20% para eliminar primeiro a dívida de maior juro.",
    },
  ],
  produtos: [
    {
      id: "simulador-juros-compostos",
      nome: "Simulador de Juros Compostos",
      descricao:
        "Calcula o crescimento do patrimônio ao longo do tempo considerando valor inicial, aportes mensais e taxa de juros anual.",
      tipo: "calculadora",
    },
    {
      id: "diagnostico-50-30-20",
      nome: "Diagnóstico 50/30/20",
      descricao:
        "Avalia o orçamento mensal da pessoa usuária e classifica os gastos de acordo com o método clássico.",
      tipo: "analise",
    },
  ],
};

export interface FinancialResponse {
  resposta_contextualizada: string;
  proximo_passo_recomendado: string;
  calculo_realizado: string | null;
  modelo_utilizado?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: FinancialResponse;
  deepThinking?: boolean;
  timestamp: number;
  source?: "text" | "voice" | "tool";
}

export interface SimulationParams {
  valor_inicial: number;
  aporte_mensal: number;
  taxa_anual_pct: number;
  meses: number;
}

export interface SimulationPoint {
  mes: number;
  montante: number;
  depositado: number;
}

export interface SimulationResult {
  valor_final: number;
  total_depositado: number;
  total_juros: number;
  taxa_mensal_pct: number;
  detalhes: SimulationPoint;
  historico: SimulationPoint[];
}

export interface BudgetInput {
  renda_liquida: number;
  necessidades: number;
  desejos: number;
  objetivos: number;
}

export type BudgetStatus = "no_alvo" | "atencao" | "acima_ideal" | "abaixo_ideal";

export interface BudgetCategoryMetrics {
  id: "necessidades" | "desejos" | "objetivos";
  nome: string;
  valor: number;
  percentualAtual: number;
  percentualMeta: number;
  valorMeta: number;
  diferencaBRL: number;
  status: BudgetStatus;
  statusLabel: string;
}

export interface BudgetAnalysis {
  renda_liquida: number;
  totalAlocado: number;
  saldoRestante: number;
  categorias: BudgetCategoryMetrics[];
}

export type GuidedModuleId = "regra-50-30-20" | "reserva-emergencia" | "simulador-pratica";

export type LearningGoal =
  | "organizar-orcamento"
  | "montar-reserva"
  | "quitar-dividas"
  | "fazer-render";

export interface AdaptiveFeedback {
  acertou: boolean;
  titulo_feedback: string;
  explicacao_adaptada: string;
  dica_pratica_brl: string;
  proximo_desafio: string;
  nivel_dominio: "iniciante" | "em_evolucao" | "consolidado";
}

export interface LearningProgress {
  goal: LearningGoal | null;
  activeModule: GuidedModuleId;
  completedModules: GuidedModuleId[];
  moduleScores: Partial<Record<GuidedModuleId, number>>;
  lastFeedback: Partial<Record<GuidedModuleId, AdaptiveFeedback>>;
  essentialMonthlyCost: number;
  stabilityType: "clt_estavel" | "autonomo_variavel";
}

export const LEARNING_GOALS: Array<{
  id: LearningGoal;
  titulo: string;
  descricao: string;
}> = [
  {
    id: "organizar-orcamento",
    titulo: "Organizar meus gastos mensais",
    descricao: "Entender para onde vai o dinheiro usando a divisão 50/30/20.",
  },
  {
    id: "montar-reserva",
    titulo: "Construir minha reserva de emergência",
    descricao: "Definir a meta em R$ e escolher onde deixar com liquidez diária.",
  },
  {
    id: "quitar-dividas",
    titulo: "Sair de dívidas com juros altos",
    descricao: "Priorizar juros caros e liberar espaço no orçamento.",
  },
  {
    id: "fazer-render",
    titulo: "Simular investimentos no longo prazo",
    descricao: "Visualizar o efeito dos aportes mensais e dos juros compostos.",
  },
];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1).replace(".", ",")}%`;
}

export function calcularJurosCompostos(params: SimulationParams): SimulationResult {
  const valorInicial = Math.max(0, Number(params.valor_inicial) || 0);
  const aporteMensal = Math.max(0, Number(params.aporte_mensal) || 0);
  const taxaAnualPct = Math.max(0, Number(params.taxa_anual_pct) || 0);
  const meses = Math.max(1, Math.min(600, Math.round(Number(params.meses) || 1)));

  const taxaMensal = Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1;
  let montante = valorInicial;
  const historico: SimulationPoint[] = [];

  for (let mes = 1; mes <= meses; mes++) {
    montante = (montante + aporteMensal) * (1 + taxaMensal);
    const depositado = valorInicial + aporteMensal * mes;
    historico.push({
      mes,
      montante: Math.round(montante * 100) / 100,
      depositado: Math.round(depositado * 100) / 100,
    });
  }

  const totalDepositado = Math.round((valorInicial + aporteMensal * meses) * 100) / 100;
  const valorFinal = Math.round(montante * 100) / 100;
  const totalJuros = Math.round((valorFinal - totalDepositado) * 100) / 100;

  return {
    valor_final: valorFinal,
    total_depositado: totalDepositado,
    total_juros: totalJuros,
    taxa_mensal_pct: Math.round(taxaMensal * 10000) / 100,
    detalhes: historico[historico.length - 1],
    historico,
  };
}

export function calcularDiagnostico503020(input: BudgetInput): BudgetAnalysis {
  const renda = Math.max(1, Number(input.renda_liquida) || 0);
  const necessidades = Math.max(0, Number(input.necessidades) || 0);
  const desejos = Math.max(0, Number(input.desejos) || 0);
  const objetivos = Math.max(0, Number(input.objetivos) || 0);

  const pctNec = (necessidades / renda) * 100;
  const pctDes = (desejos / renda) * 100;
  const pctObj = (objetivos / renda) * 100;

  const evalSpendCategory = (
    id: "necessidades" | "desejos",
    nome: string,
    valor: number,
    pct: number,
    metaPct: number
  ): BudgetCategoryMetrics => {
    const valorMeta = (renda * metaPct) / 100;
    const diferencaBRL = valor - valorMeta;
    let status: BudgetStatus = "no_alvo";
    let statusLabel = "No Alvo";

    if (pct > metaPct + 8) {
      status = "acima_ideal";
      statusLabel = "Acima do Ideal";
    } else if (pct > metaPct + 2) {
      status = "atencao";
      statusLabel = "Atenção";
    }

    return {
      id,
      nome,
      valor,
      percentualAtual: Math.round(pct * 10) / 10,
      percentualMeta: metaPct,
      valorMeta: Math.round(valorMeta * 100) / 100,
      diferencaBRL: Math.round(diferencaBRL * 100) / 100,
      status,
      statusLabel,
    };
  };

  const evalGoalCategory = (): BudgetCategoryMetrics => {
    const metaPct = 20;
    const valorMeta = (renda * metaPct) / 100;
    const diferencaBRL = objetivos - valorMeta;
    let status: BudgetStatus = "no_alvo";
    let statusLabel = "No Alvo";

    if (pctObj < metaPct - 8) {
      status = "abaixo_ideal";
      statusLabel = "Abaixo da Meta";
    } else if (pctObj < metaPct - 2) {
      status = "atencao";
      statusLabel = "Atenção";
    }

    return {
      id: "objetivos",
      nome: "Objetivos e Investimentos",
      valor: objetivos,
      percentualAtual: Math.round(pctObj * 10) / 10,
      percentualMeta: metaPct,
      valorMeta: Math.round(valorMeta * 100) / 100,
      diferencaBRL: Math.round(diferencaBRL * 100) / 100,
      status,
      statusLabel,
    };
  };

  const totalAlocado = necessidades + desejos + objetivos;

  return {
    renda_liquida: renda,
    totalAlocado: Math.round(totalAlocado * 100) / 100,
    saldoRestante: Math.round((renda - totalAlocado) * 100) / 100,
    categorias: [
      evalSpendCategory("necessidades", "Necessidades Essenciais", necessidades, pctNec, 50),
      evalSpendCategory("desejos", "Desejos e Estilo de Vida", desejos, pctDes, 30),
      evalGoalCategory(),
    ],
  };
}
