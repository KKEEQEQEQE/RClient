# RClient

RClient is a community-built desktop companion for Roblox. It brings experience discovery, catalog search, favorites, launch shortcuts, and client preferences into one Electron app.

RClient is not affiliated with or endorsed by Roblox Corporation.

## Current features

- Roblox experience discovery and keyword search using public Roblox web APIs.
- Experience thumbnails and player counts where Roblox provides them.
- One-click handoff to the official Roblox experience page and installed player.
- Catalog keyword search with official Roblox item pages for viewing and purchasing.
- Local favorites and recently opened experiences.
- Dark, Midnight, and Light themes.
- Performance preference panel with common frame-rate targets.
- Roblox Player installation detection on Windows and macOS.
- Electron security defaults: context isolation, sandboxed renderer, and a narrow preload bridge.
- GitHub Releases update configuration through electron-updater.

## Requirements

- Node.js 20 or newer.
- npm.
- Windows 10/11 or macOS for local development. The app is structured for both; Windows packaging is currently the primary build target.

## Run locally

```bash
npm install
npm start
```

## Build installers

Windows:

```bash
npm run dist:win
```

macOS (build on macOS):

```bash
npm run dist:mac
```

Build output is written to `release/`.

## Updates

The packaged app checks GitHub Releases using electron-updater. Publish versioned releases with installer artifacts for automatic updates to work. Development builds do not run the updater.

## Roblox integration

RClient currently uses public Roblox web endpoints for experience search, game thumbnails, and catalog search. Launching hands off to the official Roblox website, which can open the Roblox Player when installed. Account actions and purchases stay on Roblox's official website; RClient does not collect Roblox passwords or session cookies.

The Performance page stores a preferred frame-rate target as a reminder. Users configure the actual Maximum Frame Rate in Roblox's own settings. RClient does not claim to force an unsupported frame-rate cap.

## Roadmap

- [ ] More robust ranked/trending discovery feeds and genre filters.
- [ ] Experience detail pages, server lists, and friend presence where supported by public APIs.
- [ ] Catalog thumbnails, category filters, and avatar preview.
- [ ] Per-experience launch profiles and settings backup.
- [ ] Multi-instance management with isolated app data where supported.
- [ ] Optional second-screen status panel.
- [ ] More diagnostics and accessibility controls.
- [ ] Signed release pipeline and automatic update testing.

## Project structure

```
src/
  main.js       Electron main process, Roblox API requests, settings, updates
  preload.js    Secure renderer API
  index.html    Desktop interface
  styles.css    Themes and layout
  app.js        Renderer behavior
```

## License

MIT
