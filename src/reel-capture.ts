// Browser MediaRecorder owns encoding; only the store canvas enters this
// stream. No microphone, system audio, browser chrome or DOM is captured.
export const REEL_MAX_MS = 120_000;
export const REEL_MAX_BYTES = 600 * 1024 * 1024;
export const REEL_MIME_TYPES = [
  'video/mp4;codecs=avc1.640034', 'video/mp4',
  'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
];
import type {ReelCaptureFacts} from './reel-receipt';
export interface ReelResult { blob: Blob; extension: string; reason: string; capture:ReelCaptureFacts; }
export class ReelCapture {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private reason = '';
  private finishing = false;
  private startedAt = '';
  private startedMs = 0;
  private width = 0;
  private height = 0;
  private readonly onResult: (result: ReelResult) => void;
  private readonly onError: (message: string) => void;
  constructor(onResult: (result: ReelResult) => void, onError: (message: string) => void) {
    this.onResult = onResult; this.onError = onError;
  }
  get busy(): boolean { return !!this.recorder; }
  get recording(): boolean { return this.recorder?.state === 'recording' && !this.finishing; }
  start(canvas: HTMLCanvasElement): void {
    if (this.busy) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      throw new Error('Recording is unavailable in this browser. Open Halcyon in Chrome or Edge.');
    }
    this.chunks = []; this.bytes = 0; this.reason = ''; this.finishing = false;
    this.width=canvas.width;this.height=canvas.height;
    try {
      this.stream = canvas.captureStream(60);
      let lastError: unknown;
      for (const mimeType of REEL_MIME_TYPES) {
        if (!MediaRecorder.isTypeSupported(mimeType)) continue;
        try {
          this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 40_000_000 });
          break;
        } catch (error) { lastError = error; }
      }
      if (!this.recorder) throw lastError || new Error('No supported video encoder is available.');
      const recorder = this.recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) { this.chunks.push(event.data); this.bytes += event.data.size; }
        if (this.bytes >= REEL_MAX_BYTES) this.stop('Clip saved at the recording size limit.');
      };
      recorder.onerror = () => {
        this.reason = 'The video encoder stopped. Any captured footage is available below.';
        if (recorder.state !== 'inactive') this.stop(this.reason);
        // The recording API delivers a final dataavailable and stop after error.
      };
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || this.chunks[0]?.type || 'video/webm' });
        const reason = this.reason;
        const capture={width:this.width,height:this.height,startedAt:this.startedAt,wallDurationMs:Math.max(0,performance.now()-this.startedMs),requestedFps:60,
          audioTracks:this.stream?.getTracks().filter(track=>track.kind==='audio').length??0};
        this.cleanup();
        if (blob.size) this.onResult({ blob, reason, capture, extension: blob.type.includes('mp4') ? 'mp4' : 'webm' });
        else this.onError(reason || 'No video frames were captured. Please try again.');
      };
      this.startedAt=new Date().toISOString();this.startedMs=performance.now();
      recorder.start(1000);
      this.timer = setTimeout(() => this.stop('Two-minute clip saved. You can start another take.'), REEL_MAX_MS);
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }
  stop(reason = ''): void {
    if (!this.recorder || this.finishing) return;
    this.finishing = true;
    this.reason = reason || this.reason;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
  }
  private cleanup(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null; this.recorder = null; this.chunks = []; this.bytes = 0; this.finishing = false;
  }
}
