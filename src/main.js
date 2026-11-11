const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { autoUpdater } = require("electron-updater");

const APP_ID = "com.rclient.desktop";
const DEFAULTS = {
  theme: "dark",
  accent: "#8b7cff",
  favorites: [],
  recentGames: [],
  fpsTarget: 240,
  showPresence: true,
  compactMode: false
};

let mainWindow;
let configPath;

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(next) {
  const current = readConfig();
  const merged = { ...current, ...next };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#0c0d12",
    title: "RClient",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

async function robloxGet(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "RClient/0.1.0"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const error = new Error("Roblox returned HTTP " + response.status);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function normalizeGame(game) {
  return {
    id: game.id,
    rootPlaceId: game.rootPlaceId || game.id,
    name: game.name || "Untitled experience",
    description: game.description || "",
    creatorName: game.creatorName || game.creator?.name || "Unknown creator",
    playing: game.playerCount ?? game.playing ?? 0,
    visits: game.totalUpVotes ?? game.visits ?? 0,
    maxPlayers: game.maxPlayers ?? 0,
    price: game.price ?? 0,
    source: "Roblox"
  };
}

ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:get-platform", () => process.platform);
ipcMain.handle("app:get-config", () => readConfig());
ipcMain.handle("app:set-config", (_event, patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Invalid settings payload");
  }
  const allowed = {};
  for (const key of ["theme", "accent", "favorites", "recentGames", "fpsTarget", "showPresence", "compactMode"]) {
    if (Object.hasOwn(patch, key)) allowed[key] = patch[key];
  }
  if (allowed.theme && !["dark", "light", "midnight"].includes(allowed.theme)) {
    throw new Error("Unsupported theme");
  }
  if (allowed.fpsTarget && ![60, 120, 144, 165, 240].includes(allowed.fpsTarget)) {
    throw new Error("Unsupported frame-rate target");
  }
  return writeConfig(allowed);
});

ipcMain.handle("roblox:search-games", async (_event, keyword) => {
  const query = String(keyword || "").trim().slice(0, 80);
  if (!query) return [];
  const url = "https://games.roblox.com/v1/games/search?keyword=" +
    encodeURIComponent(query) + "&limit=24&sortOrder=2";
  const data = await robloxGet(url);
  return (data.data || []).map(normalizeGame);
});

ipcMain.handle("roblox:popular-games", async () => {
  const searches = ["popular", "obby", "roleplay"];
  const results = await Promise.allSettled(searches.map(async keyword => {
    const url = "https://games.roblox.com/v1/games/search?keyword=" +
      encodeURIComponent(keyword) + "&limit=12&sortOrder=2";
    const data = await robloxGet(url);
    return (data.data || []).map(normalizeGame);
  }));

  const unique = new Map();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const game of result.value) {
      if (game.id && !unique.has(game.id)) unique.set(game.id, game);
    }
  }
  return [...unique.values()].slice(0, 30);
});

ipcMain.handle("roblox:game-thumbnails", async (_event, ids) => {
  const safeIds = Array.isArray(ids)
    ? ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 50)
    : [];
  if (!safeIds.length) return {};
  const url = "https://thumbnails.roblox.com/v1/games/icons?universeIds=" +
    safeIds.join(",") + "&size=512x512&format=Png&isCircular=false";
  const data = await robloxGet(url);
  return Object.fromEntries((data.data || []).map(item => [item.targetId, item.imageUrl]));
});

ipcMain.handle("roblox:search-catalog", async (_event, keyword) => {
  const query = String(keyword || "").trim().slice(0, 80);
  if (!query) return [];
  const url = "https://catalog.roblox.com/v1/search/items/details?Category=1&Keyword=" +
    encodeURIComponent(query) + "&Limit=30&SortType=3";
  const data = await robloxGet(url);
  return (data.data || []).map(item => ({
    id: item.id,
    name: item.name || "Catalog item",
    creatorName: item.creatorName || item.creatorTargetId || "Creator",
    price: item.price ?? null,
    itemType: item.itemType || "Asset",
    productId: item.productId || null
  }));
});

ipcMain.handle("roblox:open-game", async (_event, placeId) => {
  const id = Number(placeId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid place ID");
  const directUrl = "roblox://placeId=" + id;
  const fallbackUrl = "https://www.roblox.com/games/start?placeId=" + id;
  try {
    await shell.openExternal(directUrl);
  } catch {
    await shell.openExternal(fallbackUrl);
  }
  const config = readConfig();
  const recentGames = [{ id, playedAt: Date.now() }, ...config.recentGames.filter(item => item.id !== id)].slice(0, 12);
  writeConfig({ recentGames });
  return true;
});

ipcMain.handle("roblox:open-catalog-item", async (_event, itemId) => {
  const id = Number(itemId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid catalog item ID");
  await shell.openExternal("https://www.roblox.com/catalog/" + id);
  return true;
});

ipcMain.handle("roblox:open-profile", async () => {
  await shell.openExternal("https://www.roblox.com/users/profile");
});

ipcMain.handle("roblox:open-settings", async () => {
  await shell.openExternal("https://www.roblox.com/my/account#!/info");
});

ipcMain.handle("system:open-external", async (_event, rawUrl) => {
  const url = new URL(String(rawUrl));
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only web links are allowed");
  await shell.openExternal(url.toString());
  return true;
});

ipcMain.handle("system:detect-roblox", () => {
  const candidates = [];
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const roaming = process.env.APPDATA || "";
    candidates.push(
      path.join(local, "Roblox", "Versions"),
      path.join(roaming, "Microsoft", "Windows", "Start Menu", "Programs", "Roblox")
    );
    const versions = path.join(local, "Roblox", "Versions");
    let foundVersion = null;
    try {
      foundVersion = fs.readdirSync(versions, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(versions, entry.name, "RobloxPlayerBeta.exe"))
        .find(file => fs.existsSync(file)) || null;
    } catch {}
    return { installed: Boolean(foundVersion), executable: foundVersion, checked: candidates };
  }
  if (process.platform === "darwin") {
    const appPath = "/Applications/Roblox.app";
    return { installed: fs.existsSync(appPath), executable: appPath, checked: [appPath] };
  }
  return { installed: false, executable: null, checked: [] };
});

ipcMain.handle("updates:check", async () => {
  if (!app.isPackaged) return { available: false, message: "Updates are available in installed builds." };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: Boolean(result?.updateInfo), version: result?.updateInfo?.version || null };
  } catch (error) {
    return { available: false, message: error.message };
  }
});

app.whenReady().then(() => {
  configPath = path.join(app.getPath("userData"), "settings.json");
  nativeTheme.themeSource = readConfig().theme === "light" ? "light" : "dark";
  createWindow();

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.on("update-downloaded", () => {
      if (mainWindow) {
        mainWindow.webContents.send("updates:downloaded");
      }
    });
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
