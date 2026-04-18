export type ZoneId =
  | "lobby"
  | "carpark"
  | "hallway"
  | "pool"
  | "mailroom"
  | "stairwell"
  | "elevator"
  | "gym";

export interface Zone {
  id: ZoneId;
  label: string;
  cameraId: string;
  /** Percentage coords on the map image (0-100) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FeedKind = "live" | "recorded";

export interface Feed {
  id: string;
  cameraId: string;
  zoneId: ZoneId;
  label: string;
  kind: FeedKind;
  /** for recorded feeds */
  src?: string;
}

export type EscalationStage = "guard" | "supervisor" | "manager";

export interface ContactLogEntry {
  at: number;
  channel: "telegram" | "email" | "sms";
  target: string;
  status: "sent" | "failed" | "pending";
  detail?: string;
}

export interface Incident {
  id: string;
  zoneId: ZoneId;
  cameraId: string;
  label: string;
  pattern: string;
  confidence: number;
  detectedAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  escalatedAt?: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
  checklist: { id: string; label: string; done: boolean }[];
  snapshot?: string; // dataURL
  /** seconds before auto-escalation when first opened */
  escalationSeconds: number;
  contactLog: ContactLogEntry[];
  /** trigger source for the incident */
  trigger: "unknown_face" | "manual" | "auto_pattern";
}
