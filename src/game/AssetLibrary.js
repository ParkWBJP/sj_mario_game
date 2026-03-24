import { IMAGE_ASSETS } from "../config/assets.js";

function flattenImages(branch, prefix = []) {
  const entries = [];
  for (const [key, value] of Object.entries(branch)) {
    const nextPrefix = [...prefix, key];
    if (typeof value === "string") {
      entries.push([nextPrefix.join("."), value]);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        entries.push([[...nextPrefix, index].join("."), item]);
      });
      continue;
    }
    entries.push(...flattenImages(value, nextPrefix));
  }
  return entries;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function shouldTrim(key) {
  return (
    key.startsWith("characters.") ||
    key.startsWith("enemies.") ||
    key === "backgrounds.cloudsFar" ||
    key === "backgrounds.cloudsNear"
  );
}

function trimImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return image;
  }

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const visited = new Uint8Array(width * height);

  function isBackgroundPixel(index) {
    const alpha = data[index + 3];
    if (alpha === 0) {
      return true;
    }
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const average = (red + green + blue) / 3;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    return average > 150 && spread < 58;
  }

  const queue = [];
  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }
    const dataIndex = pixelIndex * 4;
    if (!isBackgroundPixel(dataIndex)) {
      return;
    }
    visited[pixelIndex] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const pixelIndex = y * width + x;
    const dataIndex = pixelIndex * 4;
    data[dataIndex + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) {
        continue;
      }
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const average = (red + green + blue) / 3;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (average > 188 && spread < 44) {
        data[index + 3] = 0;
      }
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const visible = alpha > 24 && (red < 246 || green < 246 || blue < 246);
      if (!visible) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return image;
  }

  ctx.putImageData(new ImageData(data, width, height), 0, 0);

  const trimmed = document.createElement("canvas");
  trimmed.width = maxX - minX + 1;
  trimmed.height = maxY - minY + 1;
  const trimmedCtx = trimmed.getContext("2d");
  if (!trimmedCtx) {
    return image;
  }
  trimmedCtx.drawImage(
    canvas,
    minX,
    minY,
    trimmed.width,
    trimmed.height,
    0,
    0,
    trimmed.width,
    trimmed.height
  );
  return trimmed;
}

export class AssetLibrary {
  constructor() {
    this.images = new Map();
    this.ready = false;
  }

  async preload() {
    const pairs = flattenImages(IMAGE_ASSETS);
    const loaded = await Promise.all(
      pairs.map(async ([key, src]) => [key, await loadImage(src)])
    );
    for (const [key, image] of loaded) {
      if (image) {
        this.images.set(key, shouldTrim(key) ? trimImage(image) : image);
      }
    }
    this.ready = true;
  }

  getImage(key) {
    return this.images.get(key) ?? null;
  }

  getFrames(prefix) {
    const frames = [];
    for (let index = 0; ; index += 1) {
      const image = this.getImage(`${prefix}.${index}`);
      if (!image) {
        break;
      }
      frames.push(image);
    }
    return frames;
  }
}
