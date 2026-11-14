import * as THREE from 'three';

export function assertStateTransitions() {
  // This test oracle is independent of the runtime transition table.
  const contract = {
    BOOT:['EXPLORING'], EXPLORING:['INSPECTING_OBJECT','EVIDENCE_BOARD'],
    INSPECTING_OBJECT:['EXPLORING','INK_MEMORY_VIGNETTE'], INK_MEMORY_VIGNETTE:['EXPLORING'],
    EVIDENCE_BOARD:['EXPLORING','CASE_SOLVED'], CASE_SOLVED:['EXPLORING']
  };
  const states = Object.keys(contract);
  for (const from of states) {
    for (const to of states) {
      const machine = new StateMachine();
      machine.state = from;
      const expected = contract[from].includes(to);
      if (machine.go(to) !== expected) throw new Error(`${from} → ${to} did not match the transition table.`);
      if (expected && machine.state !== to) throw new Error(`${from} → ${to} did not update state.`);
      if (!expected && machine.state !== from) throw new Error(`Illegal ${from} → ${to} changed state.`);
    }
  }
  const machine = new StateMachine();
  if (machine.canLook) throw new Error('BOOT incorrectly allows looking.');
  if (!machine.go('EXPLORING') || !machine.canLook) throw new Error('EXPLORING must allow looking.');
  for (const state of ['INSPECTING_OBJECT', 'INK_MEMORY_VIGNETTE', 'EVIDENCE_BOARD', 'CASE_SOLVED']) {
    machine.state = state;
    if (machine.canLook) throw new Error(`${state} incorrectly allows looking.`);
  }
  return 'All FSM pairs, illegal/self transitions, state updates, and canLook permissions passed.';
}

export function assertDotProductReveal() {
  if (!dotReveal(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, 9))) throw new Error('Non-unit aligned vectors did not reveal.');
  if (dotReveal(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.92, Math.sqrt(1 - 0.92 ** 2), 0))) throw new Error('Strict 0.92 boundary revealed.');
  if (!dotReveal(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.920001, Math.sqrt(1 - 0.920001 ** 2), 0))) throw new Error('Dot value above 0.92 did not reveal.');
  if (dotReveal(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1))) throw new Error('Zero normal revealed.');
  if (dotReveal(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0))) throw new Error('Zero light revealed.');
  return 'Normalized vectors, strict threshold, and zero vectors passed.';
}

export async function assertShaderUniforms(renderer) {
  if (!renderer || typeof renderer.verify !== 'function') throw new Error('renderer.verify() is unavailable.');
  const result = await renderer.verify();
  if (result === false) throw new Error('renderer.verify() returned false.');
  return 'Shader uniform verification passed.';
}

export function assertTextureFactory(factory) {
  if (!factory?.textures || typeof factory.textures[Symbol.iterator] !== 'function') throw new Error('factory.textures is unavailable.');
  const textures = [...factory.textures];
  if (!textures.length) throw new Error('No textures were registered.');
  for (const texture of textures) {
    if (!(texture instanceof THREE.CanvasTexture)) throw new Error('A registered texture is not a THREE.CanvasTexture.');
    const canvas = texture.image;
    if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) throw new Error('A texture has empty canvas dimensions.');
    if (!(texture.version > 0)) throw new Error('Texture version is zero; needsUpdate was not set.');
  }
  return `${textures.length} registered canvas texture(s) are ready.`;
}

export function createDiagnostics({ renderer, factory } = {}) {
  return async function runECCDiagnostics() {
    const tests = [];
    const record = async (name, fn) => {
      try { tests.push({ name, pass: true, detail: await fn() }); }
      catch (error) { tests.push({ name, pass: false, detail: error?.message || String(error) }); }
    };
    await record('assertStateTransitions', assertStateTransitions);
    await record('assertDotProductReveal', assertDotProductReveal);
    await record('assertShaderUniforms', () => assertShaderUniforms(renderer));
    await record('assertTextureFactory', () => assertTextureFactory(factory));
    return { passed: tests.filter(test => test.pass).length, total: tests.length, tests };
  };
}

export class StateMachine {
  static transitions = Object.freeze({
    BOOT: ['EXPLORING'],
    EXPLORING: ['INSPECTING_OBJECT', 'EVIDENCE_BOARD'],
    INSPECTING_OBJECT: ['EXPLORING', 'INK_MEMORY_VIGNETTE'],
    INK_MEMORY_VIGNETTE: ['EXPLORING'],
    EVIDENCE_BOARD: ['EXPLORING', 'CASE_SOLVED'],
    CASE_SOLVED: ['EXPLORING'],
  });

  constructor() { this.state = 'BOOT'; }
  get canLook() { return this.state === 'EXPLORING'; }
  go(next) {
    if (!StateMachine.transitions[this.state]?.includes(next)) return false;
    this.state = next;
    return true;
  }
}

export function dotReveal(normal, lightDirection) {
  const normalLength = Math.hypot(normal?.x ?? 0, normal?.y ?? 0, normal?.z ?? 0);
  const lightLength = Math.hypot(lightDirection?.x ?? 0, lightDirection?.y ?? 0, lightDirection?.z ?? 0);
  if (!normalLength || !lightLength) return false;
  const dot = ((normal.x * lightDirection.x) + (normal.y * lightDirection.y) + (normal.z * lightDirection.z)) / (normalLength * lightLength);
  return dot > 0.92;
}

export const CLUE_REGISTRY = Object.freeze({
  visa: Object.freeze({
    title: 'Forged Medical Visa', chapter: 'The Lure', number: '01', enabled: true,
    description: 'A medical visa stamp, A17, carries the initials M. VALE. Mara Vale had been promised work at a clinic; the stamp alone cannot establish who altered the paperwork.',
    detail: 'The clinic offer and A17 route appear together. Mara presses a carbon receipt at the desk to preserve proof of what she was given.',
    memoryLine: '“They said the clinic was waiting for me.”',
    memoryPrompt: 'Press the carbon receipt flat to preserve proof.',
    memoryAction: 'Mara presses a carbon receipt at the desk to preserve proof of the clinic offer and A17 stamp.',
    receipt: 'The desk carbon copy bears the same A17 reference.', bleedTitle: 'Carbon receipt',
    linkLabel: 'A17 appears on both records', artifactStamp: 'A17',
    deduction: 'Mara was offered clinic work. Her A17 receipt matches a visa listing her as a patient. Her copy gives investigators a lead they can check with her.', textureKey: 'visa',
  }),
  phone: Object.freeze({
    title: 'Burner Phone', chapter: 'The Transit', number: '02', enabled: false,
    description: 'A number is written beside M. VALE in the clinic travel notes. Its owner is not identified by the note alone.',
    detail: 'The number may help trace who arranged Mara’s journey and the promised clinic work.',
    memoryLine: '“I wrote it down before the paper was taken.”',
    memoryPrompt: 'Save the number for comparison.',
    memoryAction: 'Mara saves the callback number so it can be compared with the clinic and travel records.',
    receipt: 'Mara’s saved callback note repeats extension 0147.', bleedTitle: 'Callback note',
    artifactStamp: '0147',
    linkLabel: 'Compare the callback number',
    deduction: 'The number may identify an intermediary; corroboration is still needed.', textureKey: 'phone',
  }),
  manifest: Object.freeze({
    title: 'Redacted Clinic Manifest', chapter: 'The Signal', number: '03', enabled: false,
    description: 'A redacted clinic manifest lists M. VALE beside a blank consent field and the phrase “donor allocation.” The signature is redacted; this raises a concern about possible organ procurement but does not prove it.',
    detail: 'Mara’s account was that she had been promised clinic work and was never asked to sign this page. The blank field and redaction need independent follow-up.',
    memoryLine: '“I was promised clinic work. No one asked me to sign this.”',
    memoryPrompt: 'Mark the blank consent field.',
    memoryAction: 'Mara marks the blank consent field so its absence can be checked against the original record.',
    receipt: 'The saved desk carbon carries A17 and her initials.', bleedTitle: 'Unsigned carbon copy',
    artifactStamp: 'UNSIGNED',
    linkLabel: 'Check the missing consent record',
    deduction: 'The missing consent entry calls for verification; it does not by itself prove coercion or a crime.', textureKey: 'manifest',
  }),
});

export class InkAudio {
  constructor() {
    this.context = null;
    this.nodes = null;
    this.muted = false;
    this.memory = false;
    this.active = true;
    this.disposed = false;
    this.activityQueue = null;
  }

  async gesture() {
    if (this.disposed) return false;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      if (!this.context) {
        this.context = new AudioContextClass();
        this.#buildGraph();
      }
      const context = this.context;
      if (this.active && context.state !== 'running') await context.resume();
      if (context !== this.context || this.disposed) return false;
      if (!this.active && context.state === 'running') await context.suspend();
      this.#applyMix();
      return true;
    } catch {
      return false;
    }
  }

  #buildGraph() {
    const context = this.context;
    const master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);

    // Locally generated filtered noise gives a quiet, continuous vinyl texture.
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * 0.22;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 900;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.12;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();

    // Sparse, short impulses add a recognizable but subdued vinyl crackle.
    const crackleBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const crackles = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackles.length; i++) {
      if (Math.random() < 0.00018) crackles[i] = (Math.random() * 2 - 1) * 0.8;
    }
    const crackle = context.createBufferSource();
    crackle.buffer = crackleBuffer;
    crackle.loop = true;
    const crackleFilter = context.createBiquadFilter();
    crackleFilter.type = 'lowpass';
    crackleFilter.frequency.value = 3500;
    const crackleGain = context.createGain();
    crackleGain.gain.value = 0.09;
    crackle.connect(crackleFilter).connect(crackleGain).connect(master);
    crackle.start();

    // Slow oscillator modulation creates a soft, non-literal heartbeat pulse.
    const heart = context.createOscillator();
    heart.type = 'sine';
    heart.frequency.value = 54;
    const heartFilter = context.createBiquadFilter();
    heartFilter.type = 'lowpass';
    heartFilter.frequency.value = 100;
    const heartGain = context.createGain();
    heartGain.gain.value = 0;
    const pulse = context.createOscillator();
    pulse.frequency.value = 1.15;
    const pulseDepth = context.createGain();
    pulseDepth.gain.value = 0;
    pulse.connect(pulseDepth).connect(heartGain.gain);
    heart.connect(heartFilter).connect(heartGain).connect(master);
    heart.start();
    pulse.start();

    this.nodes = { master, noise, noiseGain, noiseFilter, crackle, crackleFilter, crackleGain, heart, heartFilter, heartGain, pulse, pulseDepth };
  }

  #applyMix() {
    if (!this.nodes || !this.context) return;
    const now = this.context.currentTime;
    this.nodes.master.gain.setTargetAtTime(this.muted ? 0 : 0.16, now, 0.04);
    this.nodes.noiseGain.gain.setTargetAtTime(this.memory ? 0.035 : 0.12, now, 0.12);
    this.nodes.heartGain.gain.setTargetAtTime(this.memory ? 0.018 : 0, now, 0.12);
    this.nodes.pulseDepth.gain.setTargetAtTime(this.memory ? 0.01 : 0, now, 0.12);
    this.nodes.noiseFilter.frequency.setTargetAtTime(this.memory ? 500 : 900, now, 0.12);
  }

  setMuted(value) { this.muted = Boolean(value); this.#applyMix(); }
  setMemory(value) { this.memory = Boolean(value); this.#applyMix(); }

  setActive(value) {
    this.active = Boolean(value);
    if (!this.context || this.disposed) return;
    // Serialize changes so a slow suspend cannot overtake a later resume.
    const context = this.context;
    this.activityQueue = (this.activityQueue || Promise.resolve()).then(async () => {
      if (this.disposed || context !== this.context || context.state === 'closed') return;
      if (this.active && context.state !== 'running') await context.resume();
      else if (!this.active && context.state === 'running') await context.suspend();
    }).catch(() => {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.nodes) {
      for (const node of [this.nodes.noise, this.nodes.crackle, this.nodes.heart, this.nodes.pulse]) {
        try { node.stop(); } catch { /* already stopped */ }
      }
      for (const node of Object.values(this.nodes)) {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
      this.nodes = null;
    }
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
  }
}
