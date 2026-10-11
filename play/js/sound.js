// The game's sounds, made from tones as in Audio/SoundSynth.cs: short notes with a quick attack and a decay, a
// sine with a little of its octave. Made once, on the first sound (browsers start audio after a gesture).
const RATE = 44100;
let context = null;
let buffers = null;
export const sound = { enabled: true };

const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);

function note(frequency, seconds, volume, octave = 0.3) {
  const count = Math.floor(seconds * RATE);
  const samples = new Float32Array(count);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / RATE, progress = i / count;
    phase += (2 * Math.PI * frequency) / RATE;
    const envelope = Math.min(1, t / 0.004) * Math.pow(1 - progress, 2.5);
    samples[i] = (volume * envelope * (Math.sin(phase) + octave * Math.sin(2 * phase))) / (1 + octave);
  }
  return samples;
}

function sequence(step, ...notes) {
  const stepSamples = Math.floor(step * RATE);
  let length = 0;
  notes.forEach((n, i) => (length = Math.max(length, i * stepSamples + n.length)));
  const mix = new Float32Array(length);
  notes.forEach((n, i) => n.forEach((value, s) => (mix[i * stepSamples + s] += value)));
  return mix;
}

function make() {
  const all = {
    tick: note(midi(84), 0.05, 0.18),
    found: sequence(0.08, note(midi(76), 0.25, 0.35), note(midi(83), 0.35, 0.35)),
    complete: sequence(0.11, note(midi(72), 0.3, 0.3), note(midi(76), 0.3, 0.3), note(midi(79), 0.3, 0.3), note(midi(84), 0.7, 0.35)),
    hint: sequence(0.06, note(midi(88), 0.18, 0.2), note(midi(91), 0.25, 0.2)),
  };
  buffers = {};
  for (const [name, samples] of Object.entries(all)) {
    const buffer = context.createBuffer(1, samples.length, RATE);
    buffer.copyToChannel(samples, 0);
    buffers[name] = buffer;
  }
}

/** Plays a sound; pitch in octaves (-1 to 1), as MonoGame's. */
export function play(name, pitch = 0) {
  if (!sound.enabled) return;
  try {
    if (!context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      context = new Context();
      make();
    }
    if (context.state === "suspended") context.resume();
    const source = context.createBufferSource();
    source.buffer = buffers[name];
    source.playbackRate.value = Math.pow(2, pitch);
    source.connect(context.destination);
    source.start();
  } catch (e) {
    // No sound is no problem.
  }
}
