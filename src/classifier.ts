import type { Features, Prediction, StudyMode } from './types';

export class ScreenClassifier {
  private samples: Features[] = [];
  private baseline: Features | null = null;
  mode: StudyMode = 'screen';
  // Normalized geometric ratios; exploratory parameters, NOT degrees.
  yawThreshold = 0.18;
  pitchThreshold = 0.22;

  addCalibrationSample(features: Features) { this.samples.push({...features}); }
  finishCalibration() {
    if (this.samples.length < 10) throw new Error('At least 10 samples needed');
    const n = this.samples.length;
    this.baseline = {
      yawProxy: this.samples.reduce((a,b)=>a+b.yawProxy,0)/n,
      pitchProxy: this.samples.reduce((a,b)=>a+b.pitchProxy,0)/n
    };
    this.samples=[];
  }
  reset() { this.samples=[]; this.baseline=null; }
  get calibrated() { return this.baseline !== null; }
  classify(features: Features | null, timestampMs: number): Prediction {
    let state: Prediction['state'] = 'UNKNOWN';
    if (features && this.baseline && this.mode === 'screen') {
      const yawDelta = Math.abs(features.yawProxy - this.baseline.yawProxy);
      const pitchDelta = Math.abs(features.pitchProxy - this.baseline.pitchProxy);
      state = yawDelta > this.yawThreshold || pitchDelta > this.pitchThreshold
        ? 'LOOKING_AWAY' : 'SCREEN_FACING';
    }
    // No calibrated probability yet: don't report arbitrary confidence.
    return {state, mode:this.mode, timestampMs, features, confidence:null};
  }
}
