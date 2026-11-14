import { InkAudio } from './systems.js';
const RECORDED = __SFX__;
export class GameAudio extends InkAudio {
  // Hand-made sounds (see SOUNDS.md). `name` matches name.mp3 or its variations name-1.mp3, name-2.mp3…
  // Decoded once on the first gesture; until a file exists (or finishes decoding) the synth version plays.
  warmRecorded() {
    const c = this.context;
    if (!c || this.decoding) return;
    this.decoding = true; this.recorded = this.recorded || {};
    for (const [name, data] of Object.entries(RECORDED)) {
      const bin = atob(data), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      c.decodeAudioData(bytes.buffer).then((b) => { this.recorded[name] = b; if (name.startsWith('amb-')) this.ambience(); }).catch(() => {});
    }
  }
  take(name) {
    const r = this.recorded || {}, pick = Object.keys(r).filter((k) => k === name || k.startsWith(name + '-') && /^\d+$/.test(k.slice(name.length + 1)));
    return pick.length ? r[pick[Math.floor(Math.random() * pick.length)]] : null;
  }
  play(name, volume = 1) {
    const c = this.context, buffer = this.take(name);
    if (!buffer || !c || this.muted || !this.active || c.state !== 'running') return !!buffer;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buffer; g.gain.value = 5 * volume; // the master bus sits at 0.16
    src.connect(g).connect(this.nodes.master); src.start();
    src.onended = () => { src.disconnect(); g.disconnect(); };
    return true;
  }
  // Recorded room tone replaces the synth crackle bed; amb-memory crossfades in during memories.
  ambience() {
    const c = this.context; if (!c || !this.nodes) return;
    this.amb = this.amb || {};
    for (const name of ['amb-room', 'amb-memory']) {
      const buffer = this.take(name); if (!buffer || this.amb[name]) continue;
      const src = c.createBufferSource(), g = c.createGain();
      // loopStart/End skip the MP3 encoder padding so the seam doesn't click.
      src.buffer = buffer; src.loop = true; src.loopStart = .05; src.loopEnd = buffer.duration - .05; g.gain.value = 0;
      src.connect(g).connect(this.nodes.master); src.start();
      this.amb[name] = g;
      if (name === 'amb-room') { this.nodes.noiseGain.disconnect(); this.nodes.crackleGain.disconnect(); }
      if (name === 'amb-memory') this.nodes.heartGain.disconnect();
    }
    const room = this.amb['amb-room'], mem = this.amb['amb-memory'], now = c.currentTime;
    room?.gain.setTargetAtTime(this.memory && mem ? 0 : 2.5, now, .4);
    mem?.gain.setTargetAtTime(this.memory ? 2.5 : 0, now, .4);
  }
  setMemory(value) { super.setMemory(value); this.ambience(); }
  tone(hz, end, life, wave = 'sine', volume = .30, cutoff = 2600, delay = 0) {
    if (!this.context || this.muted || !this.active || this.context.state !== 'running') return;
    const c = this.context,
      t = c.currentTime + delay,
      osc = c.createOscillator(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    osc.type = wave;
    osc.frequency.setValueAtTime(hz, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + life);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + .009);
    g.gain.exponentialRampToValueAtTime(.0001, t + life);
    osc.connect(f).connect(g).connect(this.nodes.master);
    osc.start(t);
    osc.stop(t + life + .02);
    osc.onended = () => {
      osc.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  // Filtered noise burst: the basis of tearing, spraying, grinding and static.
  noise(life, cutoff = 2000, volume = .3, type = 'bandpass', q = .8, delay = 0) {
    if (!this.context || this.muted || !this.active || this.context.state !== 'running') return;
    const c = this.context, t = c.currentTime + delay;
    if (!this.noiseBuffer) {
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = b;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuffer; src.loop = true;
    f.type = type; f.frequency.value = cutoff; f.Q.value = q;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + life);
    src.connect(f).connect(g).connect(this.nodes.master);
    src.start(t, Math.random()); src.stop(t + life + .05);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  }
  // A guard's footstep at loudness k (0..1): the recorded step if there is one, else the synth thud.
  footstep(k) { if (k > .02 && !this.play('guard', k)) this.tone(137, 51, .18, 'triangle', .5 * k, 270); }
  // Tactile sound cues. `amount` is 0..1 for continuous ones (screech, tear, static).
  sfx(name, amount = 1) {
    if (name === 'static') return this.staticLevel(amount);
    const now = this.context?.currentTime || 0;
    if (['screech', 'tear', 'spray', 'tick', 'grind', 'ui-hover'].includes(name)) { const k = '_' + name; if (now - (this[k] || 0) < .07) return; this[k] = now; }
    if (this.play(name, ['screech', 'tear'].includes(name) ? .4 + .6 * amount : 1)) return;
    switch (name) {
      case 'ui-hover': this.tone(2400, 2000, .025, 'square', .08, 6000); break;
      case 'ui-press': this.tone(1800, 1400, .03, 'square', .1, 5000); break;
      case 'slide': this.noise(.25, 900, .22, 'lowpass'); break;
      case 'clink': this.tone(1900, 1500, .12, 'sine', .18, 5000); this.tone(2600, 2300, .09, 'sine', .1, 6000, .03); break;
      case 'screech': this.tone(700 + amount * 500, 600 + amount * 450, .09, 'sawtooth', .07, 2400); this.noise(.08, 3000, .06); break;
      case 'kachunk': this.tone(120, 45, .22, 'triangle', .7, 400); this.noise(.12, 600, .35, 'lowpass'); break;
      case 'thud': this.tone(90, 50, .16, 'sine', .55, 300); this.tone(320, 180, .05, 'square', .08, 1200); break;
      case 'crack': this.noise(.12, 5200, .35, 'highpass'); this.tone(2400, 900, .08, 'square', .08, 7000); break;
      case 'shatter': for (let i = 0; i < 6; i++) this.tone(2800 + Math.random() * 3000, 1500, .25 + Math.random() * .3, 'triangle', .09, 9000, i * .03); this.noise(.5, 6500, .4, 'highpass'); break;
      case 'clank': this.tone(420, 380, .3, 'triangle', .3, 2200); this.tone(980, 900, .2, 'sine', .12, 3000, .02); break;
      case 'spray': this.noise(.16, 4200, .14, 'highpass', .6); break;
      case 'tick': this.tone(2400, 2000, .025, 'square', .08, 6000); break;
      case 'voice': [220, 247, 196, 262].forEach((f, i) => this.tone(f, f * .98, .22, 'sawtooth', .07, 1200, i * .24)); break;
      case 'snip': this.tone(3200, 1200, .06, 'square', .14, 8000); this.noise(.05, 6000, .2, 'highpass'); break;
      case 'spark': for (let i = 0; i < 5; i++) this.noise(.04, 7000, .14, 'highpass', 1, i * .035); break;
      case 'crunch': this.noise(.35, 500, .4, 'lowpass'); this.tone(80, 40, .3, 'sawtooth', .2, 300); break;
      case 'grind': this.tone(70, 64, .14, 'sawtooth', .16, 500); this.noise(.12, 800, .14); break;
      case 'stamp': this.tone(160, 70, .14, 'triangle', .45, 600); break;
      case 'tear': this.noise(.09, 1200 + amount * 1800, .08 + amount * .14, 'bandpass', 2.5); break;
      case 'whoosh': this.noise(.3, 1400, .18, 'bandpass', .7); break;
      case 'click': this.tone(1800, 1400, .03, 'square', .1, 5000); break;
      case 'wire': this.tone(600, 900, .08, 'sine', .14, 3000); break;
      case 'heartbeat': this.tone(70, 45, .14, 'sine', .55, 200); this.tone(65, 42, .12, 'sine', .4, 200, .22); break;
      default: this.cue(name);
    }
  }
  // A looping static bed for the radio dials; level 0 silences it.
  staticLevel(level) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    if (!this.staticNode) {
      if (level <= 0) return;
      this.noise(.01, 100, .0002);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), rec = this.take('radio-static');
      src.buffer = rec || this.noiseBuffer; src.loop = true; if (rec) { src.loopStart = .05; src.loopEnd = rec.duration - .05; } f.type = rec ? 'allpass' : 'bandpass'; f.frequency.value = 2400; f.Q.value = .5; g.gain.value = 0;
      src.connect(f).connect(g).connect(this.nodes.master); src.start();
      this.staticNode = { src, g, scale: rec ? 2.5 : .22 };
    }
    this.staticNode.g.gain.setTargetAtTime(this.muted ? 0 : Math.max(0, Math.min(1, level)) * this.staticNode.scale, c.currentTime, .05);
  }
  // Recorded clips bundled as base64 (decoded once with WebAudio, so the CSP needs no media source).
  clip(name) {
    const c = this.context;
    if (!c || this.muted || !this.active || c.state !== 'running') return;
    const data = { daynight: __DAYNIGHT_SFX__ }[name];
    if (!data) return;
    this.clips = this.clips || {};
    const play = (buffer) => { const src = c.createBufferSource(), g = c.createGain(); g.gain.value = .9; src.buffer = buffer; src.connect(g).connect(this.nodes.master); src.start(); src.onended = () => { src.disconnect(); g.disconnect(); }; };
    if (this.clips[name]) return play(this.clips[name]);
    const bin = atob(data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    c.decodeAudioData(bytes.buffer).then((buffer) => { this.clips[name] = buffer; play(buffer); }).catch(() => {});
  }
  warmClip(name) { const c = this.context; if (!c || (this.clips && this.clips[name])) return; const data = { daynight: __DAYNIGHT_SFX__ }[name]; const bin = atob(data), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); c.decodeAudioData(bytes.buffer).then((b) => { this.clips = this.clips || {}; this.clips[name] = b; }).catch(() => {}); }
  cue(which) {
    if (this.play(which)) return;
    switch (which) {
      case 'glass':
        this.tone(104, 34, .34, 'triangle', .92, 140);
        this.tone(131, 58, .22, 'sine', .32, 140, .028);
        break;
      case 'lens':
        this.tone(1030, 160, .065, 'square', .36, 1600);
        this.tone(650, 127, .09, 'triangle', .35, 900, .075);
        break;
      case 'step':
        this.tone(90, 40, .11, 'triangle', .20, 220);
        break;
      case 'guard':
        this.tone(137, 51, .18, 'triangle', .50, 270);
        this.tone(94, 43, .15, 'triangle', .32, 250, .32);
        break;
      case 'hurt':
        this.tone(179, 50, .29, 'sawtooth', .49, 570);
        break;
      case 'radio':
        this.tone(809, 860, .22, 'square', .21, 1300);
        this.tone(670, 630, .22, 'square', .20, 1100, .27);
        break;
      case 'clue':
        this.tone(330, 440, .21, 'sine', .36);
        this.tone(495, 660, .30, 'sine', .30, 1800, .12);
        break;
      case 'latch':
        this.tone(470, 104, .085, 'square', .28, 1100);
        break;
      case 'gaze':
        // A sharp low sting when the guard locks eyes on the player.
        this.tone(220, 207, .55, 'sawtooth', .34, 700);
        this.tone(233, 220, .55, 'sawtooth', .30, 700, .02);
        this.tone(55, 41, .7, 'sine', .55, 200);
        break;
      case 'keys':
        for (let i = 0; i < 4; i++) this.tone(2400 + i * 310, 1800, .05, 'square', .07, 5200, i * .07);
        this.tone(120, 60, .16, 'triangle', .28, 300, .32);
        break;
      case 'shift':
        this.tone(392, 392, .9, 'sine', .22, 1600);
        this.tone(523, 523, 1.1, 'sine', .16, 1800, .18);
        break;
      case 'tune':
        this.tone(1400 + Math.random() * 900, 900, .04, 'square', .05, 3000);
        break;
      default:
        this.tone(285, 195, .08, 'triangle', .25);
    }
  }
}
