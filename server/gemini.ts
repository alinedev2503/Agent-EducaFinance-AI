import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type { Content } from "@google/genai";
import {
  KNOWLEDGE_BASE,
  type AdaptiveFeedback,
  type BudgetAnalysis,
  type FinancialResponse,
  type GuidedModuleId,
  type LearningGoal,
  type SimulationParams,
  type SimulationResult,
  formatBRL,
} from "../src/lib/knowledgeBase.ts";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chave GEMINI_API_KEY não configurada no servidor. Verifique Settings > Secrets."
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

export function buildEduSystemInstruction(learningSummary?: string): string {
  const kbJson = JSON.stringify(KNOWLEDGE_BASE, null, 2);
  const progressBlock = learningSummary
    ? `\nContexto atual de aprendizado do usuário:\n${learningSummary}\nAdapte seus exemplos e recomendações levando em conta esse progresso.\n`
    : "";

  return [
    "Você é o 'Edu', um educador financeiro brasileiro empático, claro, acolhedor e seguro do EducaFinance AI.",
    "Seu objetivo é ajudar a pessoa usuária em suas dúvidas financeiras, planejamento em Reais (R$), organização de orçamento e simulações.",
    "REGRAS ESTRITAS:",
    "1. Responda sempre em Português do Brasil (PT-BR), com clareza e sem jargões complexos desnecessários.",
    "2. Responda APENAS com base nas informações fornecidas na Base de Conhecimento abaixo ou em princípios financeiros sólidos e matemática financeira verificável.",
    "3. Se não possuir informação suficiente sobre algum produto específico ou taxa de mercado em tempo real, diga claramente que não sabe e oriente o próximo passo prático.",
    "4. Nunca invente dados, rentabilidades garantidas ou taxas fictícias.",
    "5. Use valores monetários no formato brasileiro (R$ 1.250,00) quando fizer contas.",
    progressBlock,
    `Base de Conhecimento:\n${kbJson}`,
  ].join("\n");
}

const financialResponseSchema = {
  type: Type.OBJECT,
  properties: {
    resposta_contextualizada: {
      type: Type.STRING,
      description:
        "Resposta clara, objetiva e acolhedora baseada na base de conhecimento e princípios financeiros sólidos.",
    },
    proximo_passo_recomendado: {
      type: Type.STRING,
      description: "Sugestão de ação prática e imediata para a pessoa usuária.",
    },
    calculo_realizado: {
      type: Type.STRING,
      description:
        "Demonstração numérica ou simulação financeira em R$ passo a passo se aplicável, ou string vazia quando não houver cálculo.",
    },
  },
  required: ["resposta_contextualizada", "proximo_passo_recomendado"],
};

// In-memory multi-turn conversation store keyed by sessionId
const sessionHistories = new Map<string, Content[]>();

export function resetChatSession(sessionId: string): void {
  sessionHistories.delete(sessionId);
}

export async function runChatTurn(params: {
  sessionId: string;
  message: string;
  deepThinking: boolean;
  learningSummary?: string;
}): Promise<FinancialResponse> {
  const ai = getGeminiClient();
  const history = sessionHistories.get(params.sessionId) ?? [];
  const modelName = params.deepThinking ? "gemini-4-carbon" : "gemini-4-hydrogen";

  const chat = ai.chats.create({
    model: modelName,
    history,
    config: {
      systemInstruction: buildEduSystemInstruction(params.learningSummary),
      responseMimeType: "application/json",
      responseSchema: financialResponseSchema,
      ...(params.deepThinking
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
        : { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } }),
    },
  });

  const response = await chat.sendMessage({
    message: params.message,
  });

  const rawText = (response.text ?? "").trim();
  let parsed: FinancialResponse;

  try {
    const json = JSON.parse(rawText);
    const calc =
      typeof json.calculo_realizado === "string" && json.calculo_realizado.trim().length > 0
        ? json.calculo_realizado.trim()
        : null;

    parsed = {
      resposta_contextualizada:
        json.resposta_contextualizada ||
        "Não consegui estruturar a resposta completamente, mas posso ajudar com sua organização financeira.",
      proximo_passo_recomendado:
        json.proximo_passo_recomendado ||
        "Teste o Simulador de Juros Compostos ou o Diagnóstico 50/30/20 ao lado para visualizar seus números.",
      calculo_realizado: calc,
      modelo_utilizado: params.deepThinking
        ? "Análise profunda (gemini-4-carbon)"
        : "Resposta padrão (gemini-4-hydrogen)",
    };
  } catch {
    parsed = {
      resposta_contextualizada: rawText,
      proximo_passo_recomendado:
        "Revise sua dúvida ou explore as ferramentas ao lado para detalharmos um plano prático.",
      calculo_realizado: null,
      modelo_utilizado: params.deepThinking
        ? "Análise profunda (gemini-4-carbon)"
        : "Resposta padrão (gemini-4-hydrogen)",
    };
  }

  // Persist multi-turn history safely
  const updatedHistory: Content[] = [
    ...history,
    { role: "user", parts: [{ text: params.message }] },
    { role: "model", parts: [{ text: parsed.resposta_contextualizada }] },
  ];
  sessionHistories.set(params.sessionId, updatedHistory.slice(-24));

  return parsed;
}

export async function generateFollowUpSuggestions(params: {
  lastUserMessage: string;
  lastAssistantReply: string;
  activeModule?: GuidedModuleId;
}): Promise<string[]> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: [
      "Gere exatamente 3 perguntas curtas e naturais em PT-BR (máximo 9 palavras cada) que a pessoa usuária poderia fazer em seguida para continuar aprendendo com o Edu.",
      `Módulo atual: ${params.activeModule ?? "livre"}`,
      `Última pergunta do usuário: ${params.lastUserMessage}`,
      `Última resposta do Edu: ${params.lastAssistantReply}`,
    ].join("\n"),
    config: {
      systemInstruction:
        "Retorne apenas um array JSON com 3 perguntas curtas em Português (PT-BR) sobre finanças pessoais, regra 50/30/20, reserva de emergência, dívidas ou juros compostos.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  const json = JSON.parse((response.text ?? "[]").trim());
  if (Array.isArray(json)) {
    return json.filter((item): item is string => typeof item === "string").slice(0, 3);
  }
  return [];
}

export async function runDiagnosticAnalysis(params: {
  kind: "juros" | "orcamento";
  simulation?: { input: SimulationParams; result: SimulationResult };
  budget?: BudgetAnalysis;
}): Promise<FinancialResponse> {
  const ai = getGeminiClient();

  let prompt = "";
  if (params.kind === "juros" && params.simulation) {
    const { input, result } = params.simulation;
    prompt = [
      "Analise esta simulação real de juros compostos em R$:",
      `- Valor inicial: ${formatBRL(input.valor_inicial)}`,
      `- Aporte mensal: ${formatBRL(input.aporte_mensal)}`,
      `- Taxa anual: ${input.taxa_anual_pct}% ao ano (${result.taxa_mensal_pct}% ao mês)`,
      `- Prazo: ${input.meses} meses`,
      `- Total depositado pela pessoa: ${formatBRL(result.total_depositado)}`,
      `- Total em juros compostos acumulados: ${formatBRL(result.total_juros)}`,
      `- Valor final projetado: ${formatBRL(result.valor_final)}`,
      "Explique o peso dos juros compostos nesse resultado, alerte sobre consistência dos aportes ou reserva de emergência antes de prazos longos, e dê um próximo passo prático.",
    ].join("\n");
  } else if (params.kind === "orcamento" && params.budget) {
    const b = params.budget;
    const catLines = b.categorias
      .map(
        (c) =>
          `- ${c.nome}: ${formatBRL(c.valor)} (${c.percentualAtual}% vs meta de ${c.percentualMeta}% = ${formatBRL(c.valorMeta)}, status: ${c.statusLabel})`
      )
      .join("\n");

    prompt = [
      "Analise este Diagnóstico 50/30/20 real informado pela pessoa usuária:",
      `- Renda líquida mensal: ${formatBRL(b.renda_liquida)}`,
      `- Total alocado: ${formatBRL(b.totalAlocado)}`,
      `- Saldo não alocado / diferença: ${formatBRL(b.saldoRestante)}`,
      catLines,
      "Faça um diagnóstico empático e prático em PT-BR destacando onde ajustar em R$ primeiro e qual prioridade seguir (ex.: equilibrar essenciais, ajustar desejos ou fortalecer os 20% para reserva/dívidas).",
    ].join("\n");
  } else {
    throw new Error("Dados insuficientes para diagnóstico.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-4-argon",
    contents: prompt,
    config: {
      systemInstruction: buildEduSystemInstruction(),
      responseMimeType: "application/json",
      responseSchema: financialResponseSchema,
    },
  });

  const data = JSON.parse((response.text ?? "{}").trim());
  return {
    resposta_contextualizada: data.resposta_contextualizada,
    proximo_passo_recomendado: data.proximo_passo_recomendado,
    calculo_realizado:
      typeof data.calculo_realizado === "string" && data.calculo_realizado.trim().length > 0
        ? data.calculo_realizado.trim()
        : null,
    modelo_utilizado: "Diagnóstico analítico (gemini-4-argon)",
  };
}

export async function generateAdaptiveLearningFeedback(params: {
  moduleId: GuidedModuleId;
  goal: LearningGoal | null;
  completedModules: GuidedModuleId[];
  userResponseSummary: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
}): Promise<AdaptiveFeedback> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: [
      `Módulo da trilha: ${params.moduleId}`,
      `Objetivo principal do usuário: ${params.goal ?? "não informado"}`,
      `Módulos já concluídos: ${params.completedModules.join(", ") || "nenhum"}`,
      `Desempenho nesta etapa: ${params.correctCount} de ${params.totalCount} (${params.scorePct}%)`,
      `Detalhes da resposta/ação do usuário:\n${params.userResponseSummary}`,
      "Adapte o feedback didático em PT-BR com base exatamente no que o usuário respondeu e no seu progresso.",
      "Se houve erro ou dúvida, reforce o conceito com exemplo concreto em Reais (R$) sem julgar. Se acertou tudo, proponha um desafio prático um passo adiante no estúdio.",
    ].join("\n\n"),
    config: {
      systemInstruction: buildEduSystemInstruction(),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          acertou: {
            type: Type.BOOLEAN,
            description: "Verdadeiro se o desempenho atingiu o objetivo principal da etapa.",
          },
          titulo_feedback: {
            type: Type.STRING,
            description: "Título curto e encorajador adaptado ao resultado.",
          },
          explicacao_adaptada: {
            type: Type.STRING,
            description:
              "Explicação personalizada comentando diretamente as escolhas feitas pelo usuário nesta etapa.",
          },
          dica_pratica_brl: {
            type: Type.STRING,
            description: "Exemplo ou regra prática aplicada com valores em R$.",
          },
          proximo_desafio: {
            type: Type.STRING,
            description: "Próximo passo adaptado ao progresso atual dentro do EducaFinance AI.",
          },
          nivel_dominio: {
            type: Type.STRING,
            description: "Deve ser exatamente: iniciante, em_evolucao ou consolidado.",
          },
        },
        required: [
          "acertou",
          "titulo_feedback",
          "explicacao_adaptada",
          "dica_pratica_brl",
          "proximo_desafio",
          "nivel_dominio",
        ],
      },
    },
  });

  const data = JSON.parse((response.text ?? "{}").trim());
  const nivel =
    data.nivel_dominio === "consolidado" || data.nivel_dominio === "em_evolucao"
      ? data.nivel_dominio
      : "iniciante";

  return {
    acertou: Boolean(data.acertou),
    titulo_feedback: data.titulo_feedback || "Etapa analisada pelo Edu",
    explicacao_adaptada: data.explicacao_adaptada,
    dica_pratica_brl: data.dica_pratica_brl,
    proximo_desafio: data.proximo_desafio,
    nivel_dominio: nivel,
  };
}
