import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { filterStations } from "../lib/filter-stations";
import type { AirQualityStation } from "../types/air-quality";

interface StationComboboxProps {
  id?: string;
  stations: AirQualityStation[];
  value: string;
  onChange: (stationId: string) => void;
}

interface ComboboxOption {
  id: string;
  label: string;
  country: string;
}

const ALL_OPTION: ComboboxOption = {
  id: "all",
  label: "Todas las ubicaciones",
  country: "",
};

export function StationCombobox({
  id,
  stations,
  value,
  onChange,
}: StationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = stations.find((station) => station.id === value);
  const displayValue =
    selected === undefined
      ? ALL_OPTION.label
      : `${selected.name}, ${selected.country}`;

  const options = useMemo<ComboboxOption[]>(() => {
    const matches = filterStations(stations, query).map((station) => ({
      id: station.id,
      label: station.name,
      country: station.country,
    }));

    return query.trim() === "" ? [ALL_OPTION, ...matches] : matches;
  }, [query, stations]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current !== null &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const select = (stationId: string) => {
    onChange(stationId);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (open && options[highlight] !== undefined) {
        event.preventDefault();
        select(options[highlight].id);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[highlight] !== undefined
              ? `${listId}-${options[highlight].id}`
              : undefined
          }
          autoComplete="off"
          value={open ? query : displayValue}
          placeholder="Buscar ciudad o país…"
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setHighlight(0);
          }}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
          className="control-select w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <ChevronsUpDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">
              Sin resultados
            </li>
          )}
          {options.map((option, index) => {
            const isSelected = option.id === value;
            return (
              <li key={option.id} id={`${listId}-${option.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => select(option.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                    index === highlight
                      ? "bg-teal-50 text-teal-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {option.label}
                    {option.country !== "" && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        {option.country}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check size={14} className="shrink-0 text-teal-700" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
