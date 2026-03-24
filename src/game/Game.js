import { AudioManager } from "./AudioManager.js";
import { AssetLibrary } from "./AssetLibrary.js";
import {
  CAMERA_LEAD,
  GAME_DURATION_SECONDS,
  GOAL_POLE_HEIGHT,
  GOAL_SPAWN_DISTANCE,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  PLAYER_HEIGHT,
  RUN_SPEED,
  STEP_UP_HEIGHT,
  TARGET_MONSTER_DEFEATS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH
} from "./constants.js";
import { Enemy } from "./entities/Enemy.js";
import { Player } from "./entities/Player.js";
import { Projectile } from "./entities/Projectile.js";
import { createLevel } from "./level.js";
import { clamp, formatTime, rangeOverlap, rectsIntersect } from "./math.js";

const OVERLAY_COPY = {
  start: {
    badge: "서준 서진이 전용",
    title: "서준 서진이를 위한 마리오 게임",
    text: "몬스터 5마리를 잡으면 깃발이 나와요. 2분 안에 골인해요.",
    button: "시작하기"
  },
  fail: {
    badge: "다시 한번",
    title: "앗, 다시 달려볼까요?",
    text: "몬스터를 잡고 깃발까지 가면 성공이에요.",
    button: "다시 시작"
  },
  complete: {
    badge: "게임 완료",
    title: "깃발에 도착했어요!",
    text: "몬스터 5마리를 잡고 멋지게 골인했어요.",
    button: "다시 시작"
  }
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.fullscreenRoot = this.canvas.closest(".game-frame") ?? document.documentElement;
    this.assets = new AssetLibrary();
    this.audio = new AudioManager();
    this.mode = "start";
    this.level = createLevel();
    this.player = new Player();
    this.enemies = this.level.enemies.map((enemy) => new Enemy(enemy));
    this.projectiles = [];
    this.cameraX = 0;
    this.timeRemaining = GAME_DURATION_SECONDS;
    this.lastFrameTime = 0;
    this.fixedStep = 1 / 60;
    this.cloudOffset = 0;
    this.pendingShoot = false;
    this.defeatedEnemies = 0;
    this.goal = this.createGoalState();
    this.setupPlayerOnGround();
    this.updateHud();
    this.syncFullscreenLabel();
    this.audio.startBgm();
    this.assets.preload().then(() => this.render());
  }

  createGoalState() {
    return {
      unlocked: false,
      reached: false,
      x: 0,
      groundY: GROUND_Y,
      width: 58,
      height: GOAL_POLE_HEIGHT
    };
  }

  setupPlayerOnGround() {
    this.player.y = GROUND_Y - PLAYER_HEIGHT;
    this.player.onGround = true;
  }

  bindInput() {
    const pressJump = (event) => {
      event?.preventDefault?.();
      this.requestJump();
    };
    const pressShoot = (event) => {
      event?.preventDefault?.();
      this.requestShoot();
    };
    const playButtonClick = async () => {
      await this.audio.activate();
      this.audio.playUiClick();
    };

    window.addEventListener("keydown", (event) => {
      if (event.repeat) {
        return;
      }
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        pressJump(event);
      } else if (event.code === "KeyB" || event.code === "Enter" || event.code === "KeyX") {
        pressShoot(event);
      } else if (event.key.toLowerCase() === "f") {
        this.toggleFullscreen();
      }
    });

    this.ui.jumpButton.addEventListener("pointerdown", pressJump);
    this.ui.shootButton.addEventListener("pointerdown", pressShoot);
    this.ui.startButton.addEventListener("click", async () => {
      await playButtonClick();
      this.handlePrimaryButton();
    });
    this.ui.restartButton.addEventListener("click", async () => {
      await playButtonClick();
      this.restart();
    });
    this.ui.fullscreenButton.addEventListener("click", async () => {
      await playButtonClick();
      this.toggleFullscreen();
    });
    this.ui.soundToggle.addEventListener("click", async () => {
      await this.audio.activate();
      const muted = await this.audio.toggleMuted();
      this.syncSoundLabel(muted);
      if (!muted) {
        this.audio.playUiClick();
      }
    });

    document.addEventListener("fullscreenchange", () => this.syncFullscreenLabel());
    document.addEventListener("webkitfullscreenchange", () => this.syncFullscreenLabel());
  }

  startLoop() {
    const loop = (timestamp) => {
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }
      const delta = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;
      this.step(delta);
      this.render();
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }

  handlePrimaryButton() {
    if (this.mode === "start" || this.mode === "fail" || this.mode === "complete") {
      this.restart();
    }
  }

  async restart(options = {}) {
    await this.audio.activate();
    this.audio.startBgm();
    this.mode = "play";
    this.player.reset();
    this.setupPlayerOnGround();
    this.enemies = this.level.enemies.map((enemy) => new Enemy(enemy));
    this.projectiles = [];
    this.pendingShoot = false;
    this.cameraX = 0;
    this.timeRemaining = options.timeRemaining ?? GAME_DURATION_SECONDS;
    this.cloudOffset = 0;
    this.defeatedEnemies = 0;
    this.goal = this.createGoalState();
    if (typeof options.playerX === "number" && Number.isFinite(options.playerX)) {
      this.setPlayerStartX(options.playerX);
    }
    this.hideOverlay();
    this.updateHud();
    this.render();
  }

  requestJump() {
    if (this.mode !== "play") {
      return;
    }
    this.player.queueJump();
  }

  requestShoot() {
    if (this.mode !== "play") {
      return;
    }
    this.pendingShoot = true;
  }

  setMode(nextMode) {
    this.mode = nextMode;
    if (nextMode !== "play") {
      this.audio.stopBgm();
    }
    if (nextMode === "complete") {
      this.audio.playSuccess();
    }
    this.showOverlayForMode(nextMode);
    this.updateHud();
  }

  showOverlayForMode(mode) {
    const copy = OVERLAY_COPY[mode];
    if (!copy) {
      return;
    }
    this.ui.overlay.classList.remove("hidden");
    this.ui.overlayBadge.textContent = copy.badge;
    this.ui.overlayTitle.textContent = copy.title;
    this.ui.overlayText.textContent = copy.text;
    this.ui.startButton.textContent = copy.button;
    this.ui.overlayKids?.classList.toggle("hidden", mode !== "start");
  }

  hideOverlay() {
    this.ui.overlay.classList.add("hidden");
  }

  updateHud() {
    this.ui.timePill.textContent = `남은 시간 ${formatTime(this.timeRemaining)}`;
    if (this.ui.goalPill) {
      this.ui.goalPill.textContent = this.goal.unlocked
        ? "깃발로 가요!"
        : `몬스터 ${this.defeatedEnemies} / ${TARGET_MONSTER_DEFEATS}`;
    }
  }

  syncSoundLabel(muted = this.audio.isMuted) {
    this.ui.soundToggle.textContent = muted ? "소리 꺼짐" : "소리 켜짐";
    this.ui.soundToggle.setAttribute("aria-pressed", String(muted));
  }

  step(deltaSeconds) {
    const dt = Math.max(0, deltaSeconds);
    this.cloudOffset += dt * 18;

    if (this.mode !== "play") {
      this.audio.update();
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining === 0) {
      this.failRun();
      return;
    }

    this.player.tick(dt);
    if (this.player.jumpBufferRemaining > 0 && this.player.canJump()) {
      this.player.consumeJump();
      this.player.vy = JUMP_VELOCITY;
      this.audio.playJump();
    }

    if (this.pendingShoot && this.player.canShoot()) {
      this.spawnProjectile();
      this.player.consumeShootCooldown();
      this.audio.playShoot();
    }
    this.pendingShoot = false;

    this.movePlayer(dt);
    if (this.mode !== "play") {
      return;
    }

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.checkGoalReached();
    if (this.mode !== "play") {
      return;
    }

    this.cameraX = clamp(this.player.x - CAMERA_LEAD, 0, Math.max(0, this.level.worldLength - VIEWPORT_WIDTH));
    this.audio.update();
    this.updateHud();
  }

  movePlayer(dt) {
    const player = this.player;
    const previous = {
      x: player.x,
      y: player.y,
      right: player.x + player.width,
      bottom: player.y + player.height,
      top: player.y
    };

    player.x += RUN_SPEED * dt;
    const nearbySolids = this.getNearbySolids(player.x - 20, player.x + player.width + 60);
    player.onGround = false;

    for (const solid of nearbySolids) {
      const currentBounds = player.getBounds();
      if (!rectsIntersect(currentBounds, solid)) {
        continue;
      }

      const approachingFromLeft = previous.right <= solid.x + 6;
      const stepHeight = previous.bottom - solid.y;
      if (approachingFromLeft && stepHeight >= 0 && stepHeight <= STEP_UP_HEIGHT) {
        player.x = solid.x - player.width + 4;
        player.y = solid.y - player.height;
        player.vy = 0;
        player.onGround = true;
        continue;
      }

      if (approachingFromLeft) {
        player.x = solid.x - player.width - 0.1;
      }
    }

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    let landed = false;

    for (const solid of nearbySolids) {
      const bounds = player.getBounds();
      if (!rectsIntersect(bounds, solid)) {
        continue;
      }

      if (player.vy >= 0 && previous.bottom <= solid.y + 6) {
        player.y = solid.y - player.height;
        player.vy = 0;
        landed = true;
      } else if (player.vy < 0 && previous.top >= solid.y + solid.height - 6) {
        player.y = solid.y + solid.height;
        player.vy = 30;
      }
    }

    player.onGround = landed || player.onGround;

    if (this.tryStompEnemy(previous)) {
      player.onGround = false;
    } else if (this.playerTouchesEnemy()) {
      this.failRun();
      return;
    }

    if (player.y > VIEWPORT_HEIGHT + 40) {
      this.failRun();
    }
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.update(dt);
    }
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.update(dt);
      if (!projectile.active) {
        continue;
      }

      for (const enemy of this.enemies) {
        if (!enemy.alive) {
          continue;
        }
        if (rectsIntersect(projectile.getBounds(), enemy.getBounds())) {
          this.defeatEnemy(enemy);
          projectile.active = false;
          break;
        }
      }

      if (!projectile.active) {
        continue;
      }

      for (const solid of this.getNearbySolids(projectile.x - 20, projectile.x + 20)) {
        if (rectsIntersect(projectile.getBounds(), solid)) {
          projectile.active = false;
          this.audio.playHit();
          break;
        }
      }
    }

    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
  }

  playerTouchesEnemy() {
    const playerBounds = this.player.getBounds();
    return this.enemies.some((enemy) => enemy.alive && rectsIntersect(playerBounds, enemy.getBounds()));
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.alive) {
      return;
    }

    enemy.alive = false;
    this.defeatedEnemies += 1;
    this.audio.playHit();
    if (this.defeatedEnemies >= TARGET_MONSTER_DEFEATS) {
      this.unlockGoal();
    }
    this.updateHud();
  }

  tryStompEnemy(previous) {
    if (this.player.vy < 0) {
      return false;
    }

    const playerBounds = this.player.getBounds();
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const enemyBounds = enemy.getBounds();
      if (!rectsIntersect(playerBounds, enemyBounds)) {
        continue;
      }

      const previousBottom = previous.bottom;
      const enemyTop = enemyBounds.y;
      const horizontalOverlap =
        playerBounds.x + playerBounds.width > enemyBounds.x + enemyBounds.width * 0.2 &&
        playerBounds.x < enemyBounds.x + enemyBounds.width * 0.8;
      const stompWindow = enemyBounds.height * 0.45 + 10;
      const cameFromAbove = previousBottom <= enemyTop + stompWindow;

      if (!horizontalOverlap || !cameFromAbove) {
        continue;
      }

      this.defeatEnemy(enemy);
      this.player.y = enemyTop - this.player.height - 2;
      this.player.vy = JUMP_VELOCITY * 0.45;
      this.player.jumpBufferRemaining = 0;
      this.player.coyoteRemaining = 0;
      return true;
    }

    return false;
  }

  unlockGoal() {
    if (this.goal.unlocked) {
      return;
    }

    const desiredX = this.player.x + GOAL_SPAWN_DISTANCE;
    const segment = this.findGoalGroundSegment(desiredX);
    if (segment) {
      const minX = Math.max(desiredX, segment.x + 96);
      const maxX = Math.max(segment.x + 96, segment.x + segment.width - 88);
      this.goal.x = clamp(minX, segment.x + 96, maxX);
      this.goal.groundY = segment.y;
    } else {
      this.goal.x = desiredX;
      this.goal.groundY = GROUND_Y;
    }

    this.goal.unlocked = true;
    this.updateHud();
  }

  findGoalGroundSegment(minX) {
    return this.level.groundSegments.find(
      (segment) => segment.x + segment.width > minX + 120 && segment.width >= 220
    );
  }

  getGoalBounds() {
    return {
      x: this.goal.x - 18,
      y: this.goal.groundY - this.goal.height,
      width: this.goal.width,
      height: this.goal.height
    };
  }

  checkGoalReached() {
    if (!this.goal.unlocked || this.goal.reached) {
      return;
    }

    if (rectsIntersect(this.player.getBounds(), this.getGoalBounds())) {
      this.goal.reached = true;
      this.setMode("complete");
    }
  }

  spawnProjectile() {
    const projectileX = this.player.x + this.player.width + 12;
    const projectileY = this.player.y + this.player.height * 0.48;
    this.projectiles.push(new Projectile(projectileX, projectileY));
  }

  failRun() {
    if (this.mode !== "play") {
      return;
    }
    this.audio.playDie();
    this.setMode("fail");
  }

  setPlayerStartX(playerX) {
    this.player.x = clamp(playerX, 0, this.level.worldLength - this.player.width - 20);
    const surfaceY = this.findStandingSurfaceY(this.player.x, this.player.width);
    this.player.y = surfaceY - this.player.height;
    this.player.vy = 0;
    this.player.onGround = true;
    this.cameraX = clamp(this.player.x - CAMERA_LEAD, 0, Math.max(0, this.level.worldLength - VIEWPORT_WIDTH));
  }

  findStandingSurfaceY(playerX, width) {
    let bestY = GROUND_Y;
    for (const solid of this.getNearbySolids(playerX - 4, playerX + width + 4)) {
      if (!rangeOverlap(playerX + 6, playerX + width - 6, solid.x, solid.x + solid.width)) {
        continue;
      }
      if (solid.y < bestY) {
        bestY = solid.y;
      }
    }
    return bestY;
  }

  getNearbySolids(minX, maxX) {
    const solids = [];
    for (const ground of this.level.groundSegments) {
      if (rangeOverlap(minX, maxX, ground.x, ground.x + ground.width)) {
        solids.push(ground);
      }
    }
    for (const platform of this.level.platforms) {
      if (rangeOverlap(minX, maxX, platform.x, platform.x + platform.width)) {
        solids.push(platform);
      }
    }
    return solids;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.drawSky(ctx);
    this.drawSun(ctx);
    this.drawCloudLayers(ctx);
    this.drawHills(ctx);
    this.drawGround(ctx);
    this.drawPlatforms(ctx);
    this.drawPits(ctx);
    this.drawGoal(ctx);
    this.drawProjectiles(ctx);
    this.drawEnemies(ctx);
    this.drawPlayer(ctx);
  }

  drawSky(ctx) {
    const sky = this.assets.getImage("backgrounds.sky");
    if (sky) {
      ctx.drawImage(sky, 0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      ctx.fillStyle = "rgba(255, 252, 235, 0.16)";
      ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
    gradient.addColorStop(0, "#8edaff");
    gradient.addColorStop(0.55, "#d5f4ff");
    gradient.addColorStop(1, "#fff0bc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  drawSun(ctx) {
    ctx.save();
    ctx.translate(840, 92);
    ctx.fillStyle = "#fff0a9";
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      ctx.strokeStyle = "rgba(255, 220, 100, 0.95)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 60, Math.sin(angle) * 60);
      ctx.lineTo(Math.cos(angle) * 84, Math.sin(angle) * 84);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCloudLayers(ctx) {
    this.drawParallaxStrip(ctx, this.assets.getImage("backgrounds.cloudsFar"), 0.16, 84, 0.7, 156);
    this.drawParallaxStrip(ctx, this.assets.getImage("backgrounds.cloudsNear"), 0.28, 54, 0.98, 320);
  }

  drawParallaxStrip(ctx, image, speed, y, alpha = 1, targetHeight = 128) {
    if (!image) {
      return;
    }
    const ratio = image.width / image.height;
    const targetWidth = Math.max(220, targetHeight * ratio);
    const offset = -((this.cameraX * speed + this.cloudOffset * 4) % targetWidth);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = offset - targetWidth; x < VIEWPORT_WIDTH + targetWidth; x += targetWidth) {
      ctx.drawImage(image, x, y, targetWidth, targetHeight);
    }
    ctx.restore();
  }

  drawHills(ctx) {
    const hills = this.assets.getImage("backgrounds.hillsFar");
    if (hills) {
      const ratio = hills.width / hills.height;
      const targetHeight = 220;
      const targetWidth = targetHeight * ratio;
      const offset = -((this.cameraX * 0.24) % targetWidth);
      for (let x = offset - targetWidth; x < VIEWPORT_WIDTH + targetWidth; x += targetWidth) {
        ctx.drawImage(hills, x, 250, targetWidth, targetHeight);
      }
      return;
    }

    ctx.fillStyle = "#b8e89c";
    ctx.fillRect(0, 300, VIEWPORT_WIDTH, 240);
  }

  drawGround(ctx) {
    const groundTile = this.assets.getImage("tiles.ground");
    const groundTopTile = this.assets.getImage("tiles.groundTop");
    for (const ground of this.level.groundSegments) {
      const screenX = ground.x - this.cameraX;
      if (screenX + ground.width < 0 || screenX > VIEWPORT_WIDTH) {
        continue;
      }

      if (groundTile) {
        for (let x = screenX; x < screenX + ground.width; x += 56) {
          for (let y = ground.y; y < VIEWPORT_HEIGHT + 84; y += 56) {
            ctx.drawImage(groundTile, x, y, 56, 56);
          }
        }
      } else {
        ctx.fillStyle = "#d39a4e";
        ctx.fillRect(screenX, ground.y, ground.width, ground.height);
      }

      if (groundTopTile) {
        for (let x = screenX - 8; x < screenX + ground.width; x += 56) {
          ctx.drawImage(groundTopTile, x, ground.y - 22, 64, 32);
        }
      }
    }
  }

  drawPlatforms(ctx) {
    const brickTile = this.assets.getImage("tiles.brick");
    const platformTile = this.assets.getImage("tiles.platform");
    for (const platform of this.level.platforms) {
      const screenX = platform.x - this.cameraX;
      if (screenX + platform.width < -20 || screenX > VIEWPORT_WIDTH + 20) {
        continue;
      }

      const tile = platform.height <= 36 ? platformTile : brickTile;
      if (tile) {
        for (let y = 0; y < platform.height; y += 36) {
          for (let x = 0; x < platform.width; x += 42) {
            ctx.drawImage(tile, screenX + x, platform.y + y, 44, 40);
          }
        }
      } else {
        ctx.fillStyle = "#d99153";
        ctx.fillRect(screenX, platform.y, platform.width, platform.height);
      }
    }
  }

  drawPits(ctx) {
    const edgeLeft = this.assets.getImage("tiles.edgeLeft");
    const edgeRight = this.assets.getImage("tiles.edgeRight");
    for (const pit of this.level.pits) {
      const screenX = pit.start - this.cameraX;
      const width = pit.end - pit.start;
      if (screenX + width < 0 || screenX > VIEWPORT_WIDTH) {
        continue;
      }
      ctx.fillStyle = "#62738f";
      ctx.fillRect(screenX, GROUND_Y, width, VIEWPORT_HEIGHT - GROUND_Y);
      ctx.fillStyle = "rgba(146, 206, 255, 0.35)";
      ctx.fillRect(screenX + 12, GROUND_Y + 18, Math.max(0, width - 24), 28);
      if (edgeLeft) {
        ctx.drawImage(edgeLeft, screenX - 16, GROUND_Y - 30, 28, 34);
      }
      if (edgeRight) {
        ctx.drawImage(edgeRight, screenX + width - 8, GROUND_Y - 30, 28, 34);
      }
    }
  }

  drawGoal(ctx) {
    if (!this.goal.unlocked) {
      return;
    }

    const bounds = this.getGoalBounds();
    const screenX = bounds.x - this.cameraX;
    if (screenX + bounds.width < -40 || screenX > VIEWPORT_WIDTH + 40) {
      return;
    }

    const flagpole = this.assets.getImage("goal.flagpole");
    if (flagpole) {
      ctx.drawImage(flagpole, screenX - 20, bounds.y - 6, 90, bounds.height + 20);
    } else {
      ctx.fillStyle = "#f5f7ff";
      ctx.fillRect(screenX + 18, bounds.y, 10, bounds.height);
      ctx.fillStyle = "#ffd86c";
      ctx.beginPath();
      ctx.arc(screenX + 23, bounds.y + 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff7a72";
      ctx.beginPath();
      ctx.moveTo(screenX + 28, bounds.y + 18);
      ctx.lineTo(screenX + 78, bounds.y + 34);
      ctx.lineTo(screenX + 28, bounds.y + 52);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255, 250, 240, 0.95)";
    ctx.fillRect(screenX - 10, bounds.y - 42, 132, 32);
    ctx.fillStyle = "#6b5970";
    ctx.font = '900 18px "Jua", sans-serif';
    ctx.fillText("여기로 골인!", screenX + 8, bounds.y - 19);
  }

  drawPlayer(ctx) {
    const x = this.player.x - this.cameraX;
    const y = this.player.y;
    const sprite = this.getPlayerSprite();
    if (sprite) {
      ctx.drawImage(sprite, x - 16, y - 22, this.player.width + 34, this.player.height + 34);
    }
  }

  getPlayerSprite() {
    if (!this.assets.ready) {
      return null;
    }
    if (!this.player.onGround) {
      return this.player.vy < 0
        ? this.assets.getImage("characters.heroJump")
        : this.assets.getImage("characters.heroFall") ?? this.assets.getImage("characters.heroLand");
    }
    const frames = this.assets.getFrames("characters.heroRunFrames");
    if (frames.length > 0) {
      return frames[Math.floor(this.player.runCycle) % frames.length];
    }
    return this.assets.getImage("characters.heroIdle");
  }

  drawEnemies(ctx) {
    const walkFrames = this.assets.getFrames("enemies.mushroomWalkFrames");
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }
      const x = enemy.x - this.cameraX;
      if (x + enemy.width < -40 || x > VIEWPORT_WIDTH + 40) {
        continue;
      }
      if (walkFrames.length > 0) {
        const sprite = walkFrames[Math.floor(enemy.walkCycle) % walkFrames.length];
        ctx.drawImage(sprite, x - 12, enemy.y - 10, enemy.width + 24, enemy.height + 24);
      }
    }
  }

  drawProjectiles(ctx) {
    for (const projectile of this.projectiles) {
      const x = projectile.x - this.cameraX;
      if (x < -20 || x > VIEWPORT_WIDTH + 20) {
        continue;
      }
      ctx.fillStyle = "#ffe47e";
      ctx.beginPath();
      ctx.arc(x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffb53e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - projectile.radius - 12, projectile.y);
      ctx.lineTo(x - projectile.radius + 2, projectile.y);
      ctx.stroke();
    }
  }

  getFullscreenElement() {
    return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  }

  isPseudoFullscreen() {
    return this.fullscreenRoot.classList.contains("pseudo-fullscreen");
  }

  syncFullscreenLabel() {
    const active = Boolean(this.getFullscreenElement()) || this.isPseudoFullscreen();
    this.ui.fullscreenButton.textContent = active ? "화면 줄이기" : "전체 화면";
    this.ui.fullscreenButton.setAttribute("aria-pressed", String(active));
  }

  async requestRealFullscreen() {
    const root = this.fullscreenRoot;
    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return true;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
      return true;
    }
    return false;
  }

  async exitRealFullscreen() {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return true;
    }
    return false;
  }

  setPseudoFullscreen(active) {
    this.fullscreenRoot.classList.toggle("pseudo-fullscreen", active);
    document.body.classList.toggle("pseudo-fullscreen-body", active);
    this.syncFullscreenLabel();
  }

  async toggleFullscreen() {
    if (this.getFullscreenElement()) {
      await this.exitRealFullscreen();
      this.syncFullscreenLabel();
      return;
    }

    if (this.isPseudoFullscreen()) {
      this.setPseudoFullscreen(false);
      return;
    }

    try {
      const entered = await this.requestRealFullscreen();
      if (!entered) {
        this.setPseudoFullscreen(true);
      }
    } catch {
      this.setPseudoFullscreen(true);
    }

    this.syncFullscreenLabel();
  }

  advanceTime(ms) {
    const totalSteps = Math.max(1, Math.round(ms / (this.fixedStep * 1000)));
    for (let index = 0; index < totalSteps; index += 1) {
      this.step(this.fixedStep);
    }
    this.render();
  }

  renderGameToText() {
    const visibleMin = this.cameraX;
    const visibleMax = this.cameraX + VIEWPORT_WIDTH;
    const visiblePits = this.level.pits
      .filter((pit) => rangeOverlap(visibleMin, visibleMax, pit.start, pit.end))
      .map((pit) => ({ start: Math.round(pit.start), end: Math.round(pit.end) }));
    const visiblePlatforms = this.level.platforms
      .filter((platform) => rangeOverlap(visibleMin, visibleMax, platform.x, platform.x + platform.width))
      .map((platform) => ({
        x: Math.round(platform.x),
        y: Math.round(platform.y),
        width: platform.width,
        height: platform.height
      }));
    const visibleEnemies = this.enemies
      .filter((enemy) => enemy.alive && rangeOverlap(visibleMin, visibleMax, enemy.x, enemy.x + enemy.width))
      .map((enemy) => ({
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        patrol: [Math.round(enemy.minX), Math.round(enemy.maxX)],
        direction: enemy.direction
      }));
    const visibleProjectiles = this.projectiles
      .filter((projectile) => projectile.active && projectile.x >= visibleMin - 20 && projectile.x <= visibleMax + 20)
      .map((projectile) => ({ x: Math.round(projectile.x), y: Math.round(projectile.y) }));

    return JSON.stringify({
      coordinateSystem: "origin top-left; x increases right; y increases down; world coordinates shown",
      mode: this.mode,
      timerRemaining: Number(this.timeRemaining.toFixed(2)),
      defeatedEnemies: this.defeatedEnemies,
      targetDefeats: TARGET_MONSTER_DEFEATS,
      goal: this.goal.unlocked
        ? {
            unlocked: true,
            reached: this.goal.reached,
            x: Math.round(this.goal.x),
            y: Math.round(this.goal.groundY)
          }
        : {
            unlocked: false,
            reached: false
          },
      cameraX: Math.round(this.cameraX),
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        vx: Math.round(this.player.vx),
        vy: Math.round(this.player.vy),
        onGround: this.player.onGround,
        jumpBufferMs: Math.round(this.player.jumpBufferRemaining * 1000),
        shootCooldownMs: Math.round(this.player.shootCooldownRemaining * 1000)
      },
      visiblePits,
      visiblePlatforms,
      visibleEnemies,
      visibleProjectiles
    });
  }
}
