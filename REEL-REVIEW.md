# Private motion review preparation

Issue #367 increment. This adds capture details and a private review-pack gate;
it does not create the owner's human-operated campaign recording, publish a site
or social post, send a pitch, change an account, release master, or modify any
existing approval/rejection decision. Finished campaign media remains blocked
until the owner supplies a qualifying take and the required review.

## Record the actual take

Use the existing opt-in Reel Recording Mode, the real personal library and a
human operator. Compose a native portrait view before starting; never crop or
shrink a landscape recording into a portrait frame. L1/F9 starts/stops capture,
R1/F toggles the inertial fly camera, sticks/WASD move/look, and L2/R2 or Page
Down/Up change height. Existing per-screen Overhead TV Programs settings choose
the movie on each TV. Foreground movie playback stays disabled in reel mode;
movie footage is permitted only within the authorized overhead-TV recording
scope. Assets and the whole recording still require review.

The existing recorder requests High detail, SSAO, smooth reflections, mirrors
and its 4K pixel budget. It captures the canvas without DOM controls, microphone
or system audio. These are requested settings, not a promise of measured frame
rate or a substitute for checking the final image. A 60 fps target is not proof
that the GPU/encoder produced 60 distinct frames. Do not interpolate or duplicate
frames to disguise slow capture. Actual-library/physical-hardware acceptance is
not established by automated synthetic control tests.

After stopping, save the video and **Save take details for review**. The JSON
contains only whitelisted source, dimensions, timing, audio-track count and
requested-profile facts. It contains no library metadata, title IDs, selected TV
movie, server address, account name, credential, local path or saved preferences.
It defaults human operation, personal library, asset/whole-clip/cadence review
to unverified and publication to false. Details are evidence, not an authenticated
attestation or a cryptographic binding to the video; the assembly tool hashes
the supplied media and details independently.

Bundled builds record a full Git revision and cleanliness, with a final build
check refusing a source change. Source archives without Git are unverified.
Development-server/HMR captures are always unverified even if the server started
on a clean revision. Private assets/runtime configuration are not established by
a Git hash. A package version is not a release receipt, and dev footage must be
labelled as a development preview until the matching release is approved.

## Prepare a private pack without changing the review queue

The existing FFmpeg/ffprobe tools do the media work; no custom comparator or new
dependency is introduced. Executables come from PATH, or `HALCYON_FFMPEG` and
`HALCYON_FFPROBE`. See [ffprobe's structured-output documentation](https://ffmpeg.org/ffprobe.html)
and [FFmpeg's stream-copy documentation](https://ffmpeg.org/ffmpeg.html).

```sh
node tools/reel-review.mjs --out scratch/publicity-kits/relaunch-review
node tools/reel-review.mjs --out scratch/publicity-kits/relaunch-review \
  --clip /local/halcyon-reel-take.mp4 --receipt /local/halcyon-reel-take.mp4.json
```

The first command creates finished hooks, factual pitch, feature sheet, channel
status and a relative two-week sequence with an explicit missing-footage blocker.
It does not invent a playable campaign take. The second inspects a bounded local
MP4/WebM file only. Playlists, symlinks, remote protocols, extra streams and
unsupported receipt fields are refused. Probing fully decodes/counts frames and
reads their timestamps, rather than trusting a nominal frame-rate header. It
reports native dimensions, orientation, sample aspect, audio, duration, decoded
cadence and longest frame gap. No input paths or arbitrary container tags enter
the review report.

The delivery check requires native 9:16 at least 720×1280, square pixels, H.264
MP4/yuv420p, no audio/data attachments, matching canvas/byte facts and a clean
bundled source. The 60 fps mechanical tolerance is at least 59 decoded frames
per second with no gap beyond roughly two target frames. This is a conservative
review gate, not a physical-phone performance claim. Recovery/limit-stopped,
sped-up, low-cadence or unverified-source takes stay blocked; they are never
silently cropped, scaled or transcoded.

An optional `--attestation` JSON can record an explicit owner confirmation bound
to the exact input SHA-256: schemaVersion 1, videoSha256, reviewedBy `owner`, true
humanOperation/personalLibrary/wholeClip/assetClearance/maximumQuality/
noFrameInterpolation, and movieFrames `none` or `overhead-tv-only`. An operator
may prepare that file from the owner's explicit confirmation; never invent the
answers or ask the owner to edit JSON. Those assertions are not authenticated by
the tool and cannot grant publication authority. All remain unverified by
default. `--released-revision` may identify an independently observed public
release SHA; matching it still does not approve publication.

Only a mechanically valid, owner-confirmed take is included as playable media.
FFmpeg stream-copy removes container metadata/chapters without reencoding,
cropping, resizing or frame interpolation. Encoded video packet hashes and
decoded dimensions/frame count must match before and after. This is not an
automatic content-redaction system: the actual pictures and encoded video are
preserved and require whole-clip human privacy/licensing review.

Packs live only under this checkout's ignored `scratch/publicity-kits/`, in
content-addressed private directories. Existing packs are verified, not
overwritten. `review.html` is a private, unindexed report with copy and, only when
qualified, playable/downloadable media. It is not an import into the existing
MogNet review page. Qualified media must later be staged there through its
supported review workflow, preserving every earlier decision and binding exact
copy, destinations and media bytes. No rejected take is resurrected here.

## Approval and measurement boundary

Instagram Reels, YouTube Shorts and TikTok remain manual destinations unless
their actual integrations change. Discord/Mastodon use the existing approved
release publisher only; configuration must be checked before a fresh approval.
Neither the tool nor the prepared two-week plan sends anything. Press/creator
outreach and production release each need their separate owner approval. The
campaign gets zero paid advertising.

Current infrastructure can confirm publisher delivery receipts, not hosted
visits, inspection conversions, playback or returns. The recommendation is to
keep new analytics OFF for this review, costing $0 in new services. The separate
showcase synthetic metrics are not real visitor evidence. A later analytics
proposal needs an explicit cost/privacy/retention decision and a real baseline;
repository traffic is not hosted-store traffic.

The next required owner input is the native vertical, human-operated take from
the real library plus its capture details and explicit whole-clip/privacy/asset
confirmation. This increment provides the controls/provenance and finished copy,
not substitute footage. The full #367 campaign remains incomplete until those
conditions, current-source/release labels and existing review-page delivery pass.
