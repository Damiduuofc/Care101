// Utility to play alert notification sounds reliably across all browsers

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Explicit unlock called on user click/touch/interaction
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// Global auto-unlock on first document interaction
if (typeof window !== "undefined") {
  const handleInteraction = () => {
    unlockAudio();
    window.removeEventListener("click", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
    window.removeEventListener("touchstart", handleInteraction);
  };
  window.addEventListener("click", handleInteraction, { passive: true, once: true });
  window.addEventListener("keydown", handleInteraction, { passive: true, once: true });
  window.addEventListener("touchstart", handleInteraction, { passive: true, once: true });
}

// Synthesizes a loud, crisp, elegant hospital announcement ding chime (B5 -> E6)
function playSynthesizedChime(ctx: AudioContext) {
  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // --- Tone 1: 987.77 Hz (B5) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(987.77, now);
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Harmonic for Tone 1: 1975.5 Hz
    const h1 = ctx.createOscillator();
    const hg1 = ctx.createGain();
    h1.type = "sine";
    h1.frequency.setValueAtTime(1975.54, now);
    hg1.gain.setValueAtTime(0.18, now);
    hg1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    h1.connect(hg1);
    hg1.connect(ctx.destination);
    h1.start(now);
    h1.stop(now + 0.35);

    // --- Tone 2: 1318.51 Hz (E6) starting at now + 0.22s ---
    const t2 = now + 0.22;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.51, t2);
    gain2.gain.setValueAtTime(0.6, t2);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 1.2);

    // Harmonic for Tone 2: 2637.0 Hz
    const h2 = ctx.createOscillator();
    const hg2 = ctx.createGain();
    h2.type = "sine";
    h2.frequency.setValueAtTime(2637.02, t2);
    hg2.gain.setValueAtTime(0.2, t2);
    hg2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.8);
    h2.connect(hg2);
    hg2.connect(ctx.destination);
    h2.start(t2);
    h2.stop(t2 + 0.8);
  } catch (e) {
    console.warn("Chime synthesizer error:", e);
  }
}

export const playDingSound = () => {
  if (typeof window === "undefined") return;

  unlockAudio();

  // 1. Always trigger synthesized Web Audio bell chime (guaranteed zero latency, no codec issues)
  const ctx = getAudioContext();
  if (ctx) {
    playSynthesizedChime(ctx);
  }

  // 2. Concurrently attempt HTML5 Audio (/Ding.wav first, then /Ding.mp3)
  try {
    const audio = new Audio("/Ding.wav");
    audio.currentTime = 0;
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const mp3 = new Audio("/Ding.mp3");
        mp3.currentTime = 0;
        mp3.volume = 1.0;
        mp3.play().catch(() => {});
      });
    }
  } catch (err) {
    console.warn("HTML5 audio playback error:", err);
  }
};
