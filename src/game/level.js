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

    for (const pit of template.pits) {
      pits.push({
        start: cursor + pit.x,
        end: cursor + pit.x + pit.width + pitBonus
      });
    }

    for (const platform of template.platforms) {
      platforms.push({
        x: cursor + platform.x,
        y: platform.y,
        width: Math.round(platform.width * SCALE),
        height: Math.round(platform.height * SCALE)
      });
    }

    for (const enemy of template.enemies) {
      const topY = GROUND_Y;
      const enemyX = cursor + enemy.x;
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
