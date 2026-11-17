import { Mic, MicOff } from "lucide-react";

export type StudioTab = "trilha" | "simulador" | "diagnostico" | "conhecimento";

interface TopBarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  isVoiceActive: boolean;
  onToggleVoice: () => void;
}

const NAV_ITEMS: Array<{ id: StudioTab; label: string }> = [
  { id: "trilha", label: "Trilha Guiada" },
  { id: "simulador", label: "Simulador" },
  { id: "diagnostico", label: "Diagnóstico 50/30/20" },
  { id: "conhecimento", label: "Conhecimento" },
];

export function TopBar({
  activeTab,
  onSelectTab,
  isVoiceActive,
  onToggleVoice,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab("trilha")}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 rounded"
        >
          EducaFinance AI
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav
          aria-label="Navegação do estúdio"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded ${
                  isActive
                    ? "text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-emerald-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleVoice}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
              isVoiceActive
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {isVoiceActive ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden="true" />
                <span>Encerrar Voz</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                <span>Conversar por Voz</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Navegação móvel"
        className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`whitespace-nowrap shrink-0 px-2 py-1 rounded transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-800 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
