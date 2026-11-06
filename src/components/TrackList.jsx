export default function TrackList({ tracks, currentDeck, deckName }) {
  const activeTracks = new Set([deckName[0], deckName[1]]);

  return (
    <div className="tracklist">
      <h3 className="tracklist-title">🎧 Loaded Tracks</h3>
      <div className="tracklist-items">
        {tracks.length === 0 && (
          <div className="tracklist-empty">No tracks loaded yet...</div>
        )}
        {tracks.map((track, i) => {
          const onDeck0 = track.name === deckName[0];
          const onDeck1 = track.name === deckName[1];
          const isActive = onDeck0 || onDeck1;
          return (
            <div
              key={track.id}
              className={`tracklist-item ${isActive ? 'active' : ''}`}
            >
              <span className="track-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="track-name">{track.name.replace(/\.[^/.]+$/, '')}</span>
              <span className="track-bpm">{track.bpm} BPM</span>
              <span className="track-dur">{formatTime(track.duration)}</span>
              {onDeck0 && <span className="deck-badge deck-a-badge">A</span>}
              {onDeck1 && <span className="deck-badge deck-b-badge">B</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
