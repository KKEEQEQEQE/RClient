const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rclient", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  getConfig: () => ipcRenderer.invoke("app:get-config"),
  setConfig: patch => ipcRenderer.invoke("app:set-config", patch),
  searchGames: keyword => ipcRenderer.invoke("roblox:search-games", keyword),
  popularGames: () => ipcRenderer.invoke("roblox:popular-games"),
  gameThumbnails: ids => ipcRenderer.invoke("roblox:game-thumbnails", ids),
  searchCatalog: options => ipcRenderer.invoke("roblox:search-catalog", options),
  catalogThumbnails: ids => ipcRenderer.invoke("roblox:catalog-thumbnails", ids),
  lookupAccount: username => ipcRenderer.invoke("roblox:lookup-account", username),
  accountAvatar: id => ipcRenderer.invoke("roblox:account-avatar", id),
  openGame: id => ipcRenderer.invoke("roblox:open-game", id),
  openCatalogItem: id => ipcRenderer.invoke("roblox:open-catalog-item", id),
  openProfile: id => ipcRenderer.invoke("roblox:open-profile", id),
  openSettings: () => ipcRenderer.invoke("roblox:open-settings"),
  openExternal: url => ipcRenderer.invoke("system:open-external", url),
  detectRoblox: () => ipcRenderer.invoke("system:detect-roblox"),
  checkUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateAvailable: callback => ipcRenderer.on("updates:available", (_event, info) => callback(info)),
  onUpdateDownloaded: callback => ipcRenderer.on("updates:downloaded", (_event, info) => callback(info)),
  onUpdateProgress: callback => ipcRenderer.on("updates:progress", (_event, progress) => callback(progress)),
  onUpdateNotAvailable: callback => ipcRenderer.on("updates:not-available", callback),
  onUpdateError: callback => ipcRenderer.on("updates:error", (_event, error) => callback(error))
});
