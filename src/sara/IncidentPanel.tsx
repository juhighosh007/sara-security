import { AlertTriangle, FileDown, X, ShieldAlert, Check, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ContactLogEntry, Incident } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  incident: Incident | null;
  countdownSeconds: number | null;
  onToggleChecklist: (incidentId: string, itemId: string) => void;
  onAcknowledge: (incidentId: string) => void;
  onSos: (incidentId: string) => void;
  onResolve: (incidentId: string) => void;
  onDismiss: () => void;
}

export function IncidentPanel({
  incident,
  countdownSeconds,
  onToggleChecklist,
  onAcknowledge,
  onSos,
  onResolve,
  onDismiss,
}: Props) {
  if (!incident) {
    return (
      <aside className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center lg:min-h-0 lg:flex-1">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-success/40 bg-success/10 text-success">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="mt-4 font-mono-hud text-xs uppercase tracking-wider text-muted-foreground">
          No active incidents
        </p>
        <p className="mt-1 max-w-[28ch] text-xs text-muted-foreground">
          SARA is watching the lobby live feed. When a situation is detected, the details appear here
          for your response.
        </p>
      </aside>
    );
  }

  const elapsed = Math.floor((Date.now() - incident.detectedAt) / 1000);
  const acknowledged = !!incident.acknowledgedAt;
  const escalated = !!incident.escalatedAt;
  const showCountdown = !acknowledged && countdownSeconds !== null && countdownSeconds > 0;

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/40 bg-card shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-2 border-b border-border bg-primary/10 p-3">
        <div className="flex items-start gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="font-mono-hud text-[9px] uppercase tracking-wider text-primary">
              Incident #{incident.id} · {incident.cameraId}
            </p>
            <h3 className="text-sm font-semibold leading-tight">{incident.label}</h3>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        {/* Escalation banner */}
        {showCountdown && (
          <div className="flex items-center justify-between rounded-md border border-primary bg-primary/10 px-3 py-2">
            <div>
              <p className="font-mono-hud text-[9px] uppercase tracking-wider text-primary">
                Auto-escalation in
              </p>
              <p className="font-mono-hud text-2xl font-bold text-primary">
                {countdownSeconds}s
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onAcknowledge(incident.id)}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Acknowledge
            </Button>
          </div>
        )}

        {acknowledged && !escalated && (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-success">
            <Check className="h-4 w-4" />
            <span className="font-mono-hud text-[10px] uppercase">
              Acknowledged by guard · escalation paused
            </span>
          </div>
        )}

        {escalated && (
          <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-primary">
            <ShieldAlert className="h-4 w-4" />
            <span className="font-mono-hud text-[10px] uppercase">
              Escalated · supervisor notified
            </span>
          </div>
        )}

        {/* Pattern */}
        <div>
          <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
            Situation detected
          </p>
          <p className="mt-1 text-sm">{incident.pattern}</p>
          {incident.detectorReason && (
            <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
              <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
                Observation
              </p>
              <p className="mt-1 font-mono-hud text-[10px] leading-snug text-foreground">
                {incident.detectorReason}
              </p>
            </div>
          )}
        </div>

        {/* Confidence + severity row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-secondary p-3">
            <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
              Confidence
            </p>
            <p className="mt-1 font-mono-hud text-2xl text-foreground">{incident.confidence}%</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${incident.confidence}%` }}
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-secondary p-3">
            <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
              Severity
            </p>
            <p
              className={cn(
                "mt-1 font-mono-hud text-2xl uppercase",
                incident.severity === "high" ? "text-primary" : "text-foreground"
              )}
            >
              {incident.severity}
            </p>
            <p className="mt-2 font-mono-hud text-[10px] uppercase text-muted-foreground">
              T+{Math.floor(elapsed / 60)}m {elapsed % 60}s
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
            SARA recommends
          </p>
          <p className="mt-1 text-sm text-foreground">{incident.recommendation}</p>
        </div>

        {/* Checklist */}
        <div>
          <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
            Guard playbook
          </p>
          <ul className="mt-2 space-y-1.5">
            {incident.checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded border border-border bg-card p-2">
                <Checkbox
                  id={`${incident.id}-${item.id}`}
                  checked={item.done}
                  onCheckedChange={() => onToggleChecklist(incident.id, item.id)}
                />
                <label
                  htmlFor={`${incident.id}-${item.id}`}
                  className={cn(
                    "cursor-pointer text-sm",
                    item.done && "text-muted-foreground line-through"
                  )}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact log */}
        <div>
          <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
            Contact log
          </p>
          {incident.contactLog.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No contacts notified yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {incident.contactLog.map((c, i) => (
                <ContactRow key={i} entry={c} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border bg-card p-3">
        {!acknowledged && !escalated && (
          <Button
            onClick={() => onSos(incident.id)}
            variant="outline"
            className="w-full gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Send className="h-4 w-4" />
            SOS — Escalate now
          </Button>
        )}
        <Button
          onClick={() => onResolve(incident.id)}
          className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
        >
          <FileDown className="h-4 w-4" />
          Resolve & generate report
        </Button>
      </div>
    </aside>
  );
}

function ContactRow({ entry }: { entry: ContactLogEntry }) {
  const Icon = entry.channel === "telegram" ? MessageCircle : Send;
  const time = new Date(entry.at).toLocaleTimeString("en-GB", { hour12: false });
  const tone =
    entry.status === "sent"
      ? "text-success"
      : entry.status === "failed"
      ? "text-primary"
      : "text-muted-foreground";
  return (
    <li className="flex items-center gap-2 rounded border border-border bg-secondary px-2 py-1.5 text-xs">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="font-mono-hud text-[10px] uppercase text-muted-foreground">{time}</span>
      <span className="flex-1 truncate">
        <span className="capitalize">{entry.channel}</span> → {entry.target}
      </span>
      <span className={cn("font-mono-hud text-[9px] uppercase", tone)}>{entry.status}</span>
    </li>
  );
}
