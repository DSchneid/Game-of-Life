// Pentatonic Scale Frequencies (C Major Pentatonic)
const SCALES = {
  pentatonic: [
    130.81, 146.83, 164.81, 196.00, 220.00, // C3 - A3
    261.63, 293.66, 329.63, 392.00, 440.00, // C4 - A4
    523.25, 587.33, 659.25, 783.99, 880.00  // C5 - A5
  ]
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private enabled: boolean = false;
  private volume: number = 0.1;
  private type: OscillatorType = 'sine';

  constructor() {
    // AudioContext must be initialized after user interaction usually,
    // we'll handle lazy loading.
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.init();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public setWaveform(type: OscillatorType) {
    this.type = type;
  }

  public playGenerationSound(bornCount: number, avgRow: number, totalRows: number) {
    if (!this.enabled || !this.ctx || !this.gainNode) return;
    if (bornCount === 0) return;

    // 1. Determine Pitch based on average Row (Height)
    // Lower rows (higher index) -> Lower pitch? Or inverse?
    // Let's do: Top of screen (index 0) = High Pitch, Bottom = Low Pitch.
    // Invert avgRow ratio.
    const normalizedHeight = 1 - (avgRow / totalRows); 
    const scaleIndex = Math.floor(normalizedHeight * SCALES.pentatonic.length);
    const safeIndex = Math.max(0, Math.min(scaleIndex, SCALES.pentatonic.length - 1));
    const frequency = SCALES.pentatonic[safeIndex];

    // 2. Determine "Texture" or Duration based on density
    // More births = slightly longer, fuller sound
    const duration = Math.min(0.5, 0.1 + (bornCount * 0.005));

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = this.type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    // Envelope
    noteGain.connect(this.gainNode);
    // Attack
    noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
    // Decay/Release
    noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(noteGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.1);

    // Optional: Add a subtle harmony if lots of births
    if (bornCount > 5) {
        this.playHarmony(safeIndex - 2, duration);
    }
  }

  private playHarmony(baseIndex: number, duration: number) {
      if (!this.ctx || !this.gainNode) return;
      if (baseIndex < 0) baseIndex += 5; // Wrap pentatonic

      const freq = SCALES.pentatonic[baseIndex];
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      
      osc.type = this.type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      noteGain.connect(this.gainNode);
      noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(this.volume * 0.5, this.ctx.currentTime + 0.1); // Quieter
      noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration + 0.2);

      osc.connect(noteGain);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.3);
  }
}

export const soundEngine = new SoundEngine();
