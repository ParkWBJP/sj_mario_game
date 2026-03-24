import { Game } from "./game/Game.js";

const ui = {
  timePill: document.querySelector("#time-pill"),
  goalPill: document.querySelector("#goal-pill"),
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

if (autostart) {
  game.restart({
    playerX: Number.isFinite(debugPlayerX) ? debugPlayerX : undefined,
    timeRemaining: Number.isFinite(debugTime) ? debugTime : undefined
  });
}

window.render_game_to_text = () => game.renderGameToText();
window.advanceTime = (ms) => game.advanceTime(ms);
window.__game = game;
