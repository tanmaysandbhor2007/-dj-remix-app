import { useCallback, useEffect, useRef, useState } from 'react';
import { DJEngine } from './engine/DJEngine.js';
import WaveformVisualizer from './components/WaveformVisualizer.jsx';
import VinylDisc from './components/VinylDisc.jsx';
import Crossfader from './components/Crossfader.jsx';
import SpectrumVisualizer from './components/SpectrumVisualizer.jsx';
import TrackUploader from './components/TrackUploader.jsx';
import TrackList from './components/TrackList.jsx';
import URLLoader from './components/URLLoader.jsx';
import YouTubePanel from './components/YouTubePanel.jsx';
import SpotifyConnector from './components/SpotifyConnector.jsx';
import AnalysisCard from './components/AnalysisCard.jsx';
import DeckControls from './components/DeckControls.jsx';
import './App.css';
import './sources.css';
import './analysis.css';

const engine = new DJEngine();

export default function App() {
  const [djState, setDjState] = useState({
    tracks: [],
    currentDeck: 0,
    isPlaying: false,
    deckBpm: [128, 128],
    deckName: ['', ''],
    deckDuration: [0, 0],
    deckKey: [null, null],
    deckSections: [[], []],
    deckMixPoints: [null, null],
    crossfaderValue: 0.5,
    isLooping: [false, false],
  });
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [beatPulse, setBeatPulse] = useState(false);
  const [analyserData, setAnalyserData] = useState([new Uint8Array(256), new Uint8Array(256)]);
  const [masterVol, setMasterVol] = useState(0.9);
  const [log, setLog] = useState(['🎛️ AI DJ ready. Upload 2+ tracks and hit START!']);
  const [sourceTab, setSourceTab] = useState('files');
  const [analysisTab, setAnalysisTab] = useState(0); // which track to show analysis for
  const animRef = useRef(null);
  const beatTimerRef = useRef(null);

  useEffect(() => {
    engine.onStateChange = (state) => setDjState({ ...state });
    engine.onBeatPulse   = () => {
      setBeatPulse(true);
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = setTimeout(() => setBeatPulse(false), 60);
    };
    engine.onMixLog = (msg) => setLog((l) => [...l, msg]);
    engine.onAnalysisUpdate = (track) => {
      setLog((l) => [...l,
        `🔍 "${track.name.replace(/\.[^/.]+$/, '')}" — ${track.bpm} BPM · ${track.analysis?.key?.root ?? '?'} ${track.analysis?.key?.mode?.[0] ?? ''} · Camelot ${track.analysis?.key?.camelot ?? '?'}`
      ]);
    };
    return () => {
      engine.stop();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Continuous analyser polling
  useEffect(() => {
    const poll = () => {
      setAnalyserData([engine.getAnalyserData(0), engine.getAnalyserData(1)]);
      animRef.current = requestAnimationFrame(poll);
    };
    animRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleTracksLoaded = useCallback(async (files) => {
    setLoading(true);
    for (const file of files) {
      setLoadingText(`Loading: ${file.name}`);
      const ab = await file.arrayBuffer();
      const track = await engine.loadTrack(ab, file.name);
      setLog((l) => [...l, `✅ Loaded "${file.name.replace(/\.[^/.]+$/, '')}" — analyzing…`]);
    }
    setLoading(false);
    setLoadingText('');
  }, []);

  const handleURLTrackLoaded = useCallback(async (arrayBuffer, name) => {
    setLoading(true);
    setLoadingText(`Loading: ${name}`);
    try {
      await engine.loadTrack(arrayBuffer, name);
      setLog((l) => [...l, `✅ URL loaded: "${name}" — analyzing…`]);
    } catch (err) {
      setLog((l) => [...l, `❌ Failed: ${err.message}`]);
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }, []);

  const handleStart = async () => {
    if (djState.tracks.length < 1) {
      setLog((l) => [...l, '⚠️ Upload at least 1 track first!']);
      return;
    }
    await engine.start();
    setLog((l) => [...l, '🎧 AI DJ SET STARTED — infinite intelligent mix engaged']);
  };

  const handleStop = () => {
    engine.stop();
    setLog((l) => [...l, '⏹ Set stopped.']);
  };

  const handleSkip = () => engine.skipToNext();

  const handleLoop  = (deckIdx) => engine.triggerLoop(deckIdx);
  const handleStopLoop = (deckIdx) => engine.stopLoop(deckIdx);
  const handleEQ    = (deckIdx, bands) => engine.setEQ(deckIdx, bands);
  const handleCrossfader = (val) => engine.setCrossfader(val);
  const handleEffect = (name) => {
    engine.triggerEffect(name);
    setLog((l) => [...l, `🎚️ FX: ${name}`]);
  };
  const handleMasterVol = (val) => {
    const v = parseFloat(val);
    setMasterVol(v);
    engine.setMasterVolume(v);
  };

  const getSpectrumData = useCallback(() => {
    const d0 = engine.getAnalyserData(0);
    const d1 = engine.getAnalyserData(1);
    const merged = new Uint8Array(d0.length);
    for (let i = 0; i < d0.length; i++) merged[i] = Math.max(d0[i], d1[i]);
    return merged;
  }, []);

  const cfVal = djState.crossfaderValue ?? 0.5;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎧</span>
          <span className="logo-text">AI<span className="logo-accent">DJ</span></span>
          <span className="logo-sub">REMIX ENGINE</span>
        </div>
        <div className={`beat-indicator ${beatPulse ? 'pulse' : ''}`}>♪</div>
        <div className="header-status">
          {djState.isPlaying ? (
            <span className="status-live">● LIVE MIX</span>
          ) : (
            <span className="status-idle">○ STANDBY</span>
          )}
        </div>
      </header>

      {/* Main Spectrum */}
      <div className="spectrum-wrapper">
        <SpectrumVisualizer getAnalyserData={getSpectrumData} />
      </div>

      {/* Decks */}
      <div className="decks-row">
        {/* Deck A */}
        <div className={`deck deck-a ${djState.currentDeck === 0 && djState.isPlaying ? 'deck-active' : ''}`}>
          <div className="deck-label">DECK A</div>
          <VinylDisc
            isPlaying={djState.isPlaying && djState.currentDeck === 0}
            speed={djState.deckBpm[0] / 128}
            color="#00f5ff"
          />
          <div className="deck-info">
            <div className="deck-track-name">
              {djState.deckName[0] ? djState.deckName[0].replace(/\.[^/.]+$/, '') : '— No Track —'}
            </div>
            <div className="deck-bpm">
              <span className="bpm-value">{djState.deckBpm[0]}</span>
              <span className="bpm-label">BPM</span>
            </div>
          </div>
          <WaveformVisualizer analyserData={analyserData[0]} color="#00f5ff" label="A" />
          <DeckControls
            deckIdx={0}
            deckLabel="A"
            deckKey={djState.deckKey?.[0]}
            otherKey={djState.deckKey?.[1]}
            isLooping={djState.isLooping?.[0]}
            onLoop={handleLoop}
            onStopLoop={handleStopLoop}
            onEQ={handleEQ}
          />
        </div>

        {/* Center Controls */}
        <div className="center-controls">
          <div className="master-vol">
            <label>MASTER</label>
            <input
              type="range" min="0" max="1" step="0.01"
              value={masterVol}
              onChange={(e) => handleMasterVol(e.target.value)}
              className="vol-slider"
              orient="vertical"
            />
            <span>{Math.round(masterVol * 100)}%</span>
          </div>

          <div className="transport-buttons">
            {!djState.isPlaying ? (
              <button className="btn btn-play" onClick={handleStart}>▶ START SET</button>
            ) : (
              <button className="btn btn-stop" onClick={handleStop}>■ STOP</button>
            )}
            <button className="btn btn-skip" onClick={handleSkip} disabled={!djState.isPlaying}>
              ⏭ SKIP
            </button>
          </div>

          <Crossfader value={cfVal} onChange={handleCrossfader} />

          {/* Effects */}
          <div className="effects-panel">
            <div className="effects-title">FX PAD</div>
            <div className="effects-grid">
              {[
                { id: 'echo',         label: '🔁 Echo',    color: '#ff006e' },
                { id: 'filter_sweep', label: '🌀 Sweep',   color: '#8338ec' },
                { id: 'drop',         label: '💥 Drop',    color: '#fb5607' },
                { id: 'reverb_tail',  label: '🌊 Reverb',  color: '#06d6a0' },
                { id: 'bass_boost',   label: '⚡ Bass+',   color: '#ffd60a' },
              ].map((fx) => (
                <button
                  key={fx.id}
                  className="fx-btn"
                  style={{ '--fx-color': fx.color }}
                  onClick={() => handleEffect(fx.id)}
                  disabled={!djState.isPlaying}
                >
                  {fx.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Deck B */}
        <div className={`deck deck-b ${djState.currentDeck === 1 && djState.isPlaying ? 'deck-active' : ''}`}>
          <div className="deck-label">DECK B</div>
          <VinylDisc
            isPlaying={djState.isPlaying && djState.currentDeck === 1}
            speed={djState.deckBpm[1] / 128}
            color="#ff6b35"
          />
          <div className="deck-info">
            <div className="deck-track-name">
              {djState.deckName[1] ? djState.deckName[1].replace(/\.[^/.]+$/, '') : '— No Track —'}
            </div>
            <div className="deck-bpm">
              <span className="bpm-value">{djState.deckBpm[1]}</span>
              <span className="bpm-label">BPM</span>
            </div>
          </div>
          <WaveformVisualizer analyserData={analyserData[1]} color="#ff6b35" label="B" />
          <DeckControls
            deckIdx={1}
            deckLabel="B"
            deckKey={djState.deckKey?.[1]}
            otherKey={djState.deckKey?.[0]}
            isLooping={djState.isLooping?.[1]}
            onLoop={handleLoop}
            onStopLoop={handleStopLoop}
            onEQ={handleEQ}
          />
        </div>
      </div>

      {/* Analysis Panel */}
      {djState.tracks.length > 0 && (
        <div className="analysis-panel">
          <div className="analysis-panel-header">
            <span className="analysis-panel-title">🔬 TRACK ANALYSIS</span>
            <div className="analysis-track-tabs">
              {djState.tracks.map((t, i) => (
                <button
                  key={t.id}
                  className={`analysis-track-tab ${analysisTab === i ? 'active' : ''}`}
                  onClick={() => setAnalysisTab(i)}
                >
                  {t.name.replace(/\.[^/.]+$/, '').slice(0, 18)}
                  {t.analyzing && <span className="analyzing-dot">●</span>}
                </button>
              ))}
            </div>
          </div>
          {djState.tracks[analysisTab] && (
            <AnalysisCard track={djState.tracks[analysisTab]} />
          )}
        </div>
      )}

      {/* Bottom Row */}
      <div className="bottom-row">
        <div className="source-panel">
          <div className="source-tabs">
            {[
              { id: 'files',   label: '📁 Files' },
              { id: 'url',     label: '🔗 URL' },
              { id: 'youtube', label: '📺 YouTube' },
              { id: 'spotify', label: '🟢 Spotify' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`source-tab ${sourceTab === tab.id ? 'active' : ''}`}
                onClick={() => setSourceTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="source-tab-content">
            {sourceTab === 'files'   && <TrackUploader onTracksLoaded={handleTracksLoaded} disabled={loading} />}
            {sourceTab === 'url'     && <URLLoader onTrackLoaded={handleURLTrackLoaded} />}
            {sourceTab === 'youtube' && <YouTubePanel />}
            {sourceTab === 'spotify' && <SpotifyConnector />}
          </div>
          {loading && (
            <div className="loading-bar">
              <div className="loading-spinner" />
              <span>{loadingText}</span>
            </div>
          )}
        </div>

        <TrackList
          tracks={djState.tracks}
          currentDeck={djState.currentDeck}
          deckName={djState.deckName}
        />

        <div className="dj-log">
          <div className="log-title">📋 DJ LOG</div>
          <div className="log-entries">
            {log.slice(-10).map((entry, i) => (
              <div key={i} className="log-entry">{entry}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
