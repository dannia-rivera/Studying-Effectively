import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Features } from './types';

export class FaceVision {
  private constructor(private model: FaceLandmarker) {}
  static async create(modelUrl='/models/face_landmarker.task', wasmUrl='/mediapipe/wasm') {
    const vision = await FilesetResolver.forVisionTasks(wasmUrl);
    const model = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO', numFaces: 1
    });
    return new FaceVision(model);
  }
  detect(frame: HTMLVideoElement, timestampMs: number): Features | null {
    const result = this.model.detectForVideo(frame, timestampMs);
    const l = result.faceLandmarks[0];
    if (!l) return null;
    // Approximate face-orientation *proxies*, NOT gaze angles or degrees.
    // Eye corners 33/263, nose tip 1. Ratios are invariant to image scale.
    const left = l[33], right = l[263], nose = l[1];
    const dx = right.x - left.x, dy = right.y - left.y;
    const eyeWidth = Math.hypot(dx, dy);
    if (eyeWidth < 0.015) return null;
    const centerX = (left.x + right.x)/2;
    const centerY = (left.y + right.y)/2;
    return {
      yawProxy: (nose.x - centerX) / eyeWidth,
      pitchProxy: (nose.y - centerY) / eyeWidth,
    };
  }
  close() { this.model.close(); }
}
