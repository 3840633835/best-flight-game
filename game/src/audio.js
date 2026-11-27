// Every sound is synthesised with WebAudio — no audio files are shipped. An engine
// drone follows the throttle, wind follows the speed, and the rings, warnings, the
// crash and the landing each have their own short voice.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  /** Build the graph on the first user gesture: browsers block audio before one. */
  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 68;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Looping wind: two seconds of white noise, band-passed, gain by speed.
      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, at, dur, type, vol) {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, context.currentTime + at);
    gain.gain.linearRampToValueAtTime(vol, context.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + at + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(context.currentTime + at);
    osc.stop(context.currentTime + at + dur + 0.05);
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    /** Call every frame with the plane's throttle and speed; the drone follows. */
    update(throttle, speed, flying) {
      if (!context || !started) return;
      const t = context.currentTime;
      engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.06 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(58 + throttle * 95 + speed * 0.35, t, 0.1);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 700, t, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.16, speed * 0.0016) : 0, t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    ring() {
      tone(880, 0, 0.22, 'sine', 0.22);
      tone(1318, 0.07, 0.3, 'sine', 0.18);
    },
    click() {
      tone(660, 0, 0.08, 'square', 0.08);
    },
    warn() {
      tone(440, 0, 0.12, 'square', 0.12);
      tone(440, 0.16, 0.12, 'square', 0.12);
    },
    bump() {
      if (!context) return;
      const dur = 0.25;
      const buffer = context.createBuffer(1, context.sampleRate * dur, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.5;
      source.connect(gain);
      gain.connect(master);
      source.start();
      tone(70, 0, 0.4, 'sine', 0.4);
    },
    land() {
      tone(523, 0, 0.18, 'triangle', 0.2);
      tone(659, 0.12, 0.18, 'triangle', 0.2);
      tone(784, 0.24, 0.34, 'triangle', 0.22);
      tone(1046, 0.38, 0.5, 'triangle', 0.18);
    },
  };
}
