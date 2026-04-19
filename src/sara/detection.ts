/** Must match `MONITORING_LABEL` in detection_engine.py */
export const BRAIN_MONITORING_PATTERN = "Status: Monitoring";

export type BrainStatus = {
  pattern: string;
  reason: string;
  confidence: number;
  camera_id: string;
  frame_ok: boolean;
};

const defaultBase = "http://127.0.0.1:8765";

export function detectionApiBase(): string {
  const v = import.meta.env.VITE_DETECTION_API as string | undefined;
  return (v && v.length > 0 ? v : defaultBase).replace(/\/$/, "");
}

export async function fetchBrainStatus(signal?: AbortSignal): Promise<BrainStatus | null> {
  try {
    const res = await fetch(`${detectionApiBase()}/api/status`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as BrainStatus;
  } catch {
    return null;
  }
}

export function mjpegUrl(): string {
  return `${detectionApiBase()}/video.mjpg`;
}

export function isAlerting(status: BrainStatus | null): status is BrainStatus {
  if (!status?.frame_ok) return false;
  return status.pattern !== BRAIN_MONITORING_PATTERN;
}
