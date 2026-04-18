import jsPDF from "jspdf";
import type { Incident } from "./types";

export function generateIncidentPdf(incident: Incident) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header bar
  doc.setFillColor(255, 106, 26); // primary orange
  doc.rect(0, 0, w, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SARA — Incident Report", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Smart Adaptive Response Assistant", margin, 50);

  y = 100;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Incident #${incident.id}`, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines: [string, string][] = [
    ["Zone",         incident.label],
    ["Camera",       incident.cameraId],
    ["Pattern",      incident.pattern],
    ["Severity",     incident.severity.toUpperCase()],
    ["Confidence",   `${incident.confidence}%`],
    ["Trigger",      incident.trigger.replace("_", " ")],
    ["Detected",     new Date(incident.detectedAt).toLocaleString()],
    ["Acknowledged", incident.acknowledgedAt ? new Date(incident.acknowledgedAt).toLocaleString() : "—"],
    ["Escalated",    incident.escalatedAt ? new Date(incident.escalatedAt).toLocaleString() : "—"],
    ["Resolved",     incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : "—"],
    ["Recommendation", incident.recommendation],
  ];
  for (const [k, v] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 110, y, { maxWidth: w - margin * 2 - 110 });
    y += 18;
  }

  // Checklist
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Guard Actions", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const item of incident.checklist) {
    doc.text(`${item.done ? "[x]" : "[ ]"}  ${item.label}`, margin, y);
    y += 16;
  }

  // Contact log
  if (incident.contactLog.length > 0) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Escalation Contact Log", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const c of incident.contactLog) {
      const t = new Date(c.at).toLocaleTimeString();
      doc.text(`[${t}] ${c.channel.toUpperCase()} → ${c.target} · ${c.status}`, margin, y);
      y += 14;
    }
  }

  // Snapshot
  if (incident.snapshot) {
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Snapshot", margin, y);
    y += 10;
    try {
      const imgW = w - margin * 2;
      const imgH = imgW * 0.5625;
      doc.addImage(incident.snapshot, "JPEG", margin, y, imgW, imgH);
      y += imgH;
    } catch {
      doc.text("(snapshot unavailable)", margin, y + 14);
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString()} • SARA v0.2`,
    margin,
    doc.internal.pageSize.getHeight() - 20
  );

  doc.save(`SARA-incident-${incident.id}.pdf`);
}
