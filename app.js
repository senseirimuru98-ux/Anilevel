const STORAGE_KEY = "anilevel_v1";

const $ = (id) => document.getElementById(id);
const toast = (msg) => {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
};

const todayKey = () => new Date().toISOString().slice(0,10);

const defaultState = () => ({
  playerName: "",
  avatar: "🧑‍🚀",
  theme: "default",
  xp: 0,
  streak: 0,
  lastActiveDay: null,   // YYYY-MM-DD
  todayXP: 0,
  todayDone: 0,
  todayKey: todayKey(),
  activeTab: "daily",
  quests: [
    // seed starter quests
    { id: cryptoId(), title: "Drink water", type: "daily", xp: 10, doneOn: {} },
    { id: cryptoId(), title: "Move your body 10 min", type: "daily", xp: 20, doneOn: {} },
    { id: cryptoId(), title: "Learn something (anime or skill) 15 min", type: "side", xp: 20, doneOn: {} },
    { id: cryptoId(), title: "Deep focus 45 min (Boss)", type: "boss", xp: 50, doneOn: {} },
  ],
});

function cryptoId(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    // merge with defaults to avoid missing fields
    return { ...defaultState(), ...s };
  }catch{
    return defaultState();
  }
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function xpToNext(level){
  // simple curve
  return 60 + (level-1)*25;
}

function calcLevel(xp){
  let level = 1;
  let remain = xp;
  while(remain >= xpToNext(level)){
    remain -= xpToNext(level);
    level++;
    if(level > 200) break;
  }
  return { level, inLevelXP: remain, need: xpToNext(level) };
}

function rankFromLevel(level){
  // anime-ish ranks
  if(level >= 60) return "S";
  if(level >= 40) return "A";
  if(level >= 25) return "B";
  if(level >= 12) return "C";
  if(level >= 5)  return "D";
  return "E";
}

function resetDailyIfNeeded(){
  const tk = todayKey();
  if(state.todayKey !== tk){
    state.todayKey = tk;
    state.todayXP = 0;
    state.todayDone = 0;
  }
}

function updateStreakOnComplete(){
  const tk = todayKey();
  if(state.lastActiveDay === tk){
    // already active today
    return;
  }
  if(state.lastActiveDay){
    const last = new Date(state.lastActiveDay);
    const now  = new Date(tk);
    const diffDays = Math.round((now - last) / (1000*60*60*24));
    if(diffDays === 1) state.streak += 1;
    else state.streak = 1; // streak breaks
  }else{
    state.streak = 1;
  }
  state.lastActiveDay = tk;
}

function setTheme(theme){
  state.theme = theme;
  if(theme === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  save();
}

function render(){
  resetDailyIfNeeded();

  $("playerName").value = state.playerName;
  $("avatar").textContent = state.avatar;

  const lvl = calcLevel(state.xp);
  $("level").textContent = lvl.level;
  $("rank").textContent = rankFromLevel(lvl.level);
  $("xp").textContent = state.xp;
  $("streak").textContent = state.streak;

  $("todayXP").textContent = state.todayXP;
  $("todayDone").textContent = state.todayDone;

  const pct = Math.floor((lvl.inLevelXP / lvl.need) * 100);
  $("xpFill").style.width = `${pct}%`;
  $("xpToNext").textContent = `${(lvl.need - lvl.inLevelXP)} to next`;

  // tabs
  document.querySelectorAll(".segBtn").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.tab === state.activeTab);
  });

  // quest list (filter by tab)
  const list = $("questList");
  list.innerHTML = "";

  const tk = todayKey();
  const filtered = state.quests.filter(q => q.type === state.activeTab);

  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No quests here yet. Add one above 👆🏽";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(q=>{
    const done = !!q.doneOn?.[tk];

    const item = document.createElement("div");
    item.className = "quest";

    const left = document.createElement("div");
    left.className = "questLeft";

    const check = document.createElement("div");
    check.className = "check" + (done ? " done" : "");
    check.textContent = done ? "✓" : "";
    check.title = done ? "Completed today" : "Mark complete";
    check.addEventListener("click", () => toggleComplete(q.id));

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "questTitle";
    title.textContent = q.title;

    const meta = document.createElement("div");
    meta.className = "questMeta";
    meta.textContent = `${q.type.toUpperCase()} • +${q.xp} XP`;

    text.appendChild(title);
    text.appendChild(meta);

    left.appendChild(check);
    left.appendChild(text);

    const right = document.createElement("div");
    right.className = "qActions";

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `+${q.xp}`;

    const del = document.createElement("button");
    del.className = "iconBtn";
    del.innerHTML = "🗑️";
    del.title = "Delete quest";
    del.addEventListener("click", () => deleteQuest(q.id));

    right.appendChild(badge);
    right.appendChild(del);

    item.appendChild(left);
    item.appendChild(right);

    list.appendChild(item);
  });

  save();
}

function toggleComplete(id){
  const tk = todayKey();
  const q = state.quests.find(x => x.id === id);
  if(!q) return;

  q.doneOn = q.doneOn || {};
  const already = !!q.doneOn[tk];

  if(already){
    // un-complete: remove XP earned today for that quest
    delete q.doneOn[tk];
    state.xp -= q.xp;
    state.todayXP = Math.max(0, state.todayXP - q.xp);
    state.todayDone = Math.max(0, state.todayDone - 1);
    toast(`Undid: -${q.xp} XP`);
  }else{
    q.doneOn[tk] = true;
    state.xp += q.xp;
    state.todayXP += q.xp;
    state.todayDone += 1;
    updateStreakOnComplete();
    toast(`Quest cleared! +${q.xp} XP`);
  }

  // safety
  state.xp = Math.max(0, state.xp);

  // level up feedback
  const lvl = calcLevel(state.xp);
  if(!already && lvl.inLevelXP === 0){
    toast(`LEVEL UP! You’re now Level ${lvl.level} ⚡️`);
  }

  render();
}

function deleteQuest(id){
  state.quests = state.quests.filter(q => q.id !== id);
  toast("Quest deleted");
  render();
}

function addQuest(title, type, xp){
  state.quests.unshift({
    id: cryptoId(),
    title,
    type,
    xp: Number(xp),
    doneOn: {}
  });
  toast("Quest added");
  render();
}

function addTemplate(pack){
  const packs = {
    study: [
      ["Study 30 min", "daily", 20],
      ["Flashcards / notes 15 min", "daily", 10],
      ["1 practice quiz", "side", 35],
    ],
    fitness: [
      ["Walk 15 min", "daily", 10],
      ["Workout 30 min", "side", 35],
      ["Stretch 10 min", "daily", 10],
    ],
    clean: [
      ["Make bed", "daily", 10],
      ["Clean 1 area (desk/kitchen)", "daily", 20],
      ["Laundry / deep clean", "side", 35],
    ],
  };

  (packs[pack] || []).forEach(([t, ty, xp]) => addQuest(t, ty, xp));
}

function cycleTheme(){
  const order = ["default", "ocean", "sunrise"];
  const idx = order.indexOf(state.theme);
  const next = order[(idx + 1) % order.length];
  setTheme(next);
  toast(`Theme: ${next}`);
  render();
}

let state = load();

function init(){
  // apply theme
  setTheme(state.theme || "default");

  // name
  $("playerName").addEventListener("input", (e)=>{
    state.playerName = e.target.value;
    save();
  });

  // tabs
  document.querySelectorAll(".segBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.activeTab = btn.dataset.tab;
      render();
    });
  });

  // add quest
  $("questForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const title = $("questTitle").value.trim();
    const type = $("questType").value;
    const xp = $("questXP").value;
    if(!title) return;
    addQuest(title, type, xp);
    $("questTitle").value = "";
  });

  // avatar buttons
  document.querySelectorAll(".emojiBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      state.avatar = b.dataset.emoji;
      toast("Avatar updated");
      render();
    });
  });

  // templates
  $("tplStudy").addEventListener("click", ()=> addTemplate("study"));
  $("tplFitness").addEventListener("click", ()=> addTemplate("fitness"));
  $("tplClean").addEventListener("click", ()=> addTemplate("clean"));

  // theme cycle
  $("btnTheme").addEventListener("click", cycleTheme);

  // reset
  $("btnReset").addEventListener("click", ()=>{
    if(confirm("Reset everything? This will erase your quests and XP.")){
      state = defaultState();
      setTheme("default");
      toast("Reset complete");
      render();
    }
  });

  // daily reset check on load
  resetDailyIfNeeded();
  render();
}

init();
