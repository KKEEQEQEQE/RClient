const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { autoUpdater } = require("electron-updater");
const execFileAsync = promisify(execFile);

const DEFAULTS = {
  theme: "dark", accent: "#8b7cff", favorites: [], recentGames: [],
  fpsTarget: 240, showPresence: true, compactMode: false,
  linkedAccount: null, catalogCategory: "all", catalogSort: "relevance"
};
let mainWindow;
let configPath;

function readConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath, "utf8")) }; }
  catch { return { ...DEFAULTS }; }
}
function writeConfig(patch) {
  const merged = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460, height: 940, minWidth: 1060, minHeight: 700,
    backgroundColor: "#0c0d12", title: "RClient", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}
async function robloxGet(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RClient/0.2.0" },
    signal: AbortSignal.timeout(16000)
  });
  const body = await response.text();
  if (!response.ok) {
    let detail = body.slice(0, 240);
    try { detail = JSON.parse(body).errors?.[0]?.message || detail; } catch {}
    const error = new Error("Roblox API " + response.status + ": " + detail);
    error.status = response.status;
    throw error;
  }
  try { return JSON.parse(body); }
  catch { throw new Error("Roblox returned an unreadable response."); }
}
function normalizeGame(game) {
  return {
    id: Number(game.universeId || game.id), rootPlaceId: Number(game.rootPlaceId || game.placeId || game.rootPlace?.id || game.id),
    name: game.name || "Untitled experience", description: game.description || "",
    creatorName: game.creatorName || game.creator?.name || "Roblox creator",
    playing: Number(game.playerCount ?? game.playing ?? 0),
    visits: Number(game.visits ?? game.placeVisits ?? 0),
    maxPlayers: Number(game.maxPlayers ?? 0), source: "Roblox"
  };
}
function safeIds(ids, max=50) {
  return Array.isArray(ids) ? ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0).slice(0,max) : [];
}
async function searchGames(keyword, limit=30) {
  const q = String(keyword || "").trim().slice(0,80);
  if (!q) return [];
  const params = new URLSearchParams({
    searchQuery:q,
    sessionId:"RClientDesktop",
    pageType:"all"
  });
  let data = null;
  try { data = await robloxGet("https://apis.roblox.com/search-api/omni-search?" + params); }
  catch {}
  const found = [];
  const visit = value => {
    if (!value) return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (typeof value !== "object") return;
    const candidate = value.universe || value;
    const universeId = Number(candidate.universeId || candidate.id);
    const placeId = Number(candidate.rootPlaceId || candidate.placeId || candidate.rootPlace?.id);
    if (universeId > 0 && placeId > 0 && candidate.name) {
      found.push(normalizeGame({
        ...candidate,
        id:universeId,
        universeId,
        rootPlaceId:placeId,
        creatorName:candidate.creatorName || candidate.creator?.name,
        playerCount:candidate.playerCount ?? candidate.playing
      }));
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "creator" && key !== "thumbnail" && key !== "image") visit(child);
    }
  };
  if (data) visit(data.searchResults || data.results || []);
  if (!found.length) {
    const fallbackParams = new URLSearchParams({keyword:q,limit:String(Math.min(Number(limit)||30,50)),sortOrder:"2",sortType:"1"});
    try {
      const fallback = await robloxGet("https://games.roblox.com/v1/games/search?" + fallbackParams);
      for (const game of (fallback.games || fallback.data || [])) found.push(normalizeGame(game));
    } catch {}
  }
  const unique = new Map();
  for (const game of found) if (game.id && !unique.has(game.id)) unique.set(game.id,game);
  if (!unique.size) throw new Error("Roblox game search returned no usable results. Try again in a moment.");
  return [...unique.values()].slice(0,Math.max(1,Math.min(Number(limit)||30,50)));
}
async function getGameImages(ids) {
  if (!ids.length) return {};
  const data = await robloxGet("https://thumbnails.roblox.com/v1/games/icons?universeIds=" + ids.join(",") + "&size=512x512&format=Png&isCircular=false");
  return Object.fromEntries((data.data || []).map(x => [x.targetId,x.imageUrl]));
}
async function searchCatalog({keyword="",category="all",sort="relevance",limit=30,freeOnly=false}={}) {
  const categoryMap = {
    all: {category:1},
    clothing: {category:3},
    shirts: {category:3,subcategory:12},
    tshirts: {category:3,subcategory:13},
    pants: {category:3,subcategory:14},
    accessories: {category:11},
    hats: {category:11,subcategory:9},
    hair: {category:11,subcategory:20},
    "face-accessories": {category:11,subcategory:21},
    neck: {category:11,subcategory:22},
    shoulder: {category:11,subcategory:23},
    front: {category:11,subcategory:24},
    back: {category:11,subcategory:25},
    waist: {category:11,subcategory:26},
    heads: {category:4,subcategory:15},
    faces: {category:4,subcategory:10},
    bundles: {category:1,subcategory:37},
    animations: {category:12,subcategory:27},
    emotes: {category:12,subcategory:39},
    gear: {category:5}
  };
  const params = new URLSearchParams({
    Category:String(selected.category),
    Limit:String([10,28,30].includes(Number(limit))?Number(limit):30),
    SortType:String(sortTypes[sort] ?? 0),
    SortAggregation:"5"
  });
  if (selected.subcategory !== undefined) params.set("Subcategory",String(selected.subcategory));
  if (keyword) params.set("Keyword",String(keyword).slice(0,80));
  if (freeOnly) { params.set("MinPrice","0"); params.set("MaxPrice","0"); }
  const data = await robloxGet("https://catalog.roblox.com/v1/search/items/details?" + params);
  return (data.data || []).map(item => ({
    id:Number(item.id), name:item.name || "Catalog item",
    creatorName:item.creatorName || item.creator?.name || "Creator",
    price:item.price ?? null, itemType:item.itemType || "Asset",
    productId:item.productId || null, favoriteCount:item.favoriteCount || 0
  })).filter(x=>x.id);
}
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:get-platform", () => process.platform);
ipcMain.handle("app:get-config", () => readConfig());
ipcMain.handle("app:set-config", (_e, patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid settings payload");
  const allowed = {};
  for (const key of ["theme","accent","favorites","recentGames","fpsTarget","showPresence","compactMode","linkedAccount","catalogCategory","catalogSort"]) {
    if (Object.hasOwn(patch,key)) allowed[key]=patch[key];
  }
  if (allowed.theme && !["dark","light","midnight"].includes(allowed.theme)) throw new Error("Unsupported theme");
  if (allowed.fpsTarget && ![60,120,144,165,240].includes(allowed.fpsTarget)) throw new Error("Unsupported frame-rate target");
  if (allowed.linkedAccount && (!Number.isSafeInteger(Number(allowed.linkedAccount.id)) || !String(allowed.linkedAccount.name || "").trim())) throw new Error("Invalid linked account");
  return writeConfig(allowed);
});

ipcMain.handle("roblox:search-games", async (_e, keyword) => searchGames(keyword));
ipcMain.handle("roblox:popular-games", async () => {
  const feeds = ["popular","anime","obby","roleplay","simulator","horror","tycoon","adventure"];
  const results = await Promise.allSettled(feeds.map(q => searchGames(q,18)));
  const unique = new Map();
  for (const result of results) if (result.status==="fulfilled") for (const game of result.value) if (game.id && !unique.has(game.id)) unique.set(game.id,game);
  const games = [...unique.values()];
  games.sort((a,b)=>b.playing-a.playing);
  if (!games.length) throw new Error("Roblox discovery returned no experiences. Check your connection and try again.");
  return games.slice(0,60);
});
ipcMain.handle("roblox:game-thumbnails", async (_e, ids) => getGameImages(safeIds(ids)));
ipcMain.handle("roblox:search-catalog", async (_e, options) => searchCatalog(typeof options==="string" ? {keyword:options} : options));
ipcMain.handle("roblox:catalog-thumbnails", async (_e, ids) => {
  const safe = safeIds(ids);
  if (!safe.length) return {};
  const data = await robloxGet("https://thumbnails.roblox.com/v1/assets?assetIds="+safe.join(",")+"&returnPolicy=PlaceHolder&size=420x420&format=Png");
  return Object.fromEntries((data.data||[]).map(x=>[x.targetId,x.imageUrl]));
});
ipcMain.handle("roblox:lookup-account", async (_e, username) => {
  const name = String(username||"").trim().replace(/^@/,"").slice(0,20);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error("Enter a valid Roblox username.");
  const response = await fetch("https://users.roblox.com/v1/usernames/users",{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({usernames:[name],excludeBannedUsers:true}),signal:AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("Roblox account lookup failed ("+response.status+").");
  const found = (await response.json()).data?.[0];
  if (!found) throw new Error("No Roblox account found for @"+name+".");
  const thumbs = await robloxGet("https://thumbnails.roblox.com/v1/users/avatar?userIds="+found.id+"&size=420x420&format=Png&isCircular=false");
  return {id:found.id,name:found.name,displayName:found.displayName||found.name,avatar:thumbs.data?.[0]?.imageUrl||null};
});
ipcMain.handle("roblox:account-avatar", async (_e, userId) => {
  const id=Number(userId); if(!Number.isSafeInteger(id)||id<=0) throw new Error("Invalid Roblox user ID.");
  const data=await robloxGet("https://thumbnails.roblox.com/v1/users/avatar?userIds="+id+"&size=420x420&format=Png&isCircular=false");
  return data.data?.[0]?.imageUrl||null;
});
ipcMain.handle("roblox:open-game", async (_e, placeId) => {
  const id=Number(placeId); if(!Number.isSafeInteger(id)||id<=0) throw new Error("Invalid place ID");
  try { await shell.openExternal("roblox://placeId="+id); }
  catch { await shell.openExternal("https://www.roblox.com/games/start?placeId="+id); }
  const cfg=readConfig();
  const recentGames=[{id,playedAt:Date.now()},...cfg.recentGames.filter(x=>x.id!==id)].slice(0,12);
  writeConfig({recentGames});
  return true;
});
ipcMain.handle("roblox:open-catalog-item", async (_e,id) => {
  const n=Number(id); if(!Number.isSafeInteger(n)||n<=0) throw new Error("Invalid catalog item ID");
  await shell.openExternal("https://www.roblox.com/catalog/"+n); return true;
});
ipcMain.handle("roblox:open-profile", async (_e,id) => {
  const n=Number(id); await shell.openExternal(Number.isSafeInteger(n)&&n>0 ? "https://www.roblox.com/users/"+n+"/profile" : "https://www.roblox.com/users/profile");
});
ipcMain.handle("roblox:open-settings", async () => shell.openExternal("https://www.roblox.com/my/account#!/info"));
ipcMain.handle("system:open-external", async (_e,raw) => {
  const url=new URL(String(raw)); if(!["https:","http:"].includes(url.protocol)) throw new Error("Only web links are allowed");
  await shell.openExternal(url.toString()); return true;
});

async function detectWindowsRoblox() {
  const local=process.env.LOCALAPPDATA||"";
  const roaming=process.env.APPDATA||"";
  const candidates=[
    path.join(local,"Roblox","Versions"),
    path.join(local,"Packages","ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr","LocalCache","Local","Roblox"),
    path.join(roaming,"Microsoft","Windows","Start Menu","Programs","Roblox")
  ];
  let executable=null;
  try {
    const versions=fs.readdirSync(path.join(local,"Roblox","Versions"),{withFileTypes:true}).filter(x=>x.isDirectory());
    for(const entry of versions){const p=path.join(local,"Roblox","Versions",entry.name,"RobloxPlayerBeta.exe");if(fs.existsSync(p)){executable=p;break;}}
  } catch {}
  let storePackage=null;
  try {
    const {stdout}=await execFileAsync("powershell.exe",["-NoProfile","-NonInteractive","-Command","Get-AppxPackage -Name '*ROBLOX*' | Select-Object -First 1 -ExpandProperty InstallLocation"],{timeout:5000,windowsHide:true});
    storePackage=stdout.trim()||null;
  } catch {}
  if(!executable && storePackage){
    for(const name of ["Windows10Universal.exe","RobloxPlayerBeta.exe"]){const p=path.join(storePackage,name);if(fs.existsSync(p)){executable=p;break;}}
  }
  return {installed:Boolean(executable||storePackage),type:executable?"Desktop Player":storePackage?"Microsoft Store":"Not found",executable:executable||storePackage,checked:candidates};
}
ipcMain.handle("system:detect-roblox", async () => {
  if(process.platform==="win32") return detectWindowsRoblox();
  if(process.platform==="darwin"){
    const homes=[path.join(os.homedir(),"Applications","Roblox.app"),"/Applications/Roblox.app"];
    const found=homes.find(p=>fs.existsSync(p))||null;
    return {installed:Boolean(found),type:"macOS Player",executable:found,checked:homes};
  }
  return {installed:false,type:"Unsupported platform",executable:null,checked:[]};
});
ipcMain.handle("updates:check", async () => {
  if(!app.isPackaged) return {available:false,message:"Updates are available in installed builds."};
  try{const result=await autoUpdater.checkForUpdates();return {available:Boolean(result?.updateInfo),version:result?.updateInfo?.version||null};}
  catch(error){return {available:false,message:error.message};}
});
ipcMain.handle("updates:download", async () => {if(!app.isPackaged)throw new Error("Updates are available in installed builds.");return autoUpdater.downloadUpdate();});
ipcMain.handle("updates:install", () => {if(!app.isPackaged)return false;autoUpdater.quitAndInstall();return true;});

app.whenReady().then(()=>{
  configPath=path.join(app.getPath("userData"),"settings.json");
  nativeTheme.themeSource=readConfig().theme==="light"?"light":"dark";
  createWindow();
  if(app.isPackaged){
    autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=true;
    autoUpdater.on("checking-for-update",()=>mainWindow?.webContents.send("updates:checking"));
    autoUpdater.on("update-available",info=>mainWindow?.webContents.send("updates:available",{version:info.version}));
    autoUpdater.on("update-not-available",()=>mainWindow?.webContents.send("updates:not-available"));
    autoUpdater.on("download-progress",p=>mainWindow?.webContents.send("updates:progress",{percent:Math.round(p.percent||0)}));
    autoUpdater.on("update-downloaded",info=>mainWindow?.webContents.send("updates:downloaded",{version:info.version}));
    autoUpdater.on("error",error=>mainWindow?.webContents.send("updates:error",{message:error.message}));
    mainWindow.webContents.once("did-finish-load",()=>autoUpdater.checkForUpdates().catch(error=>mainWindow?.webContents.send("updates:error",{message:error.message})));
  }
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
