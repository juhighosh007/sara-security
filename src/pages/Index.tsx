import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/sara/Header";
import { CondoMap } from "@/sara/CondoMap";
import { FeedTile } from "@/sara/FeedTile";
import { IncidentPanel } from "@/sara/IncidentPanel";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CHECKLIST,
  DEFAULT_ESCALATION_SECONDS,
  FEEDS,
  PATTERNS,
  ZONES,
  findPatternMeta,
  zoneById,
} from "@/sara/data";
import {
  BRAIN_MONITORING_PATTERN,
  fetchBrainStatus,
  type BrainStatus,
} from "@/sara/detection";
import type { ContactLogEntry, Incident, ZoneId } from "@/sara/types";
import { generateIncidentPdf } from "@/sara/pdf";

const Index = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [tick, setTick] = useState(0);

  const captureRefs = useRef<Record<string, () => string | null>>({});
  /** Prevents overlapping escalation work for the same incident (duplicate Telegram). */
  const escalationLockRef = useRef(new Set<string>());
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

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const poll = async () => {
      const s = await fetchBrainStatus(ac.signal);
      setBrainStatus(s);
    };
    void poll();
    const id = window.setInterval(poll, 400);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!brainStatus?.frame_ok) return;
    if (brainStatus.pattern === BRAIN_MONITORING_PATTERN) return;

    let created = false;
    let toastLabel = "";
    let toastDesc = "";

    setIncidents((prev) => {
      const openDet = prev.find(
        (i) => i.zoneId === "lobby" && !i.resolvedAt && i.trigger === "detector"
      );
      const meta = findPatternMeta(brainStatus.pattern);
      const severity = meta?.severity ?? "high";
      const recommendation =
        meta?.recommendation ??
        "Review live feed and follow standard response protocol.";
      const confidence = Math.round(Math.min(100, Math.max(0, brainStatus.confidence)));

      if (openDet) {
        const same =
          openDet.pattern === brainStatus.pattern &&
          openDet.confidence === confidence &&
          openDet.detectorReason === brainStatus.reason &&
          openDet.recommendation === recommendation;
        if (same) return prev;
        return prev.map((i) =>
          i.id === openDet.id
            ? {
                ...i,
                pattern: brainStatus.pattern,
                confidence,
                severity,
                recommendation,
                detectorReason: brainStatus.reason,
              }
            : i
        );
      }

      const openLobbyOther = prev.some(
        (i) => i.zoneId === "lobby" && !i.resolvedAt && i.trigger !== "detector"
      );
      if (openLobbyOther) return prev;

      const z = zoneById("lobby");
      if (!z) return prev;

      const incident: Incident = {
        id: String(Date.now()).slice(-5),
        zoneId: "lobby",
        cameraId: z.cameraId,
        label: `${z.label} — ${z.cameraId}`,
        pattern: brainStatus.pattern,
        severity,
        recommendation,
        confidence,
        detectorReason: brainStatus.reason,
        detectedAt: Date.now(),
        checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
        escalationSeconds: DEFAULT_ESCALATION_SECONDS,
        contactLog: [],
        trigger: "detector",
      };

      created = true;
      toastLabel = z.label;
      toastDesc = `${brainStatus.pattern} · ${confidence}% confidence`;
      return [...prev, incident];
    });

    if (created) {
      window.setTimeout(() => {
        toast.error(`ALERT · ${toastLabel}`, { description: toastDesc });
        setSelectedZone("lobby");
      }, 0);
    }
  }, [brainStatus]);

  const triggerIncident = useCallback(
    (opts?: {
      forcedZone?: ZoneId;
      pattern?: string;
      severity?: "low" | "medium" | "high";
      recommendation?: string;
      snapshot?: string | null;
      trigger?: Incident["trigger"];
      confidence?: number;
      detectorReason?: string;
    }) => {
      let created = false;
      let zoneForToast: { id: ZoneId; label: string } | null = null;
      let desc = "";

      setIncidents((prev) => {
        const taken = new Set(prev.filter((i) => !i.resolvedAt).map((i) => i.zoneId));
        const candidates = ZONES.filter((z) => !taken.has(z.id));
        if (candidates.length === 0) return prev;
        const zone =
          opts?.forcedZone != null
            ? zoneById(opts.forcedZone) ?? candidates[0]
            : candidates[Math.floor(Math.random() * candidates.length)];

        let pattern: string;
        let severity: "low" | "medium" | "high";
        let recommendation: string;
        let confidence: number;
        let detectorReason: string | undefined;

        if (opts?.pattern) {
          const meta = findPatternMeta(opts.pattern);
          pattern = opts.pattern;
          severity = opts.severity ?? meta?.severity ?? "high";
          recommendation =
            opts.recommendation ??
            meta?.recommendation ??
            "Verify the situation via intercom or patrol.";
          confidence = Math.round(opts.confidence ?? 0);
          detectorReason = opts.detectorReason;
        } else {
          const pick = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
          pattern = pick.pattern;
          severity = pick.severity;
          recommendation = pick.recommendation;
          confidence = 0;
          detectorReason = undefined;
        }

        const incident: Incident = {
          id: String(Date.now()).slice(-5),
          zoneId: zone.id,
          cameraId: zone.cameraId,
          label: `${zone.label} — ${zone.cameraId}`,
          pattern,
          severity,
          recommendation,
          confidence,
          detectorReason,
          detectedAt: Date.now(),
          checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
          escalationSeconds: DEFAULT_ESCALATION_SECONDS,
          contactLog: [],
          trigger: opts?.trigger ?? "manual",
          snapshot: opts?.snapshot ?? undefined,
        };

        created = true;
        zoneForToast = { id: zone.id, label: zone.label };
        desc = `${pattern} (training drill — not from live camera)`;
        return [...prev, incident];
      });

      if (created && zoneForToast) {
        window.setTimeout(() => {
          toast.error(`DRILL · ${zoneForToast!.label}`, { description: desc });
          setSelectedZone(zoneForToast!.id);
        }, 0);
      }
    },
    []
  );

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
    if (escalationLockRef.current.has(incidentId)) return;
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident || incident.escalatedAt) return;
    escalationLockRef.current.add(incidentId);

    try {
      setIncidents((prev) =>
        prev.map((i) => (i.id === incidentId ? { ...i, escalatedAt: Date.now() } : i))
      );

      toast.warning(manual ? "SOS sent" : "Auto-escalation triggered", {
        description: "Notifying supervisor…",
      });

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
    } finally {
      escalationLockRef.current.delete(incidentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

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

  const activeIncidents = incidents.filter((i) => !i.resolvedAt);
  const incidentByZone = new Map(activeIncidents.map((i) => [i.zoneId, i]));

  const countdownSeconds =
    activeIncident && !activeIncident.acknowledgedAt && !activeIncident.escalatedAt
      ? Math.max(
          0,
          activeIncident.escalationSeconds -
            Math.floor((Date.now() - activeIncident.detectedAt) / 1000)
        )
      : null;

  const lobbyCameraOnline = brainStatus !== null && brainStatus.frame_ok;
  const lobbyFeed = FEEDS.find((f) => f.kind === "live");
  const secondaryFeeds = FEEDS.filter((f) => f.kind !== "live");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header
        resolvedCount={resolvedCount}
        activeCount={activeIncidents.length}
        lobbyCameraOnline={lobbyCameraOnline}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-4 p-3 md:p-5 lg:flex-row lg:gap-6">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <div className="shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
  <div className="h-[240px] sm:h-[280px]">
    <CondoMap
      activeIncidents={activeIncidents}
      selectedZone={selectedZone}
      onSelectZone={(id) => setSelectedZone(id)}
    />
  </div>
</div>

          {lobbyFeed && (
            <FeedTile
              key={lobbyFeed.id}
              feed={lobbyFeed}
              layout="primary"
              hasIncident={incidentByZone.has(lobbyFeed.zoneId)}
              registerCapture={registerCapture(lobbyFeed.id)}
              brainStatus={brainStatus}
            />
          )}

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono-hud text-[10px] uppercase tracking-widest text-muted-foreground">
              Other cameras · {secondaryFeeds.length}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => triggerIncident({ trigger: "manual" })}
              className="h-8 shrink-0 gap-1.5 self-start font-mono-hud text-[10px] uppercase sm:self-auto"
            >
              <Zap className="h-3 w-3" />
              Simulate drill
            </Button>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {secondaryFeeds.map((f) => (
              <FeedTile
                key={f.id}
                feed={f}
                layout="compact"
                hasIncident={incidentByZone.has(f.zoneId)}
                registerCapture={registerCapture(f.id)}
              />
            ))}
          </div>
        </section>

        <section className="flex w-full shrink-0 flex-col lg:w-[min(100%,380px)] lg:max-w-[400px]">
          <div className="flex min-h-[280px] flex-1 flex-col lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)]">
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
