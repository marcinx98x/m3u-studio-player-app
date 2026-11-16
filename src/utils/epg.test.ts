import { describe, expect, it } from 'vitest';
import { decodeEpgTitle, epgEndMs, epgStartMs } from './epg';

describe('decodeEpgTitle', () => {
  it('returns plain text as-is', () => {
    expect(decodeEpgTitle('Wiadomości')).toBe('Wiadomości');
  });

  it('decodes base64 utf-8', () => {
    const b64 = btoa('Test Program');
    expect(decodeEpgTitle(b64)).toBe('Test Program');
  });
});

describe('epg timestamps', () => {
  it('parses unix seconds', () => {
    expect(epgStartMs({ start_timestamp: '1700000000' })).toBe(1700000000 * 1000);
    expect(epgEndMs({ stop_timestamp: '1700003600' })).toBe(1700003600 * 1000);
  });
});
