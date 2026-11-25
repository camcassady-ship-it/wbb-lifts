/* William Byrd Baseball · Lifts
   Static reference. All prescriptions come from data/program.json. */
(function () {
  const STORAGE = "wbb-lifts-v1";
  const app = document.getElementById("app");
  const topNav = document.getElementById("top-nav");
  let program = null;
  let audioCtx = null;
  let wakeLock = null;
  const timer = {
    mode: "down",
    remaining: 0,
    elapsed: 0,
    running: false,
    endsAt: 0,
    startedAt: 0,
    handle: null,
    label: ""
  };

  const store = loadStore();

  function loadStore() {
    try {
      return Object.assign(
        { mode: "elite", maxes: { elite: {}, novice: {} }, last: "", holds: {}, sets: {} },
        JSON.parse(localStorage.getItem(STORAGE) || "{}")
      );
    } catch (e) {
      return { mode: "elite", maxes: { elite: {}, novice: {} }, last: "", holds: {}, sets: {} };
    }
  }
  function saveStore() {
    localStorage.setItem(STORAGE, JSON.stringify(store));
  }

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach((key) => {
      if (key === "class") node.className = a[key];
      else if (key === "html") node.innerHTML = a[key];
      else if (key.startsWith("on") && typeof a[key] === "function") node.addEventListener(key.slice(2), a[key]);
      else if (a[key] === true) node.setAttribute(key, "");
      else if (a[key] !== false && a[key] != null) node.setAttribute(key, a[key]);
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
  function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  }
  function notes(list) {
    if (!list || !list.length) return null;
    return list.map((text) => h("p", { class: "note" }, h("strong", null, "Source note. "), text));
  }
  function quotes(list) {
    return (list || []).map((text) => h("blockquote", { class: "quote" }, text));
  }
  function credit() {
    return h("p", { class: "meta" }, program.credit);
  }

  function phaseByNumber(n) {
    return program.phases.find((p) => String(p.number) === String(n));
  }
  function weekObj(phase, n) {
    return (phase.weeks || []).find((w) => String(w.number) === String(n));
  }
  function daysFor(phase, week) {
    if (!week) return [];
    return (phase.daySets && phase.daySets[week.daySet]) || [];
  }
  function findDay(phase, week, id) {
    const days = daysFor(phase, week);
    return days.find((d) => d.id === id) || days.find((d) => d.id === "day-" + id);
  }

  function parseRoute() {
    const q = new URLSearchParams(location.search);
    if (q.has("phase") && !location.hash) {
      const day = q.get("day");
      let dayId = day;
      if (day && /^\d+$/.test(day)) dayId = "day-" + day;
      let hash = "#/phase/" + q.get("phase");
      if (q.get("week")) hash += "/week/" + q.get("week");
      if (dayId) hash += "/day/" + dayId;
      if (q.get("view")) hash += "/" + q.get("view");
      history.replaceState(null, "", location.pathname + hash);
    }
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const route = { name: "home", parts: parts };
    if (!parts.length) return route;
    if (parts[0] === "warmup") {
      route.name = "warmup";
      route.condensed = parts[1] === "condensed";
      return route;
    }
    if (parts[0] === "exercises") {
      route.name = "library";
      return route;
    }
    if (parts[0] === "exercise") {
      route.name = "exercise";
      route.slug = parts.slice(1).join("/");
      return route;
    }
    if (parts[0] === "phase") {
      route.phase = parts[1];
      route.name = "phase";
      if (parts[2] === "week") {
        route.week = parts[3];
        route.name = "week";
        if (parts[4] === "day") {
          route.day = parts[5];
          route.name = "day";
          route.view = parts[6] || "player";
        }
      }
    }
    return route;
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function dayHash(phase, week, day, view) {
    let hash = "#/phase/" + phase.number + "/week/" + week.number + "/day/" + day.id;
    if (view && view !== "player") hash += "/" + view;
    return hash;
  }
  function abs(hash) {
    return location.origin + location.pathname + hash;
  }

  function nav(route) {
    clear(topNav);
    const links = [
      ["#/", "Home", route.name === "home"],
      ["#/warmup", "Warm-Up", route.name === "warmup"],
      ["#/exercises", "Exercises", route.name === "library" || route.name === "exercise"],
      ["#/phase/1", "Phase 1", route.phase === "1"],
      ["#/phase/2", "Phase 2", route.phase === "2"],
      ["#/phase/3", "Phase 3", route.phase === "3"]
    ];
    links.forEach((item) => {
      const a = h("a", { href: item[0] }, item[1]);
      if (item[2]) a.setAttribute("aria-current", "page");
      topNav.appendChild(a);
    });
  }

  function modeToggle() {
    const elite = store.mode !== "novice";
    return h("div", { class: "row", role: "group", "aria-label": "Athlete type" },
      h("button", {
        class: "chip" + (elite ? " on" : ""),
        type: "button",
        onclick: () => { store.mode = "elite"; saveStore(); render(); }
      }, "Elite · 1RM"),
      h("button", {
        class: "chip" + (!elite ? " on" : ""),
        type: "button",
        onclick: () => { store.mode = "novice"; saveStore(); render(); }
      }, "Novice · 3RM")
    );
  }
  function modeLabel() {
    return store.mode === "novice" ? "3RM" : "1RM";
  }

  function mountDemos(demos) {
    if (!demos || !demos.length) return null;
    let index = 0;
    const frame = h("div", { class: "demo-frame noprint" });
    const video = document.createElement("video");
    video.className = "demo-video";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("preload", "none");
    const label = h("p", { class: "meta demo-label" });
    const noteBox = h("div");
    const count = h("span", { class: "meta" });
    function show(next) {
      index = (next + demos.length) % demos.length;
      const demo = demos[index];
      video.pause();
      video.removeAttribute("src");
      video.dataset.src = demo.src;
      video.poster = demo.poster || "";
      video.dataset.wantPlay = "";
      label.textContent = demo.label || "";
      clear(noteBox);
      append(noteBox, notes(demo.sourceNotes));
      count.textContent = (index + 1) + " / " + demos.length;
      video.setAttribute("aria-label", demo.label || "Exercise demo");
    }
    show(0);
    frame.appendChild(video);
    if (demos.some((d) => d.label)) frame.appendChild(label);
    frame.appendChild(noteBox);
    if (demos.length > 1) {
      const nav = h("div", { class: "demo-nav" });
      nav.appendChild(h("button", { class: "btn", type: "button", onclick: (event) => { event.preventDefault(); event.stopPropagation(); show(index - 1); } }, "Previous demo"));
      nav.appendChild(count);
      nav.appendChild(h("button", { class: "btn", type: "button", onclick: (event) => { event.preventDefault(); event.stopPropagation(); show(index + 1); } }, "Next demo"));
      frame.appendChild(nav);
    }
    return frame;
  }

  let demoObserver = null;
  function bindDemoPlayback() {
    if (demoObserver) demoObserver.disconnect();
    const active = [];
    demoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (visible) {
          if (!video.getAttribute("src") && video.dataset.src) video.src = video.dataset.src;
          video.dataset.wantPlay = "1";
          const pending = video.play();
          if (pending && pending.catch) pending.catch(() => {});
          const at = active.indexOf(video);
          if (at >= 0) active.splice(at, 1);
          active.push(video);
          while (active.length > 2) {
            const old = active.shift();
            if (old && old !== video) {
              old.pause();
              old.dataset.wantPlay = "";
            }
          }
        } else {
          video.pause();
          video.dataset.wantPlay = "";
          const at = active.indexOf(video);
          if (at >= 0) active.splice(at, 1);
        }
      });
    }, { threshold: [0, 0.2, 0.6] });
    app.querySelectorAll("video.demo-video").forEach((node) => demoObserver.observe(node));
  }

  function render() {
    app.ontouchstart = null;
    app.ontouchend = null;
    const route = parseRoute();
    document.body.classList.toggle("coach-on", route.view === "coach" || route.view === "stations");
    nav(route);
    clear(app);
    if (route.name === "home") renderHome();
    else if (route.name === "warmup") renderWarmup(route.condensed);
    else if (route.name === "library") renderLibrary();
    else if (route.name === "exercise") renderExercise(route.slug);
    else if (route.name === "phase") renderPhase(route);
    else if (route.name === "week") renderWeek(route);
    else if (route.name === "day") renderDay(route);
    else renderHome();
    if (route.name === "day") store.last = location.hash;
    saveStore();
    bindDemoPlayback();
  }

  function renderHome() {
    app.appendChild(h("p", { class: "kicker" }, "Weight room reference"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.6rem,8vw,4.5rem);margin:6px 0 8px" }, "William Byrd Baseball · Lifts"));
    app.appendChild(h("p", { class: "lead" }, program.credit));
    app.appendChild(h("p", { class: "quote" }, program.percentageRule));
    app.appendChild(h("p", { class: "note" },
      h("strong", null, "Source note. "),
      "No file in the source set states a current William Byrd calendar, in-season or off-season. Pick the phase and week. The last day you opened on this device is kept here only."
    ));
    const actions = h("div", { class: "row" });
    if (store.last) actions.appendChild(h("a", { class: "btn primary", href: store.last }, "Continue"));
    actions.appendChild(h("a", { class: "btn primary", href: "#/phase/1/week/1/day/day-1/coach" }, "Coach · Phase 1 Week 1 Day 1"));
    actions.appendChild(h("a", { class: "btn", href: "#/warmup" }, "PEP Warm-Up"));
    app.appendChild(actions);
    const grid = h("div", { class: "grid cards phases" });
    program.phases.forEach((phase) => {
      const card = h("a", { class: "card", href: "#/phase/" + phase.number });
      if (phase.image) card.appendChild(h("img", { src: phase.image, alt: "" }));
      card.appendChild(h("p", { class: "kicker" }, "Weeks " + phase.weeks.map((w) => w.number).join(", ")));
      card.appendChild(h("h2", null, phase.title));
      card.appendChild(h("p", null, phase.subtitle || ""));
      grid.appendChild(card);
    });
    app.appendChild(grid);
    app.appendChild(h("p", { class: "meta", style: "margin-top:16px" }, program.scopeNote));
  }

  function renderWarmup(condensed) {
    const w = program.warmup;
    app.appendChild(h("p", { class: "kicker" }, condensed ? "Condensed deck" : "Full deck"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,7vw,3.6rem)" }, w.title));
    app.appendChild(h("p", { class: "quote" }, w.setup));
    app.appendChild(h("div", { class: "row noprint" },
      h("a", { class: "chip" + (!condensed ? " on" : ""), href: "#/warmup" }, "Full"),
      h("a", { class: "chip" + (condensed ? " on" : ""), href: "#/warmup/condensed" }, "Condensed")
    ));
    w.sources.forEach((s) => app.appendChild(h("p", { class: "meta" }, s)));
    if (condensed) {
      app.appendChild(h("p", { class: "note" },
        h("strong", null, "Source note. "),
        "The condensed deck uses the same three phases and the same 14 agility drills, often two drills per slide. Mobility and dynamic-flexibility names match the full deck."
      ));
    }
    w.phases.forEach((phase) => {
      app.appendChild(h("h2", { class: "section-h" }, phase.name));
      app.appendChild(h("p", { class: "quote" }, phase.instructions));
      phase.exercises.forEach((ex) => {
        const card = h("article", { class: "card" });
        card.appendChild(h("h3", { class: "ex-name", style: "font-size:1.7rem" },
          h("a", { href: "#/exercise/" + slug(ex.name), style: "color:inherit;text-decoration:none" }, ex.name)));
        append(card, mountDemos(ex.demos));
        if (ex.howToTitle) card.appendChild(h("p", { class: "kicker" }, ex.howToTitle));
        if (ex.howTo && ex.howTo.length) {
          const ul = h("ul", { class: "cues" });
          ex.howTo.forEach((line) => ul.appendChild(h("li", null, line)));
          card.appendChild(ul);
        }
        if (ex.benefits && ex.benefits.length) {
          const ul = h("ul", { class: "benefits" });
          ex.benefits.forEach((line) => ul.appendChild(h("li", null, line)));
          card.appendChild(ul);
        }
        append(card, notes(ex.sourceNotes));
        app.appendChild(card);
      });
      append(app, notes(phase.sourceNotes));
    });
    app.appendChild(credit());
  }

  function indexExercises() {
    const map = new Map();
    function add(name, appearance, cues, benefits, extra) {
      const key = slug(name);
      if (!map.has(key)) map.set(key, { slug: key, name: name, cues: [], benefits: [], demos: [], howTo: [], sourceNotes: [], appearances: [] });
      const item = map.get(key);
      (cues || []).forEach((c) => { if (c && item.cues.indexOf(c) === -1) item.cues.push(c); });
      (benefits || []).forEach((c) => { if (c && item.benefits.indexOf(c) === -1) item.benefits.push(c); });
      ((extra && extra.howTo) || []).forEach((c) => { if (c && item.howTo.indexOf(c) === -1) item.howTo.push(c); });
      ((extra && extra.demos) || []).forEach((d) => { if (!item.demos.some((x) => x.id === d.id)) item.demos.push(d); });
      ((extra && extra.sourceNotes) || []).forEach((c) => { if (c && item.sourceNotes.indexOf(c) === -1) item.sourceNotes.push(c); });
      item.appearances.push(appearance);
    }
    program.warmup.phases.forEach((phase) => {
      phase.exercises.forEach((ex) => add(ex.name, {
        where: "PEP Warm-Up · " + phase.name,
        href: "#/warmup",
        rx: phase.instructions
      }, ex.howTo || [], ex.benefits || [], ex));
    });
    program.phases.forEach((phase) => {
      Object.keys(phase.daySets).forEach((setName) => {
        const weeks = phase.weeks.filter((w) => w.daySet === setName);
        phase.daySets[setName].forEach((day) => {
          (day.sections || []).forEach((section) => {
            (section.exercises || []).forEach((ex) => {
              const weekLabel = weeks.map((w) => "Wk " + w.number).join(", ");
              const href = weeks.length ? dayHash(phase, weeks[0], day) : "#/phase/" + phase.number;
              add(ex.name, {
                where: phase.title + " · " + weekLabel + " · " + day.title,
                href: href,
                rx: [ex.sets ? ex.sets + " sets" : "sets not printed", ex.reps ? ex.reps + " reps" : "reps not printed", ex.loadText || "", ex.tempo || ""].filter(Boolean).join(" · ")
              }, ex.cues, ex.benefits, ex);
              (ex.variations || []).forEach((v) => {
                if (v !== ex.name) add(v, {
                  where: "Variation on " + ex.name + " · " + phase.title + " · " + day.title,
                  href: href,
                  rx: ex.loadText || ""
                }, ex.cues, ex.benefits, ex);
              });
            });
          });
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderLibrary() {
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,7vw,3.6rem)" }, "Exercise library"));
    app.appendChild(h("p", { class: "lead" }, "Every name below is taken from the PEP files in this reference. A still means a mapped demo clip is attached."));
    const search = h("input", { type: "search", placeholder: "Search exercises", "aria-label": "Search exercises" });
    const list = h("div", { class: "grid", style: "margin-top:12px" });
    const items = indexExercises();
    function paint() {
      const q = search.value.trim().toLowerCase();
      clear(list);
      items.filter((item) => !q || item.name.toLowerCase().includes(q)).forEach((item) => {
        const card = h("a", { class: "card", href: "#/exercise/" + item.slug });
        if (item.demos && item.demos[0]) {
          card.appendChild(h("img", { src: item.demos[0].poster, alt: "", style: "max-height:140px;object-fit:cover;width:100%;border-radius:8px" }));
        }
        card.appendChild(h("h2", { style: "font-size:1.7rem" }, item.name));
        card.appendChild(h("p", null, item.appearances.length + " place" + (item.appearances.length === 1 ? "" : "s") + (item.demos.length ? " · " + item.demos.length + " demo" + (item.demos.length === 1 ? "" : "s") : "")));
        list.appendChild(card);
      });
    }
    search.addEventListener("input", paint);
    app.appendChild(search);
    app.appendChild(list);
    paint();
  }

  function renderExercise(id) {
    const item = indexExercises().find((ex) => ex.slug === id);
    if (!item) {
      app.appendChild(h("h1", null, "Exercise not in the source files"));
      app.appendChild(h("p", null, "That link does not match an exercise name in this reference."));
      return;
    }
    app.appendChild(h("p", { class: "kicker" }, "Exercise"));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,7vw,3.8rem)" }, item.name));
    append(app, mountDemos(item.demos));
    if (item.howTo && item.howTo.length) {
      app.appendChild(h("h2", { class: "section-h" }, "How to, as written"));
      const ul = h("ul", { class: "cues" });
      item.howTo.forEach((c) => ul.appendChild(h("li", null, c)));
      app.appendChild(ul);
    }
    if (item.cues.length) {
      app.appendChild(h("h2", { class: "section-h" }, "Cues, as written"));
      const ul = h("ul", { class: "cues" });
      item.cues.forEach((c) => ul.appendChild(h("li", null, c)));
      app.appendChild(ul);
    }
    if (item.benefits.length) {
      app.appendChild(h("h2", { class: "section-h" }, "Performance benefits, as written"));
      const ul = h("ul", { class: "benefits" });
      item.benefits.forEach((c) => ul.appendChild(h("li", null, c)));
      app.appendChild(ul);
    }
    app.appendChild(h("h2", { class: "section-h" }, "Where it appears"));
    item.appearances.forEach((ap) => {
      app.appendChild(h("a", { class: "card", href: ap.href },
        h("h3", { style: "font-size:1.3rem" }, ap.where),
        h("p", null, ap.rx)
      ));
    });
    append(app, notes(item.sourceNotes));
    if (!item.demos.length) {
      app.appendChild(h("p", { class: "note" }, h("strong", null, "Source note. "), "No demo video in the mapped set for this name."));
    }
  }

  function renderPhase(route) {
    const phase = phaseByNumber(route.phase);
    if (!phase) return missing();
    app.appendChild(h("p", { class: "kicker" }, phase.source));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,7vw,3.8rem)" }, phase.title));
    app.appendChild(h("p", { class: "lead" }, phase.subtitle + " · " + phase.calendarNote));
    if (phase.image) app.appendChild(h("img", { src: phase.image, alt: "", style: "max-height:280px;border-radius:12px;margin:12px 0" }));
    append(app, quotes(phase.intro));
    append(app, notes(phase.sourceNotes));
    const grid = h("div", { class: "grid cards" });
    phase.weeks.forEach((week) => {
      grid.appendChild(h("a", { class: "card", href: "#/phase/" + phase.number + "/week/" + week.number },
        h("h2", null, week.label),
        h("p", null, week.kind === "deload" ? "Deload week" : "Training week")
      ));
    });
    app.appendChild(grid);
    app.appendChild(credit());
  }

  function renderWeek(route) {
    const phase = phaseByNumber(route.phase);
    const week = phase && weekObj(phase, route.week);
    if (!phase || !week) return missing();
    app.appendChild(h("p", { class: "kicker" }, phase.title));
    app.appendChild(h("h1", { style: "font-size:clamp(2.2rem,7vw,3.8rem)" }, week.label));
    if (week.kind === "deload" && phase.deloadImage) {
      app.appendChild(h("img", { src: phase.deloadImage, alt: "", style: "max-height:220px;border-radius:12px" }));
    }
    app.appendChild(h("p", { class: "lead" }, phase.calendarNote));
    append(app, notes(phase.sourceNotes));
    const days = daysFor(phase, week);
    days.forEach((day) => {
      const a1 = day.a1ByWeek && day.a1ByWeek[String(week.number)];
      const card = h("a", { class: "card day-link", href: dayHash(phase, week, day) });
      const left = h("div");
      left.appendChild(h("h3", null, day.title));
      left.appendChild(h("p", { class: "meta" }, day.role || ""));
      card.appendChild(left);
      if (a1) card.appendChild(h("div", { class: "rx" }, a1.text));
      app.appendChild(card);
    });
    const row = h("div", { class: "row" });
    phase.weeks.forEach((w) => {
      row.appendChild(h("a", { class: "chip" + (w.number === week.number ? " on" : ""), href: "#/phase/" + phase.number + "/week/" + w.number }, w.label));
    });
    app.appendChild(row);
  }

  function missing() {
    app.appendChild(h("h1", null, "That day is not in the source files"));
    app.appendChild(h("p", null, "The link does not match a phase, week, or day in this reference."));
    app.appendChild(h("a", { href: "#/" }, "Back home"));
  }

  function roundLb(n) {
    return Math.round(n * 2) / 2;
  }

  function directPercents(ex, weekNumber) {
    const out = [];
    (ex.percents || []).forEach((p) => {
      if (!p.week || String(p.week) === String(weekNumber)) out.push(p);
    });
    return out;
  }

  function renderCalculator(phase, week, day) {
    const box = h("div", { class: "panel noprint" });
    box.appendChild(h("h2", { class: "section-h", style: "margin-top:0" }, "Load calculator"));
    box.appendChild(modeToggle());
    const rule = phase.number === 3 ? program.percentageRulePhase3 : program.percentageRule;
    box.appendChild(h("p", { class: "quote" }, rule));
    box.appendChild(h("p", { class: "meta" }, "Saved on this device only. Effort ratings stay in the PDF’s words."));
    const keys = [];
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((ex) => {
        const key = ex.maxKey || ex.name;
        const has = (ex.percents && ex.percents.length) || ex.percentRange || (ex.percentGroups && ex.percentGroups.length) || ex.percentOfA1;
        if (has && keys.indexOf(key) === -1 && (ex.percents || ex.percentRange || ex.percentGroups)) keys.push(key);
      });
    });
    if (!keys.length) {
      box.appendChild(h("p", null, "This day has no percentage-of-max load in the source."));
      return box;
    }
    const loads = h("div", { class: "loads" });
    keys.forEach((key) => {
      const bucket = store.maxes[store.mode] || (store.maxes[store.mode] = {});
      const id = "max-" + slug(key);
      const input = h("input", { id: id, type: "number", min: "0", step: "0.5", inputmode: "decimal", value: bucket[key] || "" });
      input.addEventListener("input", () => {
        const n = parseFloat(input.value);
        if (input.value === "" || Number.isNaN(n)) delete bucket[key];
        else bucket[key] = n;
        saveStore();
        paintLoads();
      });
      box.appendChild(h("label", { for: id }, modeLabel() + " for " + key));
      box.appendChild(input);
    });
    function paintLoads() {
      clear(loads);
      const bucket = store.maxes[store.mode] || {};
      (day.sections || []).forEach((section) => {
        (section.exercises || []).forEach((ex) => {
          const key = ex.maxKey || ex.name;
          const max = parseFloat(bucket[key]);
          directPercents(ex, week.number).forEach((p) => {
            loads.appendChild(loadRow(ex.name, p.label, Number.isFinite(max) ? roundLb(max * p.percent / 100) + " lb" : "enter a max"));
          });
          (ex.percentGroups || []).forEach((group) => {
            group.items.forEach((p) => {
              const mark = String(p.week) === String(week.number) ? " · this week" : "";
              loads.appendChild(loadRow(ex.name, group.source + " — " + p.label + mark, Number.isFinite(max) ? roundLb(max * p.percent / 100) + " lb" : "enter a max"));
            });
          });
          if (ex.percentRange) {
            const r = ex.percentRange;
            const text = Number.isFinite(max)
              ? roundLb(max * r.low / 100) + "–" + roundLb(max * r.high / 100) + " lb"
              : "enter a max";
            loads.appendChild(loadRow(ex.name, r.label, text));
          }
          if (ex.percentOfA1) {
            const a1 = (section.exercises || []).find((e) => e.order === "A1");
            const a1key = a1 && (a1.maxKey || a1.name);
            const a1max = a1key ? parseFloat(bucket[a1key]) : NaN;
            const p = directPercents(a1 || {}, week.number)[0];
            if (p && Number.isFinite(a1max)) {
              const a1load = a1max * p.percent / 100;
              const lo = roundLb(a1load * ex.percentOfA1.low / 100);
              const hi = roundLb(a1load * ex.percentOfA1.high / 100);
              loads.appendChild(loadRow(ex.name, ex.percentOfA1.label + " (of today’s A1 load at " + p.label + ")", lo + "–" + hi + " lb"));
            } else {
              loads.appendChild(loadRow(ex.name, ex.percentOfA1.label, "needs the A1 max"));
            }
          }
          if (ex.effortByWeek && ex.effortByWeek[String(week.number)]) {
            loads.appendChild(loadRow(ex.name, "Effort, as written", ex.effortByWeek[String(week.number)]));
          }
        });
      });
    }
    function loadRow(name, label, value) {
      return h("div", { class: "load" }, h("span", null, name + " — " + label), h("b", null, value));
    }
    box.appendChild(loads);
    paintLoads();
    return box;
  }

  function exerciseBlock(ex, week) {
    const bits = [];
    bits.push(h("p", { class: "rx" },
      (ex.order ? ex.order + " · " : "") +
      (ex.sets ? ex.sets + " × " : "Sets not printed · ") +
      (ex.reps || "reps not printed")
    ));
    const a1 = ex.repsByWeek && week && ex.repsByWeek[String(week.number)];
    if (a1) bits.push(h("p", null, "This week, schedule total: " + a1));
    if (ex.loadText) bits.push(h("p", null, ex.loadText));
    if (ex.tempo) bits.push(h("p", { class: "tempo" }, ex.tempo));
    if (ex.rom) bits.push(h("p", null, "Range: " + ex.rom));
    bits.push(mountDemos(ex.demos));
    if (ex.cues && ex.cues.length) {
      const ul = h("ul", { class: "cues" });
      ex.cues.forEach((c) => ul.appendChild(h("li", null, c)));
      bits.push(ul);
    }
    if (ex.benefits && ex.benefits.length) {
      const ul = h("ul", { class: "benefits" });
      ex.benefits.forEach((c) => ul.appendChild(h("li", null, c)));
      bits.push(ul);
    }
    bits.push(notes(ex.sourceNotes));
    return bits;
  }

  function sheet(phase, week, day) {
    const root = h("article", { class: "print-sheet" });
    root.appendChild(h("p", { class: "kicker" }, "William Byrd Baseball · Lifts"));
    root.appendChild(h("h1", null, phase.title + " · " + week.label));
    root.appendChild(h("h2", null, day.title));
    root.appendChild(h("p", null, program.credit));
    if (day.kind === "rest") {
      append(root, quotes(day.quotes));
      append(root, notes(day.sourceNotes));
      return root;
    }
    (day.schedule || []).forEach((line) => root.appendChild(h("p", { class: "meta" }, line)));
    const a1 = day.a1ByWeek && day.a1ByWeek[String(week.number)];
    if (a1) root.appendChild(h("p", { class: "quote" }, "This week, main lift: " + a1.text));
    (day.guidelines || []).forEach((g) => root.appendChild(h("p", { class: "quote" }, g)));
    root.appendChild(h("h3", null, "PEP Warm-Up"));
    program.warmup.phases.forEach((p) => root.appendChild(h("p", null, p.name + ": " + p.instructions)));
    (day.sections || []).forEach((section) => {
      root.appendChild(h("h3", { class: "section-h" }, section.title));
      if (section.rest) {
        const r = section.rest;
        if (r.betweenExercises) root.appendChild(h("p", null, r.betweenExercises.quote || r.betweenExercises.label));
        if (r.betweenSets) root.appendChild(h("p", null, r.betweenSets.quote || r.betweenSets.label));
        if (r.during) root.appendChild(h("p", null, r.during));
      }
      (section.exercises || []).forEach((ex) => {
        const box = h("section", { class: "check" });
        box.appendChild(h("div", null, h("h3", { class: "ex-name", style: "font-size:1.5rem" }, ex.name), exerciseBlock(ex, week)));
        root.appendChild(box);
      });
    });
    if (day.closer) root.appendChild(h("p", { class: "quote" }, day.closer));
    append(root, notes(day.sourceNotes));
    const qrBox = h("div", { class: "qr", id: "qr" });
    root.appendChild(h("p", { class: "meta" }, "Coach mode for this day"));
    root.appendChild(qrBox);
    return root;
  }

  function drawQr(url) {
    const slot = document.getElementById("qr");
    if (!slot || typeof qrcode !== "function") return;
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    slot.innerHTML = qr.createSvgTag(4, 2);
  }

  function stepsFor(day) {
    if (day.kind === "rest") return [{ kind: "rest", title: day.title, quotes: day.quotes || [], notes: day.sourceNotes || [] }];
    const steps = [];
    program.warmup.phases.forEach((phase) => {
      if (phase.id === "agility") {
        phase.exercises.forEach((ex) => steps.push({ kind: "warmup", phase: phase, exercise: ex, sectionId: "warmup-agility" }));
      } else {
        steps.push({ kind: "warmup", phase: phase, sectionId: "warmup-" + phase.id });
      }
    });
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((ex, index) => {
        steps.push({ kind: "exercise", section: section, exercise: ex, index: index });
      });
    });
    if (day.closer) steps.push({ kind: "closer", text: day.closer });
    return steps;
  }

  function restChoices(step, steps, idx, day) {
    const choices = [];
    const ex = step.exercise;
    const section = step.section;
    if (ex && ex.cluster) choices.push({ label: "Between cluster reps · " + ex.cluster.quote, presets: ex.cluster.presets });
    if (ex && ex.restHint) choices.push({ label: ex.restHint.label, presets: ex.restHint.presets });
    if (ex && ex.hold) return [{ label: "Hold — count up", countUp: true, presets: [] }];
    if (section && !section.rest && step.kind === "exercise") {
      const next = steps[idx + 1];
      const same = next && next.section && next.section.id === section.id;
      const guide = ((day && day.guidelines) || []).join(" ");
      if (same && guide.indexOf("15-30 seconds") !== -1) {
        choices.push({
          label: "15-30 seconds rest between exercises",
          presets: [15, 30]
        });
      }
      return choices;
    }
    if (!section || !section.rest) return choices;
    const next = steps[idx + 1];
    const same = next && next.section && next.section.id === section.id;
    const rest = section.rest;
    let useShort = false;
    if (same && section.kind === "complex") {
      const between = rest.between;
      if (next.exercise && next.exercise.duringRest) useShort = false;
      else if (between === "A1-A2") useShort = ex.order === "A1" && next.exercise && next.exercise.order === "A2";
      else useShort = true;
    } else if (same && rest.betweenExercises && section.kind !== "complex") useShort = true;
    if (useShort && rest.betweenExercises) {
      choices.push({ label: rest.betweenExercises.quote || rest.betweenExercises.label, presets: rest.betweenExercises.presets });
    }
    const during = ex && ex.duringRest;
    if (!during && (!useShort || !same) && rest.betweenSets && step.kind === "exercise") {
      choices.push({ label: rest.betweenSets.quote || rest.betweenSets.label, presets: rest.betweenSets.presets });
    }
    return choices;
  }

  function fmt(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m) + ":" + String(r).padStart(2, "0");
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep() {
    try {
      ensureAudio();
      if (!audioCtx) return;
      [0, 0.22].forEach((offset) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + offset);
        o.stop(audioCtx.currentTime + offset + 0.16);
      });
    } catch (e) { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function stopTimer() {
    timer.running = false;
    if (timer.handle) cancelAnimationFrame(timer.handle);
    timer.handle = null;
  }
  function startCountdown(seconds, label) {
    ensureAudio();
    stopTimer();
    timer.mode = "down";
    timer.remaining = seconds;
    timer.label = label;
    timer.endsAt = Date.now() + seconds * 1000;
    timer.running = true;
    tick();
  }
  function startCountUp() {
    ensureAudio();
    stopTimer();
    timer.mode = "up";
    timer.elapsed = 0;
    timer.startedAt = Date.now();
    timer.running = true;
    timer.label = "Hold";
    tick();
  }
  function tick() {
    if (!timer.running) return;
    if (timer.mode === "down") {
      const left = Math.ceil((timer.endsAt - Date.now()) / 1000);
      if (left <= 0) {
        timer.remaining = 0;
        timer.running = false;
        paintDigits();
        beep();
        return;
      }
      timer.remaining = left;
    } else {
      timer.elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    }
    paintDigits();
    timer.handle = requestAnimationFrame(() => setTimeout(tick, 200));
  }
  function paintDigits() {
    const el = document.getElementById("digits");
    if (!el) return;
    el.textContent = timer.mode === "up" ? fmt(timer.elapsed) : fmt(timer.remaining);
  }

  async function requestWake() {
    if (!navigator.wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { wakeLock = null; }
  }
  function releaseWake() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener("visibilitychange", () => {
    const route = parseRoute();
    if (document.visibilityState === "visible" && route.view === "coach") requestWake();
  });

  function renderDay(route) {
    const phase = phaseByNumber(route.phase);
    const week = phase && weekObj(phase, route.week);
    const day = phase && week && findDay(phase, week, route.day);
    if (!phase || !week || !day) return missing();
    if (route.view === "coach") return renderCoach(phase, week, day);
    if (route.view === "stations") return renderStations(phase, week, day);

    app.appendChild(h("p", { class: "kicker" }, phase.title + " · " + week.label));
    app.appendChild(h("h1", { style: "font-size:clamp(2rem,6vw,3.4rem)" }, day.title));
    app.appendChild(h("p", { class: "lead" }, day.role || ""));
    const tools = h("div", { class: "row noprint" });
    if (day.kind !== "rest") {
      tools.appendChild(h("a", { class: "btn primary", href: dayHash(phase, week, day, "coach") }, "Coach mode"));
      tools.appendChild(h("a", { class: "btn", href: dayHash(phase, week, day, "stations") }, "Station grid"));
    }
    tools.appendChild(h("button", { class: "btn", type: "button", onclick: () => window.print() }, "Print day sheet"));
    const link = abs(dayHash(phase, week, day, "coach"));
    tools.appendChild(h("button", {
      class: "btn", type: "button",
      onclick: () => { if (navigator.clipboard) navigator.clipboard.writeText(link); }
    }, "Copy coach link"));
    app.appendChild(tools);
    const weekRow = h("div", { class: "row noprint" });
    phase.weeks.filter((w) => w.daySet === week.daySet).forEach((w) => {
      weekRow.appendChild(h("a", { class: "chip" + (w.number === week.number ? " on" : ""), href: dayHash(phase, w, day) }, w.label));
    });
    app.appendChild(weekRow);

    if (day.kind === "rest") {
      append(app, quotes(day.quotes));
      append(app, notes(day.sourceNotes));
      app.appendChild(sheet(phase, week, day));
      drawQr(link);
      return;
    }

    (day.schedule || []).forEach((line) => app.appendChild(h("p", { class: "meta" }, line)));
    const a1 = day.a1ByWeek && day.a1ByWeek[String(week.number)];
    if (a1) app.appendChild(h("p", { class: "quote" }, "This week: " + a1.text));
    app.appendChild(modeToggle());
    (day.guidelines || []).forEach((g) => app.appendChild(h("p", { class: "quote" }, g)));
    app.appendChild(renderCalculator(phase, week, day));

    app.appendChild(h("h2", { class: "section-h" }, "PEP Warm-Up"));
    program.warmup.phases.forEach((p) => {
      app.appendChild(h("p", null, h("a", { href: "#/warmup" }, p.name), " — " + p.instructions));
    });

    (day.sections || []).forEach((section) => {
      app.appendChild(h("h2", { class: "section-h" }, section.title));
      if (section.note) app.appendChild(h("p", null, section.note));
      if (section.image) app.appendChild(h("img", { src: section.image, alt: "Still from the source files for " + section.title }));
      if (section.rest) {
        const r = section.rest;
        if (r.betweenExercises) app.appendChild(h("p", { class: "meta" }, r.betweenExercises.quote || r.betweenExercises.label));
        if (r.betweenSets) app.appendChild(h("p", { class: "meta" }, r.betweenSets.quote || r.betweenSets.label));
        if (r.during) app.appendChild(h("p", null, r.during));
        if (r.alsoQuoted) app.appendChild(h("p", { class: "meta" }, r.alsoQuoted));
      }
      (section.exercises || []).forEach((ex, i) => {
        const key = phase.id + week.number + day.id + section.id + i;
        const box = h("div", { class: "check" });
        const input = h("input", { type: "checkbox", "aria-label": "Done: " + ex.name });
        const saved = sessionStorage.getItem("check-" + key) === "1";
        input.checked = saved;
        input.addEventListener("change", () => sessionStorage.setItem("check-" + key, input.checked ? "1" : "0"));
        box.appendChild(input);
        const body = h("div");
        body.appendChild(h("a", { class: "ex-name", href: "#/exercise/" + slug(ex.name), style: "text-decoration:none;color:inherit" }, ex.name));
        if (ex.duringRest) body.appendChild(h("p", { class: "kicker" }, "During the rest"));
        append(body, exerciseBlock(ex, week));
        box.appendChild(body);
        app.appendChild(box);
      });
    });
    if (day.closer) app.appendChild(h("p", { class: "quote" }, day.closer));
    append(app, notes(day.sourceNotes));
    const qrWrap = h("div", { class: "qr-panel" });
    qrWrap.appendChild(h("p", null, "QR opens coach mode for this day."));
    qrWrap.appendChild(h("div", { class: "qr", id: "qr" }));
    qrWrap.appendChild(h("p", { class: "meta" }, link));
    app.appendChild(qrWrap);
    drawQr(link);
    app.appendChild(credit());
  }

  function renderStations(phase, week, day) {
    app.appendChild(h("div", { class: "coach-top noprint" },
      h("a", { class: "btn", href: dayHash(phase, week, day) }, "Player view"),
      h("a", { class: "btn primary", href: dayHash(phase, week, day, "coach") }, "Coach mode")
    ));
    app.appendChild(h("h1", null, week.label + " · " + day.title));
    app.appendChild(h("p", { class: "meta" }, "Whole block at once, for a TV or a rotating group."));
    (day.sections || []).forEach((section) => {
      app.appendChild(h("h2", { class: "section-h" }, section.title));
      const grid = h("div", { class: "stations" });
      (section.exercises || []).forEach((ex) => {
        grid.appendChild(h("article", { class: "station" },
          h("p", { class: "kicker" }, ex.order || section.title),
          h("h3", null, ex.name),
          h("p", { class: "rx" }, (ex.sets || "—") + " × " + (ex.reps || "—")),
          ex.loadText ? h("p", null, ex.loadText) : null,
          ex.tempo ? h("p", null, ex.tempo) : null,
          h("ul", { class: "cues" }, (ex.cues || []).slice(0, 3).map((c) => h("li", null, c)))
        ));
      });
      app.appendChild(grid);
    });
  }

  function renderCoach(phase, week, day) {
    requestWake();
    const steps = stepsFor(day);
    let idx = parseInt(sessionStorage.getItem("step-" + phase.id + week.number + day.id) || "0", 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= steps.length) idx = 0;
    const step = steps[idx];

    function setIdx(next) {
      idx = Math.max(0, Math.min(steps.length - 1, next));
      sessionStorage.setItem("step-" + phase.id + week.number + day.id, String(idx));
      stopTimer();
      render();
    }

    app.appendChild(h("div", { class: "coach-top noprint" },
      h("a", { class: "btn", href: dayHash(phase, week, day) }, "Exit"),
      h("span", { class: "progress" }, (idx + 1) + " / " + steps.length + " · " + week.label),
      modeToggle(),
      h("a", { class: "btn", href: dayHash(phase, week, day, "stations") }, "Stations")
    ));
    app.appendChild(h("p", { class: "meta coach-phase-line" }, phase.title + " · " + day.title));

    if (step.kind === "exercise" && step.section && step.section.kind === "complex") {
      const strip = h("div", { class: "strip", "aria-label": "Complex order" });
      step.section.exercises.forEach((ex, i) => {
        const on = ex === step.exercise;
        strip.appendChild(h("button", {
          type: "button",
          class: on ? "now" : "",
          onclick: () => {
            const at = steps.findIndex((s) => s.exercise === ex);
            if (at >= 0) setIdx(at);
          }
        }, h("span", null, on ? "Now" : (i === step.index + 1 ? "Next" : "Then")), h("strong", null, (ex.order || "") + " " + ex.name)));
      });
      app.appendChild(strip);
    } else {
      const strip = h("div", { class: "strip" });
      [-1, 0, 1].forEach((delta) => {
        const s = steps[idx + delta];
        if (!s) return;
        const label = delta < 0 ? "Prev" : delta === 0 ? "Now" : "Next";
        const name = s.kind === "warmup" ? (s.exercise ? s.exercise.name : s.phase.name) : s.kind === "closer" ? "Foam roll & stretch" : s.kind === "rest" ? "Rest" : s.exercise.name;
        strip.appendChild(h("button", { type: "button", class: delta === 0 ? "now" : "", onclick: () => setIdx(idx + delta) },
          h("span", null, label), h("strong", null, name)));
      });
      app.appendChild(strip);
    }

    const layout = h("div", { class: "coach-layout" });
    const card = h("article", { class: "coach-card" });
    if (step.kind === "warmup") {
      const drill = step.exercise;
      card.appendChild(h("p", { class: "kicker" }, "PEP Warm-Up · " + step.phase.name));
      if (drill) append(card, mountDemos(drill.demos));
      card.appendChild(h("h1", { class: "ex-name" }, drill ? drill.name : step.phase.name));
      card.appendChild(h("p", { class: "tempo" }, step.phase.instructions));
      if (step.phase.id === "agility") card.appendChild(h("p", null, program.warmup.setup));
      if (drill) {
        if (drill.howToTitle) card.appendChild(h("p", { class: "kicker" }, drill.howToTitle));
        if (drill.howTo) {
          const ul = h("ul", { class: "cues" });
          drill.howTo.forEach((line) => ul.appendChild(h("li", null, line)));
          card.appendChild(ul);
        }
        if (drill.benefits) {
          const ul = h("ul", { class: "benefits" });
          drill.benefits.forEach((line) => ul.appendChild(h("li", null, line)));
          card.appendChild(ul);
        }
        append(card, notes(drill.sourceNotes));
      } else {
        const ul = h("ul", { class: "cues" });
        step.phase.exercises.forEach((ex) => ul.appendChild(h("li", null, ex.name)));
        card.appendChild(ul);
        step.phase.exercises.forEach((ex) => {
          if (ex.benefits && ex.benefits.length) {
            card.appendChild(h("h3", { style: "margin-top:12px" }, ex.name));
            const bl = h("ul", { class: "benefits" });
            ex.benefits.forEach((line) => bl.appendChild(h("li", null, line)));
            card.appendChild(bl);
            append(card, notes(ex.sourceNotes));
          }
        });
      }
      const liftAt = steps.findIndex((s) => s.kind === "exercise");
      if (liftAt > idx) {
        card.appendChild(h("button", { class: "btn noprint", type: "button", onclick: () => setIdx(liftAt) }, "Skip to the lift"));
      }
      append(card, notes(step.phase.sourceNotes));
    } else if (step.kind === "rest") {
      card.appendChild(h("h1", { class: "ex-name" }, step.title));
      append(card, quotes(step.quotes));
      append(card, notes(step.notes));
    } else if (step.kind === "closer") {
      card.appendChild(h("p", { class: "kicker" }, "Closer"));
      card.appendChild(h("h1", { class: "ex-name" }, "Foam roll & stretch"));
      card.appendChild(h("p", { class: "rx-big" }, step.text));
    } else {
      const ex = step.exercise;
      card.appendChild(h("p", { class: "kicker" }, (ex.order || step.section.title) + (ex.duringRest ? " · during the rest" : "")));
      append(card, mountDemos(ex.demos));
      card.appendChild(h("h1", { class: "ex-name" }, ex.name));
      const a1 = day.a1ByWeek && day.a1ByWeek[String(week.number)];
      let rx = (ex.sets ? ex.sets + " sets" : "Sets not printed") + "  ×  " + (ex.reps || "reps not printed");
      if (ex.repsByWeek && ex.repsByWeek[String(week.number)]) rx += "  ·  " + ex.repsByWeek[String(week.number)];
      card.appendChild(h("p", { class: "rx-big" }, rx));
      const ul = h("ul", { class: "cues" });
      (ex.cues || []).forEach((c) => ul.appendChild(h("li", null, c)));
      card.appendChild(ul);
      if (ex.tempo) card.appendChild(h("p", { class: "tempo" }, ex.tempo));
      if (ex.rom) card.appendChild(h("p", null, ex.rom));
      if (a1 && ex.order === "A1" && (ex.percents || ex.percentGroups || ex.effortByWeek)) {
        card.appendChild(h("p", { class: "quote" }, a1.text));
      }
      if (ex.loadText) card.appendChild(h("p", null, ex.loadText));
      if (step.section.image && step.index === 0) {
        card.appendChild(h("img", { src: step.section.image, alt: "Source still for " + step.section.title, style: "max-height:240px;margin-top:8px;border-radius:8px" }));
      }
      append(card, notes(ex.sourceNotes));
      const setKey = phase.id + ":" + week.number + ":" + day.id + ":" + idx;
      let count = parseInt(store.sets[setKey] || "0", 10) || 0;
      const setLine = h("p", { class: "set-count" }, "Sets done: " + count);
      const setBox = h("div", { class: "set-actions" });
      function paintSets() {
        setLine.textContent = "Sets done: " + count + (ex.sets ? "  (written: " + ex.sets + ")" : "");
      }
      paintSets();
      setBox.appendChild(h("button", { class: "btn", type: "button", onclick: () => { count = Math.max(0, count - 1); store.sets[setKey] = count; saveStore(); paintSets(); } }, "− set"));
      setBox.appendChild(h("button", { class: "btn primary", type: "button", onclick: () => { count += 1; store.sets[setKey] = count; saveStore(); paintSets(); } }, "+ set"));
      card.appendChild(setLine);
      card.appendChild(setBox);
      if (ex.hold) {
        const holdKey = ex.name;
        const saved = store.holds[holdKey];
        card.appendChild(h("p", { class: "meta" }, saved ? "Last hold on this device: " + saved : "Hold time is saved on this device only."));
        card.appendChild(h("button", {
          class: "btn", type: "button",
          onclick: () => {
            store.holds[holdKey] = fmt(timer.elapsed || 0) + " (" + new Date().toLocaleString() + ")";
            saveStore();
            render();
          }
        }, "Save this hold time"));
      }
    }
    layout.appendChild(card);

    const side = h("div");
    const choices = restChoices(step, steps, idx, day);
    const timerBox = h("div", { class: "timer", id: "timer-box" });
    timerBox.appendChild(h("p", { class: "kicker" }, "Rest"));
    timerBox.appendChild(h("div", { class: "digits", id: "digits", "aria-live": "polite" }, timer.mode === "up" && timer.running ? fmt(timer.elapsed) : fmt(timer.remaining)));
    timerBox.appendChild(h("p", { id: "timer-label", class: "meta" }, timer.label || (choices[0] ? choices[0].label : "No rest time is printed for this step.")));
    const actions = h("div", { class: "timer-actions" });
    choices.forEach((choice) => {
      if (choice.countUp) {
        actions.appendChild(h("button", { class: "btn primary", type: "button", onclick: () => { startCountUp(); document.getElementById("timer-label").textContent = choice.label; } }, "Start hold"));
      } else {
        (choice.presets || []).forEach((sec, n) => {
          actions.appendChild(h("button", {
            class: n === 0 ? "btn primary" : "btn",
            type: "button",
            onclick: () => { startCountdown(sec, choice.label); const lab = document.getElementById("timer-label"); if (lab) lab.textContent = choice.label; }
          }, "Start " + fmt(sec)));
        });
      }
    });
    actions.appendChild(h("button", { class: "btn", type: "button", onclick: () => { timer.running = !timer.running; if (timer.running) { if (timer.mode === "down") timer.endsAt = Date.now() + timer.remaining * 1000; else timer.startedAt = Date.now() - timer.elapsed * 1000; tick(); } else stopTimer(); } }, "Pause"));
    actions.appendChild(h("button", { class: "btn", type: "button", onclick: () => { stopTimer(); timer.remaining = 0; timer.elapsed = 0; paintDigits(); } }, "Reset"));
    timerBox.appendChild(actions);
    if (!navigator.wakeLock) timerBox.appendChild(h("p", { class: "meta" }, "This browser does not expose the Wake Lock API. The screen may sleep."));
    else timerBox.appendChild(h("p", { class: "meta" }, "Screen stay-awake is requested in coach mode."));
    side.appendChild(timerBox);
    const details = h("details", { class: "calc-details noprint" });
    if (window.innerWidth >= 980) details.setAttribute("open", "");
    details.appendChild(h("summary", null, "Percentages"));
    details.appendChild(renderCalculator(phase, week, day));
    side.appendChild(details);
    layout.appendChild(side);
    app.appendChild(layout);

    const dock = h("div", { class: "dock noprint" });
    dock.appendChild(h("button", { class: "btn", type: "button", onclick: () => setIdx(idx - 1), disabled: idx === 0 }, "Previous"));
    dock.appendChild(h("button", { class: "btn primary", type: "button", onclick: () => setIdx(idx + 1), disabled: idx === steps.length - 1 }, "Next"));
    app.appendChild(dock);

    const print = sheet(phase, week, day);
    print.classList.add("for-print");
    app.appendChild(print);
    drawQr(abs(dayHash(phase, week, day, "coach")));

    let touchX = null;
    app.ontouchstart = (e) => { touchX = e.changedTouches[0].clientX; };
    app.ontouchend = (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 60) setIdx(idx + (dx < 0 ? 1 : -1));
      touchX = null;
    };
  }

  document.addEventListener("keydown", (e) => {
    const route = parseRoute();
    if (route.view !== "coach") return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); document.querySelector(".dock .primary") && document.querySelector(".dock .btn.primary").click(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); const b = document.querySelector(".dock .btn"); if (b) b.click(); }
    if (e.key === "Escape") go(location.hash.replace(/\/(coach|stations)$/, ""));
  });

  window.addEventListener("hashchange", () => { stopTimer(); if (parseRoute().view !== "coach") releaseWake(); render(); });

  fetch("data/program.json")
    .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
    .then((data) => {
      program = data;
      document.title = data.title || document.title;
      render();
      if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    })
    .catch(() => {
      clear(app);
      app.appendChild(h("h1", null, "The program file did not load"));
      app.appendChild(h("p", null, "data/program.json needs to be served with this page."));
    });
})();
