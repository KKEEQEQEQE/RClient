# RClient

RClient is a community-built desktop companion for Roblox. It brings experience discovery, catalog search, favorites, launch shortcuts, and client preferences into one Electron app.

RClient is not affiliated with or endorsed by Roblox Corporation.

## Current features

- Roblox experience discovery and keyword search using public Roblox web APIs.
- Experience thumbnails and player counts where Roblox provides them.
- One-click handoff to the official Roblox experience page and installed player.
- Populated avatar shop with Roblox catalog thumbnails, category filters, sorting, free-item filtering, and official item pages.
- Public Roblox profile linking by username with avatar display; this is a profile lookup, not authenticated account ownership.
- Shop and Customize views, with avatar editing handed off to Roblox's official editor.
- Windows desktop and Microsoft Store Roblox installation detection, plus macOS app detection.
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

The account profile connection uses Roblox's public username lookup and avatar thumbnail endpoints; it does not authenticate the user or establish account ownership. Authenticated linking requires a registered Roblox OAuth application. The catalog displays Roblox-rendered item thumbnails; equipping and editing outfits are handled by Roblox's official avatar editor.

The Performance page stores a preferred frame-rate target as a reminder. Users configure the actual Maximum Frame Rate in Roblox's own settings. RClient does not claim to force an unsupported frame-rate cap.

## Roadmap

- [ ] More robust ranked/trending discovery feeds and genre filters.
- [ ] Experience detail pages, server lists, and friend presence where supported by public APIs.
- [x] Catalog thumbnails, category filters, and linked public-profile avatar preview.
- [ ] Authenticated Roblox account linking through Roblox OAuth (requires a registered OAuth application).
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


## Automatic updates

Installed builds check GitHub Releases for updates when RClient starts. When a newer version is found, RClient asks whether to download it now or later. Downloads run in the background while the app remains usable. Once downloaded, RClient offers **Restart & update**; choosing **Later** leaves the current session running and the update prompt appears again the next time RClient starts. Updates are not force-installed while the app is in use.
