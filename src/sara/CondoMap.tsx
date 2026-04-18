import { ZONES } from "./data";
import type { Incident, ZoneId } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  activeIncidents: Incident[];
  selectedZone?: ZoneId | null;
  onSelectZone: (id: ZoneId) => void;
  residentVisible?: boolean;
}

export function CondoMap({ activeIncidents, selectedZone, onSelectZone, residentVisible }: Props) {
  const activeByZone = new Map(activeIncidents.map((i) => [i.zoneId, i]));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Faint grid backdrop */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Title overlay */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary blink" />
        <span className="font-mono-hud text-[10px] uppercase tracking-widest text-foreground">
          Digital Twin · Block A · Level 1
        </span>
      </div>
      <div className="absolute right-3 top-3 z-10 font-mono-hud text-[10px] uppercase tracking-widest text-muted-foreground">
        scanning {ZONES.length} zones
      </div>

      {residentVisible && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 font-mono-hud text-[10px] uppercase text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success blink" />
          Resident on premises
        </div>
      )}

      {/* Zones */}
      {ZONES.map((z) => {
        const incident = activeByZone.get(z.id);
        const isSelected = selectedZone === z.id;
        return (
          <button
            key={z.id}
            onClick={() => onSelectZone(z.id)}
            className={cn(
              "group absolute z-10 rounded-md border text-left transition-all",
              "hover:border-primary",
              incident
                ? "border-primary bg-primary/15 pulse-alert"
                : isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-secondary"
            )}
            style={{
              left: `${z.x}%`,
              top: `${z.y}%`,
              width: `${z.w}%`,
              height: `${z.h}%`,
            }}
          >
            <div className="flex h-full w-full flex-col justify-between p-1.5">
              <span
                className={cn(
                  "font-mono-hud text-[9px] uppercase tracking-wider",
                  incident ? "text-primary" : "text-muted-foreground"
                )}
              >
                {z.cameraId}
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  incident ? "text-foreground" : "text-foreground/80"
                )}
              >
                {z.label}
              </span>
            </div>
            {incident && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
