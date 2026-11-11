const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rclient", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  getConfig: () => ipcRenderer.invoke("app:get-config"),
  setConfig: patch => ipcRenderer.invoke("app:set-config", patch),
  searchGames: keyword => ipcRenderer.invoke("roblox:search-games", keyword),
  popularGames: () => ipcRenderer.invoke("roblox:popular-games"),
  gameThumbnails: ids => ipcRenderer.invoke("roblox:game-thumbnails", ids),
  searchCatalog: keyword => ipcRenderer.invoke("roblox:search-catalog", keyword),
  openGame: id => ipcRenderer.invoke("roblox:open-game", id),
  openCatalogItem: id => ipcRenderer.invoke("roblox:open-catalog-item", id),
  openProfile: () => ipcRenderer.invoke("roblox:open-profile"),
  openSettings: () => ipcRenderer.invoke("roblox:open-settings"),
  openExternal: url => ipcRenderer.invoke("system:open-external", url),
  detectRoblox: () => ipcRenderer.invoke("system:detect-roblox"),
  checkUpdates: () => ipcRenderer.invoke("updates:check"),
  onUpdateDownloaded: callback => ipcRenderer.on("updates:downloaded", callback)
});
