const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let config={theme:"dark",favorites:[],recentGames:[],fpsTarget:240,linkedAccount:null,catalogCategory:"all",catalogSort:"relevance"};
let currentGames=[];
let currentCatalog=[];
let catalogRequest=0;
let toastTimer;
let updateIsDownloaded=false;
function toast(message){const n=$("#toast");n.textContent=message;n.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove("show"),2800);}
async function saveConfig(patch){config=await window.rclient.setConfig(patch);applyTheme();}
function applyTheme(){document.body.dataset.theme=config.theme||"dark";document.documentElement.style.setProperty("--accent",config.accent||"#8b7cff");document.documentElement.style.setProperty("--ui-font",JSON.stringify(config.uiFont||"Inter"));$("[data-theme]").forEach(b=>b.classList.toggle("selected",b.dataset.theme===config.theme));$("#theme-toggle").textContent=config.theme==="light"?"☼":"◐";if($("#accent-color"))$("#accent-color").value=config.accent||"#8b7cff";if($("#ui-font"))$("#ui-font").value=config.uiFont||"Inter";}
function navigate(page){
  $$(".page").forEach(n=>n.classList.toggle("active",n.id==="page-"+page));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  $("#page-heading").textContent=page==="catalog"?"Avatar Shop":page.charAt(0).toUpperCase()+page.slice(1);
  if(page==="favorites")renderFavorites();
  if(page==="performance")detectRoblox();
  if(page==="catalog"&&!currentCatalog.length)loadCatalog();
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function formatPlayers(v){const n=Number(v||0);return n>=1e6?(n/1e6).toFixed(1)+"m playing":n>=1e3?(n/1e3).toFixed(1)+"k playing":n.toLocaleString()+" playing";}
async function getImages(games){try{return await window.rclient.gameThumbnails(games.map(g=>g.id));}catch{return {};}}
function gameCard(g,img){
 const fav=config.favorites.some(x=>x.id===g.id);
 return `<article class="game-card"><div class="game-image">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:`<div class="image-fallback">${esc((g.name||"R").slice(0,1).toUpperCase())}</div>`}</div><div class="game-info"><h3 title="${esc(g.name)}">${esc(g.name)}</h3><div class="game-meta"><span>${esc(g.creatorName||"Roblox creator")}</span><span>${esc(formatPlayers(g.playing))}</span></div><div class="game-actions"><button class="play-button" data-play="${Number(g.rootPlaceId||g.id)}">Play ↗</button><button class="favorite-button ${fav?"is-favorite":""}" data-favorite="${Number(g.id)}">${fav?"★":"☆"}</button></div></div></article>`;
}
async function renderGames(container,games){
 if(!games.length){container.innerHTML='<div class="empty-state">No experiences found. Try another category or search.</div>';return;}
 container.innerHTML='<div class="loading-state">Loading game artwork…</div>';
 const imgs=await getImages(games);container.innerHTML=games.map(g=>gameCard(g,imgs[g.id])).join("");bindGameCards(container);
}
function bindGameCards(container){
 container.querySelectorAll("[data-play]").forEach(b=>b.addEventListener("click",async()=>{
  b.disabled=true;b.textContent="Opening…";
  try{
   const result=await window.rclient.openGame(b.dataset.play);
   config=await window.rclient.getConfig();
   toast(result?.method==="browser"?"Opened the Roblox game page — press Play there.":"Opening Roblox Player…");
   b.disabled=false;b.textContent="Play ↗";
  }catch(e){toast(e.message||"Could not open this experience");b.disabled=false;b.textContent="Play ↗";}
 }));
 container.querySelectorAll("[data-favorite]").forEach(b=>b.addEventListener("click",async()=>{
  const id=Number(b.dataset.favorite),g=currentGames.find(x=>x.id===id)||config.favorites.find(x=>x.id===id);if(!g)return;
  const exists=config.favorites.some(x=>x.id===id),favorites=exists?config.favorites.filter(x=>x.id!==id):[...config.favorites,g];
  await saveConfig({favorites});toast(exists?"Removed from favorites":"Added to favorites");
  const active=$(".page.active")?.id;if(active==="page-favorites")renderFavorites();else if(active==="page-home")renderGames($("#home-grid"),currentGames.slice(0,8));else if(active==="page-discover")renderGames($("#discover-grid"),currentGames);
 }));
}
async function loadPopular(){
 $("#home-grid").innerHTML='<div class="loading-state">Loading Roblox experiences…</div>';
 $("#discover-grid").innerHTML='<div class="loading-state">Loading Roblox experiences…</div>';
 try{
  currentGames=await window.rclient.popularGames();
  const featured=currentGames[0];
  if(featured){const hero=$("#featured-game");const art=await getImages([featured]);hero.style.backgroundImage=`linear-gradient(90deg,#111722 0%,#111722e8 43%,#11172255 100%),url("${art[featured.id]||""}")`;hero.style.backgroundSize="cover";hero.style.backgroundPosition="center";hero.querySelector("h1").textContent=featured.name;hero.querySelector("p").textContent=(featured.creatorName||"Roblox creator")+" · "+formatPlayers(featured.playing);hero.querySelector(".eyebrow").textContent="FEATURED EXPERIENCE";hero.querySelector(".primary-button").onclick=()=>window.rclient.openGame(featured.rootPlaceId||featured.id);}
  await renderGames($("#home-grid"),config.favorites?.length?config.favorites.slice(0,5):currentGames.slice(0,5));
  if($("#game-search").value.trim()==="")await renderGames($("#discover-grid"),currentGames);
 }catch(e){
  const msg=esc(e.message||"Roblox discovery is unavailable.");
  $("#home-grid").innerHTML='<div class="empty-state">Could not load experiences: '+msg+'</div>';
  $("#discover-grid").innerHTML='<div class="empty-state">Could not load experiences: '+msg+'</div>';
  toast("Roblox discovery failed");
 }
}
async function searchGames(){
 const q=$("#game-search").value.trim();
 $("#discover-title").textContent=q?'Results for “'+q+'”':"Popular experiences";
 $("#discover-grid").innerHTML='<div class="loading-state">Searching Roblox…</div>';
 try{currentGames=q?await window.rclient.searchGames(q):await window.rclient.popularGames();await renderGames($("#discover-grid"),currentGames);}
 catch(e){$("#discover-grid").innerHTML='<div class="empty-state">'+esc(e.message||"Search failed.")+'</div>';}
}
async function selectGameFeed(feed){
 $$("#game-categories [data-game-feed]").forEach(b=>b.classList.toggle("selected",b.dataset.gameFeed===feed));
 $("#game-search").value="";
 if(feed==="all"||feed==="popular"){await searchGames();return;}
 $("#discover-title").textContent=feed.charAt(0).toUpperCase()+feed.slice(1)+" experiences";
 $("#discover-grid").innerHTML='<div class="loading-state">Loading '+esc(feed)+' games…</div>';
 try{currentGames=await window.rclient.searchGames(feed);await renderGames($("#discover-grid"),currentGames);}
 catch(e){$("#discover-grid").innerHTML='<div class="empty-state">'+esc(e.message||"Could not load this feed.")+'</div>';}
}
function catalogCard(item,img){
 const price=item.price==null?"Off sale":item.price===0?"Free":Number(item.price).toLocaleString()+" R$";
 return `<article class="catalog-card item-card"><button class="item-preview" data-open-item="${Number(item.id)}" title="View ${esc(item.name)}">${img?`<img src="${esc(img)}" alt="${esc(item.name)}" loading="lazy">`:'<div class="catalog-icon">◇</div>'}</button><div class="item-info"><h3 title="${esc(item.name)}">${esc(item.name)}</h3><p>${esc(item.creatorName)}</p><strong>${price}</strong><button class="item-view-button" data-open-item="${Number(item.id)}">View item ↗</button></div></article>`;
}
async function loadCatalog(){
 const request=++catalogRequest;
 const category=$("#catalog-categories .selected")?.dataset.catalogCategory||config.catalogCategory||"all";
 const sort=$("#catalog-sort").value||config.catalogSort||"relevance";
 const query=$("#catalog-search").value.trim();
 $("#catalog-grid").innerHTML='<div class="loading-state">Loading avatar shop…</div>';
 $("#catalog-result-count").textContent="Loading items…";
 try{
  const items=await window.rclient.searchCatalog({keyword:query,category,sort,limit:30,freeOnly:$("#free-filter").checked});
  if(request!==catalogRequest)return;
  let visible=items;
  if($("#on-sale-filter").checked)visible=visible.filter(x=>x.price!==null&&x.price!==undefined);
  currentCatalog=visible;
  if(!visible.length){$("#catalog-grid").innerHTML='<div class="empty-state">No items match these filters. Try another category or remove a filter.</div>';$("#catalog-result-count").textContent="0 items";return;}
  const thumbs=await window.rclient.catalogThumbnails(visible.map(x=>x.id));
  if(request!==catalogRequest)return;
  $("#catalog-grid").innerHTML=visible.map(x=>catalogCard(x,thumbs[x.id])).join("");
  $("#catalog-result-count").textContent=visible.length+" items";
  bindCatalogItems($("#catalog-grid"));
 }catch(e){
  if(request!==catalogRequest)return;
  $("#catalog-grid").innerHTML='<div class="empty-state">Could not load the Roblox avatar shop: '+esc(e.message||"Please try again.")+'</div>';
  $("#catalog-result-count").textContent="Shop unavailable";
 }
}
function bindCatalogItems(root){
 root.querySelectorAll("[data-open-item]").forEach(b=>b.addEventListener("click",async()=>{
  const id=Number(b.dataset.openItem),item=currentCatalog.find(x=>x.id===id);if(item){const old=JSON.parse(localStorage.getItem("rclient-recent-items")||"[]");localStorage.setItem("rclient-recent-items",JSON.stringify([item,...old.filter(x=>x.id!==id)].slice(0,12)));}
  try{await window.rclient.openCatalogItem(id);}catch(e){toast(e.message||"Could not open item");}
 }));
}
async function renderRecentCatalog(){
 const items=JSON.parse(localStorage.getItem("rclient-recent-items")||"[]");
 if(!items.length){$("#recent-catalog-grid").innerHTML='<div class="empty-state">No recently viewed items yet.</div>';return;}
 const thumbs=await window.rclient.catalogThumbnails(items.map(x=>x.id));
 $("#recent-catalog-grid").innerHTML=items.map(x=>catalogCard(x,thumbs[x.id])).join("");bindCatalogItems($("#recent-catalog-grid"));
}
async function renderFavorites(){
 const games=config.favorites||[];if(!games.length){$("#favorites-grid").innerHTML='<div class="empty-state">Favorite an experience to see it here.</div>';return;}
 await renderGames($("#favorites-grid"),games);
}
function renderAccount(){
 const a=config.linkedAccount;
 $("#top-account-name").textContent=a?a.displayName||a.name:"Connect Roblox";$("#welcome-account").textContent=a?(a.displayName||a.name):"to RClient";
 $("#top-avatar").hidden=!a?.avatar;$("#top-avatar-fallback").hidden=Boolean(a?.avatar);
 if(a?.avatar)$("#top-avatar").src=a.avatar;
 $("#avatar-preview-name").textContent=a?(a.displayName||a.name):"Connect account";
 $("#avatar-stage").innerHTML=a?.avatar?`<img class="avatar-3d-image" src="${esc(a.avatar)}" alt="Avatar for ${esc(a.name)}"><span>@${esc(a.name)}</span>`:'<div class="avatar-placeholder">R</div><span>Link a Roblox profile to preview its avatar</span>';
 $("#connected-account").innerHTML=a?`<div class="connected-profile"><img src="${esc(a.avatar||"")}" alt=""><div><strong>${esc(a.displayName||a.name)}</strong><span>@${esc(a.name)} · ID ${Number(a.id)}</span></div><button class="text-button" id="disconnect-account">Disconnect</button></div>`:"<span>No profile connected</span>";
 $("#account-username").value=a?.name||"";
 $("#disconnect-account")?.addEventListener("click",async()=>{await saveConfig({linkedAccount:null});renderAccount();toast("Profile disconnected");});
}
async function connectAccount(){
 const name=$("#account-username").value.trim();if(!name){toast("Enter your Roblox username first");return;}
 const b=$("#connect-account-button");b.disabled=true;b.textContent="Looking up…";
 try{const account=await window.rclient.lookupAccount(name);await saveConfig({linkedAccount:account});renderAccount();toast("Roblox profile connected");}
 catch(e){toast(e.message||"Could not find that Roblox profile");}
 finally{b.disabled=false;b.textContent="Connect profile";}
}
async function detectRoblox(){
 $("#install-status").textContent="Checking…";
 try{const r=await window.rclient.detectRoblox();$("#install-status").textContent=r.installed?"Roblox Player detected · "+r.type:"Roblox Player not detected";$("#install-path").textContent=r.executable||"Install Roblox from roblox.com or the Microsoft Store. RClient can still try the official launch link.";$("#browse-install-button").textContent=r.manual?"Change location":"Choose location";$("#connection-label").textContent=r.installed?"Roblox Player detected":"Roblox launch link ready";}
 catch{$("#install-status").textContent="Could not check installation";$("#install-path").textContent="RClient can still try opening Roblox through its official app link.";}
}
function setShopTab(tab){
 $$(".shop-tab").forEach(b=>b.classList.toggle("selected",b.dataset.shopTab===tab));
 $("#shop-panel").hidden=tab!=="shop";$("#customize-panel").hidden=tab!=="customize";
 if(tab==="customize")renderRecentCatalog();
}
function bindEvents(){
 $$("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
 $$("[data-navigate]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.navigate)));
 $("#game-search-button").addEventListener("click",searchGames);
 $("#game-search").addEventListener("keydown",e=>{if(e.key==="Enter")searchGames();});
 $$("#game-categories [data-game-feed]").forEach(b=>b.addEventListener("click",()=>selectGameFeed(b.dataset.gameFeed)));
 $("#catalog-search-button").addEventListener("click",loadCatalog);
 $("#catalog-search").addEventListener("keydown",e=>{if(e.key==="Enter")loadCatalog();});
 $$("#catalog-categories [data-catalog-category]").forEach(b=>b.addEventListener("click",async()=>{$$("#catalog-categories [data-catalog-category]").forEach(x=>x.classList.toggle("selected",x===b));await saveConfig({catalogCategory:b.dataset.catalogCategory});loadCatalog();}));
 $("#catalog-sort").addEventListener("change",async()=>{await saveConfig({catalogSort:$("#catalog-sort").value});loadCatalog();});
 $("#free-filter").addEventListener("change",loadCatalog);$("#on-sale-filter").addEventListener("change",loadCatalog);
 $$(".shop-tab").forEach(b=>b.addEventListener("click",()=>setShopTab(b.dataset.shopTab)));
 $("#customize-avatar-button").addEventListener("click",()=>window.rclient.openExternal("https://www.roblox.com/my/avatar"));
 $("#open-avatar-editor").addEventListener("click",()=>window.rclient.openExternal("https://www.roblox.com/my/avatar"));
 $("#connect-account-button").addEventListener("click",connectAccount);
 $("#account-username").addEventListener("keydown",e=>{if(e.key==="Enter")connectAccount();});
 $("#theme-toggle").addEventListener("click",()=>{const order=["dark","midnight","light"];saveConfig({theme:order[(order.indexOf(config.theme)+1)%order.length]});});
 $$("[data-theme]").forEach(b=>b.addEventListener("click",()=>saveConfig({theme:b.dataset.theme})));
 $$("[data-fps]").forEach(b=>b.addEventListener("click",async()=>{await saveConfig({fpsTarget:Number(b.dataset.fps)});$$("[data-fps]").forEach(x=>x.classList.toggle("selected",x===b));toast("Preferred frame-rate target saved");}));
 $("#detect-button").addEventListener("click",detectRoblox);
 $("#browse-install-button").addEventListener("click",async()=>{try{const selected=await window.rclient.pickRobloxInstall();if(selected){toast("Roblox installation saved");await detectRoblox();}}catch(e){toast(e.message||"Could not select Roblox installation");}});
 $("#clear-install-button").addEventListener("click",async()=>{await window.rclient.clearRobloxInstall();toast("Saved location cleared");await detectRoblox();});
 $("#accent-color").addEventListener("input",async e=>{await saveConfig({accent:e.target.value});});
 $("#ui-font").addEventListener("change",async e=>{await saveConfig({uiFont:e.target.value});});
 $("#reset-appearance").addEventListener("click",async()=>{await saveConfig({accent:"#8b7cff",uiFont:"Inter",theme:"dark"});toast("Appearance reset");});
 $("#profile-button").addEventListener("click",()=>config.linkedAccount?window.rclient.openProfile(config.linkedAccount.id):navigate("settings"));
 $("#account-button").addEventListener("click",()=>window.rclient.openSettings());
 $("#update-button").addEventListener("click",async()=>{const b=$("#update-button");b.disabled=true;b.textContent="Checking…";$("#update-status").textContent="Checking GitHub for the latest RClient release…";try{const result=await window.rclient.checkUpdates();if(result.message){$("#update-status").textContent=result.message;}else if(result.available){$("#update-status").textContent="Update found. Downloading automatically…";}else{$("#update-status").textContent="You're up to date.";}}catch(error){$("#update-status").textContent="Could not check for updates: "+(error.message||"Please try again.");}finally{b.disabled=false;b.textContent="Check for updates";}});
 $("#update-later").addEventListener("click",()=>{$("#update-modal").hidden=true;$("#update-status").textContent=updateIsDownloaded?"Update downloaded. Restart whenever ready.":"Update postponed.";});
 $("#update-primary").addEventListener("click",async()=>{const b=$("#update-primary");if(updateIsDownloaded){await window.rclient.installUpdate();return;}b.disabled=true;$("#update-later").disabled=true;$("#update-progress").hidden=false;$("#update-message").textContent="Downloading in the background. Keep using RClient.";try{await window.rclient.downloadUpdate();}catch(e){b.disabled=false;$("#update-later").disabled=false;$("#update-message").textContent=e.message;$("#update-progress").hidden=true;}});
 window.rclient.onUpdateAvailable(info=>{updateIsDownloaded=false;$("#update-status").textContent="RClient v"+(info?.version||"new version")+" found. Downloading automatically in the background…";$("#update-modal").hidden=true;});
 window.rclient.onUpdateProgress(p=>{const n=Math.max(0,Math.min(100,Number(p?.percent)||0));$("#update-progress-fill").style.width=n+"%";$("#update-progress-label").textContent="Downloading… "+n+"%";$("#update-status").textContent="Downloading update automatically… "+n+"%";});
 window.rclient.onUpdateDownloaded(info=>{updateIsDownloaded=true;$("#update-status").textContent="RClient "+(info?.version||"update")+" is downloaded. It will install automatically when you close RClient.";$("#update-modal").hidden=true;toast("Update ready — it will install when RClient closes.");});
 window.rclient.onUpdateNotAvailable(()=>$("#update-status").textContent="You're up to date.");
 window.rclient.onUpdateError(e=>{$("#update-status").textContent="Update check failed: "+(e?.message||"Unknown error");});
}
async function init(){
 bindEvents();config={...config,...await window.rclient.getConfig()};applyTheme();renderAccount();
 const v=await window.rclient.getVersion();$("#version-label").textContent="RClient v"+v;$("#about-version").textContent="Version "+v;
 $("#fps-options").querySelectorAll("button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.fps)===config.fpsTarget));
 $("#catalog-sort").value=config.catalogSort||"relevance";
 $$("#catalog-categories [data-catalog-category]").forEach(b=>b.classList.toggle("selected",b.dataset.catalogCategory===(config.catalogCategory||"all")));
 await Promise.all([detectRoblox(),loadPopular(),loadCatalog()]);
 if(config.recentGames?.length){
  const ids=config.recentGames.map(x=>x.id);
  const recent=currentGames.filter(g=>ids.includes(g.id));
  if(recent.length)await renderGames($("#recent-grid"),recent);
 }
}
window.addEventListener("DOMContentLoaded",init);
