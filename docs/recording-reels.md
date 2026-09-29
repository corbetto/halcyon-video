# Record a Halcyon reel

Open **Settings → Performance**, turn **Reel Recording Mode** on, then close
settings. Halcyon rebuilds the current store with your existing library, High
detail, reflections, an 8.3-million-pixel (4K) rendering budget and no automatic
resolution downshift. Your ordinary graphics preferences are preserved.

| Control | In Reel Recording Mode |
| --- | --- |
| L1 / left bumper, or F9 | Start or stop recording |
| R1 / right bumper, or F | Switch between browsing and the smooth fly camera |
| Left stick / WASD | Move the fly camera |
| Right stick / arrow keys | Look around |
| L2 / R2 | Descend / ascend |
| Page Down / Page Up | Descend / ascend with a keyboard |
| Hold L3 / Shift | Fly faster |
| Drag the mouse | Look around smoothly |
| Back / Escape | Leave the fly camera |

L1 keeps its normal put-back action when Reel Recording Mode is off.

The interface and floating selection markers disappear during recording.
Recordings contain only the store canvas, with no microphone, system audio,
browser chrome or desktop capture. Overhead movie screens and movie playback
are disabled in this mode. Compose your shot and let nearby artwork load
before starting a take.

Stopping a take downloads a video and leaves a **Save last take** link in case
the browser blocks the automatic download. The recorder prefers MP4 when the
browser supports it, with WebM as a fallback. The actual dimensions appear
after recording; the browser window sets the aspect ratio, with no cropping.
For a portrait reel, shape the window before starting. The 4K pixel budget and
2× rendering limit mean a small window produces a smaller video.

Capture targets 60 frames per second at a high encoding bitrate. Actual frame
rate depends on the GPU, scene and browser encoder; this is real-time capture,
not an offline render. Takes stop at two minutes or the recording memory limit,
whichever comes first. Start another take to continue.

Changing the window size, hiding the tab or losing window focus stops and
saves the take. Returning to normal settings restores the usual graphics and
controller behavior. If the desktop application's webview cannot record, open
the same Halcyon store in a browser with MediaRecorder support.
