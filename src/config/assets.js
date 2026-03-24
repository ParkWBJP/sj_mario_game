export const IMAGE_ASSETS = {
  backgrounds: {
    sky: "./assets/images/backgrounds/sky.png",
    hillsFar: "./assets/images/backgrounds/hills_far.png",
    cloudsFar: "./assets/images/backgrounds/clouds_far.png",
    cloudsNear: "./assets/images/backgrounds/clouds_near.png"
  },
  characters: {
    heroIdle: "./assets/images/characters/hero_idle.png",
    heroJump: "./assets/images/characters/hero_jump.png",
    heroFall: "./assets/images/characters/hero_fall.png",
    heroLand: "./assets/images/characters/hero_land.png",
    heroRunFrames: [
      "./assets/images/characters/hero_run_01.png",
      "./assets/images/characters/hero_run_02.png",
      "./assets/images/characters/hero_run_03.png",
      "./assets/images/characters/hero_run_04.png",
      "./assets/images/characters/hero_run_05.png",
      "./assets/images/characters/hero_run_06.png"
    ]
  },
  enemies: {
    mushroomWalkFrames: [
      "./assets/images/enemies/mushroom_walk_01.png",
      "./assets/images/enemies/mushroom_walk_02.png"
    ],
    mushroomFlat: "./assets/images/enemies/mushroom_flat.png"
  },
  tiles: {
    ground: "./assets/images/tiles/ground.png",
    groundTop: "./assets/images/tiles/ground_top.png",
    brick: "./assets/images/tiles/brick.png",
    platform: "./assets/images/tiles/platform.png",
    edgeLeft: "./assets/images/hazards/edge_left.png",
    edgeRight: "./assets/images/hazards/edge_right.png"
  },
  ui: {
    startButton: "./assets/images/ui/start_button.png"
  },
  goal: {
    flagpole: "./assets/images/goal/flagpole.png"
  }
};

export const AUDIO_ASSETS = {
  bgm: "./assets/audio/main.mp3",
  jump: "./assets/audio/jump.mp3",
  shoot: "./assets/audio/fireball.wav",
  hit: "./assets/audio/coin_get.wav",
  die: "./assets/audio/dead.mp3",
  success: "./assets/audio/success_goal.mp3"
};
