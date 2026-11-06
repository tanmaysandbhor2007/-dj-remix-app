import { AudioAnalyzer } from '../engine/AudioAnalyzer.js';

export default function DeckControls({ deckIdx, deckKey, otherKey, isLooping, onLoop, onStopLoop, onEQ, deckLabel }) {
  const harmony = AudioAnalyzer.camelotCompatible(deckKey, otherKey);
  const harmonyColors = {
    perfect: '#00ff88',
    good:    '#ffcc00',
    risky:   '#ff4444',
    unknown: '#555',
  };

  return (
    <div className="deck-controls">
      {/* Key display */}
      {deckKey && (
        <div className="key-display">
          <span className="key-root">{deckKey.root} {deckKey.mode[0]}</span>
          <span className="key-camelot">{deckKey.camelot}</span>
          {otherKey && (
            <span className="key-harmony" style={{ color: harmonyColors[harmony] }}>
              {harmony === 'perfect' ? '✦ Perfect' : harmony === 'good' ? '◎ Good' : harmony === 'risky' ? '⚠ Risky' : ''}
            </span>
          )}
        </div>
      )}

      {/* Loop button */}
      <button
        className={`loop-btn ${isLooping ? 'looping' : ''}`}
        onClick={() => isLooping ? onStopLoop(deckIdx) : onLoop(deckIdx)}
        title={isLooping ? 'Stop loop' : 'Loop best section (8 bars)'}
      >
        {isLooping ? '■ LOOP' : '⟳ LOOP'}
      </button>

      {/* Mini 3-band EQ */}
      <div className="mini-eq">
        {[
          { label: 'LO', param: 'low', color: '#ff6b35' },
          { label: 'MID', param: 'mid', color: '#00f5ff' },
          { label: 'HI', param: 'high', color: '#a78bfa' },
        ].map(({ label, param, color }) => (
          <div key={param} className="eq-knob-col">
            <input
              type="range"
              min="-12"
              max="12"
              defaultValue="0"
              step="1"
              className="eq-slider"
              style={{ '--eq-color': color }}
              onChange={(e) => onEQ(deckIdx, { [param]: parseFloat(e.target.value) })}
              title={`${label} EQ (${deckLabel})`}
            />
            <span className="eq-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
