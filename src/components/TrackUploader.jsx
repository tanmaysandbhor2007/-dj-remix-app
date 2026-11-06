import { useCallback, useRef, useState } from 'react';

export default function TrackUploader({ onTracksLoaded, disabled }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const audioFiles = Array.from(files).filter((f) =>
        f.type.startsWith('audio/')
      );
      if (audioFiles.length === 0) {
        alert('Please upload audio files (MP3, WAV, OGG, etc.)');
        return;
      }
      onTracksLoaded(audioFiles);
    },
    [onTracksLoaded]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      className={`uploader ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="uploader-icon">🎵</div>
      <div className="uploader-text">
        {isDragging ? 'Drop it like it\'s hot! 🔥' : 'Drop tracks here or click to browse'}
      </div>
      <div className="uploader-hint">MP3 · WAV · OGG · FLAC · AAC</div>
    </div>
  );
}
