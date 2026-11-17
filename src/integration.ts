import { FaceVision, ScreenClassifier, StudyTracker } from './index';

const classifier = new ScreenClassifier();
const tracker = new StudyTracker();

let vision: FaceVision | null = null;
let stream: MediaStream | null = null;
let active = false;
let calibrating = false;
let calibrationEnd = 0;
let lastFrame = 0;
let frameId = 0;
let message = 'Camera is off';

type Metrics = ReturnType<StudyTracker['getMetrics']>;
let metrics: Metrics | null = null;

function setText(id: string, value: string) {
  const element = document.getElementById(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function syncView() {
  const video = document.getElementById(
    'study-camera-video'
  ) as HTMLVideoElement | null;

  if (video) {
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      if (stream) video.play().catch(() => {});
    }
    video.hidden = !stream;
  }

  const empty = document.getElementById('camera-empty');
  if (empty) empty.hidden = !!stream;

  setText('real-tracking-status', message);
  setText(
    'real-facing',
    metrics?.screenFacingPercent == null
      ? '--'
      : `${metrics.screenFacingPercent.toFixed(1)}%`
  );
  setText('real-interruptions', String(metrics?.interruptions ?? 0));
  setText(
    'real-away',
    `${((metrics?.totalAwayMs ?? 0) / 1000).toFixed(1)} sec`
  );
  setText(
    'real-longest',
    `${((metrics?.longestInterruptionMs ?? 0) / 1000).toFixed(1)} sec`
  );
}

const observer = new MutationObserver(syncView);
const view = document.getElementById('view');

if (view) {
  observer.observe(view, { childList: true, subtree: true });
}

function updateMetrics(now: number) {
  metrics = tracker.getMetrics(now);
  syncView();
}

function loop(now: number) {
  if (!active || !vision) return;

  const video = document.getElementById(
    'study-camera-video'
  ) as HTMLVideoElement | null;

  if (video && video.readyState >= 2 && now - lastFrame >= 100) {
    lastFrame = now;

    try {
      const features = vision.detect(video, now);

      if (calibrating) {
        if (features) classifier.addCalibrationSample(features);

        if (now >= calibrationEnd) {
          calibrating = false;
          try {
            classifier.finishCalibration();
            tracker.reset();
            message = 'Tracking active';
          } catch {
            classifier.reset();
            message = 'Calibration failed. Try again with your face visible.';
          }
        }
      } else if (classifier.calibrated) {
        const prediction = classifier.classify(features, now);
        tracker.update(prediction.state, now);
        updateMetrics(now);

        message = prediction.state === 'SCREEN_FACING'
          ? 'Screen facing'
          : prediction.state === 'LOOKING_AWAY'
          ? 'Looking away'
          : 'Face not detected';
      } else {
        message = features
          ? 'Face detected. Ready to calibrate.'
          : 'Waiting for face detection';
      }

      syncView();
    } catch (error) {
      stopCamera();
      message = `Tracking error: ${String(error)}`;
      syncView();
      return;
    }
  }

  frameId = requestAnimationFrame(loop);
}

async function startCamera() {
  if (active || vision) return;
  message = 'Loading camera tracking...';
  syncView();

  try {
    vision = await FaceVision.create();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });

    classifier.reset();
    tracker.reset();
    metrics = null;
    lastFrame = 0;
    active = true;
    message = 'Camera ready. Select Calibrate.';
    syncView();

    frameId = requestAnimationFrame(loop);
  } catch (error) {
    stopCamera();
    message = `Unable to start camera: ${String(error)}`;
    syncView();
  }
}

function calibrate() {
  if (!active) {
    message = 'Start the camera first.';
    syncView();
    return;
  }

  classifier.reset();
  tracker.reset();
  metrics = null;
  calibrating = true;
  calibrationEnd = performance.now() + 2000;
  message = 'Calibrating. Face the screen for two seconds.';
  syncView();
}

function stopCamera() {
  if (active && classifier.calibrated) {
    tracker.stop(performance.now());
    updateMetrics(performance.now());
  }

  active = false;
  calibrating = false;
  cancelAnimationFrame(frameId);

  stream?.getTracks().forEach(track => track.stop());
  stream = null;

  vision?.close();
  vision = null;

  message = 'Camera is off';
  syncView();
}

function downloadSummary() {
  if (!metrics) {
    message = 'Calibrate and track a session first.';
    syncView();
    return;
  }

  const file = new Blob(
    [JSON.stringify(metrics, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'studyfocus-session.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const action = target.closest('button')?.dataset.action;

  if (action === 'real-start') void startCamera();
  if (action === 'real-calibrate') calibrate();
  if (action === 'real-stop') stopCamera();
  if (action === 'real-download') downloadSummary();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && active && classifier.calibrated) {
    tracker.update('UNKNOWN', performance.now());
  }
});

window.addEventListener('pagehide', stopCamera);
syncView();
