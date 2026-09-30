import { snapshotSchema, titleKey, type CatalogTitle, type Snapshot } from './schema.ts';
import { services } from './services.ts';

function getSubscriptionTitleKeys(
  titles: CatalogTitle[],
  filter?: { serviceId?: string; mediaType?: 'movie' | 'tv' }
): Set<string> {
  const keys = new Set<string>();
  for (const title of titles) {
    if (filter?.mediaType && title.mediaType !== filter.mediaType) continue;
    const hasMatchingSubOffer = title.offers.some(offer => {
      if (offer.type !== 'subscription') return false;
      if (filter?.serviceId && offer.serviceId !== filter.serviceId) return false;
      return true;
    });
    if (hasMatchingSubOffer) {
      keys.add(titleKey(title));
    }
  }
  return keys;
}

export function validatePromotion(
  candidate: unknown,
  previous: unknown | undefined,
  now: number
): Snapshot {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('Expected finite timestamp for now');
  }

  const parsedCandidate = snapshotSchema.parse(candidate);

  const candGenerated = Date.parse(parsedCandidate.generatedAt);
  const candChecked = Date.parse(parsedCandidate.checkedAt);

  if (candGenerated > now) {
    throw new Error('Candidate generation time is in the future');
  }
  if (candChecked > now) {
    throw new Error('Candidate check time is in the future');
  }

  const candMovieSubCount = getSubscriptionTitleKeys(parsedCandidate.titles, { mediaType: 'movie' }).size;
  const candTvSubCount = getSubscriptionTitleKeys(parsedCandidate.titles, { mediaType: 'tv' }).size;

  if (candMovieSubCount === 0) {
    throw new Error('Candidate active subscription movie group is empty');
  }
  if (candTvSubCount === 0) {
    throw new Error('Candidate active subscription TV group is empty');
  }

  for (const row of parsedCandidate.coverage) {
    if (row.providerIds.length > 0) {
      const subCount = getSubscriptionTitleKeys(parsedCandidate.titles, {
        serviceId: row.serviceId,
        mediaType: row.mediaType,
      }).size;
      if (subCount === 0 && !row.limitation) {
        throw new Error(
          `Coverage row for ${row.serviceId}:${row.mediaType} has resolved provider IDs but no active subscription titles and no explicit limitation`
        );
      }
    }
  }

  if (previous !== undefined) {
    const parsedPrevious = snapshotSchema.parse(previous);

    if (parsedCandidate.source !== parsedPrevious.source) {
      throw new Error(
        `Source mismatch: candidate source is ${parsedCandidate.source}, previous source was ${parsedPrevious.source}`
      );
    }
    if (parsedCandidate.region !== parsedPrevious.region) {
      throw new Error(
        `Region mismatch: candidate region is ${parsedCandidate.region}, previous region was ${parsedPrevious.region}`
      );
    }
    if (candChecked < Date.parse(parsedPrevious.checkedAt)) {
      throw new Error('Candidate checkedAt regresses before previous checkedAt');
    }

    const prevGlobalSubCount = getSubscriptionTitleKeys(parsedPrevious.titles).size;
    const candGlobalSubCount = getSubscriptionTitleKeys(parsedCandidate.titles).size;

    if (prevGlobalSubCount > 0) {
      if (candGlobalSubCount * 100 < prevGlobalSubCount * 70) {
        throw new Error(
          `Global subscription title count dropped by more than 30% (${prevGlobalSubCount} -> ${candGlobalSubCount})`
        );
      }
    }

    for (const service of services) {
      for (const mediaType of ['movie', 'tv'] as const) {
        const prevGroupCount = getSubscriptionTitleKeys(parsedPrevious.titles, {
          serviceId: service.id,
          mediaType,
        }).size;

        if (prevGroupCount >= 1) {
          const candGroupCount = getSubscriptionTitleKeys(parsedCandidate.titles, {
            serviceId: service.id,
            mediaType,
          }).size;

          if (candGroupCount * 100 < prevGroupCount * 70) {
            throw new Error(
              `Subscription title count for ${service.id}:${mediaType} dropped by more than 30% (${prevGroupCount} -> ${candGroupCount})`
            );
          }
        }
      }
    }
  }

  return parsedCandidate;
}
