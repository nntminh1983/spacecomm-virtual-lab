/* PH035IU — Space Communication Virtual Lab
   All six modules. Everything on screen is computed from the formulas in the lectures. */
(function () {
"use strict";

/* ============================ small helpers ============================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const RE = 6378.14, MU = 398600.4418, AGEO = 42164.17, C0 = 299792.458; // km, km^3/s^2, km, km/s
const KB_DB = -228.6;

const fx = (v, n) => (isFinite(v) ? v.toFixed(n) : "—");
const dB = x => 10 * Math.log10(x);
const lin = x => Math.pow(10, x / 10);

function C() {
  const s = getComputedStyle(document.documentElement);
  const g = n => s.getPropertyValue(n).trim();
  return { bg: g("--bg"), panel: g("--panel"), sunk: g("--sunk"), line: g("--line"),
           line2: g("--line2"), ink: g("--ink"), soft: g("--soft"), faint: g("--faint"),
           up: g("--up"), down: g("--down"), hot: g("--hot"), ok: g("--ok"),
           violet: g("--violet"), grid: g("--grid"), knock: g("--knock") };
}

/* Readable text colour for a label sitting on an arbitrary fill.
   Needed because the access-scheme palette mixes dark accents with pale tints. */
function onFill(hex, alpha, under) {
  let h = String(hex).trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!isFinite(n)) return "#000";
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  if (alpha != null && alpha < 1 && under) {
    let u = String(under).trim().replace("#", "");
    if (u.length === 3) u = u[0] + u[0] + u[1] + u[1] + u[2] + u[2];
    const m = parseInt(u, 16);
    if (isFinite(m)) {
      r = r * alpha + ((m >> 16) & 255) * (1 - alpha);
      gg = gg * alpha + ((m >> 8) & 255) * (1 - alpha);
      b = b * alpha + (m & 255) * (1 - alpha);
    }
  }
  const sr = [r, gg, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const L = 0.2126 * sr[0] + 0.7152 * sr[1] + 0.0722 * sr[2];
  return L > 0.42 ? "#10171E" : "#FFFFFF";
}

const DESIGN = new WeakMap();
function prep(cv) {
  if (!DESIGN.has(cv)) DESIGN.set(cv, { w: +cv.getAttribute("width"), h: +cv.getAttribute("height") });
  const d = DESIGN.get(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = cv.clientWidth || d.w;
  const ch = cw * d.h / d.w;
  cv.style.height = ch + "px";
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(ch * dpr);
  const g = cv.getContext("2d");
  const k = dpr * cw / d.w;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, d.w, d.h);
  g.font = "11px 'IBM Plex Mono', monospace";
  g.textBaseline = "middle";
  return { g, W: d.w, H: d.h, c: C() };
}

function txt(g, s, x, y, col, size, align, mono) {
  g.fillStyle = col; g.textAlign = align || "left";
  g.font = (size || 11) + "px " + (mono === false ? "'IBM Plex Sans', sans-serif" : "'IBM Plex Mono', monospace");
  g.fillText(s, x, y);
}
function lineTo(g, x1, y1, x2, y2, col, w, dash) {
  g.save(); g.strokeStyle = col; g.lineWidth = w || 1;
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
}
function disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

/* a plot frame in design coordinates */
function Frame(g, c, box, o) {
  const { x, y, w, h } = box;
  const xlog = !!o.xlog, ylog = !!o.ylog;
  const fxv = v => xlog ? Math.log10(v) : v, fyv = v => ylog ? Math.log10(v) : v;
  const x0 = fxv(o.xmin), x1 = fxv(o.xmax), y0 = fyv(o.ymin), y1 = fyv(o.ymax);
  const X = v => x + (fxv(v) - x0) / (x1 - x0) * w;
  const Y = v => y + h - (fyv(v) - y0) / (y1 - y0) * h;
  (o.yticks || []).forEach(t => {
    const Yt = Y(t);
    lineTo(g, x, Yt, x + w, Yt, c.grid, 1);
    txt(g, o.yfmt ? o.yfmt(t) : String(t), x - 7, Yt, c.faint, 10, "right");
  });
  (o.xticks || []).forEach(t => {
    const Xt = X(t);
    lineTo(g, Xt, y, Xt, y + h, c.grid, 1);
    txt(g, o.xfmt ? o.xfmt(t) : String(t), Xt, y + h + 13, c.faint, 10, "center");
  });
  g.save(); g.strokeStyle = c.line; g.lineWidth = 1; g.strokeRect(x, y, w, h); g.restore();
  if (o.xlab) txt(g, o.xlab, x + w / 2, y + h + 30, c.soft, 10.5, "center");
  if (o.ylab) { g.save(); g.translate(x - 38, y + h / 2); g.rotate(-Math.PI / 2); txt(g, o.ylab, 0, 0, c.soft, 10.5, "center"); g.restore(); }
  return {
    X, Y, box,
    clip(fn) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(); g.restore(); },
    curve(pts, col, lw, dash) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.strokeStyle = col; g.lineWidth = lw || 2; if (dash) g.setLineDash(dash);
      g.beginPath();
      let started = false;
      for (const p of pts) {
        if (!isFinite(p[0]) || !isFinite(p[1])) { started = false; continue; }
        const px = X(p[0]), py = Y(p[1]);
        if (!isFinite(px) || !isFinite(py)) { started = false; continue; }
        if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
      }
      g.stroke(); g.restore();
    }
  };
}

/* ============================ math ============================ */
function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  if (x < 2) {
    let s = x, t = x;
    for (let n = 1; n < 200; n++) { t *= -x * x / n; const add = t / (2 * n + 1); s += add; if (Math.abs(add) < 1e-17) break; }
    return 1 - 2 / Math.sqrt(Math.PI) * s;
  }
  let cf = 0;
  for (let i = 60; i >= 1; i--) cf = (i / 2) / (x + cf);
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + cf);
}
const Q = x => 0.5 * erfc(x / Math.SQRT2);

function J1(x) {
  const ax = Math.abs(x);
  if (ax < 3) {
    const t = (x / 3) * (x / 3);
    return x * (0.5 - 0.56249985 * t + 0.21093573 * t * t - 0.03954289 * t * t * t
      + 0.00443319 * Math.pow(t, 4) - 0.00031761 * Math.pow(t, 5) + 0.00001109 * Math.pow(t, 6));
  }
  const u = 3 / ax;
  const f = 0.79788456 + 0.00000156 * u + 0.01659667 * u * u + 0.00017105 * Math.pow(u, 3)
    - 0.00249511 * Math.pow(u, 4) + 0.00113653 * Math.pow(u, 5) - 0.00020033 * Math.pow(u, 6);
  const th = ax - 2.35619449 + 0.12499612 * u + 0.00005650 * u * u - 0.00637879 * Math.pow(u, 3)
    + 0.00074348 * Math.pow(u, 4) + 0.00079824 * Math.pow(u, 5) - 0.00029166 * Math.pow(u, 6);
  const r = f * Math.cos(th) / Math.sqrt(ax);
  return x < 0 ? -r : r;
}

/* deterministic Gaussian pair (seeded, so a redraw is stable) */
function RNG(seed) {
  let s = seed >>> 0 || 1;
  return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function gauss(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function matInv(A) { /* square Gauss-Jordan */
  const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) return null;
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[i][j];
    }
  }
  return M.map(r => r.slice(n));
}

/* kv + ladder renderers */
function kv(el, rows) {
  el.innerHTML = rows.map(r =>
    '<div><span class="k">' + r[0] + '</span><span class="v ' + (r[2] || "") + '">' + r[1] + "</span></div>").join("");
}
function steps(el, rows) {
  el.innerHTML = rows.map((r, i) =>
    '<div><span class="i">' + (i + 1) + '</span><span class="d">' + r[0] + '</span><span class="r">' + r[1] + "</span></div>").join("");
}

/* ============================ shell ============================ */
const MODS = [
  { id: "m0", n: "START", t: "Overview", l: "How to use the lab" },
  { id: "m1", n: "MODULE 1", t: "Orbits, Coverage and Look Angles", l: "Lectures 1 · 2 · 3",
    d: "Kepler's third law, orbit classes, coverage and the azimuth / elevation / range a real dish needs." },
  { id: "m2", n: "MODULE 2", t: "Propagation, Rain Fade and Polarization", l: "Lectures 4 · 9",
    d: "The full ITU rain procedure, plus polarization mismatch, XPD and Faraday rotation." },
  { id: "m3", n: "MODULE 3", t: "Antennas, Beams and Free-Space Loss", l: "Lectures 5 · 10",
    d: "Reflector gain against beamwidth, sidelobes and mispointing; electronic beam steering." },
  { id: "m4", n: "MODULE 4", t: "The Space Link Budget", l: "Lectures 6 · 10",
    d: "Uplink, downlink, system noise temperature, G/T and the rain double penalty." },
  { id: "m5", n: "MODULE 5", t: "Digital Signals, Modulation and Coding", l: "Lectures 7 · 8",
    d: "Live constellations under noise, BER curves, coding gain, the eye diagram and Hamming (7,4)." },
  { id: "m6", n: "MODULE 6", t: "Multiple Access, Networks and Services", l: "Lectures 11 · 12 · 13",
    d: "FDMA / TDMA / CDMA, TCP over a long hop, GNSS geometry and digital television bit rates." }
];

const rail = $("#rail");
MODS.forEach(m => {
  const b = document.createElement("button");
  b.className = "railbtn"; b.dataset.go = m.id;
  b.innerHTML = '<span class="n">' + m.n + '</span><span class="t">' + m.t + '</span>' +
    (m.l ? '<span class="l">' + m.l + "</span>" : "");
  rail.appendChild(b);
});
$("#cards").innerHTML = MODS.slice(1).map(m =>
  '<button class="mcard" data-go="' + m.id + '"><span class="n">' + m.n + '</span><h3>' + m.t +
  '</h3><p>' + m.d + '</p><span class="l">' + m.l + "</span></button>").join("");

let current = "m0";
function go(id) {
  if (!document.getElementById(id)) id = "m0";
  current = id;
  $$(".mod").forEach(s => s.classList.toggle("on", s.id === id));
  $$(".railbtn").forEach(b => b.setAttribute("aria-current", b.dataset.go === id ? "true" : "false"));
  try { history.replaceState(null, "", "#" + id); } catch (e) {}
  window.scrollTo(0, 0);
  drawAll();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b) go(b.dataset.go);
});

/* theme — light is the default (bare :root), dark is the opt-in */
const root = document.documentElement;
$("#theme").addEventListener("click", () => {
  const next = root.getAttribute("data-ui") === "dark" ? "light" : "dark";
  root.setAttribute("data-ui", next);
  $("#theme").textContent = next === "dark" ? "Light" : "Dark";
  try { localStorage.setItem("ph035-theme", next); } catch (e) {}
  drawAll();
});
try {
  if (localStorage.getItem("ph035-theme") === "dark") {
    root.setAttribute("data-ui", "dark");
    $("#theme").textContent = "Light";
  }
} catch (e) {}

/* segmented button helper */
function seg(sel, onPick) {
  const wrap = $(sel);
  if (!wrap) return;
  wrap.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    Array.from(wrap.children).forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    onPick(b);
  });
}
function bind(ids, fn) { ids.forEach(i => { const el = $(i); if (el) el.addEventListener("input", fn); }); }

/* ===================================================================== */
/* MODULE 1 — orbits and look angles                                     */
/* ===================================================================== */
function orbit() {
  const h = +$("#s-alt").value, mask = +$("#s-mask").value;
  const a = RE + h;
  const T = 2 * Math.PI * Math.sqrt(a * a * a / MU);
  const v = Math.sqrt(MU / a);
  const cosG = (RE / a) * Math.cos(mask * D2R);
  const gam = Math.max(0, Math.acos(Math.min(1, cosG)) - mask * D2R);  // earth central angle to mask
  const gamH = Math.acos(RE / a);                                      // to true horizon
  const cov = (1 - Math.cos(gamH)) / 2;                                // fraction of sphere
  const pass = T * (2 * gam) / (2 * Math.PI);
  const geoSync = Math.abs(T - 86164.1) / 86164.1 < 0.02;              // period matches Earth's spin
  const slantZ = h, slantH = Math.sqrt(a * a - RE * RE);
  const fsl4 = f => 92.44 + 20 * Math.log10(h) + 20 * Math.log10(f);

  $("#v-alt").textContent = h >= 1000 ? (h / 1000).toFixed(h >= 10000 ? 1 : 2) + " ×10³ km" : h + " km";
  $("#v-mask").textContent = mask + "°";

  kv($("#k-orbit"), [
    ["Semi-major axis a", fx(a, 0) + " <small>km</small>"],
    ["Orbital period", T >= 3600 ? fx(T / 3600, 2) + " <small>h</small>" : fx(T / 60, 1) + " <small>min</small>", "up"],
    ["Orbital speed", fx(v, 3) + " <small>km/s</small>"],
    ["Horizon half-angle", fx(gamH * R2D, 1) + "°"],
    ["Earth coverage", fx(cov * 100, 1) + " <small>%</small>", "dn"],
    ["Usable pass @" + mask + "°", geoSync ? "continuous" : (pass >= 3600 ? fx(pass / 3600, 2) + " <small>h</small>" : fx(pass / 60, 1) + " <small>min</small>"), "dn"],
    ["Delay, zenith", fx(slantZ / C0 * 1000, 2) + " <small>ms</small>"],
    ["Delay, horizon", fx(slantH / C0 * 1000, 2) + " <small>ms</small>"],
    ["FSL @ 4 GHz zenith", fx(fsl4(4), 1) + " <small>dB</small>", "hot"],
    ["Geometric min. for global", String(Math.max(3, Math.ceil(1 / cov))), "up"]
  ]);

  const { g, W, H, c } = prep($("#c-orbit"));
  const cx = W * 0.40, cy = H / 2;
  const maxR = Math.min(H / 2 - 18, W * 0.36);
  const ratio = a / RE;
  const rE = Math.min(132, maxR / ratio);
  const rO = rE * ratio;

  // earth
  const grd = g.createRadialGradient(cx - rE * .3, cy - rE * .3, rE * .1, cx, cy, rE);
  grd.addColorStop(0, c.down); grd.addColorStop(1, c.line);
  g.globalAlpha = .35; disc(g, cx, cy, rE, c.down); g.globalAlpha = 1;
  g.save(); g.strokeStyle = c.down; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, rE, 0, 7); g.stroke(); g.restore();
  for (let k = -60; k <= 60; k += 30) {
    const yy = cy - rE * Math.sin(k * D2R), rr = rE * Math.cos(k * D2R);
    g.save(); g.strokeStyle = c.grid; g.lineWidth = .7; g.beginPath();
    g.ellipse(cx, yy, rr, rr * .18, 0, 0, 7); g.stroke(); g.restore();
  }

  // orbit circle
  g.save(); g.strokeStyle = c.line; g.lineWidth = 1; g.setLineDash([4, 4]);
  g.beginPath(); g.arc(cx, cy, rO, 0, 7); g.stroke(); g.restore();

  // satellite at 40 deg above the x axis
  const ang = -42 * D2R;
  const sx = cx + rO * Math.cos(ang), sy = cy + rO * Math.sin(ang);

  // coverage cone to the true horizon
  const tang = Math.acos(RE / a);
  [-1, 1].forEach(s => {
    const th = ang + Math.PI + s * (Math.PI / 2 - tang);
    const px = sx + Math.cos(th) * rO * 2, py = sy + Math.sin(th) * rO * 2;
    lineTo(g, sx, sy, px, py, c.up, 1, [3, 3]);
  });
  g.save();
  g.strokeStyle = c.up; g.lineWidth = 3.5; g.beginPath();
  g.arc(cx, cy, rE, ang - tang, ang + tang); g.stroke(); g.restore();

  disc(g, sx, sy, 5.5, c.up);
  txt(g, "satellite", sx + 10, sy - 10, c.up, 11);
  txt(g, "h = " + (h >= 1000 ? fx(h / 1000, 1) + "×10³" : h) + " km", sx + 10, sy + 4, c.soft, 10.5);
  txt(g, "covered arc " + fx(tang * 2 * R2D, 0) + "°", cx + rE * Math.cos(ang) + 12, cy + rE * Math.sin(ang) + 16, c.up, 10.5);

  // right-hand comparison bars
  const bx = W * 0.74, bw = W * 0.21;
  txt(g, "WHERE THIS ORBIT SITS", bx, 42, c.faint, 10);
  const classes = [["VLEO", 340], ["LEO", 550], ["LEO hi", 1200], ["MEO", 20200], ["GEO", 35786]];
  classes.forEach((cl, i) => {
    const yy = 70 + i * 34;
    const frac = Math.log10(cl[1] / 150) / Math.log10(36500 / 150);
    const near = Math.abs(Math.log10(cl[1]) - Math.log10(h)) < 0.06;
    lineTo(g, bx, yy, bx + bw, yy, c.line2, 6);
    lineTo(g, bx, yy, bx + bw * frac, yy, near ? c.up : c.line, 6);
    txt(g, cl[0], bx, yy - 12, near ? c.up : c.soft, 10.5);
    txt(g, cl[1] + " km", bx + bw, yy - 12, c.faint, 10, "right");
  });
  const cf = Math.log10(Math.max(150, h) / 150) / Math.log10(36500 / 150);
  lineTo(g, bx + bw * cf, 58, bx + bw * cf, 70 + 4 * 34 + 14, c.up, 1, [3, 3]);
  txt(g, "Scale: Earth drawn at " + fx(rE, 0) + " px, orbit radius × " + fx(ratio, 2), bx, H - 22, c.faint, 10);
}

function lookAngles(latE, lonE, lonS) {
  const B = lonS - lonE;
  const cosG = Math.cos(latE * D2R) * Math.cos(B * D2R);
  const gam = Math.acos(Math.max(-1, Math.min(1, cosG)));
  const d = Math.sqrt(RE * RE + AGEO * AGEO - 2 * RE * AGEO * cosG);
  const El = Math.acos(Math.min(1, AGEO * Math.sin(gam) / d)) * R2D;
  const Ap = Math.atan(Math.abs(Math.tan(B * D2R)) / Math.sin(Math.abs(latE) * D2R)) * R2D;
  let Az;
  if (latE >= 0) Az = (B >= 0) ? 180 - Ap : 180 + Ap;
  else Az = (B >= 0) ? Ap : 360 - Ap;
  return { B, gam: gam * R2D, d, El, Az: (Az + 360) % 360, visible: El > 0 };
}

function look() {
  const latE = +$("#s-lat").value, lonE = +$("#s-lon").value, lonS = +$("#s-sat").value;
  const r = lookAngles(latE, lonE, lonS);
  $("#v-lat").textContent = Math.abs(latE).toFixed(2) + "° " + (latE >= 0 ? "N" : "S");
  $("#v-lon").textContent = Math.abs(lonE).toFixed(2) + "° " + (lonE >= 0 ? "E" : "W");
  $("#v-sat").textContent = Math.abs(lonS).toFixed(2) + "° " + (lonS >= 0 ? "E" : "W");

  const delay = r.d / C0 * 1000;
  kv($("#k-look"), [
    ["Azimuth (true N)", r.visible ? fx(r.Az, 1) + "°" : "—", "up"],
    ["Elevation", r.visible ? fx(r.El, 1) + "°" : "below horizon", r.visible ? "dn" : "hot"],
    ["Slant range", r.visible ? fx(r.d, 0) + " <small>km</small>" : "—"],
    ["Central angle γ", fx(r.gam, 2) + "°"],
    ["One-way delay", r.visible ? fx(delay, 1) + " <small>ms</small>" : "—"],
    ["Round trip", r.visible ? fx(2 * delay, 1) + " <small>ms</small>" : "—"],
    ["FSL @ 4 GHz", r.visible ? fx(92.44 + 20 * Math.log10(r.d) + 20 * Math.log10(4), 1) + " <small>dB</small>" : "—", "hot"],
    ["Δ longitude B", fx(r.B, 2) + "°"]
  ]);
  steps($("#st-look"), [
    ["cos γ = cos(lat)·cos(B)", fx(Math.cos(latE * D2R), 5) + " × " + fx(Math.cos(r.B * D2R), 5) + " = " + fx(Math.cos(r.gam * D2R), 5)],
    ["γ = arccos(…)", fx(r.gam, 3) + "°"],
    ["d = √(Rᴇ² + a² − 2Rᴇa cos γ)", fx(r.d, 1) + " km"],
    ["El = arccos(a·sin γ / d)", fx(r.El, 2) + "°"],
    ["A′ = arctan(tan|B| / sin|lat|)", fx(Math.atan(Math.abs(Math.tan(r.B * D2R)) / Math.sin(Math.abs(latE) * D2R)) * R2D, 2) + "°"],
    [latE >= 0 ? (r.B >= 0 ? "N hemisphere, sat east → Az = 180 − A′" : "N hemisphere, sat west → Az = 180 + A′")
               : (r.B >= 0 ? "S hemisphere, sat east → Az = A′" : "S hemisphere, sat west → Az = 360 − A′"), fx(r.Az, 2) + "°"]
  ]);

  // sky plot
  const { g, W, H, c } = prep($("#c-look"));
  const cx = W * 0.30, cy = H / 2, R = Math.min(H / 2 - 26, W * 0.26);
  [0, 30, 60].forEach(e => {
    const rr = R * (90 - e) / 90;
    g.save(); g.strokeStyle = e === 0 ? c.line : c.grid; g.lineWidth = e === 0 ? 1.4 : 1;
    g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); g.restore();
    if (e) txt(g, e + "°", cx + 3, cy - rr + 1, c.faint, 9.5);
  });
  for (let a = 0; a < 360; a += 30) {
    const th = (a - 90) * D2R;
    lineTo(g, cx, cy, cx + R * Math.cos(th), cy + R * Math.sin(th), c.grid, a % 90 === 0 ? 1 : .6);
  }
  ["N", "E", "S", "W"].forEach((s, i) => {
    const th = (i * 90 - 90) * D2R;
    txt(g, s, cx + (R + 13) * Math.cos(th), cy + (R + 13) * Math.sin(th), c.soft, 11, "center");
  });
  const PT = (az, el) => {
    const rr = R * (90 - el) / 90, th = (az - 90) * D2R;
    return [cx + rr * Math.cos(th), cy + rr * Math.sin(th)];
  };
  // the GEO arc as seen from this station
  const arc = [];
  for (let L = -180; L <= 180; L += 1) {
    const q = lookAngles(latE, lonE, L);
    if (q.El > 0) arc.push(PT(q.Az, q.El)); else if (arc.length) arc.push(null);
  }
  g.save(); g.strokeStyle = c.down; g.lineWidth = 2; g.beginPath();
  let st = false;
  arc.forEach(p => { if (!p) { st = false; return; } if (!st) { g.moveTo(p[0], p[1]); st = true; } else g.lineTo(p[0], p[1]); });
  g.stroke(); g.restore();
  txt(g, "the whole GEO arc from here", cx, cy + R + 28, c.down, 10.5, "center");

  if (r.visible) {
    const p = PT(r.Az, r.El);
    lineTo(g, cx, cy, p[0], p[1], c.up, 1, [3, 3]);
    disc(g, p[0], p[1], 6, c.up);
    txt(g, "Az " + fx(r.Az, 1) + "°  El " + fx(r.El, 1) + "°", p[0] + 10, p[1] - 11, c.up, 11);
  }
  disc(g, cx, cy, 3, c.soft);
  txt(g, "SKY AS SEEN FROM THE STATION", cx, 22, c.faint, 10, "center");

  // side view
  const bx = W * 0.62, bw = W * 0.33, by = H / 2;
  txt(g, "SLANT GEOMETRY", bx, 28, c.faint, 10);
  const eR = 54, sc = eR / RE;
  const ecx = bx + 16, ecy = by + 60;
  g.globalAlpha = .3; disc(g, ecx, ecy, eR, c.down); g.globalAlpha = 1;
  g.save(); g.strokeStyle = c.down; g.lineWidth = 1.3; g.beginPath(); g.arc(ecx, ecy, eR, 0, 7); g.stroke(); g.restore();
  const latR = latE * D2R;
  const stationX = ecx + eR * Math.cos(latR), stationY = ecy - eR * Math.sin(latR);
  disc(g, stationX, stationY, 4, c.ink);
  txt(g, "station", stationX + 7, stationY - 9, c.ink, 10);
  const satX = ecx + Math.min(bw - 30, AGEO * sc), satY = ecy;
  disc(g, satX, satY, 5, c.up);
  txt(g, "GEO", satX - 4, satY - 15, c.up, 10, "center");
  lineTo(g, stationX, stationY, satX, satY, c.up, 1.6);
  lineTo(g, ecx, ecy, satX, satY, c.grid, 1, [3, 3]);
  lineTo(g, ecx, ecy, stationX, stationY, c.grid, 1, [3, 3]);
  txt(g, "d = " + (r.visible ? fx(r.d, 0) : "—") + " km", (stationX + satX) / 2 - 20, (stationY + satY) / 2 - 12, c.up, 10.5);
  txt(g, "γ = " + fx(r.gam, 1) + "°", ecx + 16, ecy - 10, c.soft, 10.5);
  txt(g, "Earth and range not to the same scale", bx, H - 18, c.faint, 9.5);
}

seg("#seg-orbit", b => { $("#s-alt").value = b.dataset.h; orbit(); });
seg("#seg-site", b => {
  const [a, b2, c2] = b.dataset.site.split(",");
  $("#s-lat").value = a; $("#s-lon").value = b2; $("#s-sat").value = c2; look();
});
bind(["#s-alt", "#s-mask"], orbit);
bind(["#s-lat", "#s-lon", "#s-sat"], look);

/* ===================================================================== */
/* MODULE 2 — rain and polarization                                      */
/* ===================================================================== */
/* ITU-R P.838-3 regression coefficients */
const P838 = [
  [1, 0.0000259, 0.9691, 0.0000308, 0.8592], [2, 0.0000847, 1.0664, 0.0000998, 0.9490],
  [4, 0.0001071, 1.6009, 0.0002461, 1.2476], [6, 0.0007056, 1.5900, 0.0004878, 1.5728],
  [7, 0.001915, 1.4810, 0.001425, 1.4745], [8, 0.004115, 1.3905, 0.003450, 1.3797],
  [10, 0.01217, 1.2571, 0.01129, 1.2156], [12, 0.02386, 1.1825, 0.02455, 1.1216],
  [15, 0.04481, 1.1233, 0.05008, 1.0440], [20, 0.09164, 1.0568, 0.09611, 0.9847],
  [25, 0.1571, 1.0000, 0.1533, 0.9491], [30, 0.2403, 0.9485, 0.2291, 0.9129],
  [35, 0.3374, 0.9040, 0.3224, 0.8761], [40, 0.4431, 0.8673, 0.4274, 0.8421],
  [50, 0.6433, 0.8016, 0.6273, 0.7828], [60, 0.8206, 0.7527, 0.8126, 0.7312]
];
function kalpha(f, pol) {
  let i = 0;
  while (i < P838.length - 2 && P838[i + 1][0] < f) i++;
  const A = P838[i], B = P838[i + 1];
  const t = (Math.log(f) - Math.log(A[0])) / (Math.log(B[0]) - Math.log(A[0]));
  const ip = (a, b, log) => log ? Math.exp(Math.log(a) + t * (Math.log(b) - Math.log(a))) : a + t * (b - a);
  const kH = ip(A[1], B[1], true), aH = ip(A[2], B[2], false);
  const kV = ip(A[3], B[3], true), aV = ip(A[4], B[4], false);
  if (pol === "H") return { k: kH, a: aH, kH, aH, kV, aV };
  if (pol === "V") return { k: kV, a: aV, kH, aH, kV, aV };
  const k = (kH + kV) / 2, a = (kH * aH + kV * aV) / (2 * k);
  return { k, a, kH, aH, kV, aV };
}
const SITE_LAT = 10.82;   // Ho Chi Minh City — sets beta in the time-percentage scaling

function rainAtt(f, el, R, hR, pol, hS) {
  hS = hS || 0.01;
  const ka = kalpha(f, pol);
  const gR = ka.k * Math.pow(R, ka.a);              // dB/km
  const LS = (hR - hS) / Math.sin(el * D2R);        // km slant through rain
  const LG = LS * Math.cos(el * D2R);               // horizontal projection
  // ITU-R P.618 horizontal reduction factor; it is a reduction, so never above 1
  const r01 = Math.min(1, 1 / (1 + 0.78 * Math.sqrt(LG * gR / f) - 0.38 * (1 - Math.exp(-2 * LG))));
  // vertical adjustment factor
  const zeta = Math.atan2(hR - hS, LG * r01) * R2D;
  const LR = zeta > el ? LG * r01 / Math.cos(el * D2R) : (hR - hS) / Math.sin(el * D2R);
  const chi = Math.abs(SITE_LAT) < 36 ? 36 - Math.abs(SITE_LAT) : 0;
  const v01 = 1 / (1 + Math.sqrt(Math.sin(el * D2R)) *
    (31 * (1 - Math.exp(-el / (1 + chi))) * Math.sqrt(LR * gR) / (f * f) - 0.45));
  const LE = LR * v01;                              // effective path length
  const A01 = gR * LE;
  // ITU-R P.618 eq. 35 — beta depends on latitude, percentage and elevation
  const phi = Math.abs(SITE_LAT);
  const beta = p => {
    if (p >= 1 || phi >= 36) return 0;
    if (el >= 25) return -0.005 * (phi - 36);
    return -0.005 * (phi - 36) + 1.8 - 4.25 * Math.sin(el * D2R);
  };
  const scale = p => {
    const ex = 0.655 + 0.033 * Math.log(p) - 0.045 * Math.log(Math.max(A01, 1e-6))
             - beta(p) * (1 - p) * Math.sin(el * D2R);
    return A01 * Math.pow(p / 0.01, -ex);
  };
  return { ka, gR, LS, LG, r01, v01, LE, A01, scale };
}

function rain() {
  const f = +$("#s-rf").value, el = +$("#s-rel").value, R = +$("#s-rr").value, hR = +$("#s-hr").value;
  const pol = $("#seg-pol").querySelector('[aria-pressed="true"]').dataset.p;
  $("#v-rf").textContent = fx(f, 1) + " GHz"; $("#v-rel").textContent = el + "°";
  $("#v-rr").textContent = R + " mm/h"; $("#v-hr").textContent = fx(hR, 2) + " km";

  const r = rainAtt(f, el, R, hR, pol);
  const A1 = r.scale(0.1), A10 = r.scale(1);
  kv($("#k-rain"), [
    ["Specific atten. γ_R", fx(r.gR, 2) + " <small>dB/km</small>"],
    ["Slant path L_S", fx(r.LS, 2) + " <small>km</small>"],
    ["Reduction factor r₀.₀₁", fx(r.r01, 3)],
    ["A at 0.01 % (99.99 %)", fx(r.A01, 1) + " <small>dB</small>", r.A01 > 10 ? "hot" : "up"],
    ["A at 0.1 % (99.9 %)", fx(A1, 1) + " <small>dB</small>", "up"],
    ["A at 1 % (99 %)", fx(A10, 2) + " <small>dB</small>", "dn"],
    ["k, α used", fx(r.ka.k, 4) + " / " + fx(r.ka.a, 3)],
    ["Outage at 0.01 %", "53 <small>min/yr</small>"]
  ]);
  steps($("#st-rain"), [
    ["k, α for " + f.toFixed(1) + " GHz " + (pol === "C" ? "circular" : pol === "H" ? "horizontal" : "vertical"), fx(r.ka.k, 5) + " , " + fx(r.ka.a, 4)],
    ["γ_R = k·R^α", fx(r.ka.k, 5) + "×" + R + "^" + fx(r.ka.a, 3) + " = " + fx(r.gR, 3) + " dB/km"],
    ["L_S = (h_R − h_S)/sin θ", fx(r.LS, 3) + " km"],
    ["L_G = L_S·cos θ", fx(r.LG, 3) + " km"],
    ["r₀.₀₁ horizontal reduction", fx(r.r01, 4)],
    ["v₀.₀₁ vertical adjustment", fx(r.v01, 4)],
    ["Effective path L_E", fx(r.LE, 3) + " km"],
    ["A₀.₀₁ = γ_R · L_E", fx(r.A01, 2) + " dB"]
  ]);

  const { g, W, H, c } = prep($("#c-rain"));
  // left: geometry
  const gx = 24, gy = 34, gw = 330, gh = H - 86;
  const groundY = gy + gh;
  lineTo(g, gx, groundY, gx + gw, groundY, c.line, 1.5);
  const hrY = groundY - gh * (hR / 6.5);
  g.fillStyle = c.down; g.globalAlpha = .13; g.fillRect(gx, hrY, gw, groundY - hrY); g.globalAlpha = 1;
  lineTo(g, gx, hrY, gx + gw, hrY, c.down, 1, [4, 3]);
  txt(g, "rain height h_R = " + fx(hR, 2) + " km", gx + 4, hrY - 9, c.down, 10);
  txt(g, "RAIN CELL", gx + gw - 4, hrY + 14, c.down, 9.5, "right");
  const sx = gx + 22, syy = groundY;
  const dx = (hR / Math.tan(el * D2R)) / 6.5 * gh;
  const ex = sx + Math.min(dx, gw - 40), ey = hrY;
  lineTo(g, sx, syy, ex, ey, c.up, 2.4);
  lineTo(g, ex, ey, ex + 40, ey - 26, c.up, 1.6, [4, 3]);
  lineTo(g, sx, syy, sx + Math.min(dx, gw - 40), syy, c.faint, 1, [3, 3]);
  disc(g, sx, syy, 4, c.ink);
  txt(g, "θ = " + el + "°", sx + 16, syy - 13, c.soft, 10.5);
  txt(g, "L_S = " + fx(r.LS, 2) + " km", (sx + ex) / 2 - 28, (syy + ey) / 2 - 10, c.up, 10.5);
  txt(g, "L_G = " + fx(r.LG, 2) + " km", sx + 20, syy + 14, c.faint, 10);
  txt(g, "SLANT PATH THROUGH RAIN", gx, 20, c.faint, 10);

  // right: A vs frequency
  const fr = Frame(g, c, { x: 430, y: 34, w: W - 470, h: H - 88 }, {
    xmin: 4, xmax: 50, ymin: 0.05, ymax: 120, ylog: true,
    xticks: [4, 10, 20, 30, 40, 50], yticks: [0.1, 1, 10, 100],
    yfmt: v => v < 1 ? v.toFixed(1) : String(v),
    xlab: "Frequency (GHz)", ylab: "Rain attenuation at 0.01 % (dB)"
  });
  const mk = p => {
    const pts = [];
    for (let ff = 4; ff <= 50; ff += 0.5) {
      const q = rainAtt(ff, el, R, hR, p);
      pts.push([ff, q.A01]);
    }
    return pts;
  };
  fr.curve(mk("H"), c.hot, 1.4, [4, 3]);
  fr.curve(mk("V"), c.down, 1.4, [4, 3]);
  fr.curve(mk(pol), c.up, 2.6);
  fr.clip(() => {
    disc(g, fr.X(f), fr.Y(r.A01), 5, c.up);
    lineTo(g, fr.X(f), fr.Y(r.A01), fr.X(f), fr.box.y + fr.box.h, c.up, 1, [3, 3]);
  });
  txt(g, "horizontal", W - 48, fr.Y(rainAtt(50, el, R, hR, "H").A01) - 10, c.hot, 10, "right");
  txt(g, "vertical", W - 48, fr.Y(rainAtt(50, el, R, hR, "V").A01) + 12, c.down, 10, "right");
  [["C", 4], ["Ku", 12], ["Ka", 20], ["Q/V", 40]].forEach(b => {
    lineTo(g, fr.X(b[1]), fr.box.y, fr.X(b[1]), fr.box.y + 10, c.faint, 1);
    txt(g, b[0], fr.X(b[1]), fr.box.y + 18, c.faint, 9.5, "center");
  });
}

function pol() {
  const tilt = +$("#s-tilt").value, arS = +$("#s-ar").value;
  const f = +$("#s-pf").value, tec = +$("#s-tec").value;
  const AR = arS === 0 ? Infinity : 1 + (100 - arS) / 100 * 40; // 0 => linear, 100 => circular (AR=1)
  $("#v-tilt").textContent = tilt + "°";
  $("#v-ar").textContent = arS === 0 ? "linear" : (arS === 100 ? "1.0 (circular)" : fx(AR, 1));
  $("#v-pf").textContent = fx(f, 1) + " GHz";
  $("#v-tec").textContent = tec + " TECU";

  const t = tilt * D2R;
  // Two co-polarised antennas rotated by t; e = 1/AR is the ellipse minor/major ratio.
  // e = 0 is pure linear (cos² law), e = 1 is circular (no tilt sensitivity at all).
  const e = isFinite(AR) ? 1 / AR : 0;
  const Lmis = -10 * Math.log10(0.5 * (1 + (1 - e * e) / (1 + e * e) * Math.cos(2 * t)));
  const XPD = -20 * Math.log10(Math.max(1e-6, Math.abs(Math.tan(t))));
  const far = 2.36e4 * 3e-5 * (tec * 1e16) / Math.pow(f * 1e9, 2) * R2D;

  kv($("#k-pol"), [
    ["Mismatch loss", fx(Math.min(40, Lmis), 2) + " <small>dB</small>", Lmis > 3 ? "hot" : "up"],
    ["Cross-polar discrim.", (XPD > 60 ? ">60" : fx(XPD, 1)) + " <small>dB</small>", XPD < 20 ? "hot" : "dn"],
    ["Co-polar leak into 2nd ch.", fx(Math.min(100, Math.pow(10, -XPD / 10) * 100), 2) + " <small>%</small>"],
    ["Faraday rotation Ω", fx(far, 2) + "°", far > 10 ? "hot" : "dn"],
    ["Faraday loss (linear)", fx(-20 * Math.log10(Math.max(1e-6, Math.abs(Math.cos(far * D2R)))), 2) + " <small>dB</small>"],
    ["Reuse capacity gain", XPD > 25 ? "×2 usable" : "degraded", XPD > 25 ? "ok" : "hot"]
  ]);

  const { g, W, H, c } = prep($("#c-pol"));
  // left: ellipse + receiver axis
  const cx = 180, cy = H / 2, R = Math.min(118, H / 2 - 40);
  lineTo(g, cx - R - 18, cy, cx + R + 18, cy, c.grid, 1);
  lineTo(g, cx, cy - R - 18, cx, cy + R + 18, c.grid, 1);
  const b = isFinite(AR) ? R / AR : 0;
  g.save(); g.strokeStyle = c.down; g.lineWidth = 2.2; g.beginPath();
  if (isFinite(AR)) g.ellipse(cx, cy, R, b, 0, 0, 7); else { g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); }
  g.stroke(); g.restore();
  txt(g, "incoming wave", cx - R, cy - R - 26, c.down, 10.5);
  lineTo(g, cx - (R + 14) * Math.cos(t), cy + (R + 14) * Math.sin(t),
            cx + (R + 14) * Math.cos(t), cy - (R + 14) * Math.sin(t), c.up, 2.4);
  txt(g, "antenna axis  Δτ = " + tilt + "°", cx - R, cy + R + 30, c.up, 10.5);
  txt(g, "loss " + fx(Math.min(40, Lmis), 2) + " dB", cx - R, cy + R + 44, c.ink, 11);
  txt(g, "POLARIZATION MATCH", 24, 22, c.faint, 10);

  // right: XPD vs rain attenuation (ITU-R P.618 empirical)
  const fr = Frame(g, c, { x: 420, y: 34, w: W - 462, h: H - 92 }, {
    xmin: 0, xmax: 25, ymin: 10, ymax: 50,
    xticks: [0, 5, 10, 15, 20, 25], yticks: [10, 20, 30, 40, 50],
    xlab: "Co-polar rain attenuation (dB)", ylab: "XPD (dB)"
  });
  [[6, c.down], [12, c.ink], [20, c.up], [30, c.hot]].forEach(([ff, col]) => {
    const Cf = 30 * Math.log10(ff), Ca = 20;
    const pts = [];
    for (let A = 0.3; A <= 25; A += 0.25) pts.push([A, Cf - Ca * Math.log10(A) - 10]);
    fr.curve(pts, col, ff === Math.round(f) ? 2.6 : 1.3);
    txt(g, ff + " GHz", fr.X(25) - 4, fr.Y(Cf - 20 * Math.log10(25) - 10) - 8, col, 9.5, "right");
  });
  lineTo(g, fr.box.x, fr.Y(25), fr.box.x + fr.box.w, fr.Y(25), c.hot, 1, [5, 4]);
  txt(g, "25 dB — practical floor for dual-polar reuse", fr.box.x + 8, fr.Y(25) - 9, c.hot, 10);
  txt(g, "XPD FALLS AS RAIN RISES", 420, 22, c.faint, 10);
}

seg("#seg-pol", rain);
seg("#seg-rain", b => {
  const [f, el, R, p] = b.dataset.r.split(",");
  $("#s-rf").value = f; $("#s-rel").value = el; $("#s-rr").value = R;
  Array.from($("#seg-pol").children).forEach(x => x.setAttribute("aria-pressed", x.dataset.p === p ? "true" : "false"));
  rain();
});
bind(["#s-rf", "#s-rel", "#s-rr", "#s-hr"], rain);
bind(["#s-tilt", "#s-ar", "#s-pf", "#s-tec"], pol);

/* ===================================================================== */
/* MODULE 3 — antennas                                                   */
/* ===================================================================== */
function antenna() {
  const D = +$("#s-D").value, f = +$("#s-af").value, eta = +$("#s-eta").value, mis = +$("#s-mis").value;
  const lam = C0 * 1e3 / (f * 1e9);                 // metres (C0 is km/s)
  const G = eta * Math.pow(Math.PI * D / lam, 2);
  const Gd = dB(G);
  const th3 = 70 * lam / D;
  const Aeff = G * lam * lam / (4 * Math.PI);
  const ff = 2 * D * D / lam;
  const Lmis = 12 * Math.pow(mis / th3, 2);

  $("#v-D").textContent = fx(D, D < 10 ? 2 : 1) + " m";
  $("#v-af").textContent = fx(f, 1) + " GHz";
  $("#v-eta").textContent = fx(eta, 2);
  $("#v-mis").textContent = fx(mis, 2) + "°";

  kv($("#k-ant"), [
    ["Wavelength λ", fx(lam * 100, 2) + " <small>cm</small>"],
    ["Gain", fx(Gd, 2) + " <small>dBi</small>", "up"],
    ["Beamwidth θ₃dB", fx(th3, 3) + "°", "dn"],
    ["Effective aperture", fx(Aeff, 3) + " <small>m²</small>"],
    ["Physical area", fx(Math.PI * D * D / 4, 3) + " <small>m²</small>"],
    ["Far field begins", ff > 1000 ? fx(ff / 1000, 2) + " <small>km</small>" : fx(ff, 1) + " <small>m</small>"],
    ["Mispointing loss", fx(Lmis, 2) + " <small>dB</small>", Lmis > 1 ? "hot" : "ok"],
    ["Net gain on axis", fx(Gd - Lmis, 2) + " <small>dBi</small>", "up"]
  ]);

  const { g, W, H, c } = prep($("#c-pat"));
  const span = Math.max(th3 * 6, 0.4);
  const fr = Frame(g, c, { x: 56, y: 30, w: W - 96, h: H - 84 }, {
    xmin: -span, xmax: span, ymin: -45, ymax: 2,
    xticks: [-span, -span / 2, 0, span / 2, span].map(v => +v.toFixed(3)),
    yticks: [0, -10, -20, -30, -40],
    xfmt: v => fx(v, span < 1 ? 2 : 1) + "°",
    xlab: "Angle off boresight", ylab: "Relative gain (dB)"
  });
  const pat = [];
  for (let i = -400; i <= 400; i++) {
    const th = i / 400 * span;
    const u = Math.PI * D / lam * Math.sin(th * D2R);
    const v = Math.abs(u) < 1e-9 ? 1 : 2 * J1(u) / u;
    pat.push([th, 20 * Math.log10(Math.max(1e-6, Math.abs(v)))]);
  }
  fr.curve(pat, c.up, 2);
  lineTo(g, fr.box.x, fr.Y(-3), fr.box.x + fr.box.w, fr.Y(-3), c.down, 1, [5, 4]);
  txt(g, "−3 dB", fr.box.x + 6, fr.Y(-3) - 9, c.down, 10);
  [-1, 1].forEach(s => lineTo(g, fr.X(s * th3 / 2), fr.Y(-3), fr.X(s * th3 / 2), fr.Y(-45), c.down, 1, [2, 3]));
  txt(g, "θ₃dB = " + fx(th3, 3) + "°", fr.X(th3 / 2) + 6, fr.Y(-40), c.down, 10.5);
  lineTo(g, fr.box.x, fr.Y(-17.6), fr.box.x + fr.box.w, fr.Y(-17.6), c.grid, 1, [3, 4]);
  txt(g, "first sidelobe −17.6 dB (uniform illumination)", fr.box.x + fr.box.w - 6, fr.Y(-17.6) - 9, c.faint, 10, "right");
  if (mis > 0) {
    fr.clip(() => {
      lineTo(g, fr.X(mis), fr.box.y, fr.X(mis), fr.box.y + fr.box.h, c.hot, 1.6);
      disc(g, fr.X(mis), fr.Y(-Lmis), 5, c.hot);
    });
    txt(g, "mispointed −" + fx(Lmis, 2) + " dB", fr.X(mis) + 7, fr.box.y + 16, c.hot, 10.5);
  }
  txt(g, fx(Gd, 1) + " dBi  ·  D/λ = " + fx(D / lam, 0), fr.box.x + 8, fr.box.y + 14, c.up, 11);
}

function array() {
  const N = +$("#s-N").value, d = +$("#s-dsp").value, st = +$("#s-st").value;
  $("#v-N").textContent = N; $("#v-dsp").textContent = fx(d, 2) + " λ"; $("#v-st").textContent = st + "°";
  const k = 2 * Math.PI, beta = -k * d * Math.sin(st * D2R);
  const AF = th => {
    const psi = k * d * Math.sin(th * D2R) + beta;
    const den = N * Math.sin(psi / 2);
    return Math.abs(Math.abs(den) < 1e-9 ? 1 : Math.sin(N * psi / 2) / den);
  };
  const th3 = 0.886 / (N * d * Math.cos(st * D2R)) * R2D;
  const gratLim = 1 / (1 + Math.abs(Math.sin(st * D2R)));
  const Gmax = dB(N) + dB(Math.cos(st * D2R));

  kv($("#k-arr"), [
    ["Array length", fx((N - 1) * d, 1) + " λ"],
    ["Beamwidth", fx(th3, 2) + "°", "dn"],
    ["Directivity (broadside N·d)", fx(dB(2 * N * d), 1) + " <small>dBi</small>", "up"],
    ["Scan loss cos θ₀", fx(dB(Math.cos(st * D2R)), 2) + " <small>dB</small>", Math.abs(st) > 50 ? "hot" : "ok"],
    ["Grating-lobe limit d/λ", fx(gratLim, 3), d > gratLim ? "hot" : "ok"],
    ["Grating lobes", d > gratLim ? "PRESENT" : "none", d > gratLim ? "hot" : "ok"]
  ]);

  const { g, W, H, c } = prep($("#c-arr"));
  const fr = Frame(g, c, { x: 56, y: 30, w: W - 96, h: H - 112 }, {
    xmin: -90, xmax: 90, ymin: -40, ymax: 2,
    xticks: [-90, -60, -30, 0, 30, 60, 90], yticks: [0, -10, -20, -30, -40],
    xfmt: v => v + "°", xlab: "Angle from broadside", ylab: "Array factor (dB)"
  });
  const pts = [];
  for (let i = -900; i <= 900; i++) {
    const th = i / 10;
    pts.push([th, 20 * Math.log10(Math.max(1e-5, AF(th)))]);
  }
  fr.curve(pts, c.up, 2);
  lineTo(g, fr.X(st), fr.box.y, fr.X(st), fr.box.y + fr.box.h, c.down, 1.4, [4, 3]);
  txt(g, "steer " + st + "°", fr.X(st) + 6, fr.box.y + 14, c.down, 10.5);
  if (d > gratLim) txt(g, "GRATING LOBE — array is under-sampled", fr.box.x + 8, fr.box.y + 14, c.hot, 11);

  // element row
  const ey = H - 52;
  txt(g, "ELEMENTS", 56, ey - 18, c.faint, 10);
  const pitch = Math.min(18, (W - 160) / Math.max(1, N - 1));
  const x0 = 56;
  for (let i = 0; i < N; i++) {
    const x = x0 + i * pitch;
    disc(g, x, ey, 3.4, c.up);
    const ph = ((beta * i * R2D) % 360 + 360) % 360;
    lineTo(g, x, ey + 6, x, ey + 6 + ph / 360 * 16, c.down, 2);
  }
  txt(g, "progressive phase shift β = " + fx(beta * R2D, 1) + "° per element", x0 + N * pitch + 14, ey + 4, c.soft, 10.5);
}

seg("#seg-ant", b => {
  const [D, f, e] = b.dataset.a.split(",");
  $("#s-D").value = D; $("#s-af").value = f; $("#s-eta").value = e; antenna();
});
bind(["#s-D", "#s-af", "#s-eta", "#s-mis"], antenna);
bind(["#s-N", "#s-dsp", "#s-st"], array);

/* ===================================================================== */
/* MODULE 4 — link budget                                                */
/* ===================================================================== */
const LBPRE = {
  c:  { f: 4, eirp: 34, D: 3, t: 45, fd: 0.5, el: 35, rb: 36, esEirp: 80, satGT: -7, ful: 6 },
  ku: { f: 12, eirp: 51, D: 0.6, t: 80, fd: 0.3, el: 35, rb: 45, esEirp: 78, satGT: 3, ful: 14 },
  ka: { f: 20, eirp: 55, D: 0.9, t: 120, fd: 0.3, el: 40, rb: 50, esEirp: 65, satGT: 12, ful: 30 }
};
let lbPre = "c";

function linkBudget() {
  const f = +$("#s-lf").value, eirp = +$("#s-eirp").value, D = +$("#s-lD").value;
  const Tlna = +$("#s-tlna").value, Lfd = +$("#s-lfd").value, el = +$("#s-lel").value;
  const Arain = +$("#s-lrain").value, Rb = +$("#s-lrb").value;
  const P = LBPRE[lbPre];

  $("#v-lf").textContent = fx(f, 2) + " GHz"; $("#v-eirp").textContent = fx(eirp, 1) + " dBW";
  $("#v-lD").textContent = fx(D, 2) + " m"; $("#v-tlna").textContent = Tlna + " K";
  $("#v-lfd").textContent = fx(Lfd, 2) + " dB"; $("#v-lel").textContent = el + "°";
  $("#v-lrain").textContent = fx(Arain, 1) + " dB"; $("#v-lrb").textContent = Rb + " Mbit/s";

  const lam = C0 * 1e3 / (f * 1e9);
  const dSlant = RE * (Math.sqrt(Math.pow(AGEO / RE, 2) - Math.pow(Math.cos(el * D2R), 2)) - Math.sin(el * D2R));
  const FSL = 92.44 + 20 * Math.log10(dSlant) + 20 * Math.log10(f);
  const Grx = dB(0.65 * Math.pow(Math.PI * D / lam, 2));

  // noise
  const Az = 0.03 + 0.0005 * f * f;                       // clear-air zenith opacity, dB
  const Aatm = Az / Math.sin(el * D2R);
  const Atot = Aatm + Arain;
  const Tsky = 275 * (1 - Math.pow(10, -Atot / 10)) + 2.7;
  const Tgnd = 10 + 40 * Math.exp(-el / 10);
  const Tant = Tsky + Tgnd;
  const Lf = lin(Lfd);                                     // feeder loss factor
  const T2 = 400, G1 = lin(50), T3 = 2000, G2 = lin(20);   // following stages
  const Ts = Tant / Lf + 290 * (1 - 1 / Lf) + Tlna + T2 / G1 + T3 / (G1 * G2);
  const GT = Grx - Lfd - dB(Ts);

  const Lpoint = 0.3, Lmisc = 0.4;
  const CN0dn = eirp - FSL - Aatm - Arain - Lpoint - Lmisc + GT - KB_DB;
  const FSLup = 92.44 + 20 * Math.log10(dSlant) + 20 * Math.log10(P.ful);
  const CN0up = P.esEirp - FSLup - 0.5 + P.satGT - KB_DB;
  const CN0im = 72;                                        // intermodulation floor, dB-Hz
  const CN0t = -dB(lin(-CN0dn) + lin(-CN0up) + lin(-CN0im));
  const EbN0 = CN0t - dB(Rb * 1e6);
  const req = 4.0;
  const margin = EbN0 - req;
  const Rmax = Math.pow(10, (CN0t - req) / 10) / 1e6;

  kv($("#k-lb"), [
    ["Slant range", fx(dSlant, 0) + " <small>km</small>"],
    ["Free-space loss", fx(FSL, 1) + " <small>dB</small>", "hot"],
    ["ES antenna gain", fx(Grx, 1) + " <small>dBi</small>", "up"],
    ["System noise T_s", fx(Ts, 1) + " <small>K</small>"],
    ["G/T", fx(GT, 1) + " <small>dB/K</small>", "dn"],
    ["Uplink C/N₀", fx(CN0up, 1) + " <small>dB-Hz</small>"],
    ["Downlink C/N₀", fx(CN0dn, 1) + " <small>dB-Hz</small>"],
    ["Combined C/N₀", fx(CN0t, 1) + " <small>dB-Hz</small>", "dn"],
    ["E_b/N₀ at " + Rb + " Mbit/s", fx(EbN0, 2) + " <small>dB</small>", margin > 0 ? "ok" : "hot"],
    ["Margin over 4.0 dB", (margin >= 0 ? "+" : "") + fx(margin, 2) + " <small>dB</small>", margin > 2 ? "ok" : margin > 0 ? "up" : "hot"],
    ["Max supportable rate", fx(Rmax, 1) + " <small>Mbit/s</small>", "up"],
    ["Link state", margin > 0 ? "CLOSED" : "BROKEN", margin > 0 ? "ok" : "hot"]
  ]);

  // waterfall
  const rows = [
    ["Satellite EIRP", eirp, "g", 0],
    ["Free-space loss, " + fx(dSlant, 0) + " km", -FSL, "l", 0],
    ["Clear-air atmosphere", -Aatm, "l", 0],
    ["Rain attenuation", -Arain, "l", 0],
    ["Pointing + misc. losses", -(Lpoint + Lmisc), "l", 0],
    ["Power at the antenna flange", null, "", 1],
    ["Receive antenna gain, " + fx(D, 2) + " m", Grx, "g", 0],
    ["Feeder loss before LNA", -Lfd, "l", 0],
    ["Received carrier power C", null, "", 1],
    ["Noise density N₀ = kT_s", -(KB_DB + dB(Ts)), "l", 0],
    ["Downlink C/N₀", null, "", 1],
    ["Combined with uplink + IM", null, "", 1],
    ["Spread over " + Rb + " Mbit/s", -dB(Rb * 1e6), "l", 0],
    ["E_b/N₀ available", null, "", 1]
  ];
  let run = 0;
  const maxMag = FSL;
  const outs = [];
  rows.forEach(r => {
    if (r[3]) {
      let v;
      if (r[0].startsWith("Power at")) v = fx(eirp - FSL - Aatm - Arain - Lpoint - Lmisc, 1) + " dBW";
      else if (r[0].startsWith("Received")) v = fx(eirp - FSL - Aatm - Arain - Lpoint - Lmisc + Grx - Lfd, 1) + " dBW";
      else if (r[0].startsWith("Downlink")) v = fx(CN0dn, 1) + " dB-Hz";
      else if (r[0].startsWith("Combined")) v = fx(CN0t, 1) + " dB-Hz";
      else v = fx(EbN0, 2) + " dB";
      outs.push('<div class="sum"><span class="nm">' + r[0] + '</span><span class="db"></span><span></span><span class="tt">' + v + "</span></div>");
      return;
    }
    run += r[1];
    const w = Math.min(100, Math.abs(r[1]) / maxMag * 100);
    outs.push('<div><span class="nm">' + r[0] + '</span><span class="db ' + r[2] + '">' +
      (r[1] >= 0 ? "+" : "") + fx(r[1], 1) + '</span><span class="bar"><i class="' + r[2] +
      '" style="width:' + w.toFixed(1) + '%"></i></span><span class="tt">' + fx(run, 1) + "</span></div>");
  });
  $("#lad-lb").innerHTML = outs.join("");

  steps($("#st-noise"), [
    ["Sky noise from " + fx(Atot, 2) + " dB of total atmospheric loss", fx(Tsky, 1) + " K"],
    ["Ground pickup through sidelobes at " + el + "°", fx(Tgnd, 1) + " K"],
    ["Antenna temperature T_ant", fx(Tant, 1) + " K"],
    ["Referred through " + fx(Lfd, 2) + " dB feeder", fx(Tant / Lf + 290 * (1 - 1 / Lf), 1) + " K"],
    ["Plus LNA", "+" + Tlna + " K"],
    ["Plus following stages T₂/G₁ + T₃/G₁G₂", "+" + fx(T2 / G1 + T3 / (G1 * G2), 2) + " K"],
    ["System noise temperature T_s", fx(Ts, 1) + " K"]
  ]);

  // noise stack
  const { g, W, H, c } = prep($("#c-noise"));
  const parts = [
    ["Sky / atmosphere", Tsky / Lf, c.down],
    ["Ground pickup", Tgnd / Lf, c.violet],
    ["Feeder loss", 290 * (1 - 1 / Lf), c.hot],
    ["LNA", Tlna, c.up],
    ["Later stages", T2 / G1 + T3 / (G1 * G2), c.faint]
  ];
  const bx = 40, bw = W - 80, by = 60, bh = 58;
  let acc = 0;
  txt(g, "SYSTEM NOISE TEMPERATURE — " + fx(Ts, 1) + " K", bx, 32, c.faint, 11);
  parts.forEach(p => {
    const w = p[1] / Ts * bw;
    g.fillStyle = p[2]; g.fillRect(bx + acc, by, Math.max(0, w), bh);
    acc += w;
  });
  g.save(); g.strokeStyle = c.line; g.strokeRect(bx, by, bw, bh); g.restore();
  acc = 0;
  parts.forEach((p, i) => {
    const w = p[1] / Ts * bw;
    if (w > 42) {
      txt(g, fx(p[1], 0) + " K", bx + acc + w / 2, by + bh / 2, onFill(p[2], 1, c.panel), 11, "center");
    }
    const lx = bx + (i % 3) * (bw / 3), ly = by + bh + 28 + Math.floor(i / 3) * 22;
    g.fillStyle = p[2]; g.fillRect(lx, ly - 5, 10, 10);
    txt(g, p[0] + "  " + fx(p[1], 1) + " K", lx + 16, ly, c.soft, 10.5);
    acc += w;
  });
  txt(g, "G/T = " + fx(GT, 1) + " dB/K", bx, H - 24, c.down, 13);
  if (Arain > 0) txt(g, "rain is adding " + fx(275 * (1 - Math.pow(10, -(Aatm + Arain) / 10)) - 275 * (1 - Math.pow(10, -Aatm / 10)), 0) +
    " K of sky noise on top of " + fx(Arain, 1) + " dB of attenuation", bx + 170, H - 24, c.hot, 11);
}

seg("#seg-lb", b => {
  lbPre = b.dataset.lb;
  const P = LBPRE[lbPre];
  $("#s-lf").value = P.f; $("#s-eirp").value = P.eirp; $("#s-lD").value = P.D;
  $("#s-tlna").value = P.t; $("#s-lfd").value = P.fd; $("#s-lel").value = P.el;
  $("#s-lrb").value = P.rb; $("#s-lrain").value = 0;
  linkBudget();
});
bind(["#s-lf", "#s-eirp", "#s-lD", "#s-tlna", "#s-lfd", "#s-lel", "#s-lrain", "#s-lrb"], linkBudget);

/* ===================================================================== */
/* MODULE 5 — signals and coding                                         */
/* ===================================================================== */
const MODS5 = {
  BPSK: { m: 2, pts: [[1, 0], [-1, 0]] },
  QPSK: { m: 4, pts: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(p => [p[0] / Math.SQRT2, p[1] / Math.SQRT2]) },
  "8PSK": { m: 8, pts: Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]) },
  "16QAM": { m: 16, pts: (() => { const p = []; for (const i of [-3, -1, 1, 3]) for (const q of [-3, -1, 1, 3]) p.push([i / Math.sqrt(10), q / Math.sqrt(10)]); return p; })() },
  "16APSK": { m: 16, pts: (() => {
      const p = [], r1 = 1 / 2.7, r2 = 1;
      for (let i = 0; i < 4; i++) p.push([r1 * Math.cos(Math.PI / 4 + i * Math.PI / 2), r1 * Math.sin(Math.PI / 4 + i * Math.PI / 2)]);
      for (let i = 0; i < 12; i++) p.push([r2 * Math.cos(i * Math.PI / 6), r2 * Math.sin(i * Math.PI / 6)]);
      const e = Math.sqrt(p.reduce((s, q) => s + q[0] * q[0] + q[1] * q[1], 0) / 16);
      return p.map(q => [q[0] / e, q[1] / e]);
    })() }
};
function berTheory(mod, ebn0dB) {
  const g = lin(ebn0dB);
  switch (mod) {
    case "BPSK": case "QPSK": return Q(Math.sqrt(2 * g));
    case "8PSK": return (2 / 3) * Q(Math.sqrt(2 * 3 * g) * Math.sin(Math.PI / 8));
    case "16QAM": return (3 / 8) * erfc(Math.sqrt(0.4 * g));
    case "16APSK": return (3 / 8) * erfc(Math.sqrt(0.34 * g));
  }
  return NaN;
}
let modSel = "BPSK";

function constellation() {
  const ebn0 = +$("#s-ebn").value, n = +$("#s-nsym").value;
  $("#v-ebn").textContent = fx(ebn0, 1) + " dB"; $("#v-nsym").textContent = n;
  const M = MODS5[modSel], k = Math.log2(M.m);
  const es = lin(ebn0) * k;                 // Es/N0
  const sigma = Math.sqrt(1 / (2 * es));    // per I/Q axis, unit average symbol energy
  const rnd = RNG(20260101);
  const { g, W, H, c } = prep($("#c-const"));
  const cx = W * 0.33, cy = H / 2, R = Math.min(H / 2 - 32, W * 0.28);
  const S = 1.65;
  const PX = v => cx + v / S * R, PY = v => cy - v / S * R;

  lineTo(g, cx - R, cy, cx + R, cy, c.grid, 1);
  lineTo(g, cx, cy - R, cx, cy + R, c.grid, 1);
  let err = 0;
  g.save(); g.beginPath(); g.rect(cx - R, cy - R, 2 * R, 2 * R); g.clip();
  for (let i = 0; i < n; i++) {
    const s = (rnd() * M.m) | 0;
    const I = M.pts[s][0] + gauss(rnd) * sigma, Qn = M.pts[s][1] + gauss(rnd) * sigma;
    let best = 0, bd = 1e9;
    for (let j = 0; j < M.m; j++) {
      const dd = (I - M.pts[j][0]) ** 2 + (Qn - M.pts[j][1]) ** 2;
      if (dd < bd) { bd = dd; best = j; }
    }
    if (best !== s) err++;
    g.fillStyle = best === s ? c.down : c.hot;
    g.globalAlpha = best === s ? 0.5 : 0.95;
    g.fillRect(PX(I) - 1, PY(Qn) - 1, 2, 2);
  }
  g.globalAlpha = 1; g.restore();
  M.pts.forEach(p => {
    disc(g, PX(p[0]), PY(p[1]), 4.5, c.ink);
    g.save(); g.strokeStyle = c.sunk; g.lineWidth = 1.4; g.beginPath(); g.arc(PX(p[0]), PY(p[1]), 4.5, 0, 7); g.stroke(); g.restore();
  });
  g.save(); g.strokeStyle = c.line; g.strokeRect(cx - R, cy - R, 2 * R, 2 * R); g.restore();
  txt(g, modSel + "  ·  " + k + " bit/symbol", cx - R, cy - R - 14, c.ink, 12);
  txt(g, "I", cx + R - 6, cy + 14, c.faint, 10);
  txt(g, "Q", cx + 8, cy - R + 8, c.faint, 10);

  const ser = err / n;
  const berMeas = ser / k;
  const berTh = berTheory(modSel, ebn0);

  // right: distance geometry explanation
  const bx = W * 0.66;
  txt(g, "WHY ERRORS HAPPEN", bx, 36, c.faint, 10);
  const dmin = (() => {
    let m = 1e9;
    for (let i = 0; i < M.m; i++) for (let j = i + 1; j < M.m; j++)
      m = Math.min(m, Math.hypot(M.pts[i][0] - M.pts[j][0], M.pts[i][1] - M.pts[j][1]));
    return m;
  })();
  const lines = [
    ["Symbol energy E_s/N₀", fx(dB(es), 2) + " dB"],
    ["Noise σ per axis", fx(sigma, 4)],
    ["Minimum distance d_min", fx(dmin, 4)],
    ["d_min / 2σ", fx(dmin / (2 * sigma), 2)],
    ["Symbols in error", err + " of " + n],
    ["Measured SER", ser === 0 ? "0 (none seen)" : ser.toExponential(2)],
    ["Measured BER (Gray)", berMeas === 0 ? "< " + (1 / (n * k)).toExponential(1) : berMeas.toExponential(2)],
    ["Theoretical BER", berTh.toExponential(2)]
  ];
  lines.forEach((l, i) => {
    const y = 62 + i * 24;
    txt(g, l[0], bx, y, c.soft, 10.5, "left", false);
    txt(g, l[1], W - 24, y, c.ink, 11, "right");
    lineTo(g, bx, y + 11, W - 24, y + 11, c.line2, 1);
  });

  kv($("#k-const"), [
    ["Bits per symbol", String(k)],
    ["E_s/N₀", fx(dB(es), 2) + " <small>dB</small>"],
    ["Measured BER", berMeas === 0 ? "none in " + n : berMeas.toExponential(2), berMeas > 1e-2 ? "hot" : "dn"],
    ["Theory BER", berTh.toExponential(2), "up"],
    ["Spectral efficiency", fx(k / 1.35, 2) + " <small>b/s/Hz</small>"],
    ["Errors drawn", String(err), err ? "hot" : "ok"]
  ]);
}

const CODES = { none: ["Uncoded", 0], conv: ["Conv (7,½) + Viterbi", 5.1], rsconv: ["RS + conv concatenated", 7.1], turbo: ["Turbo / LDPC r=½", 8.8] };
let codeSel = "none";
function berPlot() {
  const { g, W, H, c } = prep($("#c-ber"));
  const fr = Frame(g, c, { x: 62, y: 26, w: W - 104, h: H - 84 }, {
    xmin: -2, xmax: 14, ymin: 1e-8, ymax: 0.5, ylog: true,
    xticks: [-2, 0, 2, 4, 6, 8, 10, 12, 14],
    yticks: [1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1],
    yfmt: v => "1e" + Math.round(Math.log10(v)),
    xlab: "E_b/N₀ (dB)", ylab: "Bit error rate"
  });
  // Shannon wall
  fr.clip(() => {
    g.fillStyle = c.hot; g.globalAlpha = .12;
    g.fillRect(fr.box.x, fr.box.y, fr.X(-1.59) - fr.box.x, fr.box.h); g.globalAlpha = 1;
    lineTo(g, fr.X(-1.59), fr.box.y, fr.X(-1.59), fr.box.y + fr.box.h, c.hot, 2, [5, 4]);
  });
  txt(g, "Shannon −1.59 dB", fr.X(-1.59) + 7, fr.box.y + 14, c.hot, 10.5);

  const unc = [];
  for (let e = -2; e <= 14; e += 0.1) unc.push([e, berTheory("BPSK", e)]);
  fr.curve(unc, c.faint, 1.6, [5, 4]);
  txt(g, "uncoded BPSK", fr.X(11.2), fr.Y(1e-7) - 10, c.faint, 10);

  const gain = CODES[codeSel][1];
  if (gain > 0) {
    const cod = [];
    for (let e = -2; e <= 14; e += 0.05) {
      // waterfall: shifted curve with a steeper slope near threshold
      const eff = e + gain;
      let b = berTheory("BPSK", eff);
      const thr = 10.5 - gain;
      if (e < thr) b = Math.min(0.5, b * Math.pow(10, (thr - e) * 1.9));
      cod.push([e, b]);
    }
    fr.curve(cod, c.down, 2.4);
    const at5 = 9.6 - gain;
    fr.clip(() => {
      lineTo(g, fr.X(at5), fr.Y(1e-5), fr.X(9.6), fr.Y(1e-5), c.up, 2);
      disc(g, fr.X(at5), fr.Y(1e-5), 4, c.up);
      disc(g, fr.X(9.6), fr.Y(1e-5), 4, c.up);
    });
    txt(g, "coding gain " + fx(gain, 1) + " dB", fr.X((at5 + 9.6) / 2), fr.Y(1e-5) - 12, c.up, 11, "center");
    txt(g, CODES[codeSel][0], fr.X(at5) - 6, fr.Y(1e-7), c.down, 10.5, "right");
  }
  lineTo(g, fr.box.x, fr.Y(1e-5), fr.box.x + fr.box.w, fr.Y(1e-5), c.grid, 1, [2, 4]);
  txt(g, "target 10⁻⁵", fr.box.x + fr.box.w - 6, fr.Y(1e-5) - 9, c.faint, 10, "right");

  const need = 9.6 - gain;
  kv($("#k-ber"), [
    ["Scheme", CODES[codeSel][0]],
    ["E_b/N₀ for BER 10⁻⁵", fx(need, 1) + " <small>dB</small>", "up"],
    ["Coding gain", fx(gain, 1) + " <small>dB</small>", "dn"],
    ["Gap to Shannon", fx(need + 1.59, 1) + " <small>dB</small>", "hot"],
    ["Equivalent power saving", "×" + fx(lin(gain), 1)],
    ["Same as dish diameter", "×" + fx(Math.pow(lin(gain), 0.5), 2)]
  ]);
}

function eye() {
  const a = +$("#s-roll").value, toff = +$("#s-toff").value, nz = +$("#s-enoise").value;
  $("#v-roll").textContent = fx(a, 2); $("#v-toff").textContent = toff + " %"; $("#v-enoise").textContent = fx(nz, 3);
  const rc = t => {
    if (Math.abs(t) < 1e-9) return 1;
    const den = 1 - Math.pow(2 * a * t, 2);
    const sinc = Math.sin(Math.PI * t) / (Math.PI * t);
    if (Math.abs(den) < 1e-7) return sinc * Math.PI / 4;
    return sinc * Math.cos(Math.PI * a * t) / den;
  };
  const rnd = RNG(7777);
  const N = 240, bits = Array.from({ length: N }, () => (rnd() < 0.5 ? -1 : 1));
  const SPAN = 6, OS = 48;
  const { g, W, H, c } = prep($("#c-eye"));
  const bx = 56, by = 28, bw = W - 96, bh = H - 76;
  g.save(); g.strokeStyle = c.line; g.strokeRect(bx, by, bw, bh); g.restore();
  lineTo(g, bx, by + bh / 2, bx + bw, by + bh / 2, c.grid, 1);
  lineTo(g, bx + bw / 2, by, bx + bw / 2, by + bh, c.grid, 1, [3, 3]);
  const Yv = v => by + bh / 2 - v / 1.8 * (bh / 2);
  g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
  g.strokeStyle = c.down; g.lineWidth = 0.8; g.globalAlpha = 0.5;
  let minEye = 2, maxCross = 0;
  for (let s = SPAN; s < N - SPAN; s++) {
    g.beginPath();
    for (let i = 0; i <= OS * 2; i++) {
      const tt = -1 + i / OS;
      let v = 0;
      for (let k = -SPAN; k <= SPAN; k++) v += bits[s + k] * rc(tt - k);
      if (nz) v += gauss(RNG(s * 977 + i)) * nz;
      const x = bx + (tt + 1) / 2 * bw;
      if (i === 0) g.moveTo(x, Yv(v)); else g.lineTo(x, Yv(v));
    }
    g.stroke();
    // eye opening at the sampling instant
    let v0 = 0;
    const ts = toff / 100;
    for (let k = -SPAN; k <= SPAN; k++) v0 += bits[s + k] * rc(ts - k);
    if (bits[s] > 0) minEye = Math.min(minEye, v0); else minEye = Math.min(minEye, -v0);
  }
  g.globalAlpha = 1; g.restore();
  const xs = bx + (toff / 100 + 1) / 2 * bw;
  lineTo(g, xs, by, xs, by + bh, c.up, 1.8);
  txt(g, "sampling instant", xs + 6, by + 14, c.up, 10.5);
  lineTo(g, bx, Yv(minEye), bx + bw, Yv(minEye), c.hot, 1, [4, 3]);
  lineTo(g, bx, Yv(-minEye), bx + bw, Yv(-minEye), c.hot, 1, [4, 3]);
  txt(g, "eye opening " + fx(minEye * 2, 3), bx + 8, Yv(minEye) - 10, c.hot, 10.5);
  txt(g, "−1 T", bx, by + bh + 16, c.faint, 10);
  txt(g, "0", bx + bw / 2, by + bh + 16, c.faint, 10, "center");
  txt(g, "+1 T", bx + bw, by + bh + 16, c.faint, 10, "right");
  txt(g, "ROLL-OFF α = " + fx(a, 2) + "  ·  occupied bandwidth = (1+α)/2T", bx, 18, c.faint, 10);

  kv($("#k-eye"), [
    ["Eye opening", fx(Math.max(0, minEye * 2), 3), minEye < 0.3 ? "hot" : "ok"],
    ["Noise margin", minEye > 0 ? fx(20 * Math.log10(Math.max(1e-3, minEye)), 1) + " <small>dB</small>" : "closed", minEye <= 0 ? "hot" : "dn"],
    ["Bandwidth × T", fx((1 + a) / 2, 3)],
    ["Excess over Nyquist", fx(a * 100, 0) + " <small>%</small>", "up"],
    ["Timing offset", toff + " <small>%</small>", Math.abs(toff) > 25 ? "hot" : "ok"],
    ["Verdict", minEye > 0.5 ? "healthy" : minEye > 0.15 ? "marginal" : "closed", minEye > 0.5 ? "ok" : minEye > 0.15 ? "up" : "hot"]
  ]);
}

/* Hamming (7,4): codeword c = [p1 p2 d1 p3 d2 d3 d4] */
let flipPos = -1;
function hamming() {
  const m = +$("#s-msg").value;
  const d = [(m >> 3) & 1, (m >> 2) & 1, (m >> 1) & 1, m & 1];
  $("#v-msg").textContent = d.join("");
  const p1 = d[0] ^ d[1] ^ d[3], p2 = d[0] ^ d[2] ^ d[3], p3 = d[1] ^ d[2] ^ d[3];
  const code = [p1, p2, d[0], p3, d[1], d[2], d[3]];
  const rx = code.slice();
  if (flipPos >= 0 && flipPos < 7) rx[flipPos] ^= 1;
  const s1 = rx[0] ^ rx[2] ^ rx[4] ^ rx[6];
  const s2 = rx[1] ^ rx[2] ^ rx[5] ^ rx[6];
  const s3 = rx[3] ^ rx[4] ^ rx[5] ^ rx[6];
  const syn = s1 + 2 * s2 + 4 * s3;
  const fixed = rx.slice();
  if (syn) fixed[syn - 1] ^= 1;
  const ok = fixed.every((v, i) => v === code[i]);

  if (!$("#seg-flip").children.length) {
    $("#seg-flip").innerHTML = '<button data-fp="-1" aria-pressed="true">no error</button>' +
      [0, 1, 2, 3, 4, 5, 6].map(i => '<button data-fp="' + i + '">flip bit ' + (i + 1) + "</button>").join("") +
      '<button data-fp="9">flip 3 and 5</button>';
  }

  kv($("#k-ham"), [
    ["Message d", d.join("")],
    ["Codeword (7 bits)", code.join("")],
    ["Received", rx.join("")],
    ["Syndrome s₃s₂s₁", "" + s3 + s2 + s1 + " = " + syn, syn ? "hot" : "ok"],
    ["Decoder says", syn === 0 ? "no error" : "bit " + syn + " is wrong", syn ? "up" : "ok"],
    ["Result", ok ? "CORRECTED" : "MIS-CORRECTED", ok ? "ok" : "hot"]
  ]);

  const { g, W, H, c } = prep($("#c-ham"));
  // Venn
  const cx = 230, cy = H / 2 - 8, R = 92;
  const centres = [[cx - R * 0.52, cy - R * 0.40], [cx + R * 0.52, cy - R * 0.40], [cx, cy + R * 0.52]];
  const cols = [c.up, c.down, c.violet];
  centres.forEach((p, i) => {
    g.save(); g.strokeStyle = cols[i]; g.lineWidth = 1.8; g.globalAlpha = .9;
    g.beginPath(); g.arc(p[0], p[1], R, 0, 7); g.stroke(); g.restore();
  });
  txt(g, "C₁", centres[0][0] - R + 8, centres[0][1] - R + 16, cols[0], 11);
  txt(g, "C₂", centres[1][0] + R - 8, centres[1][1] - R + 16, cols[1], 11, "right");
  txt(g, "C₃", centres[2][0], centres[2][1] + R - 10, cols[2], 11, "center");
  const slots = [
    [centres[0][0] - 38, centres[0][1] - 18, "p1", 0],
    [centres[1][0] + 38, centres[1][1] - 18, "p2", 1],
    [cx, cy - 44, "d1", 2],
    [centres[2][0], centres[2][1] + 36, "p3", 3],
    [cx - 46, cy + 22, "d2", 4],
    [cx + 46, cy + 22, "d3", 5],
    [cx, cy + 2, "d4", 6]
  ];
  slots.forEach(s => {
    const bad = (flipPos === s[3]) || (flipPos === 9 && (s[3] === 2 || s[3] === 4));
    disc(g, s[0], s[1], 15, bad ? c.hot : c.panel);
    g.save(); g.strokeStyle = bad ? c.hot : c.line; g.lineWidth = 1.4;
    g.beginPath(); g.arc(s[0], s[1], 15, 0, 7); g.stroke(); g.restore();
    txt(g, String(rx[s[3]]), s[0], s[1] - 1, bad ? onFill(c.hot, 1, c.panel) : c.ink, 14, "center");
    txt(g, s[2], s[0], s[1] + 25, c.faint, 9, "center");
  });
  txt(g, "HAMMING (7,4) — EACH CIRCLE MUST HOLD AN EVEN NUMBER OF ONES", 24, 20, c.faint, 10);

  // right panel
  const bx = 480;
  const rows = [
    ["Parity equations", ""],
    ["s₁ = p1 ⊕ d1 ⊕ d2 ⊕ d4", String(s1)],
    ["s₂ = p2 ⊕ d1 ⊕ d3 ⊕ d4", String(s2)],
    ["s₃ = p3 ⊕ d2 ⊕ d3 ⊕ d4", String(s3)],
    ["Syndrome value", String(syn)],
    [syn ? "→ invert received bit " + syn : "→ accept as received", ""],
    ["Corrected codeword", fixed.join("")],
    ["Original codeword", code.join("")],
    [ok ? "Decoding succeeded" : "Decoding FAILED — two errors", ""]
  ];
  rows.forEach((r, i) => {
    const y = 56 + i * 32;
    const hot = (i === 8 && !ok) || (i === 5 && syn);
    txt(g, r[0], bx, y, i === 0 ? c.faint : (hot ? (ok ? c.ok : c.hot) : c.soft), i === 0 ? 10 : 11.5, "left", i !== 0);
    if (r[1]) txt(g, r[1], W - 28, y, c.ink, 12, "right");
    if (i) lineTo(g, bx, y + 14, W - 28, y + 14, c.line2, 1);
  });
}

seg("#seg-mod", b => { modSel = b.dataset.m; constellation(); });
seg("#seg-code", b => { codeSel = b.dataset.c; berPlot(); });
bind(["#s-ebn", "#s-nsym"], constellation);
bind(["#s-roll", "#s-toff", "#s-enoise"], eye);
bind(["#s-msg"], hamming);
document.addEventListener("click", e => {
  const b = e.target.closest("#seg-flip button");
  if (!b) return;
  Array.from(b.parentNode.children).forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  flipPos = +b.dataset.fp;
  hamming();
});

/* ===================================================================== */
/* MODULE 6 — access, networks, services                                 */
/* ===================================================================== */
let maSel = "fdma";
function multipleAccess() {
  const n = +$("#s-users").value, gp = +$("#s-guard").value, BW = +$("#s-bw").value;
  $("#v-users").textContent = n; $("#v-guard").textContent = gp + " %"; $("#v-bw").textContent = BW + " MHz";
  const { g, W, H, c } = prep($("#c-ma"));
  const bx = 62, by = 46, bw = W - 110, bh = H - 110;
  g.save(); g.strokeStyle = c.line; g.strokeRect(bx, by, bw, bh); g.restore();
  txt(g, "FREQUENCY", bx - 8, by - 16, c.faint, 10, "right");
  g.save(); g.translate(bx - 40, by + bh / 2); g.rotate(-Math.PI / 2);
  txt(g, "FREQUENCY", 0, 0, c.soft, 10.5, "center"); g.restore();
  txt(g, "TIME →", bx + bw, by + bh + 20, c.soft, 10.5, "right");

  const palette = [c.up, c.down, c.violet, c.ok, c.hot, "#3F77B8", "#B0518A", "#7A7F1F"];
  let eff = 0, perUser = 0, note = "";
  if (maSel === "fdma") {
    const gb = gp / 100;
    const slotH = bh / n;
    for (let i = 0; i < n; i++) {
      const y = by + i * slotH;
      const h = slotH * (1 - gb);
      g.fillStyle = palette[i % palette.length]; g.globalAlpha = .75;
      g.fillRect(bx + 1, y + slotH * gb / 2, bw - 2, h); g.globalAlpha = 1;
      if (h > 13) txt(g, "user " + (i + 1), bx + 8, y + slotH / 2,
                      onFill(palette[i % palette.length], .75, c.sunk), 10.5);
    }
    eff = (1 - gb) * (n > 1 ? 1 : 1);
    const backoff = Math.min(6, 1.2 * Math.log2(Math.max(1, n)));
    perUser = BW * eff / n;
    note = "each carrier is on continuously; the amplifier must back off " + fx(backoff, 1) + " dB to limit intermodulation";
    eff = eff * lin(-backoff / 3);
  } else if (maSel === "tdma") {
    const gt = gp / 100;
    const slotW = bw / n;
    for (let i = 0; i < n; i++) {
      const x = bx + i * slotW;
      g.fillStyle = palette[i % palette.length]; g.globalAlpha = .75;
      g.fillRect(x + slotW * gt / 2, by + 1, slotW * (1 - gt), bh - 2); g.globalAlpha = 1;
      if (slotW > 40) txt(g, "u" + (i + 1), x + slotW / 2, by + bh / 2,
                          onFill(palette[i % palette.length], .75, c.sunk), 11, "center");
    }
    eff = 1 - gt;
    perUser = BW * eff / n;
    note = "one carrier at a time, so the amplifier runs at saturation — but every burst pays preamble and guard time";
  } else {
    const rnd = RNG(4242);
    for (let i = 0; i < n; i++) {
      g.fillStyle = palette[i % palette.length]; g.globalAlpha = .34;
      for (let k = 0; k < 160; k++) {
        const x = bx + rnd() * (bw - 6), y = by + rnd() * (bh - 6);
        g.fillRect(x, y, 6, 6);
      }
      g.globalAlpha = 1;
    }
    const pg = 31;
    const sir = pg / Math.max(1, n - 1);
    eff = Math.min(1, dB(sir) / 10);
    perUser = BW / pg;
    note = "every user occupies the whole band all the time; capacity is limited by mutual interference, C/I = " + fx(dB(sir), 1) + " dB";
  }
  txt(g, maSel.toUpperCase(), bx + bw - 6, by + 16, c.ink, 13, "right");
  txt(g, note, bx, H - 18, c.faint, 10.5);

  kv($("#k-ma"), [
    ["Scheme", maSel.toUpperCase()],
    ["Users", String(n)],
    ["Usable fraction", fx(eff * 100, 1) + " <small>%</small>", eff > 0.8 ? "ok" : eff > 0.5 ? "up" : "hot"],
    ["Throughput per user", fx(perUser, 2) + " <small>MHz</small>", "dn"],
    ["Total usable", fx(BW * eff, 1) + " <small>MHz</small>", "up"],
    ["Main cost", maSel === "fdma" ? "backoff + guard bands" : maSel === "tdma" ? "guard time + preamble" : "self-interference"]
  ]);
}

let rttSel = 540;
function tcp() {
  const rate = +$("#s-tr").value, win = +$("#s-tw").value, lossP = +$("#s-tl").value / 10000;
  $("#v-tr").textContent = rate + " Mbit/s"; $("#v-tw").textContent = win + " kB";
  $("#v-tl").textContent = fx(lossP * 100, 3) + " %";
  const rtt = rttSel / 1000;
  const bdp = rate * 1e6 * rtt / 8 / 1024;                    // kB
  const winLimited = win * 1024 * 8 / rtt / 1e6;              // Mbit/s
  const MSS = 1460;
  const mathis = lossP > 0 ? (MSS * 8 / rtt * Math.sqrt(1.5 / lossP)) / 1e6 : Infinity;
  const thr = Math.min(rate, winLimited, mathis);
  const slowStart = Math.ceil(Math.log2(Math.max(1, (win * 1024) / MSS))) * rttSel;

  kv($("#k-tcp"), [
    ["Round-trip time", rttSel + " <small>ms</small>", rttSel > 300 ? "hot" : "dn"],
    ["Bandwidth-delay product", fx(bdp, 1) + " <small>kB</small>", "up"],
    ["Window-limited rate", fx(winLimited, 2) + " <small>Mbit/s</small>", winLimited < rate ? "hot" : "ok"],
    ["Loss-limited rate", isFinite(mathis) ? fx(mathis, 2) + " <small>Mbit/s</small>" : "no loss", mathis < rate ? "hot" : "ok"],
    ["Achieved throughput", fx(thr, 2) + " <small>Mbit/s</small>", thr > rate * 0.8 ? "ok" : "hot"],
    ["Link utilisation", fx(thr / rate * 100, 1) + " <small>%</small>", thr / rate > 0.8 ? "ok" : "hot"],
    ["Window needed for full rate", fx(bdp, 0) + " <small>kB</small>", bdp > 64 ? "hot" : "ok"],
    ["Slow start to fill window", fx(slowStart / 1000, 2) + " <small>s</small>", slowStart > 2000 ? "hot" : "up"]
  ]);

  const { g, W, H, c } = prep($("#c-tcp"));
  const fr = Frame(g, c, { x: 62, y: 28, w: W - 104, h: H - 92 }, {
    xmin: 8, xmax: 2048, ymin: 0.1, ymax: Math.max(10, rate * 1.4), xlog: true, ylog: true,
    xticks: [8, 32, 128, 512, 2048], yticks: [0.1, 1, 10, 100],
    xfmt: v => v + "kB", yfmt: v => v < 1 ? v.toFixed(1) : String(v),
    xlab: "TCP receive window", ylab: "Throughput (Mbit/s)"
  });
  [[20, "Terrestrial 20 ms"], [50, "LEO 50 ms"], [180, "MEO 180 ms"], [540, "GEO 540 ms"]].forEach(([r, lab]) => {
    const pts = [];
    for (let w = 8; w <= 2048; w *= 1.08) {
      const wl = w * 1024 * 8 / (r / 1000) / 1e6;
      pts.push([w, Math.min(rate, wl, lossP > 0 ? (MSS * 8 / (r / 1000) * Math.sqrt(1.5 / lossP)) / 1e6 : Infinity)]);
    }
    const on = r === rttSel;
    fr.curve(pts, on ? c.up : c.line, on ? 2.6 : 1.2);
    if (on) txt(g, lab, fr.X(2048) - 6, fr.Y(Math.min(rate, 2048 * 1024 * 8 / (r / 1000) / 1e6)) - 11, c.up, 10.5, "right");
  });
  fr.clip(() => {
    lineTo(g, fr.box.x, fr.Y(rate), fr.box.x + fr.box.w, fr.Y(rate), c.down, 1.4, [5, 4]);
    disc(g, fr.X(win), fr.Y(thr), 5, c.hot);
    lineTo(g, fr.X(bdp), fr.box.y, fr.X(bdp), fr.box.y + fr.box.h, c.violet, 1.4, [3, 3]);
  });
  txt(g, "link rate " + rate + " Mbit/s", fr.box.x + 8, fr.Y(rate) - 10, c.down, 10.5);
  txt(g, "BDP", fr.X(bdp) + 5, fr.box.y + 14, c.violet, 10.5);
  txt(g, "THROUGHPUT IS CAPPED BY WINDOW ÷ RTT", 62, 18, c.faint, 10);
}

function gps() {
  const n = +$("#s-gn").value, spread = +$("#s-gs").value, sig = +$("#s-ge").value;
  $("#v-gn").textContent = n; $("#v-gs").textContent = spread + "°"; $("#v-ge").textContent = fx(sig, 1) + " m";
  const sats = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const az = 90 + spread * (t - 0.5);
    const el = 20 + 55 * Math.abs(Math.sin(1.7 * i + 0.6));
    sats.push({ az, el });
  }
  const Hm = sats.map(s => {
    const a = s.az * D2R, e = s.el * D2R;
    return [-Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), -Math.sin(e), 1];
  });
  const HtH = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => Hm.reduce((s, r) => s + r[i] * r[j], 0)));
  const Qm = matInv(HtH);
  let gdop = NaN, hdop = NaN, vdop = NaN, tdop = NaN;
  if (Qm) {
    hdop = Math.sqrt(Math.max(0, Qm[0][0] + Qm[1][1]));
    vdop = Math.sqrt(Math.max(0, Qm[2][2]));
    tdop = Math.sqrt(Math.max(0, Qm[3][3]));
    gdop = Math.sqrt(Math.max(0, Qm[0][0] + Qm[1][1] + Qm[2][2] + Qm[3][3]));
  }
  const rate = g => g < 2 ? "excellent" : g < 5 ? "good" : g < 10 ? "moderate" : "poor";

  kv($("#k-gps"), [
    ["Satellites used", String(n), n < 4 ? "hot" : "ok"],
    ["GDOP", n < 4 ? "unsolvable" : fx(gdop, 2), gdop > 6 ? "hot" : "ok"],
    ["HDOP", n < 4 ? "—" : fx(hdop, 2), "dn"],
    ["VDOP", n < 4 ? "—" : fx(vdop, 2)],
    ["Horizontal error (1σ)", n < 4 ? "—" : fx(hdop * sig, 1) + " <small>m</small>", hdop * sig > 20 ? "hot" : "up"],
    ["Vertical error (1σ)", n < 4 ? "—" : fx(vdop * sig, 1) + " <small>m</small>"],
    ["Geometry", n < 4 ? "need 4 for x,y,z,t" : rate(gdop), gdop > 6 ? "hot" : "ok"],
    ["Clock bias solved?", n >= 4 ? "yes" : "no", n >= 4 ? "ok" : "hot"]
  ]);

  const { g, W, H, c } = prep($("#c-gps"));
  const cx = W * 0.27, cy = H / 2, R = Math.min(H / 2 - 30, W * 0.22);
  [0, 30, 60].forEach(e => {
    const rr = R * (90 - e) / 90;
    g.save(); g.strokeStyle = e === 0 ? c.line : c.grid; g.lineWidth = e === 0 ? 1.4 : 1;
    g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); g.restore();
  });
  for (let a = 0; a < 360; a += 45) {
    const th = (a - 90) * D2R;
    lineTo(g, cx, cy, cx + R * Math.cos(th), cy + R * Math.sin(th), c.grid, .7);
  }
  ["N", "E", "S", "W"].forEach((s, i) => {
    const th = (i * 90 - 90) * D2R;
    txt(g, s, cx + (R + 12) * Math.cos(th), cy + (R + 12) * Math.sin(th), c.soft, 10.5, "center");
  });
  sats.forEach((s, i) => {
    const rr = R * (90 - s.el) / 90, th = (s.az - 90) * D2R;
    const x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th);
    lineTo(g, cx, cy, x, y, c.line, 1, [2, 3]);
    disc(g, x, y, 5.5, c.up);
    txt(g, String(i + 1), x, y - 0.5, onFill(c.up, 1, c.sunk), 9, "center");
  });
  disc(g, cx, cy, 3.5, c.ink);
  txt(g, "SKY VIEW", cx, 20, c.faint, 10, "center");

  // error ellipse
  const ex = W * 0.68, ey = H / 2;
  const scale = Math.min(110, 110);
  txt(g, "HORIZONTAL ERROR (1σ)", ex - 120, 26, c.faint, 10);
  const maxE = Math.max(4, (isFinite(hdop) ? hdop : 4) * sig);
  const sx = isFinite(Qm && Qm[0][0]) ? Math.sqrt(Math.max(0, Qm[0][0])) * sig : 0;
  const sy = isFinite(Qm && Qm[1][1]) ? Math.sqrt(Math.max(0, Qm[1][1])) * sig : 0;
  const k = scale / maxE;
  [10, 25, 50].forEach(m => {
    const rr = m * k;
    if (rr < scale * 1.5) {
      g.save(); g.strokeStyle = c.grid; g.setLineDash([2, 3]); g.beginPath(); g.arc(ex, ey, rr, 0, 7); g.stroke(); g.restore();
      txt(g, m + " m", ex + rr + 3, ey, c.faint, 9);
    }
  });
  lineTo(g, ex - scale * 1.4, ey, ex + scale * 1.4, ey, c.grid, 1);
  lineTo(g, ex, ey - scale * 1.4, ex, ey + scale * 1.4, c.grid, 1);
  if (Qm) {
    g.save(); g.fillStyle = c.up; g.globalAlpha = .22;
    g.beginPath(); g.ellipse(ex, ey, Math.max(2, sx * k), Math.max(2, sy * k), 0, 0, 7); g.fill();
    g.globalAlpha = 1; g.strokeStyle = c.up; g.lineWidth = 2; g.stroke(); g.restore();
    txt(g, "E ±" + fx(sx, 1) + " m", ex + Math.max(2, sx * k) + 6, ey - 12, c.up, 10.5);
    txt(g, "N ±" + fx(sy, 1) + " m", ex + 6, ey - Math.max(2, sy * k) - 10, c.up, 10.5);
  } else {
    txt(g, "geometry is singular — add a fourth satellite", ex, ey, c.hot, 11, "center");
  }
  disc(g, ex, ey, 3, c.ink);
}

const FORMATS = [
  ["576i SD", 270], ["1080i HD", 1485], ["2160p UHD", 11880], ["4320p 8K", 47520]
];
const FECS = [[1, 2], [2, 3], [3, 4], [5, 6], [7, 8], [9, 10]];
function dtv() {
  const fi = +$("#s-fmt").value, ratio = +$("#s-cmp").value, fe = +$("#s-fec").value;
  const [fname, raw] = FORMATS[fi];
  const [fn, fd] = FECS[fe];
  const r = fn / fd;
  $("#v-fmt").textContent = fname;
  $("#v-cmp").textContent = ratio + " : 1";
  $("#v-fec").textContent = fn + "/" + fd;

  const comp = raw / ratio;                       // Mbit/s after MPEG
  const withFec = comp / r * (204 / 188);         // channel bit rate incl. RS outer
  const BW = 36, alpha = 0.35;
  const Rs = BW / (1 + alpha);                    // Msym/s
  const cap = Rs * 2 * r * (188 / 204);           // QPSK useful Mbit/s
  const nch = Math.max(0, Math.floor(cap / comp));

  kv($("#k-dtv"), [
    ["Studio (uncompressed)", fx(raw, 0) + " <small>Mbit/s</small>", "hot"],
    ["After MPEG at " + ratio + ":1", fx(comp, 2) + " <small>Mbit/s</small>", "up"],
    ["Channel rate with FEC", fx(withFec, 2) + " <small>Mbit/s</small>"],
    ["Symbol rate (36 MHz, α=0.35)", fx(Rs, 2) + " <small>Msym/s</small>"],
    ["Transponder capacity (QPSK)", fx(cap, 2) + " <small>Mbit/s</small>", "dn"],
    ["Programmes per transponder", String(nch), nch ? "ok" : "hot"],
    ["Compression achieved", fx(raw / comp, 0) + "×"],
    ["Overhead spent on FEC", fx((1 - r * 188 / 204) * 100, 1) + " <small>%</small>", "up"]
  ]);

  const { g, W, H, c } = prep($("#c-dtv"));
  const bars = [
    ["Uncompressed studio", raw, c.hot],
    ["After MPEG compression", comp, c.up],
    ["Plus FEC overhead", withFec, c.violet],
    ["One 36 MHz transponder", cap, c.down]
  ];
  const maxV = raw;
  const bx = 220, bw = W - 280;
  txt(g, "BIT RATE, LOG SCALE", bx, 26, c.faint, 10);
  bars.forEach((b, i) => {
    const y = 58 + i * 74;
    const frac = Math.log10(Math.max(1, b[1])) / Math.log10(maxV);
    g.fillStyle = b[2]; g.fillRect(bx, y, Math.max(3, bw * frac), 34);
    txt(g, b[0], bx - 12, y + 17, c.soft, 11, "right", false);
    txt(g, fx(b[1], b[1] < 100 ? 2 : 0) + " Mbit/s", bx + Math.max(3, bw * frac) + 10, y + 17, c.ink, 12);
  });
  const y4 = 58 + 3 * 74;
  lineTo(g, bx + bw * Math.log10(Math.max(1, cap)) / Math.log10(maxV), 50,
            bx + bw * Math.log10(Math.max(1, cap)) / Math.log10(maxV), y4 + 40, c.down, 1.4, [4, 3]);
  txt(g, nch >= 1 ? nch + " programme" + (nch > 1 ? "s" : "") + " fit in one transponder"
                  : "this programme does NOT fit — compress harder or use a wider carrier",
      bx, H - 20, nch >= 1 ? c.ok : c.hot, 11.5);
}

seg("#seg-ma", b => { maSel = b.dataset.ma; multipleAccess(); });
seg("#seg-rtt", b => { rttSel = +b.dataset.rtt; tcp(); });
bind(["#s-users", "#s-guard", "#s-bw"], multipleAccess);
bind(["#s-tr", "#s-tw", "#s-tl"], tcp);
bind(["#s-gn", "#s-gs", "#s-ge"], gps);
bind(["#s-fmt", "#s-cmp", "#s-fec"], dtv);

/* ===================================================================== */
const DRAW = {
  m1: [orbit, look], m2: [rain, pol], m3: [antenna, array],
  m4: [linkBudget], m5: [constellation, berPlot, eye, hamming],
  m6: [multipleAccess, tcp, gps, dtv]
};
function drawAll() {
  const fns = DRAW[current];
  if (!fns) return;
  fns.forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawAll, 120); });

const start = (location.hash || "").replace("#", "");
go(MODS.some(m => m.id === start) ? start : "m0");

})();
