export class AudioManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);
    this.startAmbient();
  }

  playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  playNoise(dur: number, vol = 0.2) {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(gain).connect(this.sfxGain);
    src.start();
  }

  engineSound(speedRatio: number) {
    if (!this.ctx || !this.sfxGain) return;
    // Simple whoosh
    this.playNoise(0.1, 0.05 + speedRatio * 0.1);
  }

  boost() {
    this.playTone(300, 0.2, 'sawtooth', 0.4);
    this.playTone(600, 0.3, 'square', 0.2);
  }

  checkpoint() {
    this.playTone(880, 0.15, 'sine', 0.3);
    this.playTone(1320, 0.15, 'sine', 0.3);
  }

  lapComplete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.playTone(f, 0.2), i * 120));
  }

  raceStart() {
    this.playTone(440, 0.3, 'square', 0.4);
  }

  raceEnd() {
    this.playTone(330, 0.5, 'sawtooth', 0.4);
  }

  startAmbient() {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain).connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    osc.connect(gain).connect(this.musicGain);
    lfo.start();
    osc.start();
  }

  setMasterVolume(v: number) { if (this.masterGain) this.masterGain.gain.value = v; }
  setMusicVolume(v: number) { if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVolume(v: number) { if (this.sfxGain) this.sfxGain.gain.value = v; }
}
