/* Woodshed — audio: plucked-string synth (Karplus–Strong), click, and a look-ahead transport */
(function () {
  let ctx = null, master = null, clickBus = null, instBus = null;
  const cache = new Map();

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    clickBus = ctx.createGain(); clickBus.gain.value = 0.55; clickBus.connect(master);
    instBus = ctx.createGain(); instBus.gain.value = cfg.vol; instBus.connect(master);
    return ctx;
  }

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- Instruments ---------- */
  const INSTRUMENTS = [
    { id: 'clean', name: 'Clean electric guitar', kind: 'string', lp: 4200, damp: .996, gain: 1 },
    { id: 'jazz', name: 'Jazz archtop guitar', kind: 'string', lp: 1500, damp: .9945, gain: 1.25 },
    { id: 'nylon', name: 'Nylon-string guitar', kind: 'string', lp: 2300, damp: .993, gain: 1.15 },
    { id: 'drive', name: 'Overdriven guitar', kind: 'string', lp: 5000, damp: .9975, gain: .9, drive: true },
    { id: 'epiano', name: 'Electric piano', kind: 'epiano' },
    { id: 'organ', name: 'Organ', kind: 'organ' },
    { id: 'pad', name: 'Synth pad', kind: 'pad' },
    { id: 'strings', name: 'String section', kind: 'strings' }
  ];
  const BASSES = [
    { id: 'ebass', name: 'Electric bass' }, { id: 'upright', name: 'Upright bass' },
    { id: 'synth', name: 'Synth bass' }, { id: 'same', name: 'Same as chords' }, { id: 'off', name: 'No bass' }
  ];
  const cfg = { inst: 'clean', bass: 'ebass', vol: 0.7 };
  const instOf = id => INSTRUMENTS.find(i => i.id === id) || INSTRUMENTS[0];

  let driveIn = null;
  function driveChain() {
    if (driveIn) return driveIn;
    driveIn = ctx.createGain(); driveIn.gain.value = 3.2;
    const sh = ctx.createWaveShaper(), n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(2.6 * x) * 0.85; }
    sh.curve = curve; sh.oversample = '4x';
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3400; cab.Q.value = .8;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 800; mid.gain.value = 3;
    const post = ctx.createGain(); post.gain.value = .32;
    driveIn.connect(hp); hp.connect(sh); sh.connect(mid); mid.connect(cab); cab.connect(post); post.connect(instBus);
    return driveIn;
  }

  // Karplus–Strong buffer. variant: 'ring' (normal), 'mute' (palm-muted), 'drone' (long sustain)
  function buffer(midi, variant, inst) {
    const key = midi + ':' + variant + ':' + inst.id;
    if (cache.has(key)) return cache.get(key);
    const sr = ctx.sampleRate, f = mtof(midi);
    const exact = sr / f, N = Math.max(2, Math.round(exact));
    const secs = variant === 'mute' ? 0.35 : variant === 'drone' ? 6 : 2.6;
    const len = Math.floor(sr * secs);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const damp = variant === 'mute' ? 0.9 : variant === 'drone' ? 0.9992 : (inst.damp - Math.max(0, midi - 64) * 0.0006);
    const bright = variant === 'mute' ? 0.2 : 0.5;
    for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * (1 - bright * Math.random());
    if (inst.id === 'nylon' || inst.id === 'jazz') for (let k = 0; k < 2; k++) for (let i = 1; i < N; i++) d[i] = 0.5 * (d[i] + d[i - 1]);
    for (let i = N; i < len; i++) {
      const a = d[i - N], b = d[i - N + 1] ?? a;
      d[i] = damp * 0.5 * (a + b);
    }
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    const out = { buf, rate: N / exact };
    cache.set(key, out);
    return out;
  }

  function envGain(t, peak, attack, dur, release, decayTo) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (decayTo != null) g.gain.setTargetAtTime(peak * decayTo, t + attack, dur / 3);
    g.gain.setValueAtTime(decayTo != null ? peak * decayTo : peak, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    return g;
  }

  function playString(inst, midi, t, opts) {
    const { buf, rate } = buffer(midi, opts.variant || 'ring', inst);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain();
    const vel = (opts.vel ?? 0.8) * 0.55 * inst.gain;
    g.gain.setValueAtTime(vel, t);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = opts.variant === 'mute' ? 900 : inst.lp;
    src.connect(lp); lp.connect(g); g.connect(inst.drive ? driveChain() : instBus);
    src.start(t);
    if (opts.dur) {
      const end = t + opts.dur;
      g.gain.setValueAtTime(vel, end);
      g.gain.exponentialRampToValueAtTime(0.0008, end + 0.08);
      src.stop(end + 0.1);
    }
  }

  function playSynth(kind, midi, t, opts) {
    const f = mtof(midi), vel = opts.vel ?? 0.8;
    const muted = opts.variant === 'mute';
    if (muted && vel < 0.35) return; // ghost scratches only make sense on a guitar
    let dur = opts.dur || (opts.variant === 'drone' ? 4 : 1.6);
    if (muted) dur = Math.min(dur, 0.07);
    const nodes = [];
    let out;
    if (kind === 'epiano') {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * 1.0; car.type = 'sine';
      mg.gain.setValueAtTime(f * 2.2 * vel, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.12);
      mod.connect(mg); mg.connect(car.frequency);
      const tine = ctx.createOscillator(), tg = ctx.createGain(); tine.frequency.value = f * 4; tg.gain.setValueAtTime(0.06 * vel, t); tg.gain.setTargetAtTime(0, t, 0.05);
      tine.connect(tg);
      const decay = Math.max(0.6, 2.8 - (midi - 48) * 0.04);
      out = envGain(t, 0.32 * vel, 0.004, Math.min(dur, decay), 0.12, 0.35);
      car.connect(out); tg.connect(out);
      nodes.push(car, mod, tine);
    } else if (kind === 'organ') {
      out = envGain(t, 0.13 * vel, 0.012, dur, 0.06);
      [[0.5, .55], [1, .8], [2, .55], [3, .3], [4, .22]].forEach(([r, a]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * r; g.gain.value = a; o.connect(g); g.connect(out); nodes.push(o);
      });
      const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 6.2; tg.gain.value = 0.025; trem.connect(tg); tg.connect(out.gain); nodes.push(trem);
    } else if (kind === 'pad' || kind === 'strings') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = kind === 'pad' ? 1300 : 2600; lp.Q.value = kind === 'pad' ? 2 : 0.7;
      const atk = muted ? 0.01 : kind === 'pad' ? 0.18 : 0.12;
      out = envGain(t, (kind === 'pad' ? 0.09 : 0.075) * vel, atk, Math.max(dur, atk + 0.05), kind === 'pad' ? 0.5 : 0.3);
      lp.connect(out);
      [-7, 0, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents + (kind === 'strings' ? 0 : cents);
        if (kind === 'strings') { const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 5.3; vg.gain.value = 4; v.connect(vg); vg.connect(o.detune); nodes.push(v); }
        o.connect(lp); nodes.push(o);
      });
    }
    out.connect(instBus);
    const end = t + dur + 0.6;
    nodes.forEach(n => { n.start(t); n.stop(end); });
  }

  function playBass(kind, midi, t, opts) {
    const f = mtof(midi), vel = opts.vel ?? 0.85;
    const dur = Math.max(0.12, opts.dur || 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    const nodes = [];
    let out;
    if (kind === 'upright') {
      lp.frequency.setValueAtTime(900, t); lp.frequency.setTargetAtTime(380, t, 0.05);
      out = envGain(t, 0.55 * vel, 0.008, dur, 0.12, 0.45);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const s = ctx.createOscillator(); s.frequency.value = f; const sg = ctx.createGain(); sg.gain.value = .6;
      o.connect(lp); s.connect(sg); sg.connect(lp); nodes.push(o, s);
    } else if (kind === 'synth') {
      lp.frequency.setValueAtTime(1800, t); lp.frequency.setTargetAtTime(300, t, 0.07); lp.Q.value = 6;
      out = envGain(t, 0.28 * vel, 0.005, dur, 0.08, 0.7);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); nodes.push(o);
      const sub = ctx.createOscillator(); sub.frequency.value = f / 2; const sg = ctx.createGain(); sg.gain.value = .9; sub.connect(sg); sg.connect(lp); nodes.push(sub);
    } else { // electric bass
      lp.frequency.setValueAtTime(1400, t); lp.frequency.setTargetAtTime(520, t, 0.06);
      out = envGain(t, 0.5 * vel, 0.004, dur, 0.07, 0.6);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = f; const sg = ctx.createGain(); sg.gain.value = .12;
      o.connect(lp); s.connect(sg); sg.connect(lp); nodes.push(o, s);
    }
    lp.connect(out); out.connect(instBus);
    nodes.forEach(n => { n.start(t); n.stop(t + dur + 0.3); });
  }

  /** opts: vel, dur, variant, inst (override), role: 'bass' to use the bass voice */
  function pluck(midi, when = 0, opts = {}) {
    ensure();
    const t = Math.max(when || ctx.currentTime, ctx.currentTime);
    if (opts.role === 'bass' && cfg.bass !== 'same') {
      if (cfg.bass === 'off') return t;
      let m = midi - 12; while (m < 28) m += 12;
      playBass(cfg.bass, m, t, opts);
      return t;
    }
    const inst = instOf(opts.inst || (opts.role ? cfg.inst : 'clean'));
    if (inst.kind === 'string') playString(inst, midi, t, opts);
    else playSynth(inst.kind, midi, t, opts);
    return t;
  }

  function strum(midis, when = 0, opts = {}) {
    ensure();
    const list = midis.filter(m => m != null).slice().sort((a, b) => a - b);
    if (opts.dir === 'up') list.reverse();
    const instId = opts.inst || (opts.role ? cfg.inst : 'clean');
    const keys = instOf(instId).kind !== 'string';
    const gap = keys ? 0.004 : (opts.spread ?? 0.014);
    const t0 = Math.max(when || ctx.currentTime, ctx.currentTime);
    list.forEach((m, i) => pluck(m, t0 + i * gap, { vel: (opts.vel ?? 0.8) * (0.85 + 0.15 * Math.random()), dur: opts.dur, variant: opts.variant, inst: instId }));
  }

  function click(when, level) {
    ensure();
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const freq = level === 3 ? 1760 : level === 2 ? 1320 : level === 1 ? 990 : 740;
    const amp = level === 3 ? 0.9 : level === 2 ? 0.6 : level === 1 ? 0.45 : 0.18;
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
    o.connect(g); g.connect(clickBus);
    o.start(t); o.stop(t + 0.06);
  }

  /* ---------- Transport ---------- */
  // Accent groupings for odd meters (in beats of the denominator)
  const GROUPS = { '5/4': [3,2], '7/8': [2,2,3], '5/8': [3,2], '9/8': [2,2,2,3], '11/8': [3,3,3,2], '6/8': [3,3], '12/8': [3,3,3,3], '7/4': [4,3] };
  function groupStarts(num, den) {
    const g = GROUPS[num + '/' + den];
    if (!g) return new Set([0]);
    const s = new Set(); let acc = 0; g.forEach(x => { s.add(acc); acc += x; }); return s;
  }

  const T = {
    bpm: 90, num: 4, den: 4, sub: 1, swing: false, clickOn: true, clickSubs: false,
    running: false, listeners: new Set(), trainer: null,
    _timer: null, _next: 0, _tick: 0, _bar: 0,
    get groups() { return groupStarts(this.num, this.den); },
    start() {
      ensure();
      if (this.running) return;
      this.running = true; this._tick = 0; this._bar = 0;
      this._next = ctx.currentTime + 0.08;
      this._timer = setInterval(() => this._schedule(), 25);
      this._schedule();
      this._emit('state');
    },
    stop() {
      this.running = false; clearInterval(this._timer); this._timer = null;
      this._emit('state');
    },
    toggle() { this.running ? this.stop() : this.start(); },
    setBpm(v) { this.bpm = Math.max(20, Math.min(320, Math.round(v))); this._emit('bpm'); },
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    _emit(type, info) { this.listeners.forEach(fn => { try { fn(type, info); } catch (e) { console.error(e); } }); },
    _subDur(subIdx) {
      const spb = 60 / this.bpm;
      if (this.swing && this.sub === 2) return subIdx === 0 ? spb * 2 / 3 : spb / 3;
      if (this.swing && this.sub === 4) return (subIdx % 2 === 0 ? spb * 0.29 : spb * 0.21);
      return spb / this.sub;
    },
    _schedule() {
      const ahead = ctx.currentTime + 0.12;
      while (this.running && this._next < ahead) {
        const ticksPerBar = this.num * this.sub;
        const tickInBar = this._tick % ticksPerBar;
        const beatInBar = Math.floor(tickInBar / this.sub);
        const subIdx = tickInBar % this.sub;
        const absBeat = Math.floor(this._tick / this.sub);
        if (tickInBar === 0 && this._tick > 0) {
          this._bar++;
          const tr = this.trainer;
          if (tr && tr.on && this._bar % tr.every === 0 && this.bpm < tr.target) {
            this.setBpm(Math.min(tr.target, this.bpm + tr.step));
          }
        }
        const time = this._next;
        if (this.clickOn) {
          if (subIdx === 0) {
            const lvl = beatInBar === 0 ? 3 : this.groups.has(beatInBar) && this.groups.size > 1 ? 2 : 1;
            click(time, lvl);
          } else if (this.clickSubs) click(time, 0);
        }
        this._emit('tick', { time, tick: this._tick, tickInBar, beatInBar, subIdx, absBeat, bar: this._bar, sub: this.sub });
        this._next += this._subDur(subIdx);
        this._tick++;
      }
    },
    now() { return ctx ? ctx.currentTime : 0; },
    beatDur() { return 60 / this.bpm; }
  };

  function setBandVolume(v) { cfg.vol = Math.max(0, Math.min(1.5, v)); if (instBus) instBus.gain.value = cfg.vol; }

  window.Audio2 = { ensure, pluck, strum, click, mtof, Transport: T, groupStarts, INSTRUMENTS, BASSES, cfg, setBandVolume, get ctx() { return ctx; } };
})();
