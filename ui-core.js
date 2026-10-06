/* Woodshed — shared UI: helpers, header metronome, fretboard, chord diagrams, tab */
(function () {
  const { Theory: TH, Audio2: AU } = window;
  const T = AU.Transport;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : String(c)); });
    return el;
  }
  function s(tag, attrs = {}, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
    }
    kids.flat().forEach(c => { if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }
  function select(id, options, value, onchange, label) {
    const sel = h('select', { id, 'aria-label': label || id, onchange: e => onchange(e.target.value) });
    options.forEach(o => {
      if (o.group) {
        const g = h('optgroup', { label: o.group });
        o.items.forEach(it => g.append(h('option', { value: it.value, selected: String(it.value) === String(value) }, it.label)));
        sel.append(g);
      } else sel.append(h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label));
    });
    return sel;
  }
  function field(label, control) { return h('label', { class: 'f' }, h('span', {}, label), control); }
  let toastTimer;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200);
  }
  const keyOptions = () => TH.KEYS.map(k => ({ value: k.pc, label: k.name }));
  const fmtTime = sec => { sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };

  /* ---------- Fretboard ---------- */
  const FB = { W: 54, NUT: 46, TOP: 22, GAP: 27 };
  function fretX(f) { return f === 0 ? FB.NUT / 2 : FB.NUT + (f - 0.5) * FB.W; }
  function strY(si) { return FB.TOP + (5 - si) * FB.GAP; } // si 0 = low E (bottom)

  /** marks: [{s, f, kind: root|tone|scale|hit|miss|ghost, label}] */
  function fretboard({ frets = 15, marks = [], onClick = null, window: win = null }) {
    const width = FB.NUT + frets * FB.W + 10, height = FB.TOP + 5 * FB.GAP + 42;
    const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Guitar fretboard' });
    svg.append(s('rect', { x: FB.NUT, y: FB.TOP - 12, width: frets * FB.W, height: 5 * FB.GAP + 24, rx: 3, style: 'fill:var(--wood)' }));
    if (win) svg.append(s('rect', { x: FB.NUT + Math.max(0, win[0] - 1) * FB.W, y: FB.TOP - 12, width: (win[1] - Math.max(1, win[0]) + 1) * FB.W, height: 5 * FB.GAP + 24, style: 'fill:#ffffff;opacity:.07' }));
    [3,5,7,9,15,17,19,21].filter(f => f <= frets).forEach(f => svg.append(s('circle', { cx: fretX(f), cy: FB.TOP + 2.5 * FB.GAP, r: 6, style: 'fill:var(--inlay);opacity:.85' })));
    if (frets >= 12) [1.5, 3.5].forEach(k => svg.append(s('circle', { cx: fretX(12), cy: FB.TOP + k * FB.GAP, r: 6, style: 'fill:var(--inlay);opacity:.85' })));
    svg.append(s('rect', { x: FB.NUT - 5, y: FB.TOP - 12, width: 6, height: 5 * FB.GAP + 24, style: 'fill:var(--inlay)' }));
    for (let f = 1; f <= frets; f++) svg.append(s('line', { x1: FB.NUT + f * FB.W, x2: FB.NUT + f * FB.W, y1: FB.TOP - 12, y2: FB.TOP + 5 * FB.GAP + 12, style: 'stroke:var(--fret);stroke-width:2.5' }));
    for (let si = 0; si < 6; si++) svg.append(s('line', { x1: 0, x2: FB.NUT + frets * FB.W, y1: strY(si), y2: strY(si), style: `stroke:var(--string);stroke-width:${(2.4 - si * 0.3).toFixed(1)}` }));
    for (let si = 0; si < 6; si++) svg.append(s('text', { x: 6, y: strY(si) - 5, style: 'fill:var(--muted);font:500 10px var(--mono)' }, TH.STRING_NAMES[si]));
    for (let f = 0; f <= frets; f++) if ([0,3,5,7,9,12,15,17,19,21].includes(f)) svg.append(s('text', { x: fretX(f), y: height - 10, 'text-anchor': 'middle', style: 'fill:var(--muted);font:500 11px var(--mono)' }, f));
    if (onClick) {
      for (let si = 0; si < 6; si++) for (let f = 0; f <= frets; f++) {
        svg.append(s('rect', { x: f === 0 ? 0 : FB.NUT + (f - 1) * FB.W, y: strY(si) - FB.GAP / 2, width: f === 0 ? FB.NUT - 6 : FB.W, height: FB.GAP, style: 'fill:transparent;cursor:pointer', onclick: () => onClick(si, f) }));
      }
    }
    marks.forEach(m => {
      const x = fretX(m.f), y = strY(m.s);
      const fill = { root: 'var(--accent)', tone: 'var(--tone)', scale: 'var(--scale-dot)', hit: 'var(--good)', miss: '#C0392B', ghost: 'var(--scale-dot)' }[m.kind] || 'var(--scale-dot)';
      const ink = m.kind === 'scale' || m.kind === 'ghost' ? 'var(--scale-ink)' : '#fff';
      const g = s('g', { style: `pointer-events:${onClick ? 'none' : 'auto'};opacity:${m.kind === 'ghost' ? .45 : 1}` });
      g.append(s('circle', { cx: x, cy: y, r: 11.5, style: `fill:${fill};stroke:rgba(0,0,0,.25);stroke-width:1` }));
      if (m.label != null) g.append(s('text', { x, y: y + 3.6, 'text-anchor': 'middle', style: `fill:${ink};font:600 10px var(--mono)` }, m.label));
      svg.append(g);
    });
    return svg;
  }

  /** marks for a pitch-class set across the neck */
  function scaleMarks({ rootPc, set, frets = 15, labels = 'notes', keyPc = rootPc, tones = null, tonesRoot = null, win = null, dimOutside = true }) {
    const out = [];
    for (let si = 0; si < 6; si++) for (let f = 0; f <= frets; f++) {
      const pc = (TH.TUNING[si] + f) % 12;
      const rel = TH.mod(pc - rootPc);
      const inScale = set.includes(rel);
      const isTone = tones && tones.includes(pc);
      if (!inScale && !isTone) continue;
      const outside = win && (f < win[0] || f > win[1]);
      let kind = rel === 0 ? 'root' : 'scale';
      if (tones) kind = pc === tonesRoot ? 'root' : isTone ? 'tone' : 'scale';
      if (outside && dimOutside) kind = 'ghost';
      let label = '';
      if (labels === 'notes') label = TH.noteName(pc, keyPc);
      else if (labels === 'intervals') label = TH.intervalName(tones && tonesRoot != null ? pc - tonesRoot : rel, tones && tonesRoot != null ? null : set);
      out.push({ s: si, f, kind, label });
    }
    return out;
  }

  /* ---------- Chord diagram ---------- */
  function chordDiagram(frets, rootPc) {
    const used = frets.filter(f => f !== null && f > 0);
    const maxF = used.length ? Math.max(...used) : 0, minF = used.length ? Math.min(...used) : 0;
    const start = maxF <= 5 ? 1 : minF;
    const W = 120, H = 150, L = 20, TOP = 26, sw = 16, fw = 22;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Chord diagram' });
    for (let i = 0; i <= 5; i++) svg.append(s('line', { x1: L + i * sw, x2: L + i * sw, y1: TOP, y2: TOP + 5 * fw, style: 'stroke:var(--muted);stroke-width:1' }));
    for (let j = 0; j <= 5; j++) svg.append(s('line', { x1: L, x2: L + 5 * sw, y1: TOP + j * fw, y2: TOP + j * fw, style: `stroke:var(--muted);stroke-width:${j === 0 && start === 1 ? 4 : 1}` }));
    if (start > 1) svg.append(s('text', { x: L + 5 * sw + 6, y: TOP + fw * 0.7, style: 'fill:var(--muted);font:500 11px var(--mono)' }, start + 'fr'));
    frets.forEach((f, i) => {
      const x = L + i * sw;
      if (f === null) svg.append(s('text', { x, y: TOP - 8, 'text-anchor': 'middle', style: 'fill:var(--muted);font:500 11px var(--mono)' }, '×'));
      else if (f === 0) svg.append(s('circle', { cx: x, cy: TOP - 12, r: 4, style: 'fill:none;stroke:var(--muted);stroke-width:1.2' }));
      else {
        const y = TOP + (f - start + 0.5) * fw;
        const pc = (TH.TUNING[i] + f) % 12;
        svg.append(s('circle', { cx: x, cy: y, r: 6.5, style: `fill:${pc === rootPc ? 'var(--accent)' : 'var(--ink)'}` }));
      }
    });
    // interval labels under strings
    frets.forEach((f, i) => {
      if (f === null) return;
      const pc = (TH.TUNING[i] + f) % 12;
      svg.append(s('text', { x: L + i * sw, y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--muted);font:500 9px var(--mono)' }, TH.intervalName(pc - rootPc)));
    });
    return svg;
  }

  /* ---------- Tab ---------- */
  function renderTab(steps) {
    const lines = ['e', 'B', 'G', 'D', 'A', 'E'].map(n => n + '|-');
    steps.forEach(st => {
      if (st === '|') { for (let i = 0; i < 6; i++) lines[i] += '|-'; return; }
      const w = Math.max(...st.map(([, f]) => String(f).length));
      for (let i = 0; i < 6; i++) {
        const hit = st.find(([sn]) => sn === i + 1);
        const txt = hit ? String(hit[1]) : '';
        lines[i] += txt + '-'.repeat(w - txt.length) + '-';
      }
    });
    return lines.join('\n');
  }
  function playSteps(steps, bpm, perBeat = 2) {
    AU.ensure();
    const dur = 60 / bpm / perBeat;
    let t = AU.ctx.currentTime + 0.05;
    steps.forEach(st => {
      if (st === '|') return;
      st.forEach(([sn, f]) => {
        const nums = String(f).match(/\d+/g) || [];
        nums.forEach((nf, k) => AU.pluck(TH.TUNING[6 - sn] + +nf, t + k * dur / Math.max(1, nums.length), { vel: 0.8, dur: dur * 1.6 }));
      });
      t += dur;
    });
  }

  /* ---------- Header metronome ---------- */
  function initMetronome() {
    const play = document.getElementById('m-play'), bpm = document.getElementById('m-bpm');
    const meter = document.getElementById('m-meter'), sub = document.getElementById('m-sub'), beats = document.getElementById('m-beats');
    const clickBtn = document.getElementById('m-click');
    const drawBeats = () => {
      beats.innerHTML = '';
      const g = AU.groupStarts(T.num, T.den);
      for (let i = 0; i < T.num; i++) beats.append(h('i', { class: g.size > 1 && g.has(i) ? 'g' : '' }));
    };
    const sync = () => {
      bpm.value = T.bpm; meter.value = T.num + '/' + T.den;
      if ([...sub.options].some(o => o.value === String(T.sub))) sub.value = String(T.sub);
      play.textContent = T.running ? '■' : '▶';
      play.setAttribute('aria-label', T.running ? 'Stop' : 'Start metronome');
      clickBtn.setAttribute('aria-pressed', String(T.clickOn));
      drawBeats();
    };
    play.onclick = () => {
      if (T.running) { T.stop(); App.jamOwner = null; return; }
      App.jamOwner = null; T.trainer = null; T.swing = false; T.sub = +sub.value; T.clickSubs = T.sub > 1;
      T.start();
    };
    document.getElementById('m-down').onclick = () => T.setBpm(T.bpm - (T.bpm > 200 ? 5 : 2));
    document.getElementById('m-up').onclick = () => T.setBpm(T.bpm + (T.bpm >= 200 ? 5 : 2));
    bpm.onchange = () => T.setBpm(+bpm.value || 90);
    meter.onchange = () => { const [n, d] = meter.value.split('/').map(Number); T.num = n; T.den = d; App.emit('meter'); sync(); };
    sub.onchange = () => { T.sub = +sub.value; T.clickSubs = T.sub > 1; App.emit('meter'); };
    clickBtn.onclick = () => { T.clickOn = !T.clickOn; sync(); App.emit('meter'); };
    let taps = [];
    document.getElementById('m-tap').onclick = () => {
      const now = performance.now();
      taps = taps.filter(t => now - t < 2500); taps.push(now);
      if (taps.length >= 2) { const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); T.setBpm(60000 / iv); }
    };
    T.on((type, info) => {
      if (type === 'tick' && info.subIdx === 0) {
        const delay = Math.max(0, (info.time - AU.ctx.currentTime) * 1000);
        setTimeout(() => { [...beats.children].forEach((b, i) => b.classList.toggle('on', i === info.beatInBar)); }, delay);
      } else if (type === 'state' || type === 'bpm') {
        sync();
        if (type === 'state' && !T.running) [...beats.children].forEach(b => b.classList.remove('on'));
      }
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) { e.preventDefault(); play.click(); }
    });
    sync();
  }

  /* ---------- App shell ---------- */
  const App = {
    views: {}, current: 'today', bus: new Set(), jamOwner: null,
    on(fn) { this.bus.add(fn); }, emit(ev, data) { this.bus.forEach(fn => fn(ev, data)); },
    register(name, view) { this.views[name] = view; },
    go(name, opts) {
      document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
      document.querySelectorAll('main section').forEach(sec => sec.classList.toggle('active', sec.id === name));
      this.current = name;
      const v = this.views[name];
      if (v && v.show) v.show(opts);
      try { localStorage.setItem('woodshed.tab', name); } catch (e) { /* ignore */ }
      if (window.Resume) window.Resume.put('ui', { tab: name });
      window.scrollTo({ top: 0 });
    },
    /** set up the transport for a context; stops previous jam if another owner takes over */
    setMeter(num, den) { T.num = num; T.den = den; T.listeners.forEach(fn => fn('state')); }
  };

  async function boot() {
    const R = window.Resume;
    await R.init();
    const m = R.part('metro');
    if (m) { T.bpm = m.bpm || T.bpm; T.num = m.num || 4; T.den = m.den || 4; T.sub = m.sub || 1; T.clickSubs = T.sub > 1; T.clickOn = m.clickOn !== false; }
    initMetronome();
    const saveMetro = () => R.put('metro', { bpm: T.bpm, num: T.num, den: T.den, sub: T.sub, clickOn: T.clickOn });
    let mt; T.on(type => { if (type === 'bpm' || type === 'state') { clearTimeout(mt); mt = setTimeout(saveMetro, 800); } });
    App.on(ev => { if (ev === 'meter') saveMetro(); });
    Object.entries(App.views).forEach(([name, v]) => { const sec = document.getElementById(name); sec.innerHTML = ''; v.mount(sec); });
    document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => App.go(b.dataset.tab));
    let start = 'today';
    const hash = (location.hash || '').slice(1);
    const ui = R.part('ui');
    if (App.views[hash]) start = hash;
    else if (ui && App.views[ui.tab]) start = ui.tab;
    else { try { const t = localStorage.getItem('woodshed.tab'); if (t && App.views[t]) start = t; } catch (e) { /* ignore */ } }
    App.go(start);
    window.Store.init();
  }

  window.UI = { h, s, select, field, toast, keyOptions, fmtTime, fretboard, scaleMarks, chordDiagram, renderTab, playSteps };
  window.App = App;
  window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
})();
