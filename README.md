# 🎧 AI DJ — Infinite Remix Machine

> An intelligent browser-based DJ app that **automatically analyzes songs** and mixes them forever like a real DJ — with beatmatching, harmonic key detection, bass EQ swaps, 8-bar loops, and live effects.

Built with **React + Vite + Web Audio API** — runs 100% in the browser, no backend needed.

---

## ✨ Features

### 🔬 Auto Song Analysis
Every uploaded track is automatically analyzed for:
- **BPM** — via autocorrelation onset detection
- **Musical Key** — Krumhansl-Schmuckler algorithm (outputs Camelot wheel code)
- **Energy Curve** — RMS windowing to map energy over time
- **Sections** — auto-labels intro, verse/breakdown, chorus/drop
- **Cue Points** — optimal mix-in, 8-bar loop zone, mix-out

### 🎚️ Intelligent DJ Engine
- **Beatmatching** — syncs BPMs using `AudioBufferSourceNode.playbackRate`
- **Harmonic mixing** — Camelot wheel track ordering for key-compatible transitions
- **8-step transition sequence**:
  1. Loop the outgoing track's best 8-bar section
  2. Filter sweep incoming track from low-pass → full open
  3. Equal-power crossfade
  4. Bass EQ swap (classic DJ technique)
  5. Reverb tail on outgoing
  6. Full handoff
- **Infinite auto-mix** — plays forever, never stops

### 🎛️ Controls
- **Crossfader** — manual override or watch it automate
- **3-band EQ** per deck (Lo / Mid / Hi)
- **Loop button** — instantly loop the detected best 8-bar section
- **FX Pads**: Echo, Filter Sweep, Drop, Reverb Tail, Bass Boost

### 📡 Sources
| Source | BPM Detection | Live Effects |
|--------|:---:|:---:|
| 📁 Local Files (MP3/WAV/OGG/FLAC) | ✅ | ✅ |
| 🔗 Direct Audio URL | ✅ | ✅ |
| 📺 YouTube embed | ❌ | ❌ |
| 🟢 Spotify Now Playing metadata | Via API | ❌ |

---

## 🚀 Quick Start

```bash
git clone https://github.com/tanmaysandbhor2007/dj-remix-app.git
cd dj-remix-app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| Web Audio API | Audio decoding, effects, analysis |
| Tone.js | Additional audio scheduling |
| Custom AudioAnalyzer | BPM + Key + Energy + Section detection |

---

## 📁 Project Structure

```
src/
├── engine/
│   ├── DJEngine.js        # Core DJ engine (beatmatch, EQ, transitions, loops)
│   └── AudioAnalyzer.js   # Deep audio analysis (BPM, key, energy, sections)
├── components/
│   ├── VinylDisc.jsx
│   ├── WaveformVisualizer.jsx
│   ├── SpectrumVisualizer.jsx
│   ├── Crossfader.jsx
│   ├── DeckControls.jsx
│   ├── AnalysisCard.jsx
│   ├── TrackUploader.jsx
│   ├── TrackList.jsx
│   ├── URLLoader.jsx
│   ├── YouTubePanel.jsx
│   └── SpotifyConnector.jsx
└── App.jsx
```

---

## 🎧 How It Works

1. **Upload** 2+ songs (drag & drop or paste a URL)
2. Engine **analyzes** each track in the background — BPM, key, energy, sections
3. Hit **▶ START SET** — AI DJ builds a harmonically ordered queue and mixes forever
4. Use **LOOP**, **EQ**, and **FX Pads** for live control

---

## 📜 License

MIT
