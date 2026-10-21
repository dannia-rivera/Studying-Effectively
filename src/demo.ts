import {FaceVision,ScreenClassifier,StudyTracker} from './index';
import type {Features} from './types';
const video=document.querySelector<HTMLVideoElement>('#video')!;
const out=document.querySelector<HTMLElement>('#result')!;
const start=document.querySelector<HTMLButtonElement>('#start')!;
const cal=document.querySelector<HTMLButtonElement>('#calibrate')!;
const stop=document.querySelector<HTMLButtonElement>('#stop')!;
const download=document.querySelector<HTMLButtonElement>('#download')!;
const classifier=new ScreenClassifier();
const tracker=new StudyTracker();
let vision:FaceVision|null=null;
let stream:MediaStream|null=null;
let raf=0;
let active=false;
let calibrating=false;
let calibrationUntil=0;
let lastFeatures:Features|null=null;
let lastInference=0;
let latestMetrics:ReturnType<StudyTracker['getMetrics']>|null=null;

async function loop(now:number) {
  if(!active || !vision) return;
  // 10 FPS reduces CPU consumption. Inference is synchronous.
  if(now-lastInference>=100 && video.readyState>=2) {
    lastInference=now;
    const features=vision.detect(video,now);
    lastFeatures=features;
    if(calibrating) {
      if(features) classifier.addCalibrationSample(features);
      if(now>=calibrationUntil) {
        calibrating=false;
        try {classifier.finishCalibration();tracker.reset();}
        catch(e) {out.textContent=String(e);classifier.reset();}
      }
    }
    if(classifier.calibrated && !calibrating) {
      const prediction=classifier.classify(features,now);
      tracker.update(prediction.state,now);
      latestMetrics=tracker.getMetrics(now);
      out.textContent=JSON.stringify({prediction,metrics:latestMetrics},null,2);
    } else if(calibrating) out.textContent='Look straight at the screen for calibration...';
    else out.textContent=features?'Face detected. Click Calibrate.':'No face detected.';
  }
  raf=requestAnimationFrame(loop);
}
start.onclick=async()=>{
  start.disabled=true;
  try {
    vision=await FaceVision.create();
    stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false});
    video.srcObject=stream; await video.play();
    active=true;cal.disabled=false;stop.disabled=false;download.disabled=false;
    raf=requestAnimationFrame(loop);
  } catch(e) {out.textContent=`Start failed: ${String(e)}`;stream?.getTracks().forEach(t=>t.stop());vision?.close();vision=null;start.disabled=false;}
};
cal.onclick=()=>{
  classifier.reset();tracker.reset();calibrating=true;
  calibrationUntil=performance.now()+2000;
  out.textContent='Calibration started: look straight at your screen.';
};
stop.onclick=()=>{
  active=false;cancelAnimationFrame(raf);
  tracker.stop(performance.now());
  latestMetrics=tracker.getMetrics(performance.now());
  stream?.getTracks().forEach(t=>t.stop()); stream=null;video.srcObject=null;
  vision?.close();vision=null;calibrating=false;
  start.disabled=false;cal.disabled=true;stop.disabled=true;
  out.textContent=JSON.stringify({metrics:latestMetrics},null,2);
};
download.onclick=()=>{
  const blob=new Blob([JSON.stringify(latestMetrics,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='studyfocus-session.json';a.click();
  URL.revokeObjectURL(url);
};
window.addEventListener('beforeunload',()=>stream?.getTracks().forEach(t=>t.stop()));
