const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let config = {
  theme: "dark",
  favorites: [],
  recentGames: [],
  fpsTarget: 240
};
let toastTimer;

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
}

async function saveConfig(patch) {
  config = await window.rclient.setConfig(patch);
  applyTheme();
}

function applyTheme() {
  document.body.dataset.theme = config.theme || "dark";
  $$("[data-theme]").forEach(button => button.classList.toggle("selected", button.dataset.theme === config.theme));
  $("#theme-toggle").textContent = config.theme === "light" ? "☼" : "◐";
}

function navigate(page) {
  $$(".page").forEach(node => node.classList.toggle("active", node.id === "page-" + page));
  $$(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.page === page));
  $("#page-heading").textContent = page.charAt(0).toUpperCase() + page.slice(1);
  if (page === "favorites") renderFavorites();
  if (page === "performance") detectRoblox();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatPlayers(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return (number / 1000000).toFixed(1) + "m playing";
  if (number >= 1000) return (number / 1000).toFixed(1) + "k playing";
  return number.toLocaleString() + " playing";
}

async function getImages(games) {
  try {
    return await window.rclient.gameThumbnails(games.map(game => game.id));
  } catch {
    return {};
  }
}

function gameCard(game, imageUrl) {
  const favorite = config.favorites.some(item => item.id === game.id);
  return `<article class="game-card">
    <div class="game-image">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : `<div class="image-fallback">${escapeHtml((game.name || "R").slice(0,1).toUpperCase())}</div>`}</div>
    <div class="game-info">
      <h3 title="${escapeHtml(game.name)}">${escapeHtml(game.name)}</h3>
      <div class="game-meta"><span>${escapeHtml(game.creatorName || "Roblox creator")}</span><span>${escapeHtml(formatPlayers(game.playing))}</span></div>
      <div class="game-actions"><button class="play-button" data-play="${Number(game.rootPlaceId || game.id)}">Play ↗</button><button class="favorite-button ${favorite ? "is-favorite" : ""}" data-favorite="${Number(game.id)}" title="Favorite">${favorite ? "★" : "☆"}</button></div>
    </div>
  </article>`;
}

async function renderGames(container, games) {
  if (!games.length) {
    container.innerHTML = '<div class="empty-state">No experiences found. Try another search.</div>';
    return;
  }
  container.innerHTML = '<div class="loading-state">Loading game artwork…</div>';
  const images = await getImages(games);
  container.innerHTML = games.map(game => gameCard(game, images[game.id])).join("");
  bindGameCards(container);
}

function bindGameCards(container) {
  container.querySelectorAll("[data-play]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Opening…";
    try {
      await window.rclient.openGame(button.dataset.play);
      config = await window.rclient.getConfig();
      toast("Opening Roblox experience");
    } catch (error) {
      toast(error.message || "Could not open this experience");
      button.disabled = false;
      button.textContent = "Play ↗";
    }
  }));
  container.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", async () => {
    const id = Number(button.dataset.favorite);
    const game = currentGames.find(item => item.id === id) || [...config.favorites].find(item => item.id === id);
    if (!game) return;
    const exists = config.favorites.some(item => item.id === id);
    const favorites = exists ? config.favorites.filter(item => item.id !== id) : [...config.favorites, game];
    await saveConfig({ favorites });
    toast(exists ? "Removed from favorites" : "Added to favorites");
    await refreshVisibleGames();
  }));
}

let currentGames = [];
async function refreshVisibleGames() {
  const active = $(".page.active")?.id;
  if (active === "page-home") await renderGames($("#home-grid"), currentGames);
  if (active === "page-discover") await renderGames($("#discover-grid"), currentGames);
  if (active === "page-favorites") await renderFavorites();
}

async function loadPopular() {
  $("#home-grid").innerHTML = '<div class="loading-state">Loading experiences from Roblox…</div>';
  $("#discover-grid").innerHTML = '<div class="loading-state">Loading experiences from Roblox…</div>';
  try {
    currentGames = await window.rclient.popularGames();
    await renderGames($("#home-grid"), currentGames.slice(0, 8));
    await renderGames($("#discover-grid"), currentGames);
  } catch (error) {
    $("#home-grid").innerHTML = '<div class="empty-state">Roblox discovery is temporarily unavailable. Try again in a moment.</div>';
    $("#discover-grid").innerHTML = '<div class="empty-state">Roblox discovery is temporarily unavailable. Try again in a moment.</div>';
    toast(error.message || "Could not load Roblox discovery");
  }
}

async function searchGames() {
  const query = $("#game-search").value.trim();
  if (!query) return loadPopular();
  $("#discover-title").textContent = "Results for “" + query + "”";
  $("#discover-grid").innerHTML = '<div class="loading-state">Searching Roblox…</div>';
  try {
    currentGames = await window.rclient.searchGames(query);
    await renderGames($("#discover-grid"), currentGames);
  } catch (error) {
    $("#discover-grid").innerHTML = '<div class="empty-state">Search is temporarily unavailable. Please try again.</div>';
  }
}

async function searchCatalog() {
  const query = $("#catalog-search").value.trim();
  if (!query) {
    $("#catalog-grid").innerHTML = '<div class="empty-state">Enter a search term to browse catalog items.</div>';
    return;
  }
  $("#catalog-title").textContent = "Results for “" + query + "”";
  $("#catalog-grid").innerHTML = '<div class="loading-state">Searching the Roblox catalog…</div>';
  try {
    const items = await window.rclient.searchCatalog(query);
    if (!items.length) {
      $("#catalog-grid").innerHTML = '<div class="empty-state">No catalog items found for that search.</div>';
      return;
    }
    $("#catalog-grid").innerHTML = items.map(item => `<article class="catalog-card">
      <div><div class="catalog-icon">◇</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.creatorName)} · ${item.price == null ? "Price varies" : item.price === 0 ? "Free" : item.price + " Robux"}</p></div>
      <button data-catalog-item="${Number(item.id)}">View on Roblox ↗</button>
    </article>`).join("");
    $$("#catalog-grid [data-catalog-item]").forEach(button => button.addEventListener("click", () => window.rclient.openCatalogItem(button.dataset.catalogItem)));
  } catch (error) {
    $("#catalog-grid").innerHTML = '<div class="empty-state">Catalog search is temporarily unavailable. Try again shortly.</div>';
  }
}

async function renderFavorites() {
  const games = config.favorites || [];
  if (!games.length) {
    $("#favorites-grid").innerHTML = '<div class="empty-state">Favorite an experience to see it here.</div>';
    return;
  }
  await renderGames($("#favorites-grid"), games);
}

async function detectRoblox() {
  $("#install-status").textContent = "Checking…";
  try {
    const result = await window.rclient.detectRoblox();
    $("#install-status").textContent = result.installed ? "Roblox Player detected" : "Roblox Player not detected";
    $("#install-path").textContent = result.executable || "RClient can still open the Roblox website to launch experiences.";
    $("#connection-label").textContent = result.installed ? "Roblox Player detected" : "Roblox web launch ready";
  } catch {
    $("#install-status").textContent = "Could not check installation";
    $("#install-path").textContent = "You can still use web-based game launching.";
  }
}

function bindEvents() {
  $$("[data-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
  $$("[data-navigate]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.navigate)));
  $("#game-search-button").addEventListener("click", searchGames);
  $("#game-search").addEventListener("keydown", event => { if (event.key === "Enter") searchGames(); });
  $("#catalog-search-button").addEventListener("click", searchCatalog);
  $("#catalog-search").addEventListener("keydown", event => { if (event.key === "Enter") searchCatalog(); });
  $("#theme-toggle").addEventListener("click", () => {
    const order = ["dark", "midnight", "light"];
    const next = order[(order.indexOf(config.theme) + 1) % order.length];
    saveConfig({ theme: next });
  });
  $$("[data-theme]").forEach(button => button.addEventListener("click", () => saveConfig({ theme: button.dataset.theme })));
  $$("[data-fps]").forEach(button => button.addEventListener("click", async () => {
    await saveConfig({ fpsTarget: Number(button.dataset.fps) });
    $$("[data-fps]").forEach(item => item.classList.toggle("selected", item === button));
    toast("Preferred frame-rate target saved");
  }));
  $("#detect-button").addEventListener("click", detectRoblox);
  $("#profile-button").addEventListener("click", () => window.rclient.openProfile());
  $("#account-button").addEventListener("click", () => window.rclient.openSettings());
  $("#update-button").addEventListener("click", async () => {
    $("#update-status").textContent = "Checking for updates…";
    const result = await window.rclient.checkUpdates();
    $("#update-status").textContent = result.message || (result.available ? "Update found: " + result.version : "You're up to date.");
  });
  window.rclient.onUpdateDownloaded(() => {
    $("#update-status").textContent = "An update is downloaded and will install when you restart RClient.";
    toast("RClient update downloaded");
  });
}

async function init() {
  bindEvents();
  config = { ...config, ...(await window.rclient.getConfig()) };
  applyTheme();
  const version = await window.rclient.getVersion();
  $("#version-label").textContent = "RClient v" + version;
  $("#about-version").textContent = "Version " + version;
  $("#fps-options").querySelectorAll("button").forEach(button => button.classList.toggle("selected", Number(button.dataset.fps) === config.fpsTarget));
  await detectRoblox();
  await loadPopular();
  if (config.recentGames?.length) {
    const recentIds = config.recentGames.map(item => item.id).filter(Number.isSafeInteger);
    const recent = currentGames.filter(game => recentIds.includes(game.id));
    if (recent.length) await renderGames($("#recent-grid"), recent);
  }
}

window.addEventListener("DOMContentLoaded", init);
