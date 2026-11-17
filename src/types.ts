export type StudyState = 'SCREEN_FACING' | 'LOOKING_AWAY' | 'UNKNOWN';
export type StudyMode = 'screen' | 'book';
export interface Features { yawProxy: number; pitchProxy: number; }
export interface Prediction {
  state: StudyState;
  mode: StudyMode;
  timestampMs: number;
  features: Features | null;
  confidence: number | null;
}
export interface Interruption { startMs: number; endMs: number; durationMs: number; }
export interface SessionMetrics {
  interruptions: number;
  meanInterruptionMs: number;
  longestInterruptionMs: number;
  totalAwayMs: number;
  totalScreenMs: number;
  unknownMs: number;
  screenFacingPercent: number | null;
  events: Interruption[];
}
