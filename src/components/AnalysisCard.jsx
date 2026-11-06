/**
 * AnalysisCard - Shows the deep analysis result of a track
 * Displays: BPM, Key (Camelot), energy curve, detected sections, mix points
 */
export default function AnalysisCard({ track }) {
  if (!track) return null;

  const { bpm, analysis, name, analyzing } = track;
  const displayName = name.replace(/\.[^/.]+$/, '');

  if (analyzing) {
    return (
      <div className="analysis-card analyzing">
        <div className="analysis-name">{displayName}</div>
        <div className="analysis-scanning">
          <span className="scan-dot" /><span className="scan-dot" /><span className="scan-dot" />
          Analyzing…
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { key, sections, mixPoints, energyMap } = analysis;
  const harmonyColor = {
    C: '#ff4444', 'C#': '#ff7700', D: '#ffcc00',
    'D#': '#aaff00', E: '#44ff44', F: '#00ffcc',
    'F#': '#00ccff', G: '#0088ff', 'G#': '#4400ff',
    A: '#8800ff', 'A#': '#ff00cc', B: '#ff0066',
  }[key?.root] ?? '#888';

  return (
    <div className="analysis-card">
      <div className="analysis-header">
        <span className="analysis-name" title={displayName}>{displayName}</span>
        <div className="analysis-badges">
          <span className="badge badge-bpm">{bpm} BPM</span>
          {key && (
            <span className="badge badge-key" style={{ '--key-color': harmonyColor }}>
              {key.root} {key.mode[0]} · {key.camelot}
            </span>
          )}
        </div>
      </div>

      {/* Mini energy bar */}
      {energyMap && energyMap.length > 0 && (
        <div className="energy-bar-mini" title="Energy over time">
          {energyMap.filter((_, i) => i % 4 === 0).map((f, i) => (
            <div
              key={i}
              className="energy-bar-segment"
              style={{ height: `${Math.max(4, f.energy * 32)}px` }}
              title={`${f.time.toFixed(1)}s — ${(f.energy * 100).toFixed(0)}% energy`}
            />
          ))}
        </div>
      )}

      {/* Sections */}
      {sections && sections.length > 0 && (
        <div className="sections-row">
          {sections.map((s, i) => (
            <div
              key={i}
              className={`section-chip ${s.label.replace(/[^a-z]/g, '_')}`}
              title={`${s.label} @ ${s.start.toFixed(1)}s–${s.end.toFixed(1)}s`}
              style={{ flex: s.end - s.start }}
            >
              {s.label === 'chorus/drop' ? '🔥' : s.label === 'verse/breakdown' ? '〜' : '·'}
            </div>
          ))}
        </div>
      )}

      {/* Mix cue points */}
      {mixPoints && (
        <div className="cue-points">
          <span className="cue" title="Mix-in cue point">
            ▶ <b>{fmtTime(mixPoints.mixInTime)}</b>
          </span>
          <span className="cue-arrow">→→</span>
          <span className="cue loop-cue" title="Loop zone">
            🔁 {fmtTime(mixPoints.loopStart)}–{fmtTime(mixPoints.loopEnd)}
          </span>
          <span className="cue-arrow">→→</span>
          <span className="cue" title="Mix-out cue point">
            ◼ <b>{fmtTime(mixPoints.mixOutTime)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function fmtTime(s) {
  if (!s && s !== 0) return '—';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
