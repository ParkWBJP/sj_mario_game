import { AUDIO_ASSETS } from "../config/assets.js";

function createAudio(src, { loop = false, volume = 1 } = {}) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.loop = loop;
  audio.volume = volume;
  return audio;
}

export class AudioManager {
  constructor() {
    this.assetPaths = AUDIO_ASSETS;
    this.isMuted = false;
    this.bgmEnabled = false;
    this.ready = false;
    this.sfxVolume = 0.45;
    this.bgm = createAudio(this.assetPaths.bgm, { loop: true, volume: 0.26 });
    this.successSting = createAudio(this.assetPaths.success, { volume: 0.38 });
    this.sfx = {
      jump: createAudio(this.assetPaths.jump, { volume: 0.45 }),
      shoot: createAudio(this.assetPaths.shoot, { volume: 0.35 }),
      hit: createAudio(this.assetPaths.hit, { volume: 0.32 }),
      die: createAudio(this.assetPaths.die, { volume: 0.42 })
    };
  }

  async ensureUnlocked() {
    if (this.ready) {
      return;
    }
    this.ready = true;
    const silentTargets = [this.bgm, this.successSting, ...Object.values(this.sfx)];
    for (const audio of silentTargets) {
      audio.muted = this.isMuted;
      try {
        const playPromise = audio.play();
        if (playPromise) {
          await playPromise.catch(() => {});
        }
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore asset unlock failures and keep runtime resilient.
      }
    }
  }

  async activate() {
    await this.ensureUnlocked();
  }

  setMuted(nextMuted) {
    this.isMuted = nextMuted;
    this.bgm.muted = nextMuted;
    this.successSting.muted = nextMuted;
    for (const audio of Object.values(this.sfx)) {
      audio.muted = nextMuted;
    }
  }

  async toggleMuted() {
    await this.activate();
    this.setMuted(!this.isMuted);
    if (this.isMuted) {
      this.bgm.pause();
    } else if (this.bgmEnabled) {
      this.bgm.play().catch(() => {});
    }
    return this.isMuted;
  }

  startBgm() {
    this.bgmEnabled = true;
    if (!this.isMuted) {
      this.bgm.play().catch(() => {});
    }
  }

  stopBgm() {
    this.bgmEnabled = false;
    this.bgm.pause();
    this.bgm.currentTime = 0;
  }

  update() {
    if (!this.bgmEnabled || this.isMuted) {
      return;
    }
    if (this.bgm.paused) {
      this.bgm.play().catch(() => {});
    }
  }

  playJump() {
    this.playSfx("jump");
  }

  playShoot() {
    this.playSfx("shoot");
  }

  playHit() {
    this.playSfx("hit");
  }

  playUiClick() {
    this.playSfx("hit");
  }

  playDie() {
    this.playSfx("die");
  }

  playSuccess() {
    if (this.isMuted) {
      return;
    }
    try {
      this.successSting.pause();
      this.successSting.currentTime = 0;
      this.successSting.play().catch(() => {});
    } catch {
      // Ignore playback failure.
    }
  }

  playSfx(name) {
    if (this.isMuted) {
      return;
    }
    const source = this.sfx[name];
    if (!source) {
      return;
    }
    try {
      const clone = source.cloneNode();
      clone.volume = source.volume;
      clone.muted = this.isMuted;
      clone.play().catch(() => {});
    } catch {
      // Ignore playback failure.
    }
  }
}
