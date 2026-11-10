const STORAGE_KEY = 'snake_sound';

export function readSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Playback stays a session preference when storage is blocked.
  }
}

type Cue = 'eat' | 'kill' | 'die';

let audio: AudioContext | null = null;

function context() {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

export function playCue(cue: Cue) {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const tone = cue === 'eat' ? 660 : cue === 'kill' ? 520 : 180;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(tone, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(cue === 'die' ? 0.05 : 0.035, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (cue === 'die' ? 0.22 : 0.09));
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
}
