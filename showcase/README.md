# Halcyon mobile showcase

An isolated Astro static application. The #353 contract and #354 guarded publisher
now support the fixture-based mobile browse/search/title increment for
[#355](https://github.com/halcyon-video/halcyon-video/issues/355). This is not a
public launch: live-source permission, real poster/offer acceptance and physical
phone trials remain open. See [BROWSE.md](BROWSE.md) for behavior and evidence.

Optional 3D entry, title handoff, sharing and the installation checklist are
documented in [HANDOFF.md](HANDOFF.md). Fixture identities never select real
movie stock, and neither path is required to keep browsing.

[READINESS.md](READINESS.md) describes the offline launch preflight, metadata
validation, synthetic first-week metrics and explicit owner-held launch gates.
Passing fixture CI does not mean the public beta is ready or that analytics is active.

```sh
cd showcase
npm ci
npm run check
npm run dev
```

Requires Node 22.19 or newer (including the transitive HTTP dependency). Dependencies are pinned with a separate lockfile;
output is `showcase/dist/`. The root Vite build and existing 3D deployment are
unchanged. Commands make no upstream movie API requests and need no credentials.

All 28 browsing titles are original fictional samples in `fixtures/browse.json`.
The two-record `fixtures/catalog.json` remains the original contract/publisher
fixture. Both deliberately share numeric IDs across movie and TV; no watch links
or third-party poster requests are activated. All routes remain noindex.

`SHOWCASE_ORIGIN` validates an optional HTTPS origin but does not publish it;
leave it unset until a real host is selected. Fixture previews always omit public
canonical, URL/image identity and sitemap claims; the setting is not release authority.
`SHOWCASE_SNAPSHOT` selects a local fixture snapshot. Non-fixture data and
`SHOWCASE_DEPLOY_TARGET=production` deliberately fail until the source publication
and deployment gates are implemented in #354 and #356. Do not remove these gates
merely to obtain a successful deployment.

`/data/manifest.json` points to immutable, hash-qualified 24-title JSON pages and
a compact search index. There is no search-index request on initial page load.
Search loads that index only on search/filter intent, checks its version against
the current manifest and keeps at most 24 result cards mounted. Movies, series,
pagination and title reading also have static no-JavaScript routes. Schema and
selection helpers live in `src/catalog/`; the service adapter reuses existing
pure store definitions without importing its startup graph. Real poster and
physical-phone acceptance still belong to the unclosed portion of #355.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the contract, launch gates, source
references, deployment/rollback design and next implementation boundaries.

The guarded data-publisher increment for #354 is documented in
[PUBLISHER.md](PUBLISHER.md). `npm run publish:fixture` creates immutable local
artifacts with atomic promotion and rollback safeguards. Its transport and
collector are tested against synthetic responses; live collection, daily jobs,
source permission and production publication remain explicitly gated.

The #356 [deployment foundation](DEPLOYMENT.md) adds a verified static bundle,
source/snapshot receipts, secret-free artifact CI and local rollback simulation.
It does not register a project/domain or publish a Cloudflare preview/production
site. Network publishing and scheduled live refresh remain hard-disabled.
