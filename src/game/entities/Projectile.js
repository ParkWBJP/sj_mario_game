import { BULLET_LIFETIME, BULLET_RADIUS, BULLET_SPEED } from "../constants.js";

export class Projectile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = BULLET_RADIUS;
    this.speed = BULLET_SPEED;
    this.lifeRemaining = BULLET_LIFETIME;
    this.active = true;
  }

  update(dt) {
    this.x += this.speed * dt;
    this.lifeRemaining -= dt;
    if (this.lifeRemaining <= 0) {
      this.active = false;
    }
  }

  getBounds() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2
    };
  }
}
