import type { Interruption, SessionMetrics, StudyState } from './types';

/** Session-time accounting and debounced event counting.
 * Unknown is excluded from the screen-facing denominator.
 * An interruption is counted only after SCREEN_FACING -> LOOKING_AWAY
 * with sustained away time >= minAwayMs, and is closed when gaze returns
 * or visibility becomes unknown. The same event is never counted twice.
 */
export class StudyTracker {
  minAwayMs = 1500;
  awayDebounceMs = 700;
  screenDebounceMs = 400;
  private stable: StudyState = 'UNKNOWN';
  private pending: {state:StudyState; since:number} | null = null;
  private stableSince: number | null = null;
  private lastTime: number | null = null;
  private screenMs = 0;
  private awayMs = 0;
  private unknownMs = 0;
  private awayFromScreen = false;
  private events: Interruption[] = [];

  reset() {
    this.stable='UNKNOWN'; this.pending=null; this.stableSince=null; this.lastTime=null;
    this.screenMs=0; this.awayMs=0; this.unknownMs=0;
    this.awayFromScreen=false; this.events=[];
  }
  private add(state:StudyState, duration:number) {
    if(state==='SCREEN_FACING') this.screenMs+=duration;
    else if(state==='LOOKING_AWAY') this.awayMs+=duration;
    else this.unknownMs+=duration;
  }
  private closeSegment(at:number) {
    if(this.stableSince===null) return;
    const duration=Math.max(0,at-this.stableSince);
    this.add(this.stable,duration);
    if(this.stable==='LOOKING_AWAY' && this.awayFromScreen && duration>=this.minAwayMs) {
      this.events.push({startMs:this.stableSince,endMs:at,durationMs:duration});
    }
  }
  update(raw:StudyState, now:number) {
    if(this.lastTime!==null && now<this.lastTime) throw new Error('Timestamps must increase');
    if(this.lastTime===null) {this.lastTime=now; this.stableSince=now;}
    this.lastTime=now;
    if(raw===this.stable) {this.pending=null;return;}
    if(raw==='UNKNOWN') {this.transition('UNKNOWN',now);return;}
    if(!this.pending || this.pending.state!==raw) this.pending={state:raw,since:now};
    const debounce=raw==='LOOKING_AWAY'?this.awayDebounceMs:this.screenDebounceMs;
    if(now-this.pending.since>=debounce) {
      this.transition(raw,this.pending.since);
      this.pending=null;
    }
  }
  private transition(next:StudyState, at:number) {
    if(next===this.stable) {this.pending=null;return;}
    const prev=this.stable;
    this.closeSegment(at);
    this.stable=next;this.stableSince=at;
    this.awayFromScreen=prev==='SCREEN_FACING' && next==='LOOKING_AWAY';
    this.pending=null;
  }
  stop(now:number) { if(this.lastTime!==null) {this.update(this.stable,now);this.closeSegment(now);this.stableSince=now;} }
  getMetrics(now:number):SessionMetrics {
    let screen=this.screenMs,away=this.awayMs,unknown=this.unknownMs;
    const running=Math.max(0,now-(this.stableSince??now));
    if(this.stable==='SCREEN_FACING') screen+=running;
    else if(this.stable==='LOOKING_AWAY') away+=running;
    else unknown+=running;
    const events=[...this.events];
    if(this.stable==='LOOKING_AWAY' && this.awayFromScreen && running>=this.minAwayMs) {
      events.push({startMs:this.stableSince!,endMs:now,durationMs:running});
    }
    const total=events.reduce((a,e)=>a+e.durationMs,0);
    return {
      interruptions:events.length,
      meanInterruptionMs:events.length?total/events.length:0,
      longestInterruptionMs:events.length?Math.max(...events.map(e=>e.durationMs)):0,
      totalAwayMs:away,totalScreenMs:screen,unknownMs:unknown,
      screenFacingPercent: screen+away>0 ? 100*screen/(screen+away) : null,
      events
    };
  }
}
