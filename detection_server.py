"""
HTTP API + MJPEG stream for the SARA lobby brain (CAM-04).
Run from repo root (after deps + yolov8m.pt are present):

  pip install -r requirements.txt
  python detection_server.py

UI (dev) proxies /detection-api/* to this server (default port 8765).
"""
from __future__ import annotations

import threading
import time

import cv2
from flask import Flask, Response, jsonify
from flask_cors import cross_origin

from detection_engine import SaraBrain

HOST = "127.0.0.1"
PORT = 8765

app = Flask(__name__)
_lock = threading.Lock()
_brain: SaraBrain | None = None
_last_jpeg: bytes = b""


def _capture_loop() -> None:
    global _last_jpeg
    assert _brain is not None
    while True:
        with _lock:
            ok, frame = _brain.read_process()
            if ok and frame is not None:
                ret, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
                if ret:
                    _last_jpeg = buf.tobytes()
            else:
                time.sleep(0.05)


@app.get("/api/status")
@cross_origin()
def api_status() -> Response:
    if _brain is None:
        return jsonify({"error": "brain not started"}), 503
    with _lock:
        payload = _brain.status_json()
    return jsonify(payload)


def _mjpeg_gen():
    boundary = b"frame"
    while True:
        with _lock:
            chunk = _last_jpeg
        if not chunk:
            time.sleep(0.03)
            continue
        yield b"--" + boundary + b"\r\nContent-Type: image/jpeg\r\n\r\n" + chunk + b"\r\n"
        time.sleep(0.03)


@app.get("/video.mjpg")
@cross_origin()
def video_mjpg() -> Response:
    return Response(
        _mjpeg_gen(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


def main() -> None:
    global _brain
    _brain = SaraBrain(camera_index=0)
    t = threading.Thread(target=_capture_loop, daemon=True)
    t.start()
    print(f"SARA detection server http://{HOST}:{PORT}")
    print("  GET /api/status   — JSON pattern, confidence, reason")
    print("  GET /video.mjpg  — annotated MJPEG (CAM-04)")
    app.run(host=HOST, port=PORT, threaded=True, use_reloader=False)


if __name__ == "__main__":
    main()
