import "dotenv/config";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { Modality, type LiveServerMessage } from "@google/genai";
import {
  buildEduSystemInstruction,
  generateAdaptiveLearningFeedback,
  generateFollowUpSuggestions,
  getGeminiClient,
  resetChatSession,
  runChatTurn,
  runDiagnosticAnalysis,
} from "./server/gemini.ts";
import {
  calcularDiagnostico503020,
  calcularJurosCompostos,
} from "./src/lib/knowledgeBase.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Deterministic Compound Interest Simulation endpoint
  app.post("/api/simular", (req, res) => {
    try {
      const { valor_inicial, aporte_mensal, taxa_anual_pct, meses } = req.body ?? {};
      if (
        typeof valor_inicial !== "number" ||
        typeof aporte_mensal !== "number" ||
        typeof taxa_anual_pct !== "number" ||
        typeof meses !== "number" ||
        valor_inicial < 0 ||
        aporte_mensal < 0 ||
        taxa_anual_pct < 0 ||
        meses <= 0
      ) {
        res.status(400).json({
          error: "Parâmetros inválidos para simulação de juros compostos.",
        });
        return;
      }
      const resultado = calcularJurosCompostos({
        valor_inicial,
        aporte_mensal,
        taxa_anual_pct,
        meses,
      });
      res.json(resultado);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao simular juros.";
      res.status(500).json({ error: message });
    }
  });

  // Multi-turn Chat endpoint (gemini-4-hydrogen or gemini-4-carbon with ThinkingLevel.HIGH)
  app.post("/api/chat", async (req, res) => {
    try {
      const { sessionId, message, deepThinking, learningSummary } = req.body ?? {};
      if (typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "A mensagem não pode estar vazia." });
        return;
      }

      const result = await runChatTurn({
        sessionId: typeof sessionId === "string" && sessionId ? sessionId : "default",
        message: message.trim(),
        deepThinking: Boolean(deepThinking),
        learningSummary: typeof learningSummary === "string" ? learningSummary : undefined,
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao consultar o Edu.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/chat/reset", (req, res) => {
    const { sessionId } = req.body ?? {};
    resetChatSession(typeof sessionId === "string" && sessionId ? sessionId : "default");
    res.json({ ok: true });
  });

  // Fast contextual follow-up suggestions (gemini-3.1-flash-lite)
  app.post("/api/suggest", async (req, res) => {
    try {
      const { lastUserMessage, lastAssistantReply, activeModule } = req.body ?? {};
      const suggestions = await generateFollowUpSuggestions({
        lastUserMessage: String(lastUserMessage ?? ""),
        lastAssistantReply: String(lastAssistantReply ?? ""),
        activeModule,
      });
      res.json({ suggestions });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar sugestões.";
      res.status(500).json({ error: message });
    }
  });

  // Diagnostic analysis for 50/30/20 or Compound Interest Simulator (gemini-4-argon)
  app.post("/api/diagnose", async (req, res) => {
    try {
      const { kind, simulationInput, budgetInput } = req.body ?? {};
      if (kind === "juros" && simulationInput) {
        const result = calcularJurosCompostos(simulationInput);
        const analysis = await runDiagnosticAnalysis({
          kind: "juros",
          simulation: { input: simulationInput, result },
        });
        res.json({ analysis, result });
        return;
      }

      if (kind === "orcamento" && budgetInput) {
        const budget = calcularDiagnostico503020(budgetInput);
        const analysis = await runDiagnosticAnalysis({
          kind: "orcamento",
          budget,
        });
        res.json({ analysis, budget });
        return;
      }

      res.status(400).json({ error: "Tipo ou dados de diagnóstico inválidos." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar diagnóstico.";
      res.status(500).json({ error: message });
    }
  });

  // Adaptive Guided Learning endpoint
  app.post("/api/learn/adapt", async (req, res) => {
    try {
      const {
        moduleId,
        goal,
        completedModules,
        userResponseSummary,
        scorePct,
        correctCount,
        totalCount,
      } = req.body ?? {};

      if (!moduleId || !userResponseSummary) {
        res.status(400).json({ error: "Dados da etapa de aprendizado ausentes." });
        return;
      }

      const feedback = await generateAdaptiveLearningFeedback({
        moduleId,
        goal: goal ?? null,
        completedModules: Array.isArray(completedModules) ? completedModules : [],
        userResponseSummary: String(userResponseSummary),
        scorePct: Number(scorePct ?? 0),
        correctCount: Number(correctCount ?? 0),
        totalCount: Number(totalCount ?? 1),
      });

      res.json(feedback);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao adaptar conteúdo guiado.";
      res.status(500).json({ error: message });
    }
  });

  // Setup Vite middleware in development or serve static build in production
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  // WebSocket bridge for Gemini Live API (gemini-3.8-live) on /live
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (reqUrl.pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket, request: http.IncomingMessage) => {
    let liveSession: Awaited<ReturnType<ReturnType<typeof getGeminiClient>["live"]["connect"]>> | null =
      null;

    try {
      const reqUrl = new URL(request.url ?? "/live", `http://${request.headers.host}`);
      const learningSummary = reqUrl.searchParams.get("context") ?? undefined;
      const ai = getGeminiClient();

      liveSession = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: [
            buildEduSystemInstruction(learningSummary),
            "Nesta conversa por voz em tempo real, fale em Português do Brasil de forma natural, calorosa, objetiva e concisa (frases curtas e fáceis de ouvir).",
          ].join("\n"),
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "ready" }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: "inputTranscript",
                  text: content.inputTranscription.text,
                })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: "outputTranscript",
                  text: content.outputTranscription.text,
                })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: "audio",
                    data: part.inlineData.data,
                  })
                );
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  message:
                    err instanceof Error
                      ? err.message
                      : "Erro na conexão de voz com o Gemini Live.",
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "closed" }));
              clientWs.close();
            }
          },
        },
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a sessão de voz.";
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: "error", message: msg }));
        clientWs.close();
      }
      return;
    }

    clientWs.on("message", (raw) => {
      if (!liveSession) return;
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type === "audio" && typeof payload.data === "string") {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.data,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (payload.type === "text" && typeof payload.text === "string") {
          liveSession.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    clientWs.on("close", () => {
      try {
        liveSession?.close();
      } catch {
        // Ignore close errors
      }
      liveSession = null;
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`EducaFinance AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
