import { useState } from 'react';

/**
 * SpotifyConnector - Shows Spotify "Now Playing" metadata and BPM via Spotify Web API.
 * 
 * IMPORTANT: Spotify's Web Playback SDK requires:
 * 1. A Spotify Premium account
 * 2. Your own Client ID from https://developer.spotify.com/dashboard
 * 3. The raw audio CANNOT be routed through Web Audio API (DRM protected)
 * 
 * This component connects to Spotify OAuth to read what's currently playing
 * and display its BPM/key/energy from Spotify's Audio Features API.
 */

const SPOTIFY_AUTH_URL = (clientId, redirectUri) => {
  const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state',
  ].join(' ');
  return (
    `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}`
  );
};

function getTokenFromHash() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

export default function SpotifyConnector() {
  const [clientId, setClientId] = useState('');
  const [token, setToken] = useState(() => getTokenFromHash() || '');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [audioFeatures, setAudioFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(token ? 'connected' : 'setup');

  const handleConnect = () => {
    if (!clientId.trim()) {
      setError('Enter your Spotify Client ID first');
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = SPOTIFY_AUTH_URL(clientId.trim(), redirectUri);
  };

  const fetchNowPlaying = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) {
        setNowPlaying(null);
        setError('Nothing is playing right now on Spotify.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
      const data = await res.json();
      setNowPlaying(data);

      // Fetch audio features
      const trackId = data?.item?.id;
      if (trackId) {
        const featRes = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (featRes.ok) {
          const feat = await featRes.json();
          setAudioFeatures(feat);
        }
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const modeNames = ['Minor', 'Major'];

  if (step === 'setup' || !token) {
    return (
      <div className="spotify-panel">
        <div className="source-title">🟢 Spotify Now Playing</div>
        <div className="spotify-steps">
          <div className="spotify-step">
            <span className="step-num">1</span>
            <span>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="ext-link">developer.spotify.com/dashboard</a> → Create an app</span>
          </div>
          <div className="spotify-step">
            <span className="step-num">2</span>
            <span>Add <code className="code-inline">{window.location.origin}</code> as a Redirect URI</span>
          </div>
          <div className="spotify-step">
            <span className="step-num">3</span>
            <span>Paste your Client ID below</span>
          </div>
        </div>
        <div className="spotify-form">
          <input
            type="text"
            placeholder="Spotify Client ID (32-char hex)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="url-input"
          />
          <button className="btn btn-spotify" onClick={handleConnect}>
            🟢 Connect Spotify
          </button>
        </div>
        {error && <div className="url-error">{error}</div>}
        <div className="spotify-note">
          ⚠️ Requires Spotify Premium. This shows track metadata/BPM — Spotify audio stays in the Spotify app.
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-panel">
      <div className="source-title">🟢 Spotify — Connected</div>
      <button
        className="btn btn-spotify refresh-btn"
        onClick={fetchNowPlaying}
        disabled={loading}
      >
        {loading ? '⏳ Fetching...' : '🔄 Fetch Now Playing'}
      </button>

      {error && <div className="url-error">{error}</div>}

      {nowPlaying?.item && (
        <div className="spotify-now-playing">
          {nowPlaying.item.album?.images?.[0]?.url && (
            <img
              src={nowPlaying.item.album.images[0].url}
              alt="album art"
              className="spotify-art"
            />
          )}
          <div className="spotify-meta">
            <div className="spotify-track">{nowPlaying.item.name}</div>
            <div className="spotify-artist">
              {nowPlaying.item.artists?.map((a) => a.name).join(', ')}
            </div>
            <div className="spotify-album">{nowPlaying.item.album?.name}</div>
          </div>
        </div>
      )}

      {audioFeatures && (
        <div className="spotify-features">
          <div className="feat-row">
            <div className="feat-item">
              <span className="feat-value">{Math.round(audioFeatures.tempo)}</span>
              <span className="feat-label">BPM</span>
            </div>
            <div className="feat-item">
              <span className="feat-value">
                {keyNames[audioFeatures.key]}{audioFeatures.mode !== -1 ? ' ' + modeNames[audioFeatures.mode] : ''}
              </span>
              <span className="feat-label">KEY</span>
            </div>
            <div className="feat-item">
              <span className="feat-value">{Math.round(audioFeatures.energy * 100)}%</span>
              <span className="feat-label">ENERGY</span>
            </div>
            <div className="feat-item">
              <span className="feat-value">{Math.round(audioFeatures.danceability * 100)}%</span>
              <span className="feat-label">DANCE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
