export class Enemy {
  constructor(config) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.minX = config.minX;
    this.maxX = config.maxX;
    this.speed = config.speed;
    this.direction = 1;
    this.alive = true;
    this.walkCycle = 0;
  }

  update(dt) {
    if (!this.alive) {
      return;
    }

    this.x += this.direction * this.speed * dt;
    if (this.x <= this.minX) {
      this.x = this.minX;
      this.direction = 1;
    } else if (this.x >= this.maxX) {
      this.x = this.maxX;
      this.direction = -1;
    }
    this.walkCycle += dt * 7;
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
