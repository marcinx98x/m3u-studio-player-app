import { describe, expect, it } from 'vitest';
import { formatAudioErrorMessage, parseCodecsList } from './hlsCodecSupport';

describe('parseCodecsList', () => {
  it('splits and lowercases', () => {
    expect(parseCodecsList('avc1.42E01E,mp4a.40.2')).toEqual(['avc1.42e01e', 'mp4a.40.2']);
  });

  it('handles empty', () => {
    expect(parseCodecsList(null)).toEqual([]);
    expect(parseCodecsList('')).toEqual([]);
  });
});

describe('formatAudioErrorMessage', () => {
  it('appends transcode hint when enabled', () => {
    expect(formatAudioErrorMessage('base', true)).toContain('transkodowanie');
    expect(formatAudioErrorMessage('base', false)).toBe('base');
  });
});
