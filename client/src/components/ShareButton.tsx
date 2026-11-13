import { useRef, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toPng } from "html-to-image";

export interface ShareCardData {
  title: string;
  subtitle: string;
  metricLabel: string;
  value: string;
  unit: string;
  categoryLabel: string | null;
  timestampLabel: string | null;
  readingCount: number;
}

interface ShareButtonProps {
  data: ShareCardData;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ShareButton({ data }: ShareButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    const node = cardRef.current;
    if (node === null || isSharing) {
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#f7f8f6",
      });
      const fileName = `air-quality-${slugify(data.title) || "resumen"}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Calidad del aire · ${data.title}`,
        });
        return;
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      link.click();
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }

      setError("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        disabled={isSharing}
        aria-label="Compartir resumen de calidad del aire"
        title="Compartir resumen"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-wait disabled:opacity-50"
      >
        {isSharing ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Share2 size={15} />
        )}
      </button>
      {error !== null && (
        <span
          role="alert"
          className="absolute right-0 top-10 z-50 w-48 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] leading-4 text-rose-700 shadow-sm"
        >
          {error}
        </span>
      )}

      <div className="share-card-offscreen" aria-hidden="true">
        <div ref={cardRef} className="w-[420px] bg-[#f7f8f6] p-6 text-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold tracking-tight text-white">
                AQ
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">
                  Air Quality Tracker
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Observatorio atmosférico global
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 ring-1 ring-slate-200">
              Open-Meteo
            </span>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
              {data.subtitle}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              {data.title}
            </h2>

            <div className="mt-5 flex items-end gap-2">
              <span className="text-6xl font-semibold leading-none tracking-tight text-slate-900">
                {data.value}
              </span>
              <span className="pb-1.5 text-sm font-medium text-slate-400">
                {data.unit}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {data.metricLabel}
              </span>
              {data.categoryLabel !== null && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                  {data.categoryLabel}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400">
            <span>{data.timestampLabel ?? "Sin fecha"}</span>
            <span>
              {data.readingCount} lecturas · Estimaciones modeladas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
