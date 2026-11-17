import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";

interface VoiceTranscriptItem {
  id: string;
  speaker: "user" | "edu";
  text: string;
}

interface LiveVoicePanelProps {
  learningSummary: string;
  onSaveTranscriptToChat?: (items: Array<{ speaker: "user" | "edu"; text: string }>) => void;
  onExitVoice: () => void;
}

type ConnectionState = "idle" | "connecting" | "connected" | "error";

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float32;
}

export function LiveVoicePanel({
  learningSummary,
  onSaveTranscriptToChat,
  onExitVoice,
}: LiveVoicePanelProps) {
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isEduSpeaking, setIsEduSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const transcriptsRef = useRef<VoiceTranscriptItem[]>([]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore stopped source errors
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsEduSpeaking(false);
  }, []);

  const cleanupSession = useCallback(() => {
    stopPlaybackQueue();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => undefined);
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => undefined);
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
    setMicLevel(0);
  }, [stopPlaybackQueue]);

  const appendTranscript = useCallback((speaker: "user" | "edu", text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      let next: VoiceTranscriptItem[];
      if (last && last.speaker === speaker) {
        next = [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${clean}`.replace(/\s+/g, " ") },
        ];
      } else {
        next = [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, speaker, text: clean },
        ];
      }
      transcriptsRef.current = next;
      return next;
    });
  }, []);

  const playPcmChunk = useCallback((base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const samples = base64Pcm16ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }

    const startTime = nextStartTimeRef.current;
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setIsEduSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsEduSpeaking(false);
      }
    };

    source.start(startTime);
  }, []);

  const startVoiceSession = useCallback(async () => {
    cleanupSession();
    setErrorMsg(null);
    setStatus("connecting");
    setTranscripts([]);
    transcriptsRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}/live?context=${encodeURIComponent(
        learningSummary
      )}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);

          let sumSq = 0;
          for (let i = 0; i < channelData.length; i++) {
            sumSq += channelData[i] * channelData[i];
          }
          const rms = Math.sqrt(sumSq / channelData.length);
          setMicLevel(isMutedRef.current ? 0 : Math.min(1, rms * 6));

          if (isMutedRef.current) return;

          const base64 = float32ToPcm16Base64(channelData);
          ws.send(JSON.stringify({ type: "audio", data: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            setStatus("connected");
          } else if (msg.type === "audio" && msg.data) {
            playPcmChunk(msg.data);
          } else if (msg.type === "inputTranscript" && msg.text) {
            appendTranscript("user", msg.text);
          } else if (msg.type === "outputTranscript" && msg.text) {
            appendTranscript("edu", msg.text);
          } else if (msg.type === "interrupted") {
            stopPlaybackQueue();
          } else if (msg.type === "error") {
            setErrorMsg(msg.message || "Falha na sessão de voz.");
            setStatus("error");
            cleanupSession();
          }
        } catch {
          // Ignore malformed JSON frames
        }
      };

      ws.onerror = () => {
        setErrorMsg("Não foi possível manter a conexão WebSocket de voz.");
        setStatus("error");
        cleanupSession();
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Permissão de microfone negada ou indisponível no navegador.";
      setErrorMsg(msg);
      setStatus("error");
      cleanupSession();
    }
  }, [appendTranscript, cleanupSession, learningSummary, playPcmChunk, stopPlaybackQueue]);

  useEffect(() => {
    void startVoiceSession();
    return () => {
      cleanupSession();
    };
  }, [cleanupSession, startVoiceSession]);

  const handleEndCall = () => {
    if (onSaveTranscriptToChat && transcriptsRef.current.length > 0) {
      onSaveTranscriptToChat(
        transcriptsRef.current.map((item) => ({
          speaker: item.speaker,
          text: item.text,
        }))
      );
    }
    cleanupSession();
    onExitVoice();
  };

  const bars = [0.45, 0.75, 1, 0.8, 0.55, 0.9, 0.65, 0.4];

  return (
    <div className="flex flex-1 flex-col justify-between p-5 bg-white">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Conversa ao vivo por voz · gemini-3.8-live
              </p>
              <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
                {status === "connecting" && "Conectando ao Edu..."}
                {status === "connected" &&
                  (isEduSpeaking ? "Edu está respondendo..." : "Ouvindo você em tempo real")}
                {status === "error" && "Conexão de voz interrompida"}
                {status === "idle" && "Sessão de voz encerrada"}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 h-10 px-2" aria-hidden="true">
              {bars.map((factor, idx) => {
                const activity = isEduSpeaking ? 0.85 : micLevel;
                const heightPct = Math.max(20, Math.round((0.2 + activity * 0.8 * factor) * 100));
                return (
                  <span
                    key={idx}
                    className={`w-1.5 rounded-full transition-all duration-100 ${
                      isEduSpeaking
                        ? "bg-emerald-600"
                        : micLevel > 0.08
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              {errorMsg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              disabled={status !== "connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              {isMuted ? (
                <>
                  <MicOff className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <span>Microfone Silenciado</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>Silenciar Microfone</span>
                </>
              )}
            </button>

            {status === "error" || status === "idle" ? (
              <button
                type="button"
                onClick={() => void startVoiceSession()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span>Reconectar Voz</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleEndCall}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors ml-auto"
            >
              <PhoneOff className="h-4 w-4" aria-hidden="true" />
              <span>Encerrar e Voltar ao Chat</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Transcrição em tempo real</span>
            <span>Áudio 16kHz entrada · 24kHz saída</span>
          </div>

          <div className="h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            {transcripts.length === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                Comece falando naturalmente em português. Pergunte sobre a regra 50/30/20,
                quanto guardar na reserva de emergência ou peça ajuda para organizar dívidas.
              </p>
            ) : (
              transcripts.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col ${
                    item.speaker === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="mb-1 text-[11px] font-medium text-slate-500">
                    {item.speaker === "user" ? "Você" : "Edu"}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      item.speaker === "user"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
