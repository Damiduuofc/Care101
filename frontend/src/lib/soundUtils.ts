// Utility to play alert notification sounds reliably across all browsers & mobile devices

let sharedAudioCtx: AudioContext | null = null;
let cachedAudioBuffer: AudioBuffer | null = null;
let isAudioBufferLoading = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn("Unable to create AudioContext:", e);
    return null;
  }
}

// Preload and decode /Ding.wav into an AudioBuffer for zero-latency, reliable playback
export async function preloadSound(): Promise<AudioBuffer | null> {
  if (typeof window === "undefined") return null;
  if (cachedAudioBuffer) return cachedAudioBuffer;
  if (isAudioBufferLoading) return null;

  const ctx = getAudioContext();
  if (!ctx) return null;

  isAudioBufferLoading = true;
  try {
    const res = await fetch("/Ding.wav");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    cachedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return cachedAudioBuffer;
  } catch (err) {
    console.warn("Failed to load /Ding.wav buffer, falling back to synthesized chime:", err);
    return null;
  } finally {
    isAudioBufferLoading = false;
  }
}

// Explicit unlock called on user click/touch/interaction
export function unlockAudio(): boolean {
  if (typeof window === "undefined") return false;
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    ctx.resume().catch((e) => console.warn("AudioContext resume failed:", e));
  }

  // Play an imperceptible 1-sample silent buffer to unlock iOS Safari & Android Chrome
  try {
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore
  }

  // Also preload the audio buffer
  preloadSound().catch(() => {});

  return ctx.state === "running";
}

// Global auto-unlock on user interactions
if (typeof window !== "undefined") {
  const handleInteraction = () => {
    unlockAudio();
  };
  window.addEventListener("click", handleInteraction, { passive: true });
  window.addEventListener("touchstart", handleInteraction, { passive: true });
  window.addEventListener("keydown", handleInteraction, { passive: true });

  // Kick off preload early
  if (document.readyState === "complete") {
    preloadSound().catch(() => {});
  } else {
    window.addEventListener("load", () => preloadSound().catch(() => {}), { once: true });
  }
}

// Synthesizes a loud, crisp, elegant hospital announcement ding chime (B5 -> E6)
function playSynthesizedChime(ctx: AudioContext) {
  try {
    const execute = () => {
      const now = ctx.currentTime;

      // --- Tone 1: 987.77 Hz (B5) ---
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.6, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Harmonic for Tone 1: 1975.5 Hz
      const h1 = ctx.createOscillator();
      const hg1 = ctx.createGain();
      h1.type = "sine";
      h1.frequency.setValueAtTime(1975.54, now);
      hg1.gain.setValueAtTime(0.2, now);
      hg1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      h1.connect(hg1);
      hg1.connect(ctx.destination);
      h1.start(now);
      h1.stop(now + 0.4);

      // --- Tone 2: 1318.51 Hz (E6) starting at now + 0.22s ---
      const t2 = now + 0.22;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, t2);
      gain2.gain.setValueAtTime(0.7, t2);
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
      hg2.gain.setValueAtTime(0.25, t2);
      hg2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.8);
      h2.connect(hg2);
      hg2.connect(ctx.destination);
      h2.start(t2);
      h2.stop(t2 + 0.8);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(execute).catch((e) => {
        console.warn("Synthesized chime resume error:", e);
      });
    } else {
      execute();
    }
  } catch (e) {
    console.warn("Chime synthesizer error:", e);
  }
}

export const playDingSound = () => {
  if (typeof window === "undefined") return;

  unlockAudio();

  const ctx = getAudioContext();
  let playedViaBuffer = false;

  // 1. If we have a decoded AudioBuffer and running context, play it directly
  if (ctx && cachedAudioBuffer) {
    try {
      const playBuffer = () => {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = cachedAudioBuffer;
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      };

      if (ctx.state === "suspended") {
        ctx.resume().then(playBuffer).catch(() => {});
      } else {
        playBuffer();
      }
      playedViaBuffer = true;
    } catch (e) {
      console.warn("AudioBuffer playback failed:", e);
    }
  }

  // 2. Synthesized Web Audio chime (guaranteed fallback with zero network requirements)
  if (ctx && !playedViaBuffer) {
    playSynthesizedChime(ctx);
  }

  // 3. Concurrently trigger standard HTML5 Audio with WAV/MP3 fallback
  try {
    const audio = new Audio("/Ding.wav");
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const mp3 = new Audio("/Ding.mp3");
        mp3.volume = 1.0;
        mp3.play().catch(() => {});
      });
    }
  } catch (err) {
    console.warn("HTML5 audio playback error:", err);
  }
};
