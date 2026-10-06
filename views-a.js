/* Woodshed — Jam & improvise: progression backing, live fretboard, prompts */
(function () {
  const { Theory: TH, Content: C, Audio2: AU, UI, App } = window;
  const { h } = UI;
  const T = AU.Transport;

  const FEEL = {
    rock: { sub: 2, swing: false }, straight: { sub: 1, swing: false }, shuffle: { sub: 2, swing: true },
    chug: { sub: 2, swing: false }, swing: { sub: 1, swing: true }, pompe: { sub: 1, swing: true },
    arpeggio: { sub: 2, swing: false }, odd: { sub: 1, swing: false }, drone: { sub: 1, swing: false },
    highlife: { sub: 2, swing: false }, funk: { sub: 4, swing: false }
  };
  const FEEL_NAMES = { rock: 'Rock strum', straight: 'Straight quarters', shuffle: 'Boogie shuffle', chug: 'Palm-muted chug', swing: 'Swing comping + walking bass', pompe: 'La pompe', arpeggio: 'Fingerpicked arpeggios', odd: 'Odd-meter accents', drone: 'Tanpura drone', highlife: 'Highlife picking', funk: '16th funk strum' };
  const FUNK = 'X x x X x x X x x x x x X x x x'.split(' ');
  const bassRoot = pc => 40 + TH.mod(pc - 4);

  const st = {
    style: 'All', progId: 'rock-mixo', key: 9, bpm: 104, scale: 'mixolydian', labels: 'chord',
    comp: true, chords: [], idx: -1, prompt: null, promptEvery: 0, cycles: 0
  };
  let root, els = {};

  const prog = () => C.PROGRESSIONS.find(p => p.id === st.progId);
  function totalBeats() { return prog().chords.reduce((a, c) => a + c[2], 0); }

  function buildChords() {
    const p = prog();
    let target = p.feel === 'pompe' ? 6 : p.feel === 'chug' ? 3 : 5;
    st.chords = p.chords.map(([deg, q, beats]) => {
      const pc = TH.mod(st.key + deg);
      const v = TH.voiceNear(q, pc, target);
      const frets = v ? v.p.frets : [null, null, null, null, null, null];
      const midi = v ? v.p.midi.filter(m => m != null) : [];
      if (v) target = (target * 2 + v.center) / 3;
      return { deg, q, beats, pc, frets, midi, tones: TH.chordTones(pc, q), shape: v ? v.s.name : '', label: TH.chordLabel(pc, q, st.key), roman: TH.romanFor(deg, q) };
    });
    let acc = 0; st.chords.forEach(c => { c.start = acc; acc += c.beats; });
  }

  function newPrompt() {
    const pool = C.PROMPTS.filter(p => p !== st.prompt);
    st.prompt = pool[Math.floor(Math.random() * pool.length)];
    renderPrompt();
  }
  function renderPrompt() {
    if (!els.prompt) return;
    els.prompt.innerHTML = '';
    els.prompt.append(h('div', { class: 'eyebrow' }, 'Improvisation prompt · ' + st.prompt[0]), h('p', {}, st.prompt[1]));
  }

  /* ---------- comping ---------- */
  function comp(info) {
    if (App.jamOwner !== 'jam' || !st.comp) return;
    const p = prog(), feel = p.feel, bd = T.beatDur(), t = info.time;
    const total = totalBeats();
    const beatPos = info.absBeat % total;
    const ci = st.chords.findIndex(c => beatPos >= c.start && beatPos < c.start + c.beats);
    const c = st.chords[ci], next = st.chords[(ci + 1) % st.chords.length];
    const inChord = beatPos - c.start;
    const pos = info.beatInBar * info.sub + info.subIdx;
    const r = bassRoot(c.pc);
    const v = c.midi.length ? c.midi : [r, r + 7, r + 12];
    const upper = v.slice(-4);
    const S = (m, tt, o) => AU.strum(m, tt, { ...o, role: 'chord' });
    const P = (m, tt, o) => AU.pluck(m, tt, { ...o, role: 'chord' });
    const B = (m, tt, o) => AU.pluck(m, tt, { ...o, role: 'bass' });
    switch (feel) {
      case 'rock': {
        const pat = { 0: ['down', 1], 3: ['up', .55], 4: ['down', .85], 6: ['down', .7], 7: ['up', .55] }[pos % 8];
        if (pat) S(v, t, { dir: pat[0], vel: pat[1], dur: bd * 1.1 });
        if (pos % 2 === 0) B(r, t, { vel: pos % 4 === 0 ? .95 : .7, dur: bd * .9 });
        break;
      }
      case 'straight':
        if (info.subIdx === 0) { S(v, t, { vel: info.beatInBar === 0 ? 1 : .7, dur: bd * .9 }); B(info.beatInBar % 2 ? r + 7 : r, t, { vel: .9, dur: bd * .95 }); }
        break;
      case 'shuffle': {
        const six = (info.beatInBar % 2 === 1);
        S([r + 12, r + 12 + (six ? 9 : 7)], t, { vel: info.subIdx === 0 ? .8 : .55, dur: bd * .45, spread: .006 });
        if (info.subIdx === 0) B(r + [0, 4, 7, 9][info.beatInBar % 4], t, { vel: .95, dur: bd * .6 });
        break;
      }
      case 'chug': {
        const pw = [r, r + 7, r + 12];
        if (inChord === 0 && info.subIdx === 0) S(pw, t, { vel: 1, dur: bd * 1.2, spread: .006 });
        else S(pw, t, { vel: .9, variant: 'mute', dur: bd * .3, spread: .004 });
        B(r, t, { vel: .9, dur: bd * .4 });
        break;
      }
      case 'swing': {
        S(upper, t, { vel: info.beatInBar % 2 ? .6 : .45, dur: bd * .35, spread: .01 });
        const nr = bassRoot(next.pc);
        let bn;
        const left = c.beats - inChord;
        if (left === 1) bn = (nr - r > 6 ? nr - 12 : nr) + (Math.random() < .5 ? -1 : 1);
        else if (inChord % 4 === 0) bn = r;
        else if (inChord % 4 === 1) bn = r + (c.tones.includes(TH.mod(c.pc + 4)) ? 4 : 3);
        else bn = r + 7;
        while (bn > 52) bn -= 12; while (bn < 36) bn += 12;
        B(bn, t, { vel: 1, dur: bd * .95 });
        break;
      }
      case 'pompe': {
        if (info.beatInBar % 2 === 0) {
          S(v.slice(0, 4), t, { vel: .75, dur: bd * .22, spread: .008 });
          B(info.beatInBar % 4 === 0 ? r : r + 7, t, { vel: .9, dur: bd * 1.2 });
        } else {
          S(v, Math.max(AU.ctx.currentTime, t - bd * .1), { vel: .25, dir: 'up', variant: 'mute', dur: .05, spread: .004 });
          S(v, t, { vel: 1, dur: bd * .18, spread: .006 });
        }
        break;
      }
      case 'arpeggio': {
        const n = v.length, idx = [0, n - 3, n - 2, n - 1, n - 2, n - 3, n - 2, n - 1][pos % 8];
        P(v[Math.max(0, Math.min(n - 1, idx))], t, { vel: pos % 8 === 0 ? .9 : .65, dur: bd * 1.6 });
        if (pos % 8 === 0) B(r, t, { vel: .7, dur: bd * 3.5 });
        break;
      }
      case 'odd': {
        if (info.subIdx !== 0) break;
        const g = AU.groupStarts(T.num, T.den);
        if (g.has(info.beatInBar)) { S(v, t, { vel: info.beatInBar === 0 ? 1 : .8, dur: bd * 2 }); B(r, t, { vel: .95, dur: bd * 1.6 }); }
        else B(r, t, { vel: .55, dur: bd * .4 });
        break;
      }
      case 'drone': {
        const seq = [r + 7, r + 12, r + 12, r];
        P(seq[info.beatInBar % 4] - (r > 45 ? 12 : 0), t, { vel: .65, variant: 'drone', dur: bd * 4 });
        if (info.beatInBar === 0) B(r, t, { vel: .6, dur: bd * T.num });
        break;
      }
      case 'highlife': {
        const hi = c.tones.map(pc => 64 + TH.mod(pc - 4)).sort((a, b) => a - b);
        const map = { 0: 0, 1: 1, 3: 2, 4: 1, 6: 2, 7: 0 };
        const k = pos % 8;
        if (k in map) P(hi[map[k] % hi.length], t, { vel: .6, dur: bd * .7 });
        if (k === 0 || k === 4) B(r, t, { vel: .9, dur: bd * 1.2 });
        if (k === 3) B(r + 7, t, { vel: .7, dur: bd * .6 });
        break;
      }
      case 'funk': {
        const k = pos % 16, sym = FUNK[k];
        if (sym === 'X') S(upper, t, { vel: .9, dur: bd * .14, dir: k % 2 ? 'up' : 'down', spread: .006 });
        else S(upper, t, { vel: .22, variant: 'mute', dur: .04, dir: k % 2 ? 'up' : 'down', spread: .004 });
        const bl = { 0: r, 3: r, 6: r + 12, 10: r + 10, 12: r + 7 }[k];
        if (bl != null) B(bl, t, { vel: k === 0 ? 1 : .8, dur: bd * (k === 0 ? .6 : .3) });
        break;
      }
    }
  }

  function onTick(info) {
    if (App.jamOwner !== 'jam') return;
    comp(info);
    if (info.subIdx !== 0) return;
    const total = totalBeats();
    const beatPos = info.absBeat % total;
    const ci = st.chords.findIndex(c => beatPos >= c.start && beatPos < c.start + c.beats);
    const delay = Math.max(0, (info.time - AU.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (App.jamOwner !== 'jam') return;
      if (beatPos === 0 && info.absBeat > 0) {
        st.cycles++;
        if (st.promptEvery && st.cycles % st.promptEvery === 0) newPrompt();
      }
      if (ci !== st.idx) { st.idx = ci; highlight(); }
      const c = st.chords[ci];
      const bar = els.strip && els.strip.children[ci] && els.strip.children[ci].querySelector('.bar');
      if (bar) bar.style.width = ((beatPos - c.start + 1) / c.beats * 100) + '%';
    }, delay);
  }

  function highlight() {
    [...(els.strip ? els.strip.children : [])].forEach((el, i) => { el.classList.toggle('now', i === st.idx); const b = el.querySelector('.bar'); if (b) b.style.width = '0'; });
    renderNow(); renderBoard();
  }

  function renderNow() {
    const c = st.chords[Math.max(0, st.idx)];
    if (!c || !els.now) return;
    const next = st.chords[(Math.max(0, st.idx) + 1) % st.chords.length];
    els.now.innerHTML = '';
    els.now.append(
      h('div', { class: 'now-name' }, c.label, h('small', {}, c.roman + ' · next ' + next.label)),
      h('div', { style: 'width:110px' }, UI.chordDiagram(c.frets, c.pc)),
      h('div', { class: 'stack', style: 'gap:4px;flex:1;min-width:180px' },
        h('div', { class: 'eyebrow' }, 'Chord tones'),
        h('div', { class: 'mono' }, c.tones.map((pc, i) => TH.noteName(pc, st.key) + ' (' + TH.intervalName(pc - c.pc) + ')').join('  ')),
        h('div', { class: 'note' }, 'Backing voicing: ' + c.shape))
    );
  }

  function persistJam() { window.Resume.keep('jam', { style: st.style, progId: st.progId, key: st.key, bpm: st.bpm, scale: st.scale, labels: st.labels, promptEvery: st.promptEvery, comp: st.comp }); }

  function renderBoard() {
    if (!els.board) return;
    persistJam();
    const c = st.chords[Math.max(0, st.idx)];
    const sc = TH.SCALES[st.scale];
    const marks = UI.scaleMarks({ rootPc: st.key, set: sc.iv, frets: 15, keyPc: st.key, tones: c ? c.tones : null, tonesRoot: c ? c.pc : null,
      labels: st.labels === 'notes' ? 'notes' : st.labels === 'none' ? 'none' : 'intervals' });
    if (st.labels === 'key') marks.forEach(m => { const pc = (TH.TUNING[m.s] + m.f) % 12; m.label = TH.intervalName(pc - st.key, sc.iv); });
    els.board.innerHTML = '';
    els.board.append(UI.fretboard({ frets: 15, marks, onClick: (si, f) => AU.pluck(TH.TUNING[si] + f, 0, { vel: .9 }) }));
  }

  function renderStrip() {
    els.strip.innerHTML = '';
    const p = prog();
    st.chords.forEach((c, i) => els.strip.append(h('button', { class: 'pchord' + (i === st.idx ? ' now' : ''), title: 'Play ' + c.label, onclick: () => AU.strum(c.midi, 0, { vel: .9 }) },
      h('div', { class: 'rn' }, c.roman), h('div', { class: 'cn' }, c.label), h('div', { class: 'bt' }, c.beats + (p.meter[1] === 8 ? ' eighths' : c.beats === 1 ? ' beat' : ' beats')), h('span', { class: 'bar' }))));
  }

  function applyProg(resetKey) {
    const p = prog();
    if (resetKey) { st.key = p.key; st.bpm = p.bpm; st.scale = p.scale; }
    st.idx = 0; st.cycles = 0;
    buildChords();
    if (App.jamOwner === 'jam') configureTransport();
    renderControls(); renderStrip(); renderNow(); renderBoard();
    els.tip.textContent = p.tip;
    els.meta.textContent = `${p.style} · ${p.meter.join('/')} · ${FEEL_NAMES[p.feel]} · suggested scale: ${TH.noteName(st.key, st.key)} ${TH.SCALES[p.scale].name}`;
  }

  function configureTransport() {
    const p = prog(), f = FEEL[p.feel];
    T.num = p.meter[0]; T.den = p.meter[1];
    T.sub = p.feel === 'odd' && p.meter[1] === 4 ? 2 : f.sub;
    T.swing = f.swing; T.clickSubs = false;
    T.setBpm(st.bpm);
    T.listeners.forEach(fn => fn('state'));
  }

  function toggle() {
    if (T.running && App.jamOwner === 'jam') { T.stop(); App.jamOwner = null; return; }
    if (T.running) T.stop();
    App.jamOwner = 'jam'; T.trainer = null;
    st.idx = -1; st.cycles = 0;
    configureTransport();
    T.start();
  }

  function renderControls() {
    const p = prog();
    const list = C.PROGRESSIONS.filter(x => st.style === 'All' || x.style === st.style);
    els.controls.innerHTML = '';
    els.styles.innerHTML = '';
    ['All', ...C.STYLES].forEach(sname => els.styles.append(h('button', { class: 'chip', 'aria-pressed': String(st.style === sname), onclick: () => {
      st.style = sname;
      const l = C.PROGRESSIONS.filter(x => sname === 'All' || x.style === sname);
      if (!l.includes(prog())) { st.progId = l[0].id; applyProg(true); } else renderControls();
    } }, sname)));
    const scaleOpts = TH.SCALE_GROUPS.map(g => ({ group: g.group, items: g.items.map(([id, name]) => ({ value: id, label: name })) }));
    els.controls.append(
      UI.field('Progression', UI.select('jam-prog', list.map(x => ({ value: x.id, label: (st.style === 'All' ? x.style + ' — ' : '') + x.name })), st.progId, v => { st.progId = v; applyProg(true); }, 'Progression')),
      UI.field('Key', UI.select('jam-key', UI.keyOptions().map(k => ({ ...k, label: k.label + (p.minor ? 'm' : '') })), st.key, v => { st.key = +v; applyProg(false); }, 'Key')),
      UI.field('Tempo', h('input', { id: 'jam-bpm', type: 'number', min: 30, max: 320, value: st.bpm, style: 'width:80px', onchange: e => { st.bpm = +e.target.value || p.bpm; persistJam(); if (App.jamOwner === 'jam') T.setBpm(st.bpm); } })),
      UI.field('Scale for soloing', UI.select('jam-scale', scaleOpts, st.scale, v => { st.scale = v; renderBoard(); }, 'Scale')),
      UI.field('Labels', UI.select('jam-labels', [{ value: 'chord', label: 'Intervals of the chord' }, { value: 'key', label: 'Intervals of the key' }, { value: 'notes', label: 'Note names' }, { value: 'none', label: 'No labels' }], st.labels, v => { st.labels = v; renderBoard(); }, 'Labels')),
      h('div', { class: 'row', style: 'gap:6px' },
        els.play = h('button', { class: 'btn primary', id: 'jam-play', onclick: toggle }, T.running && App.jamOwner === 'jam' ? '■ Stop' : '▶ Play backing'),
        h('button', { class: 'btn', 'aria-pressed': String(!st.comp), onclick: e => { st.comp = !st.comp; e.currentTarget.setAttribute('aria-pressed', String(!st.comp)); persistJam(); }, title: 'Mute the chords but keep the count and chord display' }, 'Mute band'))
    );
  }

  function mount(sec) {
    root = sec;
    sec.append(
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:end;margin-bottom:14px' },
        h('div', {}, h('h1', { class: 'h' }, 'Jam & improvise'),
          h('p', { class: 'lede' }, 'Pick a progression, press play, and solo. The fretboard shows the scale, with the current chord\'s tones lit up as the chords change.'))),
      els.styles = h('div', { class: 'chips', style: 'margin-bottom:12px' }),
      h('div', { class: 'panel stack' },
        els.controls = h('div', { class: 'row' }),
        els.sound = h('div', { class: 'row' }),
        els.meta = h('div', { class: 'note' }),
        els.strip = h('div', { class: 'prog-strip' })),
      h('div', { class: 'panel stack' },
        els.now = h('div', { class: 'now-card' }),
        els.board = h('div', { class: 'fb-wrap' }),
        h('div', { class: 'fb-legend' }, h('span', {}, h('b', { style: 'background:var(--accent)' }), 'Chord root'), h('span', {}, h('b', { style: 'background:var(--tone)' }), 'Chord tone'), h('span', {}, h('b', { style: 'background:var(--scale-dot);border:1px solid var(--line)' }), 'Scale note'), h('span', {}, 'Tap any note to hear it'))),
      h('div', { class: 'grid2', style: 'margin-top:18px' },
        h('div', { class: 'panel stack' },
          els.prompt = h('div', { class: 'prompt', 'aria-live': 'polite' }),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: newPrompt }, 'New prompt'),
            UI.field('Change prompt', UI.select('jam-every', [{ value: 0, label: 'Only when I ask' }, { value: 2, label: 'Every 2 times through' }, { value: 4, label: 'Every 4 times through' }], st.promptEvery, v => { st.promptEvery = +v; persistJam(); }, 'Prompt rotation')))),
        h('div', { class: 'panel stack' }, h('div', { class: 'eyebrow' }, 'How to approach it'), els.tip = h('p', { style: 'margin:0' })))
    );
    T.on((type, info) => {
      if (type === 'tick') onTick(info);
      if (type === 'state' && els.play) els.play.textContent = T.running && App.jamOwner === 'jam' ? '■ Stop' : '▶ Play backing';
    });
    renderSound();
    newPrompt();
    const saved = window.Resume.part('jam');
    if (saved && C.PROGRESSIONS.some(x => x.id === saved.progId)) { Object.assign(st, saved); applyProg(false); }
    else applyProg(true);
  }

  /* ---------- band sound ---------- */
  function saveSound() {
    const snd = { inst: AU.cfg.inst, bass: AU.cfg.bass, vol: AU.cfg.vol };
    try { localStorage.setItem('woodshed.sound', JSON.stringify(snd)); } catch (e) { /* ignore */ }
    window.Resume.keep('sound', snd);
  }
  function previewSound() {
    const c = st.chords[Math.max(0, st.idx)];
    if (!c) return;
    AU.ensure();
    const t = AU.ctx.currentTime + .05;
    AU.strum(c.midi, t, { role: 'chord', vel: .9, dur: 1.4 });
    AU.pluck(bassRoot(c.pc), t, { role: 'bass', vel: .95, dur: 1.2 });
  }
  function renderSound() {
    try {
      const saved = window.Resume.part('sound') || JSON.parse(localStorage.getItem('woodshed.sound') || 'null');
      if (saved) {
        if (AU.INSTRUMENTS.some(i => i.id === saved.inst)) AU.cfg.inst = saved.inst;
        if (AU.BASSES.some(b => b.id === saved.bass)) AU.cfg.bass = saved.bass;
        if (typeof saved.vol === 'number') AU.setBandVolume(saved.vol);
      }
    } catch (e) { /* ignore */ }
    const vol = h('input', { id: 'jam-vol', type: 'range', min: 0, max: 1.5, step: 0.05, value: AU.cfg.vol, style: 'width:140px;min-height:36px', 'aria-label': 'Band volume',
      oninput: e => { AU.setBandVolume(+e.target.value); saveSound(); } });
    els.sound.innerHTML = '';
    els.sound.append(
      UI.field('Chord instrument', UI.select('jam-inst', AU.INSTRUMENTS.map(i => ({ value: i.id, label: i.name })), AU.cfg.inst, v => { AU.cfg.inst = v; saveSound(); previewSound(); }, 'Chord instrument')),
      UI.field('Bass', UI.select('jam-bass', AU.BASSES.map(b => ({ value: b.id, label: b.name })), AU.cfg.bass, v => { AU.cfg.bass = v; saveSound(); previewSound(); }, 'Bass')),
      UI.field('Band volume', vol),
      h('button', { class: 'btn', onclick: previewSound, title: 'Hear the current chord with these sounds' }, '♪ Hear it'));
  }

  App.register('jam', {
    mount,
    show(opts) {
      if (opts && opts.progId) { st.progId = opts.progId; st.style = 'All'; applyProg(true); }
      if (opts && opts.prompt) newPrompt();
    }
  });
  window.JamState = st;
})();
