// sfx — sonido 100% sintetizado con WebAudio, cero assets.
// Se degrada a silencio si no hay AudioContext. ensure() en el primer gesto.
class Sfx {
  constructor() {
    this.ac = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ac) {
      if (this.ac.state === "suspended") void this.ac.resume();
      return;
    }
    try {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ac.destination);
    } catch {
      this.ac = null;
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.master || !this.ac) return;
    const now = this.ac.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, now, 0.03);
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

  // murmullo de bar: colchón grave + clinks de vasos cada tanto
  ambient() {
    if (!this.ac || !this.master || this._ambientOn) return;
    this._ambientOn = true;
    const ac = this.ac;
    const noiseLoop = () => {
      if (!this._ambientOn) return;
      this.noise(2.4, 0.028, 320);
      this._ambientTimer = setTimeout(noiseLoop, 1900);
    };
    noiseLoop();
    const clinkLoop = () => {
      if (!this._ambientOn) return;
      if (Math.random() < 0.4) this.blip(1900 + Math.random() * 900, 0.12, "sine", 0.018, -300);
      this._clinkTimer = setTimeout(clinkLoop, 4200 + Math.random() * 5200);
    };
    clinkLoop();
    void ac;
  }

  // Ambiente psicodélico original: notas largas, ecos y un pulso grave muy suave.
  portalAmbient() {
    if (!this.ac || !this.master || this._portalAmbientOn) return;
    this._portalAmbientOn = true;
    const phrase = () => {
      if (!this._portalAmbientOn) return;
      const notes = [146.83, 174.61, 220, 261.63, 220, 174.61];
      notes.forEach((frequency, index) => {
        const delay = index * 1.08;
        this.blip(frequency, 1.9, "sine", .018, index % 2 ? 8 : -6, delay);
        this.blip(frequency * 2, 1.45, "triangle", .006, -14, delay + .58);
        this.blip(frequency, 1.2, "sine", .004, -5, delay + 1.12);
      });
      this.blip(73.42, 6.8, "sine", .012, -3);
      this.noise(3.4, .006, 520, 2.1);
      this._portalAmbientTimer = setTimeout(phrase, 8800);
    };
    phrase();
  }

  stopPortalAmbient() {
    this._portalAmbientOn = false;
    clearTimeout(this._portalAmbientTimer);
    this._portalAmbientTimer = null;
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

  // ── duelo de bardo ──────────────────────────────────────────────────────
  // martillo que cae en vacío: seco, metálico, y un silencio que pesa
  dryClick() {
    this.blip(2400, 0.018, "square", 0.09, -1600);
    this.noise(0.03, 0.18, 5200);
    this.blip(140, 0.06, "sine", 0.05, -60, 0.02);
  }

  // tambor girando: carraca que se frena
  drumSpin() {
    for (let i = 0; i < 9; i += 1) this.noise(0.018, 0.12, 4200, i * (0.035 + i * 0.008));
  }

  // ¡PAF! corcho: pop grave + chispa + tribuna que explota
  corchazo() {
    this.blip(120, 0.22, "sine", 0.3, -80);
    this.noise(0.12, 0.42, 3200);
    this.blip(1800, 0.1, "triangle", 0.08, 900, 0.02);
    this.noise(1.1, 0.1, 900, 0.14);
  }

  // la tribuna del antro: "¡uuuh!" cuando el remate entra
  crowd(intensity = 1) {
    this.noise(0.9, 0.07 * intensity, 700);
    this.blip(220, 0.5, "sawtooth", 0.025 * intensity, 60, 0.05);
    this.blip(277, 0.5, "sawtooth", 0.02 * intensity, 50, 0.08);
  }

  // cierre de partida
  matchEnd(won) {
    const seq = won ? [392, 494, 587, 784] : [330, 294, 247, 196];
    seq.forEach((f, i) => this.blip(f, 0.4, "triangle", 0.16, 0, i * 0.15));
    this.noise(0.5, 0.12, won ? 2400 : 500, 0.2);
  }
}

export const sfx = new Sfx();
