import { ReelCapture, type ReelResult } from './reel-capture';
import {createReelReceipt,reelBuildSource,type ReelBuildSource} from './reel-receipt';
import { resetReelFlight, toggleReelFlight } from './store-reel-flight';
import { markUserActivity } from './user-activity';
import { keyboardOwnedByControl } from './text-entry-focus';
import type { StoreScene } from './three-scene';
import './reel.css';

let getScene: () => StoreScene | null = () => null;
let canStart: () => boolean = () => false;
let activeScene: StoreScene | null = null;
let panel: HTMLElement | null = null;
let status: HTMLElement | null = null;
let download: HTMLAnchorElement | null = null;
let objectUrl = '';
let receiptUrl = '';
let receiptDownload:HTMLAnchorElement|null=null;
let captureSource:ReelBuildSource={revision:null,clean:false,bundled:false};
let originalTitle = '';
let recordingSize = '';
let starting = false;
let readyScene: StoreScene | null = null;
let ready = false;
const capture = new ReelCapture(finish, fail);

function notify(message: string): void {
  if (status) status.textContent = message;
}
function restore(): void {
  if (activeScene) { activeScene.reelRecording = false; activeScene.renderer.domElement.removeAttribute('data-reel-canvas'); }
  activeScene = null;
  document.body.classList.remove('reel-recording');
  if (originalTitle) document.title = originalTitle;
  originalTitle = '';
}
function finish(result: ReelResult): void {
  restore();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(result.blob);
  if (!download) return;
  download.href = objectUrl;
  download.download = 'halcyon-reel-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + result.extension;
  download.hidden = false;
  download.textContent = 'Save last take (' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB)';
  if(receiptDownload){
    if(receiptUrl)URL.revokeObjectURL(receiptUrl);
    const receipt=createReelReceipt({filename:download.download,bytes:result.blob.size,mime:result.blob.type,capture:result.capture,source:captureSource,stoppedEarly:!!result.reason});
    receiptUrl=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'}));
    receiptDownload.href=receiptUrl;receiptDownload.download=download.download+'.json';receiptDownload.hidden=false;
  }
  notify((result.reason ? result.reason + ' ' : '') + recordingSize + ' · Silent video · Ready for another take.');
  // Keep the link until the next completed take in case automatic downloads
  // need a mouse gesture or are disabled by the browser.
  download.click();
}
function fail(message: string): void { restore(); notify(message); }
export function stopReelRecording(reason = ''): boolean {
  if (!capture.busy && !starting) return false;
  starting = false;
  capture.stop(reason);
  // Reveal controls immediately, even while the encoder drains its last chunk.
  restore();
  return true;
}
export function reelRecordingActive(): boolean { return capture.busy || starting; }
export function toggleReelRecording(): boolean {
  const scene = getScene();
  if (!scene?.reelMode && !capture.busy) return false;
  if (capture.busy || starting) { stopReelRecording(); return true; }
  if (!scene || !canStart()) return true;
  if (readyScene !== scene || !ready) { notify('Preparing full-quality artwork. Please wait before recording.'); return true; }
  try {
    if (scene.renderer.getContext().isContextLost()) throw new Error('The graphics context is unavailable.');
    starting = true;
    captureSource=reelBuildSource();
    markUserActivity();
    const canvas = scene.renderer.domElement;
    recordingSize = canvas.width + ' × ' + canvas.height + ' · 60 fps target';
    activeScene = scene;
    originalTitle = document.title;
    document.title = 'Recording — ' + originalTitle;
    canvas.setAttribute('data-reel-canvas', '');
    document.body.classList.add('reel-recording');
    scene.reelRecording = true;
    scene.requestRender();
    scene.composer.render(); // include the current navigation cursor in the first frame
    capture.start(canvas);
    starting = false;
  } catch (error) {
    starting = false;
    fail(error instanceof Error ? error.message : 'Recording could not start.');
  }
  return true;
}
export function toggleReelCamera(): boolean {
  const scene = getScene();
  if (!scene?.reelMode) return false;
  if (canStart()) {
    toggleReelFlight(scene);
    notify(scene.reelFlightActive ? 'Fly camera · Sticks: move / look · L2 / R2: down / up · L1: record'
      : 'Browse camera · L1: record · R1: fly camera');
  }
  return true;
}
export function refreshReelControls(scene: StoreScene): void {
  readyScene = scene; ready = true;
  if (panel) panel.hidden = !scene.reelMode;
  if (!scene.reelMode) return;
  // Normal artwork streaming continues while composing the shot. A missing
  // remote cover must never lock the recorder behind an unbounded promise.
  notify('L1 or F9: record · R1 or F: fly · Page Up / Down: height · 2-minute takes · Silent');
}
export function installReelRecorder(scene: () => StoreScene | null, allowed: () => boolean): void {
  getScene = scene; canStart = allowed;
  panel = document.createElement('section');
  panel.id = 'reel-controls'; panel.hidden = true; panel.setAttribute('aria-label', 'Reel recording');
  const heading = document.createElement('strong'); heading.textContent = 'REEL RECORDER';
  status = document.createElement('p'); status.setAttribute('role', 'status');
  const record = document.createElement('button'); record.textContent = 'Record · L1 / F9';
  record.onclick = () => { record.blur(); toggleReelRecording(); };
  const flight = document.createElement('button'); flight.textContent = 'Fly camera · R1 / F';
  flight.onclick = () => { flight.blur(); toggleReelCamera(); };
  download = document.createElement('a'); download.hidden = true;
  receiptDownload=document.createElement('a');receiptDownload.id='reel-receipt-download';receiptDownload.hidden=true;receiptDownload.textContent='Save take details for review';
  panel.append(heading, status, record, flight, download,receiptDownload); document.body.append(panel);
  window.addEventListener('keydown', event => {
    if (event.key !== 'F9' || event.ctrlKey || event.metaKey || keyboardOwnedByControl()) return;
    if (!getScene()?.reelMode) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) toggleReelRecording();
  }, true);
  window.addEventListener('resize', () => stopReelRecording('Saved before the window changed size.'), true);
  window.addEventListener('blur', () => { const scene = getScene(); if (scene) resetReelFlight(scene); });
  window.addEventListener('gamepaddisconnected', () => { const scene = getScene(); if (scene) resetReelFlight(scene); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopReelRecording('Saved when the store left the screen.');
  });
  window.addEventListener('beforeunload', event => {
    if (!capture.busy) return;
    event.preventDefault(); event.returnValue = '';
  });
  if (getScene()) refreshReelControls(getScene()!);
  document.addEventListener('webglcontextlost', () => stopReelRecording('Saved before graphics recovery.'), true);
}
