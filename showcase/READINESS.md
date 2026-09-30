# Readiness, not a launch

Issue #358 fixture increment. No site was deployed, domain registered, analytics
enabled, real visitor measured, Search Console submitted, outreach sent or master
release made. The report always distinguishes verified local integrity from the
unperformed source, host, phone and release acceptance. The issue stays open.

## Reproduce the evidence

Use the pinned Node 22.19 toolchain in a clean committed checkout:

```sh
cd showcase
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run package:preview -- <full-current-source-sha>
npm run readiness:report -- <full-current-source-sha> 2026-09-30T12:00:00Z
npm run readiness:report -- <full-current-source-sha> 2026-09-30T12:00:00Z --require-launch-ready
```

The example clock is an explicit report input, not a claim about current time.
Use the actual UTC observation time for an operational report. Identical sealed
bytes, policy, browser proof, fixture and clock yield identical report bytes and
the same content-addressed report directory. Report generation exits zero on
valid inputs; the explicit launch gate exits 75 because this preview is not a
release. Malformed/mismatched inputs refuse to produce a successful report.

The existing artifact workflow verifies clean source, complete snapshot/static
bundle and all phone tests first. Playwright's browser DOM parses every built
HTML route's metadata and links; no custom HTML parser or crawling service is
introduced. Its proof includes the hash of each checked HTML file and robots
file. The report verifies those against the #356 sealed bundle. Reports remain
under ignored `input/readiness/`, not the served website. Only the existing
trusted artifact-upload step retains them, for 14 days. No credential or provider
API is read. Receipts are reproducible integrity evidence, not cryptographic
attestation or authority to publish.

## Discovery and social boundary

Every included page has distinct bounded title/description text; title metadata
includes movie/series type and year. Open Graph title/description match that
page. Previews keep HTML and HTTP `noindex, nofollow`, and do not claim canonical,
`og:url`, `og:image`, public sitemap or indexing. A title with no permitted real
poster never inherits an unrelated store picture as a share card.

The preview robots file allows crawling so supporting crawlers can actually
read the noindex rule. Blocking a page in robots can prevent that rule from being
seen; it is not reliable index removal. This follows [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
Neither robots nor noindex is authentication. Preview access protection remains
an owner-held #356 decision; no outside crawler was invited by this local change.

The report carries a validated planned route inventory, excluding query/filter
combinations and paginated browse variants. It deliberately does not turn those
paths into fictional absolute URLs. After approval, a sitemap must contain the
actual canonical HTTPS URLs and accurately dated updates, not the build clock
or test origin. Submission is only a hint, not an indexing guarantee. See
[Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
The full [Open Graph identity](https://ogp.me/) additionally needs approved
absolute URL/image metadata. That public share-card gate remains blocked until
the domain and permitted relevant assets exist. No share image was invented.

## Metrics are an offline fixture, not a visitor tracker

`src/metrics/schema.ts` validates the existing #357 inert page action signal.
The only fields are version, allowlisted event and compatible surface. Unknown
fields, searches, media IDs, IPs, cookies, sessions, URLs, referrers, credentials
and personal-library data are rejected without echoing their values in errors.
Nothing imports the collector into the browser. No HTTP receiver, beacon,
analytics SDK, database, persistence, tracking identity or endpoint is activated.

The local collector is an in-memory test object. It accepts only explicitly
synthetic, date-bounded records with coarse source buckets and bounded counts;
it can be cleared, never sends a request and retains no rejected payload.
`fixtures/first-week.ts` supplies seven days of original invented counts. The
generated `synthetic-first-week.json` labels every day synthetic, records zero
real visitors, no established baseline and no conversion targets. It is neither
observed traffic nor a forecast.

| Report item | Numerator | Denominator / meaning |
| --- | --- | --- |
| Source mix | Synthetic browse page views by direct/search/referral/unknown | Document-view source buckets, not identified people or real session arrivals |
| Browse-to-title | Title document views | Browse document views |
| Title-to-watch | First watch disclosure per document | Title document views |
| Outbound watch | Watch-link activations | Watch disclosures |
| 3D entry | Explicit bridge entry clicks | Bridge document views |
| Installation guide | Guide/releases clicks | Self-host document views |

Ratios are event ratios, not cohort conversion probabilities. Repeated navigation
or clicks can produce values above one; they are not silently capped. A zero
denominator yields null, not zero-percent performance. Clicks do not prove
successful navigation, subscription, playback or completed installation. Fixture
watch links are disabled, so synthetic outbound counts are arithmetic examples,
not claims about the current preview. Before future collection, the owner must
approve permitted dimensions/retention and the host-analytics export; use coarse
source buckets without importing raw referrers or visitor-level logs. Establish
an actual baseline before selecting any conversion threshold.

## Daily checks and rollback decision path

`assessHealth` is deterministic advice, not an active monitor. Unobserved refresh,
uptime and links remain unobserved, never green. Current output assesses only the
fixture's age at the explicit input clock; it performs no provider or domain
request. No external alert destination is configured.

After an approved release, maintainer **devbjackson** owns daily refresh status,
retained source/snapshot/deployment receipts, sampled truthful provider handoffs,
canonical HTTPS/deep routes and field-performance evidence. Forty-eight-hour
checks get stale wording; seven-day checks suppress affirmative provider links,
matching #354–#355. Refresh failure preserves the last good version and original
check time. Integrity failure or a confirmed public-route outage requires owner
inspection and, if warranted, verified whole-deployment rollback from #356.
Never mix page/data versions, invent a replacement offer or advance freshness
after a failure. Recommendations do not call a hosting API automatically.

## Owner-held launch kit and first-week triage

The factual differentiators are a lightweight static movie/series catalog,
explicit truthful watch options, an optional immersive store and optional local
library integrations. This preview is fictional; it is not a live US catalog.
The release kit must use the actual approved domain, release SHA and snapshot,
three same-build phone screenshots (browse, title/watch and optional bridge), a
short browse → title → watch walkthrough, coverage/provenance/subscription and
privacy limitations. Current CI screenshots/traces are fixture proof, not a
press-ready live product kit. No root README or demo cross-link is activated.

On the first Saturday/Sunday after an approved beta: review each morning and
evening; prioritize rights/privacy/security, broken core journeys and corrupted
snapshots first, then accessibility/availability errors, then cosmetic defects.
Use the repository's owner-authored issue workflow for accepted defects. Preserve
failed receipts, assign a maintainer, and let the owner decide rollback/release.
Unknown or insufficient field samples stay unknown; desktop emulation is not an
iPhone or Android cellular acceptance session. Actual iPhone/Android, source and
image rights, owned host/DNS/HTTPS, real provider rollback, approved release,
public sitemap/share cards, host analytics and Search Console remain explicit
gates. Neither a green preview nor this report closes #358.
