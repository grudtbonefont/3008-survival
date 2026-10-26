// Procedural WebAudio sound engine — every sound is synthesized, no audio files.
export class Sfx {
  constructor() { this.ctx = null; this.vol = 0.7; this.hum = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = i % 2 ? w : b * 3.5; }
    this.startHum();
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  get t() { return this.ctx.currentTime; }
  env(g, a, peak, dec, t0 = this.t) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); }
  out(gain = 1, pan = 0) {
    const g = this.ctx.createGain(); g.gain.value = gain;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); } else g.connect(this.master);
    return g;
  }
  noiseBurst({ freq = 1000, q = 1, type = 'bandpass', a = 0.005, peak = 0.5, dec = 0.15, gain = 1, pan = 0, when = 0 }) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); const t0 = this.t + when; this.env(g, a, peak, dec, t0);
    s.connect(f); f.connect(g); g.connect(this.out(gain, pan));
    s.start(t0, Math.random()); s.stop(t0 + a + dec + 0.05);
  }
  tone({ freq = 440, to = null, type = 'sine', a = 0.01, peak = 0.3, dec = 0.3, gain = 1, pan = 0, when = 0, detune = 0 }) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = type; o.detune.value = detune;
    const t0 = this.t + when; o.frequency.setValueAtTime(freq, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + a + dec);
    const g = this.ctx.createGain(); this.env(g, a, peak, dec, t0); o.connect(g); g.connect(this.out(gain, pan));
    o.start(t0); o.stop(t0 + a + dec + 0.05);
  }
  startHum() {
    // fluorescent hum + air-conditioning rumble
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = this.ctx.createGain(); g.gain.value = 0.012;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 180;
    const ng = this.ctx.createGain(); ng.gain.value = 0.05; n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start();
    this.hum = { g, ng };
  }
  setNight(f) { if (this.hum) { this.hum.g.gain.value = 0.012 * (1 - f) + 0.002; this.hum.ng.gain.value = 0.05 + f * 0.04; } }
  play(name, o = {}) {
    if (!this.ctx) return;
    const pan = o.pan || 0, gain = o.gain ?? 1;
    switch (name) {
      case 'step': this.noiseBurst({ freq: 300 + Math.random() * 200, q: 0.8, peak: 0.25, dec: 0.08, gain: gain * 0.6, pan }); break;
      case 'jump': this.noiseBurst({ freq: 500, peak: 0.2, dec: 0.1, gain }); break;
      case 'land': this.noiseBurst({ freq: 200, q: 0.5, peak: 0.5, dec: 0.12, gain }); break;
      case 'swing': this.noiseBurst({ freq: 1800, q: 2, a: 0.04, peak: 0.25, dec: 0.12, gain, pan }); break;
      case 'hit': this.noiseBurst({ freq: 900, q: 1, peak: 0.8, dec: 0.12, gain, pan }); this.tone({ freq: 140, to: 60, type: 'triangle', peak: 0.6, dec: 0.15, gain, pan }); break;
      case 'wood': this.noiseBurst({ freq: 400, q: 3, peak: 0.8, dec: 0.2, gain, pan }); this.tone({ freq: 220, to: 120, type: 'square', peak: 0.15, dec: 0.1, gain, pan }); break;
      case 'hurt': this.tone({ freq: 300, to: 120, type: 'sawtooth', peak: 0.3, dec: 0.25, gain }); this.noiseBurst({ freq: 600, peak: 0.6, dec: 0.15, gain }); break;
      case 'eat': for (let i = 0; i < 4; i++) this.noiseBurst({ freq: 2500, q: 1.5, peak: 0.35, dec: 0.05, when: i * 0.13, gain }); break;
      case 'heal': this.tone({ freq: 523, peak: 0.2, dec: 0.2 }); this.tone({ freq: 784, peak: 0.2, dec: 0.3, when: 0.1 }); break;
      case 'pickup': this.tone({ freq: 660, to: 990, type: 'triangle', peak: 0.25, dec: 0.12, gain }); break;
      case 'place': this.noiseBurst({ freq: 250, q: 1, peak: 0.7, dec: 0.2 }); this.tone({ freq: 90, to: 50, peak: 0.4, dec: 0.2 }); break;
      case 'craft': [523, 659, 784].forEach((f, i) => this.tone({ freq: f, type: 'triangle', peak: 0.2, dec: 0.15, when: i * 0.07 })); break;
      case 'break': this.noiseBurst({ freq: 3000, q: 0.7, peak: 0.6, dec: 0.3 }); break;
      case 'chime': [659, 523, 784, 659].forEach((f, i) => this.tone({ freq: f, peak: 0.22, dec: 0.6, when: i * 0.28 })); break;
      case 'alarm': for (let i = 0; i < 6; i++) { this.tone({ freq: 700, to: 500, type: 'square', peak: 0.12, dec: 0.45, when: i * 0.5 }); } break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'square', peak: 0.12, dec: 0.2, when: i * 0.09 })); break;
      case 'death': this.tone({ freq: 400, to: 60, type: 'sawtooth', peak: 0.3, dec: 1.5 }); break;
      case 'click': this.tone({ freq: 1200, type: 'square', peak: 0.08, dec: 0.03 }); break;
      case 'creak': this.tone({ freq: 90 + Math.random() * 40, to: 60, type: 'sawtooth', a: 0.2, peak: 0.08, dec: 1.2, gain, pan }); break;
      case 'employee': // creepy distorted "hello?"
        this.tone({ freq: 180 + Math.random() * 60, to: 120, type: 'sawtooth', a: 0.05, peak: 0.25, dec: 0.5, gain, pan, detune: 30 });
        this.tone({ freq: 240 + Math.random() * 60, to: 300, type: 'square', a: 0.05, peak: 0.08, dec: 0.4, gain, pan, when: 0.25 });
        break;
      case 'heavystep': this.tone({ freq: 70, to: 40, type: 'sine', peak: 0.6, dec: 0.2, gain, pan }); break;
      case 'scream': this.tone({ freq: 900, to: 400, type: 'sawtooth', a: 0.02, peak: 0.12, dec: 0.6, gain, pan, detune: 50 }); this.noiseBurst({ freq: 2000, peak: 0.2, dec: 0.5, gain, pan }); break;
    }
  }
}
