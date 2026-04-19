"""
SARA detection brain — YOLOv8 tracking for lobby (CAM-04) scenarios.
Run headless server:  python detection_server.py
Run local OpenCV UI:  python detection_engine.py
"""
from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import cv2
from ultralytics import YOLO

# Canonical UI pattern strings (must match src/sara/data.ts PATTERNS)
MONITORING_LABEL = "Status: Monitoring"
MONITORING_REASON = "No threats detected."

# Movable / high-interest objects for delivery, unattended, and theft heuristics
VALUABLES = frozenset(
    [
        "backpack",
        "suitcase",
        "handbag",
        "laptop",
        "box",
        "skateboard",
        "surfboard",
        "umbrella",
        "sports ball",
    ]
)
# Obstruction proxies in lobby / exit sightlines (lower frame band)
HAZARD_FURNITURE = frozenset(["chair", "bench"])


@dataclass
class BrainState:
    pattern: str = MONITORING_LABEL
    reason: str = MONITORING_REASON
    """Model / heuristic confidence for the active alert, 0–100."""
    confidence: float = 0.0
    camera_id: str = "CAM-04"
    frame_ok: bool = True


@dataclass
class TrackMemory:
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    interacted: bool = False
    label: str = ""
    fall_buffer: int = 0
    # For stairwell proxy: seconds accumulated while obstructive in hazard band
    hazard_unattended_since: float | None = None
    last_center: tuple[int, int] | None = None


class SaraBrain:
    def __init__(self, camera_index: int = 0, model_path: str = "yolov8m.pt") -> None:
        self.model = YOLO(model_path)
        self.cap = cv2.VideoCapture(camera_index)
        self.memory: dict[int, TrackMemory] = defaultdict(TrackMemory)
        self.state = BrainState()
        self._alert_start = 0.0
        self._last_confidence = 0.0

    def set_alert(self, name: str, reason: str, confidence: float) -> None:
        self.state.pattern = name
        self.state.reason = reason
        self.state.confidence = max(0.0, min(100.0, float(confidence)))
        self._last_confidence = self.state.confidence
        self._alert_start = time.time()

    def process_frame(self, frame: Any) -> Any:
        """Run one detection frame; returns annotated BGR frame."""
        now = time.time()
        h, _w = frame.shape[:2]
        results = self.model.track(frame, persist=True, conf=0.32, iou=0.5)
        annotated = results[0].plot()
        persons: list[dict[str, Any]] = []
        ids_this_frame: list[int] = []

        hazard_band_y = int(h * 0.55)
        near_px = 280

        rows: list[dict[str, Any]] = []
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            clss = results[0].boxes.cls.cpu().numpy().astype(int)
            confs = results[0].boxes.conf.cpu().numpy()

            for box, tid, cls, det_conf in zip(boxes, ids, clss, confs):
                label = self.model.names[int(cls)]
                x1, y1, x2, y2 = map(int, box)
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                rows.append(
                    {
                        "tid": int(tid),
                        "label": label,
                        "box": (x1, y1, x2, y2),
                        "cx": cx,
                        "cy": cy,
                        "conf": float(det_conf) * 100.0,
                    }
                )

        ids_this_frame = [r["tid"] for r in rows]
        persons = [{"center": (r["cx"], r["cy"])} for r in rows if r["label"] == "person"]

        for r in rows:
            tid = r["tid"]
            label = r["label"]
            x1, y1, x2, y2 = r["box"]
            cx, cy = r["cx"], r["cy"]
            det_conf_f = r["conf"]

            if label == "person":
                bw, bh = (x2 - x1), (y2 - y1)
                if bw > (bh * 1.2):
                    self.memory[tid].fall_buffer += 1
                else:
                    self.memory[tid].fall_buffer = 0

                if self.memory[tid].fall_buffer > 8:
                    self.set_alert(
                        "EMERGENCY: FALL",
                        "Human lying horizontally detected.",
                        det_conf_f,
                    )

            elif label in VALUABLES:
                m = self.memory[tid]
                m.last_seen = now
                m.label = label
                near_someone = False
                for p in persons:
                    if math.hypot(p["center"][0] - cx, p["center"][1] - cy) < near_px:
                        near_someone = True
                        m.interacted = True

                if near_someone:
                    self.set_alert(
                        "DELIVERY IN PROGRESS",
                        f"Verified personnel handling {label}.",
                        det_conf_f,
                    )
                elif not near_someone and (now - m.first_seen > 5):
                    self.set_alert(
                        "UNATTENDED OBJECT",
                        f"Warning: {label} left alone.",
                        det_conf_f,
                    )

            elif label in HAZARD_FURNITURE:
                m = self.memory[tid]
                m.last_seen = now
                m.label = label
                m.last_center = (cx, cy)
                in_hazard_band = cy >= hazard_band_y
                near_someone = False
                for p in persons:
                    if math.hypot(p["center"][0] - cx, p["center"][1] - cy) < near_px:
                        near_someone = True
                        break
                if in_hazard_band and not near_someone:
                    if m.hazard_unattended_since is None:
                        m.hazard_unattended_since = now
                    elif now - m.hazard_unattended_since > 5.0:
                        self.set_alert(
                            "STAIRWELL HAZARD",
                            f"Obstruction: {label} unattended in exit sightline.",
                            det_conf_f,
                        )
                else:
                    m.hazard_unattended_since = None

        for _tid, m in self.memory.items():
            if m.label in HAZARD_FURNITURE and m.last_center is not None:
                ux, uy = m.last_center
                if any(
                    math.hypot(p["center"][0] - ux, p["center"][1] - uy) < near_px for p in persons
                ):
                    m.hazard_unattended_since = None

        # Theft: valuable disappeared shortly after interaction
        for tid, data in list(self.memory.items()):
            if tid not in ids_this_frame and data.label in VALUABLES:
                time_missing = now - data.last_seen
                if 0.2 < time_missing < 4.0 and data.interacted:
                    self.set_alert(
                        "POTENTIAL THEFT",
                        f"Alert: {data.label} removed from view.",
                        self._last_confidence or 72.0,
                    )
                if time_missing > 5:
                    del self.memory[tid]

        # Auto-reset alert text after quiet period (engine behaviour)
        if now - self._alert_start > 8:
            self.state.pattern = MONITORING_LABEL
            self.state.reason = MONITORING_REASON
            self.state.confidence = 0.0

        self.state.frame_ok = True
        # HUD on annotated preview
        cv2.rectangle(annotated, (0, 0), (annotated.shape[1], 102), (10, 10, 10), -1)
        color = (255, 255, 255)
        if "EMERGENCY" in self.state.pattern:
            color = (0, 0, 255)
        elif "THEFT" in self.state.pattern:
            color = (0, 140, 255)
        cv2.putText(
            annotated,
            f"SARA: {self.state.pattern}",
            (20, 35),
            2,
            0.8,
            color,
            2,
        )
        cv2.putText(
            annotated,
            f"WHY: {self.state.reason}",
            (20, 70),
            2,
            0.5,
            (200, 200, 200),
            1,
        )
        conf_txt = f"{self.state.confidence:.0f}%" if self.state.pattern != MONITORING_LABEL else "—"
        cv2.putText(
            annotated,
            f"CONF: {conf_txt}",
            (20, 88),
            1,
            0.45,
            (180, 220, 180),
            1,
        )
        return annotated

    def read_process(self) -> tuple[bool, Any]:
        ok, frame = self.cap.read()
        if not ok:
            self.state.frame_ok = False
            return False, None
        out = self.process_frame(frame)
        return True, out

    def release(self) -> None:
        self.cap.release()

    def status_json(self) -> dict[str, Any]:
        return {
            "pattern": self.state.pattern,
            "reason": self.state.reason,
            "confidence": round(self.state.confidence, 1),
            "camera_id": self.state.camera_id,
            "frame_ok": self.state.frame_ok,
        }


def run_cv_window(camera_index: int = 0) -> None:
    brain = SaraBrain(camera_index=camera_index)
    try:
        while brain.cap.isOpened():
            ok, annotated = brain.read_process()
            if not ok or annotated is None:
                break
            cv2.imshow("SARA Live Monitoring", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        brain.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    run_cv_window(0)
