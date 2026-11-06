export default function Crossfader({ value, onChange }) {
  return (
    <div className="crossfader-container">
      <span className="crossfader-label deck-a">A</span>
      <div className="crossfader-track">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="crossfader-slider"
        />
        <div className="crossfader-markers">
          <span>◀</span>
          <span>MIX</span>
          <span>▶</span>
        </div>
      </div>
      <span className="crossfader-label deck-b">B</span>
    </div>
  );
}
