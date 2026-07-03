// sfx — sonido 100% sintetizado con WebAudio, cero assets.
// Se degrada a silencio si no hay AudioContext. ensure() en el primer gesto.
class Sfx {
  constructor() {
    this.ac = null;
    this.master = null;
  }

  ensure() {
    if (this.ac) {
      if (this.ac.state === "suspended") void this.ac.resume();
      return;
    }
    try {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ac.destination);
    } catch {
      this.ac = null;
    }
  }

  blip(freq, dur, type, gain, slide = 0, delay = 0) {
    if (!this.ac || !this.master) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, gain, lp = 1200, delay = 0) {
    if (!this.ac || !this.master) return;
    const t = this.ac.currentTime + delay;
    const n = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, n, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const f = this.ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lp;
    const g = this.ac.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  // reparto: tres cartas rapiditas
  deal() {
    this.noise(0.06, 0.2, 2200, 0);
    this.noise(0.06, 0.2, 2000, 0.11);
    this.noise(0.06, 0.22, 1800, 0.22);
  }

  // la carta golpea el fieltro
  slap() {
    this.noise(0.09, 0.34, 1600);
    this.blip(180, 0.07, "triangle", 0.12, -80);
  }

  // hover / selección sutil
  tick() {
    this.blip(950, 0.035, "square", 0.04, -200);
  }

  // canto: dos notas de bronca, sube la presión
  canto() {
    this.blip(196, 0.28, "sawtooth", 0.16, 30);
    this.blip(294, 0.34, "sawtooth", 0.14, 40, 0.1);
    this.noise(0.18, 0.08, 800);
  }

  // cierre de mano
  handEnd(won) {
    const seq = won ? [392, 494, 587] : [311, 262, 208];
    seq.forEach((f, i) => this.blip(f, 0.3, "triangle", 0.13, 0, i * 0.12));
  }

  // cierre de partida
  matchEnd(won) {
    const seq = won ? [392, 494, 587, 784] : [330, 294, 247, 196];
    seq.forEach((f, i) => this.blip(f, 0.4, "triangle", 0.16, 0, i * 0.15));
    this.noise(0.5, 0.12, won ? 2400 : 500, 0.2);
  }
}

export const sfx = new Sfx();
