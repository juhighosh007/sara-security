import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/sara/Header";
import { CondoMap } from "@/sara/CondoMap";
import { FeedTile } from "@/sara/FeedTile";
import { IncidentPanel } from "@/sara/IncidentPanel";
import { Button } from "@/components/ui/button";
import { Zap, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CHECKLIST,
  DEFAULT_ESCALATION_SECONDS,
  FEEDS,
  PATTERNS,
  ZONES,
  zoneById,
} from "@/sara/data";
import type { ContactLogEntry, Incident, ZoneId } from "@/sara/types";
import { generateIncidentPdf } from "@/sara/pdf";

const Index = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [knownDescriptors, setKnownDescriptors] = useState<Float32Array[]>([]);
  const [residentVisible, setResidentVisible] = useState(false);
  const [tick, setTick] = useState(0); // 1Hz tick for countdown UI

  // Snapshot capture functions registered by feed tiles
  const captureRefs = useRef<Record<string, () => string | null>>({});
  const registerCapture = (feedId: string) => (fn: () => string | null) => {
    captureRefs.current[feedId] = fn;
  };

  const activeIncident = useMemo(() => {
    if (selectedZone) {
      const sel = incidents.find((i) => i.zoneId === selectedZone && !i.resolvedAt);
      if (sel) return sel;
    }
    return incidents.find((i) => !i.resolvedAt) ?? null;
  }, [incidents, selectedZone]);

  // 1Hz tick for countdown rendering
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const triggerIncident = useCallback(
    (opts?: {
      forcedZone?: ZoneId;
      pattern?: string;
      severity?: "low" | "medium" | "high";
      recommendation?: string;
      snapshot?: string | null;
      trigger?: Incident["trigger"];
    }) => {
      setIncidents((prev) => {
        const taken = new Set(prev.filter((i) => !i.resolvedAt).map((i) => i.zoneId));
        const candidates = ZONES.filter((z) => !taken.has(z.id));
        if (candidates.length === 0) return prev;
        const zone = opts?.forcedZone
          ? zoneById(opts.forcedZone) ?? candidates[0]
          : candidates[Math.floor(Math.random() * candidates.length)];
        const pat = opts?.pattern
          ? {
              pattern: opts.pattern,
              severity: opts.severity ?? ("high" as const),
              recommendation: opts.recommendation ?? "Verify the individual via intercom.",
            }
          : PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
        const incident: Incident = {
          id: String(Date.now()).slice(-5),
          zoneId: zone.id,
          cameraId: zone.cameraId,
          label: `${zone.label} — ${zone.cameraId}`,
          pattern: pat.pattern,
          severity: pat.severity,
          recommendation: pat.recommendation,
          confidence: 78 + Math.floor(Math.random() * 20),
          detectedAt: Date.now(),
          checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
          escalationSeconds: DEFAULT_ESCALATION_SECONDS,
          contactLog: [],
          trigger: opts?.trigger ?? "auto_pattern",
          snapshot: opts?.snapshot ?? undefined,
        };
        toast.error(`ALERT · ${zone.label}`, {
          description: `${pat.pattern} · ${incident.confidence}% confidence`,
        });
        setSelectedZone(zone.id);
        return [...prev, incident];
      });
    },
    []
  );

  // Auto-trigger loop (mocked AI detection)
  useEffect(() => {
    if (!autoMode) return;
    const t = setInterval(() => {
      const active = incidents.filter((i) => !i.resolvedAt).length;
      if (active < 2 && Math.random() < 0.35) triggerIncident();
    }, 12000);
    return () => clearInterval(t);
  }, [autoMode, incidents, triggerIncident]);

  const toggleChecklist = (incidentId: string, itemId: string) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              checklist: i.checklist.map((c) =>
                c.id === itemId ? { ...c, done: !c.done } : c
              ),
            }
          : i
      )
    );
  };

  const acknowledgeIncident = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === incidentId ? { ...i, acknowledgedAt: Date.now() } : i))
    );
    toast.success("Incident acknowledged", {
      description: "Auto-escalation paused.",
    });
  };

  const appendContact = (incidentId: string, entry: ContactLogEntry) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incidentId ? { ...i, contactLog: [...i.contactLog, entry] } : i
      )
    );
  };

  const escalateIncident = useCallback(async (incidentId: string, manual: boolean) => {
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident || incident.escalatedAt) return;

    setIncidents((prev) =>
      prev.map((i) => (i.id === incidentId ? { ...i, escalatedAt: Date.now() } : i))
    );

    toast.warning(manual ? "SOS sent" : "Auto-escalation triggered", {
      description: "Notifying supervisor and town council…",
    });

    // Telegram (real, via edge function if configured)
    let telegramStatus: ContactLogEntry["status"] = "pending";
    let telegramDetail: string | undefined;
    try {
      const snapshot =
        incident.snapshot ??
        captureRefs.current[FEEDS.find((f) => f.zoneId === incident.zoneId)?.id ?? ""]?.() ??
        undefined;
      const { data, error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          message:
            `🚨 SARA ALERT — ${incident.label}\n` +
            `Pattern: ${incident.pattern}\n` +
            `Confidence: ${incident.confidence}%\n` +
            `Severity: ${incident.severity.toUpperCase()}\n` +
            `Time: ${new Date().toLocaleString()}\n` +
            (manual ? "Triggered manually via SOS." : "No guard response within timeout."),
          snapshot: snapshot ?? null,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        telegramStatus = "sent";
        telegramDetail = "Telegram bot";
      } else {
        telegramStatus = "failed";
        telegramDetail = data?.error ?? "unknown error";
      }
    } catch (e: unknown) {
      telegramStatus = "failed";
      telegramDetail = e instanceof Error ? e.message : "Telegram not configured";
    }

    appendContact(incidentId, {
      at: Date.now(),
      channel: "telegram",
      target: "Supervisor Wong",
      status: telegramStatus,
      detail: telegramDetail,
    });

    // Email (simulated)
    setTimeout(() => {
      appendContact(incidentId, {
        at: Date.now(),
        channel: "email",
        target: "manager@blocka.condo",
        status: "sent",
        detail: "Incident report draft attached",
      });
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  // Auto-escalation watcher
  useEffect(() => {
    const active = incidents.find(
      (i) => !i.resolvedAt && !i.acknowledgedAt && !i.escalatedAt
    );
    if (!active) return;
    const remaining =
      active.escalationSeconds - Math.floor((Date.now() - active.detectedAt) / 1000);
    if (remaining <= 0) {
      escalateIncident(active.id, false);
    }
  }, [tick, incidents, escalateIncident]);

  const sosIncident = (incidentId: string) => {
    escalateIncident(incidentId, true);
  };

  const resolveIncident = (incidentId: string) => {
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident) return;
    const feed = FEEDS.find((f) => f.zoneId === incident.zoneId);
    const snapshot = feed ? captureRefs.current[feed.id]?.() ?? undefined : undefined;
    const finalised: Incident = {
      ...incident,
      resolvedAt: Date.now(),
      snapshot: snapshot ?? incident.snapshot,
    };
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? finalised : i)));
    setResolvedCount((c) => c + 1);
    setSelectedZone(null);
    toast.success("Incident resolved", { description: "Generating PDF report…" });
    setTimeout(() => generateIncidentPdf(finalised), 200);
  };

  const handleEnrollFace = (descriptor: Float32Array, _snapshot: string) => {
    setKnownDescriptors([descriptor]);
    toast.success("Face enrolled as Resident", {
      description: "SARA will ignore this face. Unknown faces will trigger alerts.",
    });
  };

  const handleUnknownFace = useCallback(
    (snapshot: string | null) => {
      // Only trigger if no active lobby incident, and we have an enrolled resident
      if (knownDescriptors.length === 0) return;
      const hasActiveLobby = incidents.some(
        (i) => i.zoneId === "lobby" && !i.resolvedAt
      );
      if (hasActiveLobby) return;
      triggerIncident({
        forcedZone: "lobby",
        pattern: "Unknown face detected",
        severity: "high",
        recommendation: "Use intercom to verify residency before granting access.",
        snapshot,
        trigger: "unknown_face",
      });
    },
    [knownDescriptors.length, incidents, triggerIncident]
  );

  const activeIncidents = incidents.filter((i) => !i.resolvedAt);
  const incidentByZone = new Map(activeIncidents.map((i) => [i.zoneId, i]));

  // Countdown for the active incident
  const countdownSeconds = activeIncident && !activeIncident.acknowledgedAt && !activeIncident.escalatedAt
    ? Math.max(
        0,
        activeIncident.escalationSeconds -
          Math.floor((Date.now() - activeIncident.detectedAt) / 1000)
      )
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header
        resolvedCount={resolvedCount}
        activeCount={activeIncidents.length}
        enrolled={knownDescriptors.length > 0}
      />

      <main className="flex flex-1 flex-col gap-3 p-3 md:p-4 lg:flex-row">
        {/* Map + feeds column */}
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="relative min-h-[340px] flex-1">
            <CondoMap
              activeIncidents={activeIncidents}
              selectedZone={selectedZone}
              onSelectZone={(id) => setSelectedZone(id)}
              residentVisible={residentVisible && knownDescriptors.length > 0}
            />
          </div>

          {/* Feed grid */}
          <div className="flex items-center justify-between">
            <p className="font-mono-hud text-[10px] uppercase tracking-widest text-muted-foreground">
              Live feeds · {FEEDS.length} channels{" "}
              {knownDescriptors.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success">
                  <ScanFace className="h-3 w-3" />
                  Whitelist active
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoMode((v) => !v)}
                className="h-7 gap-1.5 px-2 font-mono-hud text-[10px] uppercase"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    autoMode ? "bg-success blink" : "bg-muted-foreground"
                  }`}
                />
                Auto-detect {autoMode ? "on" : "off"}
              </Button>
              <Button
                size="sm"
                onClick={() => triggerIncident({ trigger: "manual" })}
                className="h-7 gap-1.5 px-2 font-mono-hud text-[10px] uppercase"
              >
                <Zap className="h-3 w-3" />
                Simulate alert
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEEDS.map((f) => (
              <FeedTile
                key={f.id}
                feed={f}
                hasIncident={incidentByZone.has(f.zoneId)}
                registerCapture={registerCapture(f.id)}
                knownDescriptors={f.kind === "live" ? knownDescriptors : undefined}
                onEnrollFace={f.kind === "live" ? handleEnrollFace : undefined}
                onUnknownFace={f.kind === "live" ? handleUnknownFace : undefined}
                onResidentSeen={f.kind === "live" ? setResidentVisible : undefined}
              />
            ))}
          </div>
        </section>

        {/* Incident panel */}
        <section className="lg:w-[360px] lg:shrink-0">
          <div className="h-full min-h-[300px]">
            <IncidentPanel
              incident={activeIncident}
              countdownSeconds={countdownSeconds}
              onToggleChecklist={toggleChecklist}
              onAcknowledge={acknowledgeIncident}
              onSos={sosIncident}
              onResolve={resolveIncident}
              onDismiss={() => setSelectedZone(null)}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
