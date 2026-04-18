import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Radio, UserCheck, UserX, ScanFace } from "lucide-react";
import type { Feed } from "./types";
import { cn } from "@/lib/utils";
import { getFaceDescriptor, recognizeFaces, loadFaceModels } from "./face";

interface Props {
  feed: Feed;
  hasIncident?: boolean;
  registerCapture?: (capture: () => string | null) => void;
  /** Only the live feed runs face recognition */
  knownDescriptors?: Float32Array[];
  onEnrollFace?: (descriptor: Float32Array, snapshot: string) => void;
  onUnknownFace?: (snapshot: string | null) => void;
  onResidentSeen?: (visible: boolean) => void;
}

export function FeedTile({
  feed,
  hasIncident,
  registerCapture,
  knownDescriptors,
  onEnrollFace,
  onUnknownFace,
  onResidentSeen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "clear" | "unknown" | "no_face">("idle");
  const lastUnknownReportRef = useRef<number>(0);

  // Register capture function so parent can grab snapshot on resolve
  useEffect(() => {
    if (!registerCapture) return;
    registerCapture(() => captureSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCapture]);

  const captureSnapshot = (): string | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    try {
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch {
      return null;
    }
  };

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setLiveOn(true);
        // Pre-load models in background
        loadFaceModels().catch(() => {});
      }
    } catch {
      setLiveError("Camera permission denied");
    }
  };

  const handleEnroll = async () => {
    if (!videoRef.current || !onEnrollFace) return;
    setEnrolling(true);
    try {
      const desc = await getFaceDescriptor(videoRef.current);
      if (!desc) {
        setLiveError("No face found — face the camera");
        setTimeout(() => setLiveError(null), 2500);
      } else {
        const snap = captureSnapshot() ?? "";
        onEnrollFace(desc, snap);
      }
    } finally {
      setEnrolling(false);
    }
  };

  // Continuous face recognition loop on the live feed
  useEffect(() => {
    if (feed.kind !== "live" || !liveOn || !videoRef.current) return;
    let cancelled = false;
    let timer: number;

    const tick = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const result = await recognizeFaces(videoRef.current, knownDescriptors ?? []);
        if (cancelled) return;

        if (result.faceCount === 0) {
          setScanStatus("no_face");
          onResidentSeen?.(false);
        } else if (result.unknownFaces > 0 || (knownDescriptors ?? []).length === 0) {
          setScanStatus("unknown");
          onResidentSeen?.(false);
          // Throttle unknown reports to one every 8s
          const now = Date.now();
          if (now - lastUnknownReportRef.current > 8000) {
            lastUnknownReportRef.current = now;
            onUnknownFace?.(captureSnapshot());
          }
        } else {
          setScanStatus("clear");
          onResidentSeen?.(true);
        }
      } catch {
        // ignore detection errors
      }
      if (!cancelled) timer = window.setTimeout(tick, 1200);
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [feed.kind, liveOn, knownDescriptors, onUnknownFace, onResidentSeen]);

  const enrolledCount = knownDescriptors?.length ?? 0;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-md border bg-black",
        hasIncident
          ? "border-primary shadow-[0_0_18px_hsl(var(--primary)/0.4)]"
          : "border-border"
      )}
    >
      {/* Video */}
      {feed.kind === "live" ? (
        liveOn ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary p-4 text-center">
            {liveError ? (
              <>
                <CameraOff className="h-6 w-6 text-primary" />
                <p className="text-xs text-primary">{liveError}</p>
              </>
            ) : (
              <>
                <Camera className="h-6 w-6 text-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  Webcam feed (Lobby simulation)
                </p>
                <button
                  onClick={startLive}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Enable webcam
                </button>
              </>
            )}
          </div>
        )
      ) : (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={feed.src}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
        />
      )}

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-sm bg-background/80 px-1.5 py-0.5">
          <Radio className={cn("h-3 w-3", feed.kind === "live" ? "text-primary" : "text-foreground")} />
          <span className="font-mono-hud text-[9px] uppercase text-foreground">
            {feed.cameraId} · {feed.label}
          </span>
        </div>
        <div className="absolute right-2 top-2 font-mono-hud text-[9px] uppercase text-background bg-foreground/80 rounded-sm px-1.5 py-0.5">
          {feed.kind === "live" ? "LIVE" : "REC LOOP"}
        </div>

        {/* Face status badge (live only) */}
        {feed.kind === "live" && liveOn && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-sm bg-background/85 px-2 py-0.5">
            {scanStatus === "clear" && (
              <>
                <UserCheck className="h-3 w-3 text-success" />
                <span className="font-mono-hud text-[9px] uppercase text-success">Resident</span>
              </>
            )}
            {scanStatus === "unknown" && (
              <>
                <UserX className="h-3 w-3 text-primary" />
                <span className="font-mono-hud text-[9px] uppercase text-primary">
                  {enrolledCount === 0 ? "Not enrolled" : "Unknown"}
                </span>
              </>
            )}
            {scanStatus === "no_face" && (
              <>
                <ScanFace className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono-hud text-[9px] uppercase text-muted-foreground">Scanning</span>
              </>
            )}
            {scanStatus === "idle" && (
              <span className="font-mono-hud text-[9px] uppercase text-muted-foreground">Loading…</span>
            )}
          </div>
        )}

        {hasIncident && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-sm bg-primary px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground blink" />
            <span className="font-mono-hud text-[10px] uppercase text-primary-foreground">
              ALERT
            </span>
          </div>
        )}
      </div>

      {/* Enroll button (live only) */}
      {feed.kind === "live" && liveOn && onEnrollFace && (
        <button
          onClick={handleEnroll}
          disabled={enrolling}
          className="absolute right-2 bottom-9 rounded-md bg-foreground/85 px-2 py-1 text-[10px] font-medium text-background hover:bg-foreground disabled:opacity-50"
        >
          {enrolling ? "Enrolling…" : enrolledCount > 0 ? "Re-enroll face" : "Enroll my face"}
        </button>
      )}
    </div>
  );
}
