# Mobile catalog: fixture-tested implementation

Implementation wave for issue #355. This is an unpublished, noindex development
preview with original fictional records. It is not a claim that source rights,
live availability, physical-phone acceptance, or public launch are complete.

## Experience

The first page opens directly on the selection, without a modal, service setup,
account, API key or media server. Static All/Movies/Series routes and bounded
24-title pagination work without JavaScript, as does every included title page.
The independent 3D store remains an explicit ordinary link; nothing prefetches
its scripts, models, textures or video.

Search, genre/year filtering and optional subscription-service filtering use a
small, lazily requested index. Filters have URL state. Back restores the query,
selection and scroll position; reload reapplies the URL. A cancelled in-flight
request cannot push a stale query after navigation. Empty results, offline/index
errors, retry, malformed data and snapshot/version mismatch are explicit states.
The existing visible cards survive a failed index fetch. Search text is inserted
as text, never HTML, and index routes/keys are validated before creating links.

The initial controls reserve their layout space while disabled, then enable when
their small script is ready. No-JavaScript visitors receive a clear explanation
and keep ordinary navigation. Labels, native controls, visible focus, a skip
link, live result counts, 44px targets and enlarged-text wrapping remain part of
the interface rather than an alternate accessibility mode.

Title pages include synopsis, media type, year, genre and available duration or
series metadata. Native disclosure reveals plain-text watch options, US scope,
the recorded check date, subscription/sign-in caveats and series limitations.
Provider branding is absent from title cards. Verified provider links and TMDB
watch-page fallbacks have distinct labels; neither promises playback.

Static wording remains date-qualified. On load and visibility return, the client
recomputes 48-hour stale/seven-day expired states and suppresses expired direct
provider links. Missing offers are unknown, not proof of worldwide unavailability.
All fixture watch links are disabled so invented IDs cannot send visitors to
unrelated real titles. The live-source loader and production-target build gates
remain closed.

Poster components reserve a 2:3 aspect ratio, support sized sources, and mark only
the first two browse images as eager. Fictional inputs never request third-party
artwork. The supplied fixture therefore exercises the explicit missing-artwork
state, not licensed posters or their real transfer cost. Approved real-poster
coverage and visual/image-budget review remain a launch prerequisite.

## Data compatibility

The 28-title browsing fixture is separate from the original two-title publisher
fixture. Both preserve movie/TV identity collisions deliberately. No real stock,
private library data or user assets are included.

Artifact format 2 adds service IDs and poster paths to the search index, with an
explicit envelope version and `-a2` URL suffix. New derived bytes cannot replace
old immutable URLs. Retained format-1 artifacts remain verifiable and usable for
rollback; a regression test proves old bytes survive promotion and rollback.
New indexes above 250 KiB gzip fail before publication. See [PUBLISHER.md](PUBLISHER.md).

## Repeat the checks

```sh
cd showcase
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

The Playwright configuration is 390 by 844, touch enabled and reduced motion.
An already provisioned compatible Chrome may be selected through `CHROME_PATH`.
It starts and stops an isolated local Astro preview, retains traces, and checks
the initial resource budget. The tests use Playwright 1.63.0 and axe integration
4.13.0. They do not contact movie/provider services. Automated axe checks do not
replace manual assistive-technology testing.

`lighthouserc.cjs` defines three local mobile runs and pessimistic assertions for
performance >=90, LCP <=2.5s, CLS <=0.1 and TBT <=200ms. Run `lhci collect` and
`lhci assert` with an approved Lighthouse CI installation; no upload is needed.
This wave measured LHCI 0.15.1/Lighthouse 12.6.1 in a disposable tool directory,
against local fixtures only and an existing browser. That CLI's dependency tree
reported advisories, so it is not included in this application's dependencies or
lockfile. No forced dependency fix, credential use, browser download through the
affected extraction path or remote report upload was performed. The application's
dependency audit reports zero vulnerabilities.

## Recorded development evidence

On the prepared ThinkPad, using official checksum-verified Node 22.19.0:

- A fresh archive of the staged public source, outside all project ancestors,
  passed clean `npm ci`, zero-vulnerability audit, the complete showcase check,
  all eight browser flows and the fixture publisher with `NODE_PATH` unset and
  no root `node_modules`. The ordinary root build and all 1,038 root tests also
  pass. No dependency was supplied accidentally by the parent checkout.

- 55 unit/schema/query/publisher tests, zero Astro diagnostics, static build and
  two artifact checks pass. The browser output contains no 3D assets or boot code.
- Eight Playwright phone flows pass: initial render, combined search/filters and
  title/Back/reload, exact scroll restoration and pagination, offline/retry/empty
  and stale-manifest states, no-JavaScript navigation, 200% text and keyboard
  focus, stale/unavailable offers, and navigation during an outstanding request.
- Axe reports zero violations on initial, filtered, title-disclosure and enlarged
  text states. No horizontal overflow, undersized controls, page exceptions or
  failed initial requests were observed. This is emulation, not a physical phone.
- Browser JavaScript is 4,096 bytes gzip; the fixture index is 1,013 bytes gzip.
  The initial preview transfer is 10,631 bytes including document, CSS, JavaScript,
  favicon and measured protocol overhead. No initial index request, external
  resource or 3D request occurs. Real-poster transfer is not measured here.
- Three uncontended LHCI runs score 100 performance and 100 accessibility each.
  LCP is 909.4804, 908.5681 and 907.9380 ms; CLS and TBT are zero in all three.
  Profile: simulated mobile 390x844/DPR1, 150ms RTT, 1638.4 Kbps throughput,
  CPU slowdown 4; Lighthouse 12.6.1, actual Headless Chrome 150 on Linux, with
  Lighthouse's Android/Moto G Power emulated user agent. These are lab results
  for the fixture, not Android device measurements or field percentiles.

Screenshots, full Playwright traces, raw resource sizes, LHCI JSON/HTML and command
receipts are retained in the originating workspace's
`scratch/publicity-kits/showcase-355/`, with selected phone images returned to
the owner's conversation. Initial test failures (a short About target and test
locator assumptions) are preserved separately from passing final receipts.

## Still open before issue 355 is complete

1. Project-specific source/image permission and approved real-data publication,
   attribution and coverage from #354; this increment does not open that gate.
2. Real-title/poster/offer handoff and the same budgets with approved data, not
   fictional records. No invented provider deep link is activated by this UI.
3. Five-minute physical iPhone Safari and Android Chrome trials with device,
   browser and network recorded; manual screen-reader/accessibility acceptance.
4. Authorized deployment and enough field samples before claiming p75 LCP, INP
   or CLS. No deployment, domain change, master release or kiosk replacement
   occurred, and no field metrics are available.
