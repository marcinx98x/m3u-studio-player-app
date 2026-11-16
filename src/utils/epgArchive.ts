import type { XtreamEpgListing, XtreamLiveStream } from '../types/xtream';
import { epgListingAirState, epgStartMs } from './epg';

export function listingHasArchive(
  listing: XtreamEpgListing,
  channel: XtreamLiveStream,
): boolean {
  return listing.has_archive === 1 || channel.tv_archive === 1;
}

/** Przeszłe audycje z dostępnym archiwum, posortowane chronologicznie (najstarsze pierwsze). */
export function filterArchivablePastListings(
  listings: XtreamEpgListing[],
  channel: XtreamLiveStream,
  nowMs = Date.now(),
): XtreamEpgListing[] {
  return listings
    .filter((item) => {
      if (epgListingAirState(item, nowMs) !== 'past') return false;
      return listingHasArchive(item, channel);
    })
    .sort((a, b) => epgStartMs(a) - epgStartMs(b));
}

export function listingsMatch(a: XtreamEpgListing, b: XtreamEpgListing): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  return epgStartMs(a) === epgStartMs(b) && a.title === b.title;
}

/**
 * Lista do przycisków Poprz./Nast.: przeszłe archiwum + bieżąca audycja w catch-up
 * (np. trwający program na żywo), jeśli nie ma jej jeszcze na liście past.
 */
export function buildArchiveNavigationListings(
  pastListings: XtreamEpgListing[],
  playing: XtreamEpgListing | null,
  channel: XtreamLiveStream,
): XtreamEpgListing[] {
  if (!playing || !listingHasArchive(playing, channel)) {
    return pastListings;
  }

  const alreadyListed = pastListings.some((item) => listingsMatch(item, playing));
  if (alreadyListed) {
    return pastListings;
  }

  return [...pastListings, playing].sort((a, b) => epgStartMs(a) - epgStartMs(b));
}

export function findAdjacentArchiveListing(
  listings: XtreamEpgListing[],
  current: XtreamEpgListing,
  direction: 'prev' | 'next',
): XtreamEpgListing | null {
  if (listings.length === 0) return null;
  const idx = listings.findIndex((l) => listingsMatch(l, current));
  if (idx < 0) return null;
  const nextIdx = direction === 'prev' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= listings.length) return null;
  return listings[nextIdx] ?? null;
}

/** Ostatnia zakończona audycja z archiwum (do skrótu „Poprzednia” na live). */
export function getLatestArchivablePastListing(
  listings: XtreamEpgListing[],
  channel: XtreamLiveStream,
  nowMs = Date.now(),
): XtreamEpgListing | null {
  const past = filterArchivablePastListings(listings, channel, nowMs);
  return past.length > 0 ? past[past.length - 1]! : null;
}
