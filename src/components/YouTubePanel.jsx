import { useState, useEffect, useRef } from 'react';

/**
 * YouTubePanel - Embeds a YouTube video alongside the DJ set
 * Note: YouTube audio is NOT routed through Web Audio API (browser restriction)
 * This panel acts as a "video screen" / inspiration tool for the DJ
 */
export default function YouTubePanel() {
  const [query, setQuery] = useState('');
  const [videoId, setVideoId] = useState('');
  const [inputId, setInputId] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const extractVideoId = (input) => {
    // Handle full URLs
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/, // just the ID
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const handleLoad = (e) => {
    e.preventDefault();
    const id = extractVideoId(inputId.trim());
    if (id) {
      setVideoId(id);
      setIsOpen(true);
    } else {
      alert('Please paste a valid YouTube URL or video ID');
    }
  };

  // Popular DJ/music suggestions
  const suggestions = [
    { label: '🎧 Boiler Room Mix', id: 'PGNiV3UF-xE' },
    { label: '⚡ DJ Snake Live', id: 'SlbOEH4LHCE' },
    { label: '🌊 Lofi Beats', id: 'jfKfPfyJRdk' },
  ];

  return (
    <div className="yt-panel">
      <div className="source-title">📺 YouTube Screen</div>
      <div className="yt-note">
        ℹ️ Video plays alongside your mix — audio effects apply to your deck tracks only
      </div>
      <form onSubmit={handleLoad} className="yt-form">
        <input
          type="text"
          placeholder="Paste YouTube URL or video ID"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          className="url-input"
        />
        <button type="submit" className="btn btn-url">▶ LOAD</button>
      </form>

      <div className="yt-suggestions">
        {suggestions.map((s) => (
          <button
            key={s.id}
            className="sample-track-btn"
            onClick={() => { setVideoId(s.id); setIsOpen(true); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isOpen && videoId && (
        <div className="yt-embed-wrapper">
          <iframe
            width="100%"
            height="200"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`}
            title="YouTube video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="yt-iframe"
          />
          <button className="yt-close" onClick={() => { setIsOpen(false); setVideoId(''); }}>
            ✕ Close
          </button>
        </div>
      )}
    </div>
  );
}
