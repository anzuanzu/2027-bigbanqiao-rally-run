/* Original, on-demand arena stinger. No audio files, network requests or autoplay. */
(() => {
  'use strict';

  const DEFAULT_VOLUME = 0.35;
  const DURATION = 2.4;
  let context = null;
  let contextAttempted = false;
  let output = null;
  let compressor = null;
  let noiseBuffer = null;
  let volume = DEFAULT_VOLUME;
  let sequence = 0;
  let currentRun = null;
  let cancelResume = null;

  const clampVolume = value => Number.isFinite(Number(value))
    ? Math.max(0, Math.min(1, Number(value))) : DEFAULT_VOLUME;

  function setVolume(value) {
    volume = clampVolume(value);
    if (!output || !context) return;
    const now = context.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setTargetAtTime(volume, now, 0.015);
  }

  function releaseRun(run) {
    if (!run) return;
    clearTimeout(run.cleanupTimer);
    const now = context.currentTime;
    // Disconnect immediately as well as stopping the scheduled sources. This
    // also silences filters' tails when the dialog closes or teams switch.
    run.master.gain.cancelScheduledValues(now);
    run.master.gain.setValueAtTime(0, now);
    for (const source of run.sources) {
      try { source.stop(now); } catch (_) { /* Already stopped. */ }
    }
    for (const node of run.nodes) {
      try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
    }
    run.sources.length = 0;
    run.nodes.length = 0;
    if (currentRun === run) currentRun = null;
  }

  function stop() {
    sequence += 1;
    if (cancelResume) cancelResume();
    releaseRun(currentRun);
  }

  function getContext() {
    if (context) return context.state === 'closed' ? null : context;
    if (contextAttempted) return null;
    contextAttempted = true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    output = context.createGain();
    output.gain.value = volume;
    compressor.connect(output);
    output.connect(context.destination);
    return context;
  }

  function ensureRunning(audio) {
    if (audio.state === 'running') return Promise.resolve(true);
    return new Promise(resolve => {
      let finished = false;
      let timeout;
      const finish = success => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (cancelResume === cancel) cancelResume = null;
        resolve(success);
      };
      const cancel = () => finish(false);
      cancelResume = cancel;
      timeout = setTimeout(cancel, 900);
      // Called synchronously in play(), preserving the initiating click's
      // user activation. A rejected or indefinitely suspended context is quiet.
      try { Promise.resolve(audio.resume()).then(() => finish(audio.state === 'running'), cancel); }
      catch (_) { cancel(); }
    });
  }

  function makeNoise(audio) {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * DURATION), audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function createRun(audio) {
    const master = audio.createGain();
    const start = audio.currentTime + 0.015;
    master.gain.setValueAtTime(1, start);
    master.gain.setValueAtTime(1, start + DURATION - 0.12);
    master.gain.linearRampToValueAtTime(0, start + DURATION);
    master.connect(compressor);
    return { master, start, sources: [], nodes: [master], cleanupTimer: 0 };
  }

  function envelope(audio, run, begin, peak, attack, hold, end) {
    const gain = audio.createGain();
    const at = run.start + begin;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.55, 0.0001), at + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + end - 0.025);
    gain.gain.linearRampToValueAtTime(0, at + end);
    gain.connect(run.master);
    run.nodes.push(gain);
    return gain;
  }

  function tone(audio, run, { frequency, endFrequency = frequency, begin = 0, duration, peak, attack = 0.008, hold = 0.08, type = 'sine', cutoff }) {
    const source = audio.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(frequency, run.start + begin);
    source.frequency.exponentialRampToValueAtTime(endFrequency, run.start + begin + Math.min(duration * 0.7, 0.32));
    const gain = envelope(audio, run, begin, peak, attack, hold, duration);
    if (cutoff) {
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.6;
      source.connect(filter);
      filter.connect(gain);
      run.nodes.push(filter);
    } else source.connect(gain);
    run.sources.push(source);
    run.nodes.push(source);
    source.start(run.start + begin);
    source.stop(run.start + begin + duration);
  }

  function noise(audio, run, { begin, duration, peak, attack, hold, frequency, apexFrequency, endFrequency, q }) {
    const source = audio.createBufferSource();
    source.buffer = makeNoise(audio);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, run.start + begin);
    filter.frequency.exponentialRampToValueAtTime(apexFrequency, run.start + begin + attack);
    filter.frequency.exponentialRampToValueAtTime(endFrequency, run.start + begin + duration);
    source.connect(filter);
    filter.connect(envelope(audio, run, begin, peak, attack, hold, duration));
    run.sources.push(source);
    run.nodes.push(source, filter);
    source.start(run.start + begin);
    source.stop(run.start + begin + duration);
  }

  function compose(audio, run) {
    // A brief low impact, rising air sweep and warm major-chord fanfare.
    // The diffuse filtered noise suggests an arena without voices or samples.
    tone(audio, run, { frequency: 95, endFrequency: 38, duration: 0.65, peak: 0.23 });
    tone(audio, run, { frequency: 170, endFrequency: 62, duration: 0.19, peak: 0.055, type: 'triangle' });
    noise(audio, run, { begin: 0.02, duration: 0.92, peak: 0.14, attack: 0.28, hold: 0.39, frequency: 260, apexFrequency: 3800, endFrequency: 750, q: 0.65 });
    noise(audio, run, { begin: 0.34, duration: 1.95, peak: 0.065, attack: 0.2, hold: 0.85, frequency: 720, apexFrequency: 1800, endFrequency: 680, q: 0.5 });
    [146.832, 220, 293.665, 369.994, 440].forEach((frequency, index) => {
      tone(audio, run, { frequency, begin: 0.28 + index * 0.035, duration: 1.9 - index * 0.035, peak: 0.028, attack: 0.055, hold: 0.7, type: 'sawtooth', cutoff: 1650 });
    });
    tone(audio, run, { frequency: 587.33, begin: 0.47, duration: 1.45, peak: 0.024, attack: 0.035, hold: 0.24, type: 'triangle' });
  }

  async function play({ volume: requestedVolume = DEFAULT_VOLUME } = {}) {
    stop();
    const request = sequence;
    setVolume(requestedVolume);
    try {
      const audio = getContext();
      if (!audio || !await ensureRunning(audio) || request !== sequence) return false;
      const run = createRun(audio);
      currentRun = run;
      compose(audio, run);
      run.cleanupTimer = setTimeout(() => releaseRun(run), (DURATION + 0.1) * 1000);
      return true;
    } catch (_) {
      if (request === sequence) releaseRun(currentRun);
      return false;
    }
  }

  window.RallyIntroAudio = Object.freeze({ play, stop, setVolume });
})();
