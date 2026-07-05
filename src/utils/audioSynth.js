let sharedAudioCtx = null;

export function getSharedAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch((e) => console.log("Failed to resume AudioContext", e));
  }
  return sharedAudioCtx;
}

export function playSuccessSound() {
  try {
    const ctx = getSharedAudioContext();
    const now = ctx.currentTime;
    
    // Warmth filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2500, now);
    filter.connect(ctx.destination);
    
    const playTone = (freq, delay, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };

    // Arpeggio: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
    playTone(523.25, 0, 0.35);
    playTone(659.25, 0.07, 0.35);
    playTone(783.99, 0.14, 0.55);
  } catch (e) {
    console.error("Failed to play success sound", e);
  }
}

export function playFailureSound() {
  try {
    const ctx = getSharedAudioContext();
    const now = ctx.currentTime;
    
    // Gentle lowpass to remove triangles buzzy highs
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, now); 
    filter.connect(ctx.destination);
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now); // F#3
    osc.frequency.linearRampToValueAtTime(120, now + 0.35); // B2
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(filter);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.error("Failed to play failure sound", e);
  }
}
