import { useState } from 'react';

const SAMPLE_TRACKS = [
  {
    name: 'Lofi Hip Hop Beat',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    name: 'Electronic Groove',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    name: 'Upbeat Dance Track',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    name: 'Ambient Synth',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
];

export default function URLLoader({ onTrackLoaded }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadURL = async (trackUrl, trackName) => {
    if (!trackUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(trackUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
        // Try anyway — some servers don't set correct content-type
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileName = trackName.trim() || trackUrl.split('/').pop() || 'URL Track';
      await onTrackLoaded(arrayBuffer, fileName);
      setUrl('');
      setName('');
    } catch (err) {
      if (err.message.includes('CORS') || err.message.includes('Failed to fetch')) {
        setError('❌ CORS blocked — the server doesn\'t allow cross-origin requests. Try a different URL or download and upload the file.');
      } else {
        setError(`❌ Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loadURL(url, name);
  };

  return (
    <div className="url-loader">
      <div className="source-title">🔗 Load from URL</div>
      <form onSubmit={handleSubmit} className="url-form">
        <input
          type="url"
          placeholder="https://example.com/track.mp3"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="url-input"
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Track name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="url-input name-input"
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-url"
          disabled={loading || !url.trim()}
        >
          {loading ? '⏳ Loading...' : '+ ADD'}
        </button>
      </form>
      {error && <div className="url-error">{error}</div>}

      {/* Sample tracks */}
      <div className="sample-tracks">
        <div className="sample-title">▸ Demo tracks (click to load)</div>
        {SAMPLE_TRACKS.map((t) => (
          <button
            key={t.url}
            className="sample-track-btn"
            onClick={() => loadURL(t.url, t.name)}
            disabled={loading}
          >
            🎵 {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
