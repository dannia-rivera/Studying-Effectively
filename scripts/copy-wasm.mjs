import { cpSync, existsSync, mkdirSync } from 'node:fs';
const source = 'node_modules/@mediapipe/tasks-vision/wasm';
const target = 'public/mediapipe/wasm';
if (existsSync(source)) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
  console.log('MediaPipe WASM files copied locally.');
} else {
  console.warn('MediaPipe WASM source not found; check installed package.');
}
