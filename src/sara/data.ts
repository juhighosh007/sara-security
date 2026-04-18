import type { Feed, Zone } from "./types";

export const ZONES: Zone[] = [
  { id: "lobby",     label: "Lobby",     cameraId: "CAM-04", x: 25, y: 33, w: 18, h: 17 },
  { id: "mailroom",  label: "Mailroom",  cameraId: "CAM-07", x: 47, y: 33, w: 14, h: 17 },
  { id: "pool",      label: "Pool Deck", cameraId: "CAM-11", x: 73, y: 33, w: 18, h: 14 },
  { id: "elevator",  label: "Elevator",  cameraId: "CAM-02", x: 78, y: 53, w: 11, h: 12 },
  { id: "hallway",   label: "Hallway",   cameraId: "CAM-09", x: 47, y: 53, w: 14, h: 14 },
  { id: "carpark",   label: "Carpark",   cameraId: "CAM-01", x: 25, y: 70, w: 18, h: 16 },
  { id: "stairwell", label: "Stairwell", cameraId: "CAM-05", x: 60, y: 70, w: 9,  h: 16 },
  { id: "gym",       label: "Gym",       cameraId: "CAM-12", x: 73, y: 70, w: 18, h: 16 },
];

export const FEEDS: Feed[] = [
  {
    id: "feed-1",
    cameraId: "CAM-04",
    zoneId: "lobby",
    label: "Lobby — Live",
    kind: "live",
  },
  {
    id: "feed-2",
    cameraId: "CAM-01",
    zoneId: "carpark",
    label: "Carpark — Recorded",
    kind: "recorded",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "feed-3",
    cameraId: "CAM-09",
    zoneId: "hallway",
    label: "Hallway — Recorded",
    kind: "recorded",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

export const PATTERNS = [
  { pattern: "Unknown face detected",   severity: "high"   as const, recommendation: "Use intercom to verify residency." },
  { pattern: "Loitering > 2 min",       severity: "high"   as const, recommendation: "Use intercom to verify residency." },
  { pattern: "Tailgating at entry",     severity: "high"   as const, recommendation: "Dispatch on-site guard to lobby." },
  { pattern: "Unattended object",       severity: "medium" as const, recommendation: "Inspect object via PTZ zoom." },
  { pattern: "After-hours access",      severity: "medium" as const, recommendation: "Cross-check with resident log." },
];

export const DEFAULT_CHECKLIST = [
  { id: "intercom",  label: "Intercom used",       done: false },
  { id: "verified",  label: "Resident confirmed",  done: false },
  { id: "logged",    label: "Logged in incident book", done: false },
  { id: "patrol",    label: "Physical patrol dispatched", done: false },
];

/** Seconds before SARA auto-escalates if guard hasn't acknowledged */
export const DEFAULT_ESCALATION_SECONDS = 15;

export function zoneById(id: string) {
  return ZONES.find((z) => z.id === id);
}
export function feedByZone(id: string) {
  return FEEDS.find((f) => f.zoneId === id);
}
