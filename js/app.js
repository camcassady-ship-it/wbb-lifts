/* William Byrd Baseball · Lifts. Session cards and one rest timer. */
(function () {
  const app = document.getElementById("app");
  const timerEl = document.getElementById("timer");
  const digits = document.getElementById("digits");
  const presetsEl = document.getElementById("presets");
  let program = null;
  let audioCtx = null;
  let wakeLock = null;
  let observer = null;
  const timer = { remaining: 0, endsAt: 0, running: false, handle: null, chosen: 0 };
  let open = null;

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach((key) => {
      if (key === "class") node.className = a[key];
      else if (key.startsWith("on") && typeof a[key] === "function") node.addEventListener(key.slice(2), a[key]);
      else if (a[key] === true) node.setAttribute(key, "");
      else if (a[key] != null && a[key] !== false) node.setAttribute(key, a[key]);
    });
    for (let i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach((c) => append(node, c));
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function fmt(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }
  function fmtChip(seconds) {
    if (seconds < 60) return seconds + "s";
    return fmt(seconds);
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "warmup") return { name: "warmup" };
    if (parts[0] === "videos") return { name: "videos" };
    if (parts[0] === "phase" && parts[1]) {
      if (parts[2] === "day" && parts[3]) return { name: "day", phase: parts[1], day: parts[3] };
      return { name: "phase", phase: parts[1] };
    }
    return { name: "home" };
  }
  function phaseById(id) {
    return program.phases.find((p) => p.id === id);
  }
  function dayById(phase, id) {
    return phase && phase.days.find((d) => d.id === id);
  }
  function flat(session) {
    const items = [];
    (session.blocks || []).forEach((block) => {
      block.exercises.forEach((ex) => items.push({ block: block.title, ex: ex }));
    });
    return items;
  }

  function videoNode(demo) {
    const video = document.createElement("video");
    video.className = "demo";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "none";
    video.poster = demo.poster;
    video.dataset.src = demo.src;
    video.setAttribute("aria-label", "Demo");
    return video;
  }
  function mediaBox(demos) {
    if (!demos || !demos.length) return null;
    const box = h("div", { class: "media" });
    box.appendChild(videoNode(demos[0]));
    return box;
  }
  function bindVideos(root) {
    if (observer) observer.disconnect();
    const active = [];
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const on = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (on) {
          if (!video.getAttribute("src")) video.src = video.dataset.src;
          const pending = video.play();
          if (pending && pending.catch) pending.catch(() => {});
          const at = active.indexOf(video);
          if (at >= 0) active.splice(at, 1);
          active.push(video);
          while (active.length > 2) {
            const old = active.shift();
            if (old && old !== video) old.pause();
          }
        } else {
          video.pause();
          const at = active.indexOf(video);
          if (at >= 0) active.splice(at, 1);
        }
      });
    }, { threshold: [0, 0.35] });
    root.querySelectorAll("video.demo").forEach((node) => observer.observe(node));
  }

  function cueList(cues, limit) {
    if (!cues || !cues.length) return null;
    const ul = h("ul", { class: "cues" });
    cues.slice(0, limit || cues.length).forEach((line) => ul.appendChild(h("li", null, line)));
    return ul;
  }
  function cardButton(item, index, items) {
    const ex = item.ex || item;
    const btn = h("button", { class: "card", type: "button", onclick: () => showLarge(items, index) });
    append(btn, mediaBox(ex.demos));
    const pad = h("div", { class: "pad" });
    if (item.block) pad.appendChild(h("p", { class: "kicker" }, item.block));
    pad.appendChild(h("h3", { class: "name" }, ex.name));
    if (ex.rx || ex.load) pad.appendChild(h("p", { class: "rx" }, [ex.rx, ex.load].filter(Boolean).join(" · ")));
    append(pad, cueList(ex.cues, 3));
    btn.appendChild(pad);
    return btn;
  }

  function showLarge(items, index) {
    open = { items: items, index: index };
    render();
  }
  function closeLarge() {
    open = null;
    render();
  }

  function renderOverlay() {
    if (!open) return;
    const item = open.items[open.index];
    const ex = item.ex || item;
    const layer = h("div", { class: "overlay", role: "dialog", "aria-modal": "true" });
    const bar = h("div", { class: "overlay-bar" });
    bar.appendChild(h("button", { type: "button", onclick: closeLarge }, "Close"));
    bar.appendChild(h("button", {
      type: "button",
      disabled: open.index === 0,
      onclick: () => showLarge(open.items, open.index - 1)
    }, "Previous"));
    bar.appendChild(h("button", {
      class: "primary",
      type: "button",
      disabled: open.index === open.items.length - 1,
      onclick: () => showLarge(open.items, open.index + 1)
    }, "Next"));
    const big = h("article", { class: "big" });
    big.appendChild(bar);
    append(big, mediaBox(ex.demos));
    const pad = h("div", { class: "pad" });
    if (item.block) pad.appendChild(h("p", { class: "kicker" }, item.block));
    pad.appendChild(h("h2", { class: "name" }, ex.name));
    if (ex.rx || ex.load) pad.appendChild(h("p", { class: "rx" }, [ex.rx, ex.load].filter(Boolean).join(" · ")));
    append(pad, cueList(ex.cues));
    big.appendChild(pad);
    layer.appendChild(big);
    document.body.appendChild(layer);
    bindVideos(layer);
    const video = layer.querySelector("video.demo");
    if (video) {
      video.src = video.dataset.src;
      const pending = video.play();
      if (pending && pending.catch) pending.catch(() => {});
    }
  }

  function renderBlocks(blocks) {
    const items = flat({ blocks: blocks });
    let n = 0;
    blocks.forEach((block) => {
      const head = h("div", { class: "block" });
      head.appendChild(h("h2", null, block.title));
      if (block.note) head.appendChild(h("p", { class: "note" }, block.note));
      app.appendChild(head);
      const grid = h("div", { class: "grid" });
      block.exercises.forEach((ex) => {
        const index = n;
        n += 1;
        grid.appendChild(cardButton({ block: block.title, ex: ex }, index, items));
      });
      app.appendChild(grid);
    });
  }

  function render() {
    const here = route();
    clear(app);
    document.querySelectorAll(".overlay").forEach((node) => node.remove());
    if (here.name === "home") renderHome();
    else if (here.name === "warmup") renderWarmup();
    else if (here.name === "videos") renderVideos();
    else if (here.name === "phase") renderPhase(here);
    else if (here.name === "day") renderDay(here);
    else renderHome();
    const session = here.name === "warmup" || here.name === "day";
    document.body.classList.toggle("has-timer", session);
    timerEl.hidden = !session;
    if (session) {
      const rests = here.name === "warmup" ? [] : (dayById(phaseById(here.phase), here.day) || {}).rests || [];
      armTimer(here.name + (here.day || ""), rests);
      requestWake();
    }
    if (!open) bindVideos(app);
    if (open) renderOverlay();
  }

  function renderHome() {
    app.appendChild(h("p", { class: "kicker" }, "William Byrd Baseball"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.8rem,10vw,4.6rem);margin:8px 0 16px" }, "Lifts"));
    const grid = h("div", { class: "choices" });
    grid.appendChild(h("a", { class: "choice", href: "#/warmup" }, h("h2", null, "Warm-Up"), h("p", null, "Agility, mobility, dynamic")));
    program.phases.forEach((phase) => {
      grid.appendChild(h("a", { class: "choice", href: "#/phase/" + phase.id },
        h("h2", null, phase.title), h("p", null, phase.subtitle)));
    });
    grid.appendChild(h("a", { class: "choice", href: "#/videos" }, h("h2", null, "Videos"), h("p", null, "Every demo")));
    app.appendChild(grid);
  }

  function renderWarmup() {
    app.appendChild(h("a", { class: "back", href: "#/" }, "Home"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.4rem,8vw,3.6rem);margin:8px 0" }, "Warm-Up"));
    renderBlocks(program.warmup.blocks);
  }

  function renderPhase(here) {
    const phase = phaseById(here.phase);
    if (!phase) return missing();
    app.appendChild(h("a", { class: "back", href: "#/" }, "Home"));
    app.appendChild(h("p", { class: "kicker" }, phase.subtitle));
    app.appendChild(h("h1", { style: "font-size:clamp(2.4rem,8vw,3.6rem);margin:8px 0 12px" }, phase.title));
    const grid = h("div", { class: "choices" });
    phase.days.forEach((day) => {
      grid.appendChild(h("a", { class: "choice", href: "#/phase/" + phase.id + "/day/" + day.id },
        h("h2", null, day.title), h("p", null, day.blurb)));
    });
    app.appendChild(grid);
  }

  function renderDay(here) {
    const phase = phaseById(here.phase);
    const day = dayById(phase, here.day);
    if (!phase || !day) return missing();
    app.appendChild(h("a", { class: "back", href: "#/phase/" + phase.id }, phase.title));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,8vw,3.4rem);margin:8px 0 4px" }, day.title));
    app.appendChild(h("p", { class: "lead" }, day.blurb));
    renderBlocks(day.blocks);
  }

  function allVideos() {
    const map = new Map();
    function add(ex) {
      if (!ex.demos || !ex.demos.length) return;
      if (!map.has(ex.name)) map.set(ex.name, ex);
    }
    program.warmup.blocks.forEach((block) => block.exercises.forEach(add));
    program.phases.forEach((phase) => phase.days.forEach((day) => day.blocks.forEach((block) => block.exercises.forEach(add))));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
  function renderVideos() {
    app.appendChild(h("a", { class: "back", href: "#/" }, "Home"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,8vw,3.4rem);margin:8px 0" }, "Videos"));
    const search = h("input", { class: "search", type: "search", placeholder: "Search", "aria-label": "Search videos" });
    const grid = h("div", { class: "grid" });
    const items = allVideos();
    function paint() {
      clear(grid);
      const q = search.value.trim().toLowerCase();
      const shown = items.filter((ex) => !q || ex.name.toLowerCase().includes(q));
      const wrapped = shown.map((ex) => ({ ex: ex }));
      shown.forEach((ex, i) => grid.appendChild(cardButton(wrapped[i], i, wrapped)));
      bindVideos(grid);
    }
    search.addEventListener("input", paint);
    app.appendChild(search);
    app.appendChild(grid);
    paint();
  }
  function missing() {
    app.appendChild(h("h1", null, "Not found"));
    app.appendChild(h("a", { class: "back", href: "#/" }, "Home"));
  }

  function paintTimer() {
    digits.textContent = fmt(timer.remaining);
    const pauseBtn = document.getElementById("timer-pause");
    pauseBtn.textContent = timer.running ? "Pause" : "Start";
    presetsEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("on", Number(btn.dataset.sec) === timer.chosen && timer.running);
    });
  }
  function stopTimer() {
    timer.running = false;
    if (timer.handle) cancelAnimationFrame(timer.handle);
    timer.handle = null;
  }
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AC) audioCtx = new AC();
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();
      [0, 0.22].forEach((offset) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + offset);
        o.stop(audioCtx.currentTime + offset + 0.16);
      });
    } catch (e) { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
  }
  function tick() {
    if (!timer.running) return;
    const left = Math.ceil((timer.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      timer.remaining = 0;
      timer.running = false;
      paintTimer();
      beep();
      return;
    }
    timer.remaining = left;
    paintTimer();
    timer.handle = requestAnimationFrame(() => setTimeout(tick, 200));
  }
  function startTimer(seconds) {
    stopTimer();
    timer.chosen = seconds;
    timer.remaining = seconds;
    timer.endsAt = Date.now() + seconds * 1000;
    timer.running = true;
    paintTimer();
    tick();
  }
  let timerKey = "";
  function armTimer(key, rests) {
    if (timerKey === key) return;
    timerKey = key;
    stopTimer();
    timer.remaining = 0;
    timer.chosen = 0;
    clear(presetsEl);
    (rests || []).forEach((sec) => {
      presetsEl.appendChild(h("button", { type: "button", "data-sec": String(sec), onclick: () => startTimer(sec) }, fmtChip(sec)));
    });
    paintTimer();
  }
  document.getElementById("timer-pause").addEventListener("click", () => {
    if (!timer.running) {
      if (timer.remaining > 0) startTimer(timer.remaining);
      return;
    }
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    stopTimer();
    paintTimer();
  });
  document.getElementById("timer-reset").addEventListener("click", () => {
    stopTimer();
    timer.remaining = 0;
    timer.chosen = 0;
    paintTimer();
  });
  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") closeLarge();
    if (event.key === "ArrowRight" && open.index < open.items.length - 1) showLarge(open.items, open.index + 1);
    if (event.key === "ArrowLeft" && open.index > 0) showLarge(open.items, open.index - 1);
  });
  async function requestWake() {
    if (!navigator.wakeLock || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { wakeLock = null; }
  }

  window.addEventListener("hashchange", () => { open = null; render(); });

  fetch("data/program.json")
    .then((res) => res.json())
    .then((data) => { program = data; render(); if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(() => {}); })
    .catch(() => { app.textContent = "The program did not load."; });
})();
