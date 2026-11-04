# daw-ai

A browser-based digital audio workstation (DAW) built with React, Vite, and [Linaria](https://linaria.dev/) — zero-runtime CSS-in-JS.

## Features

- **Channel Rack** — 16-step sequencer with per-channel volume, pan, and mute
- **Piano Roll** — grid-based MIDI note editor
- **Playlist** — arrangement view for patterning clips across tracks, with drag-and-drop audio clips
- **Mixer** — Ableton-style channel strips with volume, pan, sends A/B, solo, mute, live metering, two return tracks (reverb and delay), and a master strip
- **Draggable Windows** — all panels are freely draggable and resizable
- **Transport** — play/stop, BPM control, pattern/song mode toggle
- **Browser Sidebar** — collapsible file/asset browser
- **Persistent Store** — centralized state with subscriber pattern

## Tech Stack

| Tool | Purpose |
|---|---|
| [React 18](https://react.dev/) | UI framework |
| [Vite 5](https://vitejs.dev/) | Build tool & dev server |
| [Linaria](https://linaria.dev/) | Zero-runtime CSS-in-JS |
| [Zustand](https://github.com/pmndrs/zustand)-like | Custom lightweight store pattern |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Root component with window layout
├── store/
│   └── useStore.js       # Centralized app state
├── styles/
│   ├── theme.js          # Theme tokens
│   └── global.css        # Global styles
├── components/
│   ├── BrowserSidebar/   # Asset browser panel
│   ├── ChannelRack/      # Step sequencer
│   ├── DraggableWindow/  # Draggable/resizable window wrapper
│   ├── Mixer/            # Audio mixer
│   ├── PatternSelector/  # Pattern selection
│   ├── PianoRoll/        # MIDI note editor
│   ├── Playlist/         # Song arrangement
│   ├── TopBar/           # Top toolbar
│   └── Transport/        # Transport controls
└── assets/               # Static assets
```

## License

MIT
