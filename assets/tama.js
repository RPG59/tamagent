/* Тамагент film: shared, deterministic drawing helpers. Everything is a pure function of time. */
window.Tama = (function () {
  const C = { ink: "#0C0A16", panel: "#15122A", amber: "#FFB224", cream: "#F4ECDD", alarm: "#FF4B5C", muted: "#8F88A8", glass: "#07060C" };
  const GW = 40, GH = 30; // the device screen is 4:3, 40 × 30 logical pixels

  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1); // 0..1 progress of t between a and b

  /* Timing plan (window.PLAN from assets/plan.js): absolute time of a spoken word, and cue-local time. */
  function at(take, word, nth) {
    const tk = window.PLAN.takes.find((x) => x.id === take);
    const hits = tk.words.filter((w) => w[0].toLowerCase() === word.toLowerCase());
    if (!hits.length) throw new Error("no word " + word + " in " + take);
    return hits[nth || 0][1];
  }
  const local = (cue, take, word, nth) => at(take, word, nth) - window.PLAN.cues[cue].start;
  const takeStart = (cue, take) => window.PLAN.takes.find((x) => x.id === take).start - window.PLAN.cues[cue].start;
  const takeEnd = (cue, take) => { const k = window.PLAN.takes.find((x) => x.id === take); return k.start + k.dur - window.PLAN.cues[cue].start; };

  /* One proxy tween per scene: GSAP writes p.t on every seek, the setter redraws. No callbacks, so it survives silent seeks. */
  function drive(tl, dur, fn) {
    const p = {}; let v = 0;
    Object.defineProperty(p, "t", { get: () => v, set: (x) => { v = x; fn(x); } });
    tl.to(p, { t: dur, duration: dur, ease: "none" }, 0);
    fn(0);
  }

  /* The creature: a cursor block that grew a face. Returns a Set of lit "x,y" cells on the 40 × 30 grid. */
  function sprite(o) {
    const state = o.state || "idle", stage = o.stage == null ? 1 : o.stage, t = o.t || 0;
    const lit = new Set();
    const put = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < GW && y < GH) lit.add(x + "," + y); };
    const cut = (x, y) => lit.delete(Math.round(x) + "," + Math.round(y));
    const beat = (hz) => Math.floor(t * hz);
    const [w, hh] = [[6, 8], [10, 9], [12, 10], [14, 12]][stage];
    let dx = 0, dy = 0, eyes = "open", mouth = "flat", armL = "down", armR = "down", look = o.look || 0;
    if (state === "block") { eyes = "none"; mouth = "none"; }
    else if (state === "wake") { eyes = "open"; mouth = "none"; }
    else if (state === "idle") { dy = beat(1.5) % 2 ? -1 : 0; eyes = t % 2.9 > 2.74 ? "blink" : "open"; mouth = "flat"; }
    else if (state === "work") { eyes = "down"; mouth = "none"; armL = beat(8) % 2 ? "type" : "down"; armR = beat(8) % 2 ? "down" : "type"; }
    else if (state === "call") { const ph = (t * 2.2) % 1; dy = ph < 0.55 ? -Math.round(Math.sin((ph / 0.55) * Math.PI) * 3) : 0; armR = beat(7) % 2 ? "up" : "wave"; mouth = "open"; }
    else if (state === "happy") { const ph = (t * 2.6) % 1; dy = -Math.round(Math.sin(ph * Math.PI) * 3); armL = "up"; armR = "up"; eyes = "happy"; mouth = "smile"; }
    else if (state === "alarm") { dx = beat(14) % 2 ? 1 : -1; eyes = "x"; mouth = "zig"; armL = beat(9) % 2 ? "up" : "wave"; armR = beat(9) % 2 ? "wave" : "up"; }
    else if (state === "sleep") { dy = 1; eyes = "blink"; mouth = "none"; }
    else if (state === "sad") { dy = 1; eyes = "down"; mouth = "frown"; }
    if (o.dy != null) dy += o.dy;
    const cx = (o.cx == null ? 20 : o.cx) + dx, yb = (o.baseY == null ? 22 : o.baseY) + dy;
    const x0 = cx - Math.floor(w / 2), x1 = x0 + w - 1, yt = yb - hh + 1;
    for (let y = yt; y <= yb; y++) for (let x = x0; x <= x1; x++) put(x, y);
    if (stage > 0) { cut(x0, yt); cut(x1, yt); cut(x0, yb); cut(x1, yb); }
    if (stage > 0) { // feet and arms
      const air = dy < 0;
      if (!(air && beat(9) % 2)) { put(x0 + 1, yb + 1); put(x0 + 2, yb + 1); }
      if (!(air && !(beat(9) % 2))) { put(x1 - 2, yb + 1); put(x1 - 1, yb + 1); }
      const ya = yt + Math.round(hh * 0.55);
      const arm = (side, mode) => {
        const ax = side < 0 ? x0 - 1 : x1 + 1;
        if (mode === "down") { put(ax, ya); put(ax, ya + 1); }
        else if (mode === "type") { put(ax, ya + 1); put(ax + side, ya + 2); }
        else if (mode === "up") { put(ax, ya - 1); put(ax + side, ya - 2); put(ax + side, ya - 3); }
        else if (mode === "wave") { put(ax, ya - 1); put(ax + side, ya - 1); put(ax + 2 * side, ya - 2); }
      };
      arm(-1, armL); arm(1, armR);
    }
    if (stage >= 2) { put(cx, yt - 1); put(cx, yt - 2); if (beat(2) % 2 || state === "call" || state === "alarm") put(cx, yt - 3); }
    if (stage >= 3) { put(x0 + 1, yt - 1); put(x0 + 2, yt - 1); put(x1 - 1, yt - 1); put(x1 - 2, yt - 1); }
    // face
    const ey = yt + (stage === 3 ? 3 : 2);
    const ew = stage === 0 ? 1 : 2, eh = stage === 0 ? 2 : 3;
    const eL = (stage === 0 ? x0 + 1 : x0 + 2) + look, eR = (stage === 0 ? x1 - 1 : x1 - 2 - (ew - 1)) + look;
    const wideL = x0 + 1, wideR = x1 - 3;
    if (eyes === "open") for (const ex of [eL, eR]) for (let i = 0; i < ew; i++) for (let j = 0; j < eh; j++) cut(ex + i, ey + j);
    else if (eyes === "blink") for (const ex of [eL, eR]) for (let i = 0; i < ew; i++) cut(ex + i, ey + 1);
    else if (eyes === "down") for (const ex of [eL, eR]) for (let i = 0; i < ew; i++) for (let j = 1; j < eh; j++) cut(ex + i, ey + j);
    else if (eyes === "happy") for (const ex of [wideL, wideR]) { cut(ex, ey + 1); cut(ex + 1, ey); cut(ex + 2, ey + 1); }
    else if (eyes === "x") for (const ex of [wideL, wideR]) { cut(ex, ey); cut(ex + 2, ey); cut(ex + 1, ey + 1); cut(ex, ey + 2); cut(ex + 2, ey + 2); }
    const my = ey + eh + 1, mx = cx;
    if (mouth === "flat") { cut(mx - 1, my); cut(mx, my); }
    else if (mouth === "smile") { cut(mx - 2, my); cut(mx - 1, my + 1); cut(mx, my + 1); cut(mx + 1, my); }
    else if (mouth === "frown") { cut(mx - 2, my + 1); cut(mx - 1, my); cut(mx, my); cut(mx + 1, my + 1); }
    else if (mouth === "open") { cut(mx - 1, my); cut(mx, my); cut(mx - 1, my + 1); cut(mx, my + 1); }
    else if (mouth === "zig") { cut(mx - 2, my); cut(mx - 1, my + 1); cut(mx, my); cut(mx + 1, my + 1); }
    return lit;
  }

  /* Status glyphs that sit at the edges of the device screen, around the creature. */
  function extras(o, lit) {
    const t = o.t || 0, s = o.state, put = (x, y) => lit.add(x + "," + y), beat = (hz) => Math.floor(t * hz);
    if (o.extras === false) return;
    const bang = (bx) => { for (let y = 5; y <= 12; y++) { put(bx, y); put(bx + 1, y); } put(bx, 15); put(bx + 1, 15); put(bx, 16); put(bx + 1, 16); };
    if (s === "work") { const head = beat(12) % 40; for (let x = 3; x < 37; x++) if ((x - head + 40) % 40 < 9) { put(x, 28); } for (let i = 0; i <= beat(3) % 3; i++) { put(32 + i * 2, 4); } }
    if (s === "call" && beat(4) % 2) { bang(2); bang(36); }
    if (s === "happy") { [[30, 4], [31, 5], [32, 6], [33, 5], [34, 4], [35, 3], [36, 2]].forEach(([x, y]) => { put(x, y); put(x, y + 1); }); for (let i = 0; i < 10; i++) { if (hash(i * 7 + beat(6)) > 0.5) put((i % 2 ? 33 : 1) + Math.floor(hash(i * 13 + 1) * 6), 9 + Math.floor(hash(i * 5 + 2) * 18)); } }
    if (s === "alarm") { if (beat(6) % 2) for (let x = 0; x < 40; x += 2) { put(x, 0); put(x + 1, 29); } bang(2); bang(36); }
    if (s === "sleep") { const k = beat(1.2) % 2; [[31, 6], [32, 6], [33, 6], [32, 7], [31, 8], [32, 8], [33, 8]].forEach(([x, y]) => put(x, y - k)); [[35, 2], [36, 2], [35, 3], [36, 3]].forEach(([x, y]) => k && put(x, y)); }
  }

  /* Draw the device screen (or, with bare:true, only the creature on transparency). */
  function drawScreen(cv, o) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, px = W / GW;
    ctx.clearRect(0, 0, W, H);
    const col = o.color || (o.state === "alarm" ? C.alarm : C.amber);
    if (!o.bare) {
      ctx.fillStyle = C.glass; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,178,36,0.05)";
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) ctx.fillRect(x * px + px * 0.14, y * px + px * 0.14, px * 0.72, px * 0.72);
    }
    const power = o.power == null ? 1 : o.power;
    if (power <= 0.001) return;
    let lit = sprite(o);
    if (o.zoom === 2) { // chunky creature for the small device screen: every sprite cell becomes 2 × 2 cells
      const big = new Set();
      sprite(Object.assign({}, o, { cx: 10 + (o.cx == null ? 0 : (o.cx - 20) / 2), baseY: 11 })).forEach((k) => { const [x, y] = k.split(",").map(Number); for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (2 * x + i < GW && 2 * y + j < GH) big.add((2 * x + i) + "," + (2 * y + j)); });
      lit = big;
    }
    extras(o, lit);
    ctx.globalAlpha = clamp(power, 0, 1); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = px * (o.bare ? 0.5 : 0.9);
    lit.forEach((k) => { const [x, y] = k.split(",").map(Number); ctx.fillRect(x * px + px * 0.07, y * px + px * 0.07, px * 0.86, px * 0.86); });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  /* Device picture. Places a plate (Blender still + glow pass) so that screen 0 lands on {x,y,w} in host pixels,
     and puts a live canvas on every screen. Without plates it draws the device in CSS around the same rectangles. */
  const FALLBACK = {
    hero: { w: 3840, h: 2160, screens: [{ x: 1620, y: 700, w: 600, h: 450, r: 22 }] },
    desk: { w: 3840, h: 2160, screens: [{ x: 2400, y: 860, w: 480, h: 360, r: 18 }] },
    team: { w: 3840, h: 2160, screens: [{ x: 1640, y: 980, w: 560, h: 420, r: 20 }, { x: 760, y: 900, w: 400, h: 300, r: 15 }, { x: 2700, y: 900, w: 400, h: 300, r: 15 }, { x: 180, y: 840, w: 290, h: 218, r: 11 }, { x: 3380, y: 840, w: 290, h: 218, r: 11 }] },
  };
  function plate(host, o) {
    const real = (window.PLATES || {})[o.plate], P = real || FALLBACK[o.plate], s0 = P.screens[0];
    if (o.fit) { const kf = o.fit / P.w; o = Object.assign({}, o, { x: s0.x * kf, y: s0.y * kf, w: s0.w * kf }); } // fit: the plate fills a frame `fit` px wide
    const k = o.w / s0.w;
    const box = document.createElement("div"); box.className = "tm-plate";
    box.style.cssText = `position:absolute;left:${o.x - s0.x * k}px;top:${o.y - s0.y * k}px;width:${P.w * k}px;height:${P.h * k}px;`;
    if (real && !o.fit) { // a single device: fade the plate into the scene around it
      const m = `radial-gradient(ellipse 34% 56% at ${((s0.x + s0.w / 2) / P.w) * 100}% ${((s0.y + s0.h * 0.75) / P.h) * 100}%, #000 58%, transparent 100%)`;
      box.style.webkitMaskImage = m; box.style.maskImage = m;
    }
    host.appendChild(box);
    const layer = (cls, css) => { const d = document.createElement("div"); d.className = cls; d.style.cssText = "position:absolute;" + css; box.appendChild(d); return d; };
    const out = { el: box, screens: [], glows: [] };
    if (real) {
      layer("tm-plate-img", `inset:0;background:url(assets/plates/${o.plate}_base.jpg) center/100% 100% no-repeat;`);
      out.glows.push(layer("tm-plate-glow", `inset:0;background:url(assets/plates/${o.plate}_glow.jpg) center/100% 100% no-repeat;mix-blend-mode:screen;opacity:0;`));
    }
    P.screens.forEach((s) => {
      const x = s.x * k, y = s.y * k, w = s.w * k, h = s.h * k;
      if (!real) {
        const bw = w * 1.3, bh = bw * (66 / 61), bx = x - (bw - w) / 2, by = y - bw * 0.13;
        out.glows.push(layer("tm-css-glow", `left:${bx - bw * 0.5}px;top:${by + bh * 0.55}px;width:${bw * 2}px;height:${bh * 0.9}px;background:radial-gradient(closest-side,rgba(255,178,36,.55),rgba(255,178,36,0) 70%);opacity:0;`));
        layer("tm-css-body", `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;border-radius:${bw * 0.13}px;background:linear-gradient(165deg,#FBF6EC 0%,#E9E1D2 45%,#C9C0AF 100%);box-shadow:0 ${bw * 0.12}px ${bw * 0.3}px rgba(0,0,0,.65),inset 0 ${bw * 0.012}px 0 rgba(255,255,255,.9),inset 0 -${bw * 0.02}px ${bw * 0.05}px rgba(0,0,0,.25);`);
        layer("tm-css-glass", `left:${x - w * 0.05}px;top:${y - w * 0.05}px;width:${w * 1.1}px;height:${h + w * 0.1}px;border-radius:${w * 0.06}px;background:#05040A;`);
        layer("tm-css-dot", `left:${x + w / 2 - bw * 0.035}px;top:${y + h + bw * 0.1}px;width:${bw * 0.07}px;height:${bw * 0.07}px;border-radius:50%;border:${Math.max(1, bw * 0.008)}px solid #E2463A;`);
      }
      const cv = document.createElement("canvas"); cv.width = 800; cv.height = 600;
      cv.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${(s.r || 0) * k}px;`;
      box.appendChild(cv); out.screens.push(cv);
      layer("tm-sheen", `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${(s.r || 0) * k}px;background:linear-gradient(125deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 38%);`);
    });
    out.glow = (v, red) => out.glows.forEach((g) => { g.style.opacity = clamp(v, 0, 1); g.style.filter = red ? "hue-rotate(-42deg) saturate(1.6)" : "none"; });
    return out;
  }

  /* Terminal: lines = [{t, html}] appear at t; the last `rows` are shown. */
  function term(body, lines, rows) {
    let shown = -1;
    return (t) => {
      const n = lines.filter((l) => l.t <= t).length;
      if (n === shown) return; shown = n;
      body.innerHTML = lines.slice(Math.max(0, n - rows), n).map((l) => `<div class="tm-line">${l.html}</div>`).join("");
    };
  }

  /* Dot lattice with an expanding ripple; drawn on a canvas for the reveal. */
  function ripple(cv, t, o) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, step = 48;
    ctx.clearRect(0, 0, W, H);
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
      let a = 0;
      for (const r of o.rings) { const d = Math.hypot(x - r.x, y - r.y); if (d < (r.hole || 0)) continue; const rad = (t - r.t) * r.speed; if (t > r.t) a = Math.max(a, clamp(1 - Math.abs(d - rad) / 110, 0, 1) * clamp(1.4 - (t - r.t) / r.life, 0, 1)); }
      if (a < 0.02) continue;
      const sz = 5 + a * 16; ctx.globalAlpha = a; ctx.fillStyle = C.amber; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  return { C, GW, GH, hash, clamp, ease, seg, at, local, takeStart, takeEnd, drive, sprite, drawScreen, plate, term, ripple };
})();
