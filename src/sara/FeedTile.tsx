import { useEffect, useRef, useState } from "react";
import { CameraOff, Radio } from "lucide-react";
import type { Feed } from "./types";
import type { BrainStatus } from "./detection";
import { BRAIN_MONITORING_PATTERN, mjpegUrl } from "./detection";
import { cn } from "@/lib/utils";

interface Props {
  feed: Feed;
  layout?: "primary" | "compact";
  hasIncident?: boolean;
  registerCapture?: (capture: () => string | null) => void;
  brainStatus?: BrainStatus | null;
}

export function FeedTile({
  feed,
  layout = "compact",
  hasIncident,
  registerCapture,
  brainStatus,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mjpegError, setMjpegError] = useState(false);

  const captureFromVideo = (): string | null => {
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

  const captureFromMjpeg = (): string | null => {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    try {
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!registerCapture) return;
    registerCapture(() =>
      feed.kind === "live" ? captureFromMjpeg() : captureFromVideo()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCapture, feed.kind]);

  const situation =
    feed.kind === "live" && brainStatus?.pattern &&
    brainStatus.pattern !== BRAIN_MONITORING_PATTERN
      ? brainStatus.pattern
      : feed.kind === "live"
        ? "All clear — routine monitoring"
        : "—";
  const confDisplay =
    feed.kind === "live" &&
    brainStatus &&
    brainStatus.pattern !== BRAIN_MONITORING_PATTERN
      ? `${Math.round(brainStatus.confidence)}%`
      : feed.kind === "live"
        ? "—"
        : "—";

  const isPrimary = layout === "primary" && feed.kind === "live";
  const showLiveStatus = feed.kind === "live" && !mjpegError;

  const alertCorner = hasIncident
    ? feed.kind === "live"
      ? "right-2 top-10"
      : "bottom-2 left-2"
    : null;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm",
        hasIncident ? "border-primary ring-1 ring-primary/20" : "border-border",
        isPrimary ? "min-h-0 flex-1" : ""
      )}
    >
      <div
        className={cn(
          "relative w-full min-w-0 bg-black",
          isPrimary ? "min-h-[min(52vh,560px)] flex-1 sm:min-h-[400px] lg:min-h-[440px]" : "aspect-video shrink-0"
        )}
      >
        {feed.kind === "live" ? (
          mjpegError ? (
            <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 bg-secondary p-4 text-center">
              <CameraOff className="h-6 w-6 text-primary" />
              <p className="text-xs text-primary">Live camera feed unavailable</p>
              <p className="max-w-[260px] text-[11px] text-muted-foreground">
                Check that the monitoring workstation is running and connected to this console.
              </p>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={mjpegUrl()}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full",
                isPrimary ? "object-contain" : "object-cover"
              )}
              onError={() => setMjpegError(true)}
              onLoad={() => setMjpegError(false)}
            />
          )
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={feed.src}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
          />
        )}

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 rounded-sm bg-background/90 px-1.5 py-0.5">
            <Radio className={cn("h-3 w-3 shrink-0", feed.kind === "live" ? "text-primary" : "text-foreground")} />
            <span className="truncate font-mono-hud text-[9px] uppercase text-foreground">
              {feed.cameraId} · {feed.label}
            </span>
          </div>
          <div className="absolute right-2 top-2 shrink-0 font-mono-hud text-[9px] uppercase text-background bg-foreground/85 rounded-sm px-1.5 py-0.5">
            {feed.kind === "live" ? "LIVE" : "REC"}
          </div>
          {alertCorner && (
            <div
              className={cn(
                "absolute flex items-center gap-1.5 rounded-sm bg-primary px-2 py-0.5 shadow-sm",
                alertCorner
              )}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground blink" />
              <span className="font-mono-hud text-[10px] uppercase text-primary-foreground">Alert</span>
            </div>
          )}
        </div>
      </div>

      {showLiveStatus && (
        <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
                Situation
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">{situation}</p>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 border-t border-border/60 pt-2 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
              <p className="font-mono-hud text-[9px] uppercase tracking-wider text-muted-foreground">
                Confidence
              </p>
              <p className="font-mono-hud text-lg tabular-nums text-primary">{confDisplay}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
