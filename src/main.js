import { Game } from "./game/Game.js";

function trimPhotoElement(img) {
  return new Promise((resolve) => {
    if (!img) {
      resolve();
      return;
    }

    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }

      ctx.drawImage(source, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      const visited = new Uint8Array(width * height);
      const queue = [];

      const isBg = (pixelIndex) => {
        const alpha = data[pixelIndex + 3];
        if (alpha === 0) {
          return true;
        }
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        const average = (red + green + blue) / 3;
        const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
        return average > 152 && spread < 48;
      };

      const hasTransparentNeighbor = (x, y) => {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
              return true;
            }
            const neighborOffset = (nextY * width + nextX) * 4;
            if (data[neighborOffset + 3] === 0) {
              return true;
            }
          }
        }
        return false;
      };

      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          return;
        }
        const id = y * width + x;
        if (visited[id]) {
          return;
        }
        const offset = id * 4;
        if (!isBg(offset)) {
          return;
        }
        visited[id] = 1;
        queue.push([x, y]);
      };

      for (let x = 0; x < width; x += 1) {
        push(x, 0);
        push(x, height - 1);
      }
      for (let y = 0; y < height; y += 1) {
        push(0, y);
        push(width - 1, y);
      }

      while (queue.length > 0) {
        const [x, y] = queue.shift();
        const id = y * width + x;
        const offset = id * 4;
        data[offset + 3] = 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }

      for (let pass = 0; pass < 2; pass += 1) {
        const nextAlpha = new Uint8ClampedArray(width * height);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            nextAlpha[y * width + x] = data[offset + 3];
            if (data[offset + 3] === 0) {
              continue;
            }
            const red = data[offset];
            const green = data[offset + 1];
            const blue = data[offset + 2];
            const average = (red + green + blue) / 3;
            const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
            if (average > 165 && spread < 52 && hasTransparentNeighbor(x, y)) {
              nextAlpha[y * width + x] = 0;
            }
          }
        }

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            data[(y * width + x) * 4 + 3] = nextAlpha[y * width + x];
          }
        }
      }

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          if (data[offset + 3] < 16) {
            continue;
          }
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) {
        resolve();
        return;
      }

      ctx.putImageData(imageData, 0, 0);
      const trimmed = document.createElement("canvas");
      trimmed.width = maxX - minX + 1;
      trimmed.height = maxY - minY + 1;
      const trimmedCtx = trimmed.getContext("2d");
      if (!trimmedCtx) {
        resolve();
        return;
      }
      trimmedCtx.drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
      img.src = trimmed.toDataURL("image/png");
      resolve();
    };
    source.onerror = () => resolve();
    source.src = img.currentSrc || img.src;
  });
}

const ui = {
  timePill: document.querySelector("#time-pill"),
  soundToggle: document.querySelector("#sound-toggle"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  restartButton: document.querySelector("#restart-button"),
  jumpButton: document.querySelector("#jump-button"),
  shootButton: document.querySelector("#shoot-button"),
  overlay: document.querySelector("#overlay"),
  overlayBadge: document.querySelector("#overlay-badge"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayText: document.querySelector("#overlay-text"),
  overlayKids: document.querySelector("#overlay-kids"),
  seojunImage: document.querySelector("#seojun-image"),
  seojinImage: document.querySelector("#seojin-image"),
  startButton: document.querySelector("#start-btn")
};

const canvas = document.querySelector("#game-canvas");
const game = new Game(canvas, ui);
const params = new URLSearchParams(window.location.search);
const startXParam = params.get("startX");
const timeParam = params.get("timeRemaining");
const autostart = params.get("autostart") === "1" || startXParam !== null || timeParam !== null;
const debugPlayerX = startXParam === null ? undefined : Number(startXParam);
const debugTime = timeParam === null ? undefined : Number(timeParam);

game.bindInput();
game.syncSoundLabel(false);
game.showOverlayForMode("start");
game.render();
game.startLoop();
trimPhotoElement(ui.seojunImage);
trimPhotoElement(ui.seojinImage);

if (autostart) {
  game.restart({
    playerX: Number.isFinite(debugPlayerX) ? debugPlayerX : undefined,
    timeRemaining: Number.isFinite(debugTime) ? debugTime : undefined
  });
}

window.render_game_to_text = () => game.renderGameToText();
window.advanceTime = (ms) => game.advanceTime(ms);
