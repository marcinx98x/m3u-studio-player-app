import { describe, expect, it } from 'vitest';
import {
  buildStreamUrl,
  sanitizeContainerExtension,
  sanitizeStreamIconUrl,
  type XtreamCredentials,
} from './xtreamClient';

describe('sanitizeContainerExtension', () => {
  it('allows known extensions', () => {
    expect(sanitizeContainerExtension('MP4', 'ts')).toBe('mp4');
    expect(sanitizeContainerExtension('.m3u8', 'mp4')).toBe('m3u8');
  });

  it('rejects path injection', () => {
    expect(sanitizeContainerExtension('../x', 'mp4')).toBe('mp4');
    expect(sanitizeContainerExtension('mp4?x=1', 'mkv')).toBe('mkv');
    expect(sanitizeContainerExtension('exe', 'mp4')).toBe('mp4');
  });
});

describe('sanitizeStreamIconUrl', () => {
  it('allows https and relative', () => {
    expect(sanitizeStreamIconUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(sanitizeStreamIconUrl('/picons/x.png')).toBe('/picons/x.png');
  });

  it('blocks http and javascript', () => {
    expect(sanitizeStreamIconUrl('http://evil/x.png')).toBeNull();
    expect(sanitizeStreamIconUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('buildStreamUrl', () => {
  it('uses session path without password on root media base', () => {
    const creds: XtreamCredentials = {
      username: 'bob',
      sessionToken: 'a'.repeat(64),
    };
    const url = buildStreamUrl(creds, 'live', 42);
    expect(url).toContain('/live/s/');
    expect(url).toContain('/42.m3u8');
    expect(url).not.toContain('/api/xtream/');
    expect(url).not.toContain('bob');
    expect(url).not.toMatch(/\/live\/bob\//);
  });

  it('sanitizes movie extension', () => {
    const creds: XtreamCredentials = {
      username: 'bob',
      sessionToken: 'b'.repeat(64),
    };
    expect(buildStreamUrl(creds, 'movie', 9, '../../evil')).toMatch(/\/9\.mp4$/);
    expect(buildStreamUrl(creds, 'movie', 9, 'mp4')).not.toContain('/api/xtream/');
  });
});
