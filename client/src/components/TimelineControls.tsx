import { Pause, Play, Radio } from "lucide-react";
import { formatObservationTime, type TimelineFrame } from "../lib/timeline";

interface TimelineControlsProps {
  frames: TimelineFrame[];
  activeIndex: number;
  isPlaying: boolean;
  isLive: boolean;
  speed: number;
  onScrub: (index: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onGoLive: () => void;
}

const SPEEDS = [1, 2, 4];

export function TimelineControls({
  frames,
  activeIndex,
  isPlaying,
  isLive,
  speed,
  onScrub,
  onTogglePlay,
  onSpeedChange,
  onGoLive,
}: TimelineControlsProps) {
  const activeFrame = frames[activeIndex];
  const disabled = frames.length < 2;

  return (
    <div className="timeline-controls absolute inset-x-0 bottom-0 z-20 border-t border-white/80 bg-white/95 px-3 py-2.5 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={isPlaying ? "Pausar reproducción" : "Reproducir histórico"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={1}
          value={Math.max(activeIndex, 0)}
          onChange={(event) => onScrub(Number(event.target.value))}
          disabled={disabled}
          aria-label="Recorrer las horas del periodo"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-teal-700 disabled:cursor-not-allowed"
        />

        <span className="w-[84px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-700">
          {activeFrame === undefined
            ? "Sin datos"
            : formatObservationTime(activeFrame.timestamp)}
        </span>

        <button
          type="button"
          onClick={onGoLive}
          disabled={disabled}
          aria-pressed={isLive}
          title="Volver a la última hora disponible"
          className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition ${
            isLive
              ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          <Radio size={12} />
          <span className="hidden sm:inline">Ahora</span>
        </button>

        <div className="hidden shrink-0 items-center gap-0.5 rounded-md bg-slate-100 p-0.5 md:flex">
          {SPEEDS.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onSpeedChange(option)}
              aria-pressed={speed === option}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                speed === option
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-1 flex w-full max-w-2xl items-center justify-between px-10 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">
        <span>{frames.length} horas</span>
        <span>{isLive ? "En vivo" : "Histórico"}</span>
      </div>
    </div>
  );
}
