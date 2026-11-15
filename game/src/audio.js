// All sound is synthesized with WebAudio: no audio files, no network. The
// engine starts on the first user gesture (browsers block audio before one) and
// stays quiet until then. Music is a tiny step sequencer: a low bass pulse and
// a sparse pluck melody, both quiet under the effects.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone({ type = 'sine', from = 440, to = null, dur = 0.1, vol = 0.2, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.25, low = 400, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone({ type: 'square', from: 920, to: 420, dur: 0.07, vol: 0.08 }); }
  enemyHit() { this.tone({ type: 'triangle', from: 300, to: 180, dur: 0.05, vol: 0.12 }); }
  explode(big = false) {
    this.noise({ dur: big ? 0.5 : 0.25, vol: big ? 0.4 : 0.25, low: big ? 900 : 1400 });
    this.tone({ type: 'sine', from: big ? 160 : 220, to: 40, dur: big ? 0.45 : 0.25, vol: 0.3 });
  }
  pickup(combo = 0) {
    const base = 620 * Math.pow(1.03, Math.min(combo, 30));
    this.tone({ type: 'sine', from: base, to: base * 1.5, dur: 0.09, vol: 0.14 });
  }
  hurt() {
    this.tone({ type: 'sawtooth', from: 170, to: 55, dur: 0.22, vol: 0.25 });
    this.noise({ dur: 0.15, vol: 0.15, low: 700 });
  }
  shieldBreak() { this.tone({ type: 'triangle', from: 1200, to: 300, dur: 0.18, vol: 0.2 }); }
  waveHorn() {
    this.tone({ type: 'sine', from: 392, dur: 0.16, vol: 0.16 });
    this.tone({ type: 'sine', from: 523, dur: 0.22, vol: 0.16, when: 0.14 });
  }
  upgradePick() {
    [523, 659, 784].forEach((f, i) => this.tone({ type: 'sine', from: f, dur: 0.14, vol: 0.16, when: i * 0.07 }));
  }
  uiClick() { this.tone({ type: 'sine', from: 700, to: 900, dur: 0.05, vol: 0.1 }); }
  bossWarn() {
    this.tone({ type: 'sawtooth', from: 90, to: 60, dur: 0.6, vol: 0.25 });
    this.tone({ type: 'sawtooth', from: 135, to: 90, dur: 0.6, vol: 0.15, when: 0.1 });
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.25, vol: 0.18, when: i * 0.12 }));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.16, when: i * 0.16 }));
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A minor-key bass line (A C D E) with a sparse pluck on top.
    const bass = [110, 110, 130.8, 98, 110, 110, 146.8, 164.8];
    const pluck = [440, 0, 523.25, 0, 659.25, 0, 523.25, 392, 440, 0, 523.25, 0, 587.33, 659.25, 0, 0];
    const stepDur = 60 / 132 / 2; // eighth notes at 132 BPM
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) { this.musicStep++; return; }
      const i = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % bass.length;
      const b = bass[bar];
      if (i % 4 === 0) this.tone({ type: 'triangle', from: b, dur: stepDur * 3.5, vol: 0.07 });
      const p = pluck[i];
      if (p) this.tone({ type: 'sine', from: p, dur: stepDur * 1.8, vol: 0.045 });
      this.musicStep++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicOn = false;
  }
}
