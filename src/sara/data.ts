import type { Feed, Zone } from "./types";

export const ZONES: Zone[] = [
  { id: "lobby",     label: "Lobby",     cameraId: "CAM-04", x: 25, y: 33, w: 18, h: 17 },
  { id: "mailroom",  label: "Mailroom",  cameraId: "CAM-07", x: 47, y: 33, w: 14, h: 17 },
  { id: "pool",      label: "Pool Deck", cameraId: "CAM-11", x: 73, y: 33, w: 18, h: 14 },
  { id: "elevator",  label: "Elevator",  cameraId: "CAM-02", x: 78, y: 53, w: 11, h: 12 },
  { id: "hallway",   label: "Hallway",   cameraId: "CAM-09", x: 47, y: 53, w: 14, h: 14 },
  { id: "carpark",   label: "Carpark",   cameraId: "CAM-01", x: 25, y: 70, w: 18, h: 16 },
  { id: "stairwell", label: "Stairwell", cameraId: "CAM-05", x: 62, y: 70, w: 8, h: 16 },
  { id: "gym",       label: "Gym",       cameraId: "CAM-12", x: 82, y: 70, w: 14, h: 14 },
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
    src: "/recordings/carpark.mp4",
  },
  {
    id: "feed-3",
    cameraId: "CAM-09",
    zoneId: "hallway",
    label: "Hallway — Recorded",
    kind: "recorded",
    src: "/recordings/hallway.mp4",
  },
];

export const PATTERNS = [
  { 
    pattern: "EMERGENCY: FALL", 
    severity: "high" as const, 
    recommendation: "Immediate medical dispatch. Check vitals via intercom." 
  },
  { 
    pattern: "POTENTIAL THEFT", 
    severity: "high" as const, 
    recommendation: "Asset removed suddenly. Lock down exit gates and review logs." 
  },
  { 
    pattern: "DELIVERY IN PROGRESS", 
    severity: "low" as const, 
    recommendation: "Verify courier ID and authorization before releasing the parcel." 
  },
  { 
    pattern: "STAIRWELL HAZARD", 
    severity: "medium" as const, 
    recommendation: "Obstruction in fire exit. Dispatch guard to clear path." 
  },
  { 
    pattern: "UNATTENDED OBJECT", 
    severity: "medium" as const, 
    recommendation: "Security Risk: Item left alone > 8s. Inspect via PTZ zoom." 
  },
];

export const DEFAULT_CHECKLIST = [
  { id: "intercom", label: "Intercom used", done: false },
  { id: "verified", label: "Identity / access verified", done: false },
  { id: "logged", label: "Logged in incident book", done: false },
  { id: "patrol", label: "Physical patrol dispatched", done: false },
];

export function findPatternMeta(pattern: string) {
  return PATTERNS.find((p) => p.pattern === pattern) ?? null;
}
/** Seconds before SARA auto-escalates if guard hasn't acknowledged */
export const DEFAULT_ESCALATION_SECONDS = 15;

export function zoneById(id: string) {
  return ZONES.find((z) => z.id === id);
}
export function feedByZone(id: string) {
  return FEEDS.find((f) => f.zoneId === id);
}
