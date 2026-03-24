import {
  COYOTE_TIME,
  JUMP_BUFFER,
  PLAYER_HEIGHT,
  PLAYER_START_X,
  PLAYER_WIDTH,
  RUN_SPEED,
  SHOOT_COOLDOWN
} from "../constants.js";

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = PLAYER_START_X;
    this.y = 0;
    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.vx = RUN_SPEED;
    this.vy = 0;
    this.onGround = false;
    this.jumpBufferRemaining = 0;
    this.coyoteRemaining = COYOTE_TIME;
    this.shootCooldownRemaining = 0;
    this.runCycle = 0;
    this.fallTimer = 0;
  }

  queueJump() {
    this.jumpBufferRemaining = JUMP_BUFFER;
  }

  tick(dt) {
    this.vx = RUN_SPEED;
    this.jumpBufferRemaining = Math.max(0, this.jumpBufferRemaining - dt);
    this.coyoteRemaining = this.onGround ? COYOTE_TIME : Math.max(0, this.coyoteRemaining - dt);
    this.shootCooldownRemaining = Math.max(0, this.shootCooldownRemaining - dt);
    if (this.onGround) {
      this.runCycle += dt * 8.5;
      this.fallTimer = 0;
    } else {
      this.fallTimer += dt;
    }
  }

  canJump() {
    return this.onGround || this.coyoteRemaining > 0;
  }

  consumeJump() {
    this.jumpBufferRemaining = 0;
    this.onGround = false;
    this.coyoteRemaining = 0;
  }

  canShoot() {
    return this.shootCooldownRemaining <= 0;
  }

  consumeShootCooldown() {
    this.shootCooldownRemaining = SHOOT_COOLDOWN;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}
