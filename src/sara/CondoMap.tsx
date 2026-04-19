import { ZONES } from "./data";
import type { Incident, ZoneId } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  activeIncidents: Incident[];
  selectedZone?: ZoneId | null;
  onSelectZone: (id: ZoneId) => void;
}

export function CondoMap({ activeIncidents, selectedZone, onSelectZone }: Props) {
  const activeByZone = new Map(activeIncidents.map((i) => [i.zoneId, i]));

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary blink" aria-hidden />
          <span className="truncate font-mono-hud text-[10px] font-medium uppercase tracking-wide text-foreground">
            Site map · Block A · L1
          </span>
        </div>
        <span className="shrink-0 font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
          {ZONES.length} zones
        </span>
      </header>

      <div className="min-h-0 flex-1 p-2 sm:p-3">
        <div className="relative h-full min-h-[188px] w-full overflow-hidden rounded-md border border-border bg-secondary/40 sm:min-h-[210px]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {ZONES.map((z) => {
            const incident = activeByZone.get(z.id);
            const isSelected = selectedZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                title={`${z.label} (${z.cameraId})`}
                onClick={() => onSelectZone(z.id)}
                className={cn(
                  "absolute z-10 flex flex-col items-stretch justify-center overflow-hidden rounded border text-center transition-colors",
                  "px-0.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  incident
                    ? "border-primary bg-primary/20 ring-1 ring-primary/40 pulse-alert"
                    : isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/80 bg-card/90 hover:border-primary/60 hover:bg-card"
                )}
                style={{
                  left: `${z.x}%`,
                  top: `${z.y}%`,
                  width: `${z.w}%`,
                  height: `${z.h}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className={cn(
                    "block truncate font-mono-hud text-[7px] uppercase leading-none tracking-tight sm:text-[8px]",
                    incident ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {z.cameraId}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate px-0.5 text-[8px] font-medium leading-tight sm:text-[9px]",
                    incident ? "text-foreground" : "text-foreground/85"
                  )}
                >
                  {z.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
