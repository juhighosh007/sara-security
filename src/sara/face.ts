import * as faceapi from "face-api.js";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadFaceModels() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();
  return loadPromise;
}

export async function getFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

export async function detectFaceCount(input: HTMLVideoElement): Promise<number> {
  await loadFaceModels();
  const detections = await faceapi.detectAllFaces(
    input,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
  );
  return detections.length;
}

export interface RecognitionResult {
  faceCount: number;
  knownFaces: number;
  unknownFaces: number;
  bestDistance: number | null;
}

const RECOGNITION_THRESHOLD = 0.55; // lower = stricter

export async function recognizeFaces(
  input: HTMLVideoElement,
  knownDescriptors: Float32Array[]
): Promise<RecognitionResult> {
  await loadFaceModels();
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptors();

  let knownFaces = 0;
  let unknownFaces = 0;
  let bestDistance: number | null = null;

  for (const det of detections) {
    let minDist = Infinity;
    for (const known of knownDescriptors) {
      const d = faceapi.euclideanDistance(det.descriptor, known);
      if (d < minDist) minDist = d;
    }
    if (bestDistance === null || minDist < bestDistance) bestDistance = minDist;
    if (knownDescriptors.length > 0 && minDist < RECOGNITION_THRESHOLD) {
      knownFaces += 1;
    } else {
      unknownFaces += 1;
    }
  }

  return {
    faceCount: detections.length,
    knownFaces,
    unknownFaces,
    bestDistance,
  };
}
