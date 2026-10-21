# StudyFocus ML (browser-only prototype)

## Goal
Standalone TypeScript MediaPipe face-landmark inference and interruption metrics module. The camera stays on-device. This is a **head-orientation proxy** prototype: it does not yet estimate true eye gaze or mental attention. Book/phone modes are not implemented.

## Prerequisites
- Node.js current LTS, npm, modern browser, webcam
- Windows PowerShell commands below

## Install
```powershell
npm install
New-Item -ItemType Directory -Force public/models | Out-Null
Invoke-WebRequest -Uri 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' -OutFile 'public/models/face_landmarker.task'
npm run dev
```

Open URL printed by Vite (normally http://127.0.0.1:5173). Start camera, press calibrate and look at the screen for 2 seconds. The test page displays states and metrics. Stop to end a session and download summary JSON. The WASM files are copied locally from your package during `npm install`; no inference CDN is required.

## For teammates
`src/index.ts` exports:
- `FaceVision.create(modelUrl?, wasmUrl?)`, `.detect(videoElement, monotonicTimestampMs)`, `.close()`
- `ScreenClassifier`: `.addCalibrationSample(features)`, `.finishCalibration()`, `.classify(features, timeMs)`, `.reset()`
- `StudyTracker`: `.update(state, monotonicTimeMs)`, `.getMetrics(timeMs)`, `.reset()`, `.stop(timeMs)`

Host the files from `public/models/` and `public/mediapipe/wasm/` on the same origin as the website. The teammate owns webcam permission/element and render loop; they pass frame to your FaceVision instance. Keep monotonically increasing timestamps (`performance.now()`).

## Operational semantics
- Interruption begins only after a previously confirmed SCREEN_FACING interval transitions to LOOKING_AWAY for >=700ms. Only episodes lasting >=1500ms count.
- A return to SCREEN_FACING is debounced for >=400ms.
- UNKNOWN (face lost / not classifiable) does not initiate an interruption; unknown duration is excluded from screen-facing percentage denominator. A genuine interruption in progress stops when unknown begins.
- Average interruption duration: arithmetic average over confirmed interruptions only. Total away time includes shorter away segments too.
- Current ongoing away segment is included in live metrics if already >=1500ms.
- Screen-facing percentage: SCREEN_FACING/(SCREEN_FACING+LOOKING_AWAY); does not prove attention.
- All thresholds are exploratory and must be tuned on labeled data.

## Cautions
- Ratios are not gaze angles in degrees and won't catch looking away with eyes only.
- If there are detection gaps (background tab, camera sleeping), don't interpret them as measured gaze. In a production integration call `tracker.update('UNKNOWN', performance.now())` immediately on a pause/background transition. The sample harness is for foreground tests only.
- MediaPipe states on-device input processing, but the package documentation also describes metrics telemetry. Audit external requests, dependencies, CSP and consent before claiming strictly no outbound telemetry.
- MediaPipe `detectForVideo` blocks the JS thread. Optimize or move preprocessing/inference to a suitable worker if needed.
- Freeze package versions and retain lockfile when deploying for classroom research.

## Verification
Run `npm run build` after installing dependencies. Browser camera requires localhost or HTTPS.
