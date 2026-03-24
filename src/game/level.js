import { ENEMY_HEIGHT, ENEMY_WIDTH, GROUND_DEPTH, GROUND_Y, VIEWPORT_HEIGHT, WORLD_LENGTH } from "./constants.js";

const SCALE = 1.3;

const templates = [
  {
    length: 1200,
    pits: [{ x: 470, width: 84 }],
    platforms: [
      { x: 240, y: 360, width: 118, height: 60 },
      { x: 760, y: 340, width: 154, height: 24 }
    ],
    enemies: [
      { x: 930, patrol: 120, speed: 48, surface: "ground" }
    ]
  },
  {
    length: 1200,
    pits: [{ x: 620, width: 94 }],
    platforms: [
      { x: 320, y: 344, width: 126, height: 76 },
      { x: 782, y: 372, width: 112, height: 48 }
    ],
    enemies: [
      { x: 360, patrol: 70, speed: 42, surface: "ground" }
    ]
  },
  {
    length: 1200,
    pits: [],
    platforms: [
      { x: 380, y: 376, width: 98, height: 44 },
      { x: 520, y: 332, width: 124, height: 88 },
      { x: 760, y: 376, width: 112, height: 44 }
    ],
    enemies: [
      { x: 820, patrol: 82, speed: 52, surface: "ground" }
    ]
  },
  {
    length: 1200,
    pits: [
      { x: 410, width: 88 },
      { x: 860, width: 104 }
    ],
    platforms: [
      { x: 615, y: 352, width: 136, height: 68 }
    ],
    enemies: [
      { x: 1030, patrol: 82, speed: 50, surface: "ground" }
    ]
  },
  {
    length: 1200,
    pits: [{ x: 700, width: 116 }],
    platforms: [
      { x: 250, y: 356, width: 112, height: 64 },
      { x: 468, y: 324, width: 124, height: 96 },
      { x: 902, y: 350, width: 132, height: 70 }
    ],
    enemies: [
      { x: 525, patrol: 80, speed: 56, surface: "ground" },
      { x: 942, patrol: 88, speed: 50, surface: "ground" }
    ]
  },
  {
    length: 1200,
    pits: [{ x: 480, width: 106 }],
    platforms: [
      { x: 228, y: 372, width: 116, height: 48 },
      { x: 666, y: 378, width: 108, height: 42 }
    ],
    enemies: [
      { x: 778, patrol: 140, speed: 44, surface: "ground" }
    ]
  }
];

function buildGroundSegments(pits, worldLength) {
  const sorted = [...pits].sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  for (const pit of sorted) {
    if (pit.start > cursor) {
      segments.push({
        x: cursor,
        y: GROUND_Y,
        width: pit.start - cursor,
        height: VIEWPORT_HEIGHT - GROUND_Y + GROUND_DEPTH
      });
    }
    cursor = pit.end;
  }
  if (cursor < worldLength) {
    segments.push({
      x: cursor,
      y: GROUND_Y,
      width: worldLength - cursor,
      height: VIEWPORT_HEIGHT - GROUND_Y + GROUND_DEPTH
    });
  }
  return segments;
}

function overlapsRange(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function overlapsWithPadding(startA, endA, startB, endB, padding) {
  return startA < endB + padding && endA > startB - padding;
}

function canPlacePit(start, width, sectionStart, sectionEnd, platforms, pits) {
  const end = start + width;
  if (start < sectionStart + 92 || end > sectionEnd - 92) {
    return false;
  }
  for (const pit of pits) {
    if (overlapsWithPadding(start, end, pit.start, pit.end, 96)) {
      return false;
    }
  }
  for (const platform of platforms) {
    if (overlapsWithPadding(start, end, platform.x, platform.x + platform.width, 92)) {
      return false;
    }
  }
  return true;
}

function findSafePitRange(preferredStart, width, sectionStart, sectionEnd, platforms, pits) {
  const offsets = [0, -140, 140, -280, 280, -420, 420];
  for (const offset of offsets) {
    const candidateStart = preferredStart + offset;
    if (canPlacePit(candidateStart, width, sectionStart, sectionEnd, platforms, pits)) {
      return {
        start: candidateStart,
        end: candidateStart + width
      };
    }
  }
  return null;
}

function canPlacePlatform(x, width, sectionStart, sectionEnd, platforms, pits) {
  const end = x + width;
  if (x < sectionStart + 72 || end > sectionEnd - 72) {
    return false;
  }
  for (const platform of platforms) {
    if (overlapsWithPadding(x, end, platform.x, platform.x + platform.width, 54)) {
      return false;
    }
  }
  for (const pit of pits) {
    if (overlapsWithPadding(x, end, pit.start, pit.end, 84)) {
      return false;
    }
  }
  return true;
}

function findSafePlatformX(preferredX, width, sectionStart, sectionEnd, platforms, pits) {
  const offsets = [0, -120, 120, -240, 240, -360, 360];
  for (const offset of offsets) {
    const candidateX = preferredX + offset;
    if (canPlacePlatform(candidateX, width, sectionStart, sectionEnd, platforms, pits)) {
      return candidateX;
    }
  }
  return null;
}

function isGroundEnemySpotSafe(x, patrol, sectionStart, sectionEnd, platforms, pits, enemies) {
  const left = x - patrol / 2 - ENEMY_WIDTH * 0.8;
  const right = x + patrol / 2 + ENEMY_WIDTH * 0.8;
  if (left < sectionStart + 70 || right > sectionEnd - 70) {
    return false;
  }
  for (const platform of platforms) {
    if (overlapsRange(left, right, platform.x - 36, platform.x + platform.width + 36)) {
      return false;
    }
  }
  for (const pit of pits) {
    if (overlapsRange(left, right, pit.start - 46, pit.end + 46)) {
      return false;
    }
  }
  for (const enemy of enemies) {
    const enemyLeft = enemy.minX - ENEMY_WIDTH * 0.5;
    const enemyRight = enemy.maxX + ENEMY_WIDTH * 1.5;
    if (overlapsRange(left, right, enemyLeft, enemyRight)) {
      return false;
    }
  }
  return true;
}

function findSafeGroundEnemyX(preferredX, patrol, sectionStart, sectionEnd, platforms, pits, enemies) {
  const offsets = [0, -180, 180, -320, 320, -460, 460];
  for (const offset of offsets) {
    const candidate = preferredX + offset;
    if (isGroundEnemySpotSafe(candidate, patrol, sectionStart, sectionEnd, platforms, pits, enemies)) {
      return candidate;
    }
  }
  return null;
}

export function createLevel() {
  const platforms = [
    { x: 260, y: 370, width: Math.round(120 * SCALE), height: Math.round(50 * SCALE) },
    { x: 520, y: 348, width: Math.round(136 * SCALE), height: Math.round(72 * SCALE) }
  ];
  const pits = [];
  const enemies = [];

  let cursor = 1200;
  let enemyId = 0;
  const sectionsNeeded = Math.ceil((WORLD_LENGTH - cursor) / 1200);

  for (let i = 0; i < sectionsNeeded; i += 1) {
    const template = templates[i % templates.length];
    const band = Math.floor(i / templates.length);
    const pitBonus = Math.min(16, band * 6);
    const speedBonus = Math.min(16, band * 4);
    const sectionStart = cursor;
    const sectionEnd = cursor + template.length;
    const sectionPits = [];
    const sectionPlatforms = [];

    for (const pit of template.pits) {
      const placedPit = findSafePitRange(
        cursor + pit.x,
        pit.width + pitBonus,
        sectionStart,
        sectionEnd,
        platforms,
        pits
      );
      if (!placedPit) {
        continue;
      }
      pits.push(placedPit);
      sectionPits.push(placedPit);
    }

    for (const platform of template.platforms) {
      const platformWidth = Math.round(platform.width * SCALE);
      const platformX = findSafePlatformX(
        cursor + platform.x,
        platformWidth,
        sectionStart,
        sectionEnd,
        platforms,
        pits
      );
      if (platformX === null) {
        continue;
      }
      const placedPlatform = {
        x: platformX,
        y: platform.y,
        width: platformWidth,
        height: Math.round(platform.height * SCALE)
      };
      platforms.push(placedPlatform);
      sectionPlatforms.push(placedPlatform);
    }

    for (const enemy of template.enemies) {
      const topY = GROUND_Y;
      const preferredX = cursor + enemy.x;
      const enemyX = findSafeGroundEnemyX(
        preferredX,
        enemy.patrol,
        sectionStart,
        sectionEnd,
        sectionPlatforms,
        sectionPits,
        enemies
      );
      if (enemyX === null) {
        continue;
      }
      enemies.push({
        id: `enemy-${enemyId += 1}`,
        x: enemyX,
        y: topY - ENEMY_HEIGHT,
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        minX: enemyX - enemy.patrol / 2,
        maxX: enemyX + enemy.patrol / 2,
        speed: enemy.speed + speedBonus
      });
    }

    cursor += template.length;
  }

  const worldLength = Math.max(WORLD_LENGTH, cursor + 600);
  const groundSegments = buildGroundSegments(pits, worldLength);

  return {
    worldLength,
    groundSegments,
    pits,
    platforms,
    enemies
  };
}
