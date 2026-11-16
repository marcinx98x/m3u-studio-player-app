import type { AudioTrackOption, SubtitleTrackOption } from '../../lib/hlsCodecSupport';

interface MediaTrackSelectorProps {
  audioOptions: AudioTrackOption[];
  subtitleOptions: SubtitleTrackOption[];
  selectedAudioId: number | null;
  selectedSubtitleId: number;
  onAudioChange: (id: number) => void;
  onSubtitleChange: (id: number) => void;
}

export default function MediaTrackSelector({
  audioOptions,
  subtitleOptions,
  selectedAudioId,
  selectedSubtitleId,
  onAudioChange,
  onSubtitleChange,
}: MediaTrackSelectorProps) {
  const showAudio = audioOptions.length > 1;
  const showSubtitles = subtitleOptions.length > 0;

  if (!showAudio && !showSubtitles) {
    return null;
  }

  return (
    <>
      {showAudio && (
        <label className="player-track-select-wrap">
          <span className="player-track-select-label">Dźwięk</span>
          <select
            className="player-track-select"
            value={selectedAudioId ?? audioOptions[0]?.id ?? ''}
            onChange={(e) => onAudioChange(Number(e.target.value))}
            aria-label="Ścieżka dźwięku"
          >
            {audioOptions.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={!opt.playable}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {showSubtitles && (
        <label className="player-track-select-wrap">
          <span className="player-track-select-label">Napisy</span>
          <select
            className="player-track-select"
            value={selectedSubtitleId}
            onChange={(e) => onSubtitleChange(Number(e.target.value))}
            aria-label="Napisy"
          >
            <option value={-1}>Wyłączone</option>
            {subtitleOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
