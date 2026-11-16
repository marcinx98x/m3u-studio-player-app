import { describe, expect, it } from 'vitest';
import { isAllowedStreamUrl } from './streamUrlAllow';

describe('isAllowedStreamUrl', () => {
  it('allows urls under xtream base', () => {
    expect(
      isAllowedStreamUrl(
        'https://m3u-studio.marcincloud.org/api/xtream/live/s/abc/1.m3u8',
        'https://m3u-studio.marcincloud.org/api/xtream',
      ),
    ).toBe(true);
  });

  it('allows root media aliases on studio host', () => {
    expect(
      isAllowedStreamUrl(
        'https://m3u-studio.marcincloud.org/live/s/abc/1.m3u8',
        'https://m3u-studio.marcincloud.org/api/xtream',
      ),
    ).toBe(true);
    expect(
      isAllowedStreamUrl(
        'https://m3u-studio.marcincloud.org/movie/s/abc/9.mp4',
        'https://m3u-studio.marcincloud.org/api/xtream',
      ),
    ).toBe(true);
  });

  it('allows relative root media paths (dev)', () => {
    expect(isAllowedStreamUrl('/live/s/abc/1.m3u8', '/api/xtream')).toBe(true);
  });

  it('rejects foreign hosts', () => {
    expect(
      isAllowedStreamUrl(
        'https://evil.example/x.m3u8',
        'https://m3u-studio.marcincloud.org/api/xtream',
      ),
    ).toBe(false);
  });
});
