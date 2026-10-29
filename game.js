// === НОВЫЙ ДВИЖОК С НУЛЯ ===

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

// --- Ввод ---
const keys = {};
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) keys.jump = true;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = true;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = true;
  if (['Space', 'ArrowUp', 'KeyW', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) keys.jump = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
});
// Сенсорное управление
document.querySelectorAll('[data-control]').forEach(btn => {
  const key = btn.dataset.control === 'jump' ? 'jump' : btn.dataset.control;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener('pointerup', e => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener('pointercancel', e => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener('pointerleave', e => { e.preventDefault(); keys[key] = false; });
});

// --- Игрок ---
const player = {
  x: 55, y: 352, w: 35, h: 46,
  vx: 0, vy: 0,
  grounded: false,
  reset() { this.x = 55; this.y = 352; this.vx = 0; this.vy = 0; this.grounded = false; }
};

// --- Уровень ---
const platforms = [
  { x: 0,   y: 400, w: 170, h: 80 },
  { x: 205, y: 352, w: 130, h: 22 },
  { x: 365, y: 297, w: 130, h: 22 },
  { x: 535, y: 345, w: 135, h: 22 },
  { x: 710, y: 395, w: 190, h: 85 }
];
const hearts = [
  { x: 260, y: 313, w: 23, h: 23, got: false },
  { x: 418, y: 258, w: 23, h: 23, got: false },
  { x: 594, y: 306, w: 23, h: 23, got: false }
];
const hazards = [{ x: 170, y: 450, w: 540, h: 30 }];
const finish = { x: 824, y: 310, w: 53, h: 85 };

let score = 0;
let state = 'ready'; // ready, playing, won, lost
let particles = [];
let best = Number(localStorage.getItem('lily-cloud-best')) || 0;

// --- Обновление физики (фиксированный шаг) ---
function updatePhysics() {
  if (state !== 'playing') return;

  // Сброс кадровых флагов
  player.vx = 0;
  
  // 1. Горизонтальное движение
  if (keys.left) player.vx -= 5;
  if (keys.right) player.vx += 5;
  
  player.x += player.vx;
  
  // Коллизии по X (очень простые: если врезались, отталкиваем)
  for (let p of platforms) {
    if (player.x < p.x + p.w && player.x + player.w > p.x && player.y < p.y + p.h && player.y + player.h > p.y) {
      // Если мы стоим на этой платформе, мы не должны об нее спотыкаться
      if (player.y + player.h <= p.y + 5) continue;
      
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }
  
  // Границы экрана
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > 900) player.x = 900 - player.w;

  // 2. Прыжок и гравитация
  if (keys.jump && player.grounded) {
    player.vy = -12; // Импульс прыжка
    player.grounded = false;
  }
  
  player.vy += 0.6; // Гравитация
  if (player.vy > 15) player.vy = 15;
  
  player.y += player.vy;
  player.grounded = false;

  // Коллизии по Y
  for (let p of platforms) {
    if (player.x < p.x + p.w && player.x + player.w > p.x && player.y < p.y + p.h && player.y + player.h > p.y) {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  // 3. Сбор сердечек и проверка поражения
  for (let h of hearts) {
    if (!h.got && player.x < h.x + h.w && player.x + player.w > h.x && player.y < h.y + h.h && player.y + player.h > h.y) {
      h.got = true;
      score++;
      spawnParticles(h.x + 12, h.y + 12, 20, false);
      updateUI();
    }
  }

  if (player.y > 480 || hazards.some(h => player.x < h.x + h.w && player.x + player.w > h.x && player.y < h.y + h.h && player.y + player.h > h.y)) {
    endGame(false);
  }

  if (player.x < finish.x + finish.w && player.x + player.w > finish.x && player.y < finish.y + finish.h && player.y + player.h > finish.y) {
    if (score === 3) endGame(true);
  }
}

// --- Вспомогательные функции ---
function spawnParticles(x, y, count, confetti) {
  const colors = ['#ff79b4', '#ffd66f', '#b99aff', '#ffffff', '#83e5d7'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = confetti ? 4 + Math.random() * 8 : 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (confetti ? 4 : 2),
      life: confetti ? 100 : 40,
      maxLife: confetti ? 100 : 40,
      size: confetti ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 6.28,
      spin: (Math.random() - 0.5) * 0.5,
      shape: confetti ? 'confetti' : 'star'
    });
  }
}

function updateUI() {
  document.querySelector('#score').textContent = `💗 ${score}/3`;
  document.querySelector('#best').textContent = `🏆 ${best}`;
  
  const overlay = document.querySelector('#overlay');
  const gameTitle = document.querySelector('#gameTitle');
  const msg = document.querySelector('#message');
  const details = document.querySelector('#details');
  const overlayBtn = document.querySelector('#overlayBtn');
  
  gameTitle.hidden = state !== 'ready';
  overlay.classList.toggle('hidden', state === 'playing');
  
  const content = {
    ready: ['Начнём приключение? ✨', 'Помоги зайке Лили собрать три сердечка и добраться до волшебного замка!', 'Играть 💖'],
    won: ['Ура! Ты победила! 🎀', 'Все сердечки собраны. Замок найден!', 'Играть снова 💗'],
    lost: ['Ой, не получилось! 🌷', 'Избегай розовых шипов и не падай вниз.', 'Попробовать снова 💪']
  }[state];
  
  if (content) {
    msg.textContent = content[0];
    details.textContent = content[1];
    overlayBtn.textContent = content[2];
  }
}

function endGame(won) {
  state = won ? 'won' : 'lost';
  spawnParticles(won ? 450 : player.x + 18, won ? 185 : player.y + 22, won ? 80 : 30, won);
  if (won && score > best) {
    best = score;
    try { localStorage.setItem('lily-cloud-best', String(best)); } catch {}
  }
  updateUI();
}

// --- Отрисовка ---
function render() {
  ctx.clearRect(0, 0, 900, 480);
  
  // Небо
  const sky = ctx.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, '#cdeeff');
  sky.addColorStop(1, '#fff0f9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 900, 480);
  
  // Облака
  for (let i = 0; i < 9; i++) {
    const x = (i * 157 + 35) % 930, y = 45 + (i % 3) * 65;
    ctx.fillStyle = '#ffffffb9';
    for (const [dx, dy, r] of [[0, 0, 25], [28, -10, 32], [60, 0, 25]]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Точки
  for (let i = 0; i < 28; i++) {
    const x = (i * 83 + 23) % 900, y = (i * 59 + 17) % 370;
    ctx.fillStyle = i % 2 ? '#fff' : '#ffe09b';
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.fillStyle = '#f6b5d4';
  ctx.fillRect(0, 466, 900, 14);
  
  // Платформы
  for (const p of platforms) {
    ctx.fillStyle = '#b18bd5';
    ctx.beginPath(); ctx.roundRect(p.x, p.y + 6, p.w, p.h, 12); ctx.fill();
    ctx.fillStyle = '#fff9ff';
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 17, 9); ctx.fill();
    ctx.fillStyle = '#f8aed1';
    ctx.fillRect(p.x + 10, p.y + 13, Math.max(0, p.w - 20), 4);
  }
  
  // Шипы
  for (const h of hazards) {
    ctx.fillStyle = '#fa8aaf';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    for (let x = h.x; x < h.x + h.w; x += 25) {
      ctx.fillStyle = '#fff0a8';
      ctx.beginPath(); ctx.moveTo(x, h.y + 5); ctx.lineTo(x + 12, h.y - 13); ctx.lineTo(x + 24, h.y + 5); ctx.fill();
    }
  }
  
  // Замок
  const cx = 820, cy = 310;
  ctx.fillStyle = '#d7a8e9'; ctx.beginPath(); ctx.roundRect(cx, cy + 22, 63, 63, 7); ctx.fill();
  ctx.fillStyle = '#f6b2d4';
  ctx.beginPath(); ctx.roundRect(cx + 8, cy - 2, 17, 38, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + 39, cy - 2, 17, 38, 4); ctx.fill();
  ctx.fillStyle = '#ac83d7';
  for (const a of [cx + 5, cx + 36]) {
    ctx.beginPath(); ctx.moveTo(a, cy); ctx.lineTo(a + 12, cy - 28); ctx.lineTo(a + 24, cy); ctx.fill();
  }
  ctx.fillStyle = '#fff3b9'; ctx.beginPath(); ctx.roundRect(cx + 24, cy + 47, 17, 38, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '21px sans-serif'; ctx.fillText('✦', cx + 22, cy + 23);
  
  // Сердечки
  const time = performance.now();
  for (const h of hearts) {
    if (!h.got) {
      const hy = h.y + 11 + Math.sin(time / 260 + h.x) * 3;
      ctx.save();
      ctx.shadowColor = '#ff62b2';
      ctx.shadowBlur = 16 + 5 * Math.sin(time / 240);
      ctx.translate(h.x + 11, hy);
      ctx.scale(13 / 13, 13 / 13);
      ctx.fillStyle = '#f46da2';
      ctx.beginPath(); ctx.moveTo(0, 11);
      ctx.bezierCurveTo(-24, -2, -12, -17, 0, -6);
      ctx.bezierCurveTo(12, -17, 24, -2, 0, 11);
      ctx.fill();
      ctx.restore();
      
      // Звездочка
      ctx.save();
      ctx.translate(h.x + 11 + 18, hy - 17);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4 - Math.PI / 2;
        const rr = i % 2 ? 4 * .35 : 4;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  
  // Частицы
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4 - Math.PI / 2;
        const rr = i % 2 ? p.size * .35 : p.size;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .7);
    }
    ctx.restore();
  }
  
  // Зайка
  drawBunny();
}

function drawBunny() {
  const time = performance.now();
  const moving = player.vx !== 0 && player.grounded;
  const bob = moving ? Math.sin(time / 65) * 2 : Math.sin(time / 380) * 0.7;
  
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  if (!player.grounded) ctx.rotate(Math.max(-0.12, Math.min(0.12, player.vy / 250)));
  if (player.vx < 0) { ctx.translate(35, 0); ctx.scale(-1, 1); }
  
  // Уши
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(4, 17, 27, 29, 12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(6, -10, 9, 34, 7); ctx.fill();
  ctx.beginPath(); ctx.roundRect(21, -10, 9, 34, 7); ctx.fill();
  
  // Внутренние уши
  ctx.fillStyle = '#ffb9d8';
  ctx.beginPath(); ctx.roundRect(9, -4, 4, 21, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(24, -4, 4, 21, 3); ctx.fill();
  
  // Голова
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(17, 20, 16, 0, Math.PI * 2); ctx.fill();
  
  // Глаза
  ctx.fillStyle = '#694b73';
  ctx.beginPath(); ctx.arc(11, 19, 2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(23, 19, 2, 0, 7); ctx.fill();
  
  // Нос
  ctx.fillStyle = '#ee8aaa';
  ctx.beginPath(); ctx.arc(17, 25, 3, 0, 7); ctx.fill();
  
  // Щеки
  ctx.fillStyle = '#f5a2c8';
  ctx.fillRect(3, 35, 29, 7);
  ctx.fillStyle = '#e98db7';
  ctx.beginPath(); ctx.arc(3, 34, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(31, 34, 5, 0, Math.PI * 2); ctx.fill();
  
  // Бантик
  ctx.fillStyle = '#f68fbd';
  ctx.beginPath(); ctx.moveTo(25, 7); ctx.lineTo(37, 1); ctx.lineTo(35, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff4b4';
  ctx.beginPath(); ctx.arc(29, 8, 3, 0, 7); ctx.fill();
  
  ctx.restore();
}

// --- Главный цикл ---
let accumulator = 0;
let lastTime = performance.now();
const FIXED_STEP = 1000 / 60; // 60 FPS

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;
  
  // Накапливаем время (защита от зависаний при переключении вкладок)
  accumulator += Math.min(delta, 100);
  
  // Обновляем физику фиксированными шагами
  while (accumulator >= FIXED_STEP) {
    updatePhysics();
    accumulator -= FIXED_STEP;
  }
  
  // Обновляем частицы (визуально)
  if (state === 'playing' || state === 'won' || state === 'lost') {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.rot += p.spin;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  
  render();
  requestAnimationFrame(gameLoop);
}

// --- Кнопки UI ---
function startGame() {
  if (state === 'won' || state === 'lost' || state === 'ready') {
    player.reset();
    hearts.forEach(h => h.got = false);
    score = 0;
    particles = [];
    updateUI();
  }
  state = 'playing';
  updateUI();
  document.querySelector('#gameMenu').hidden = true;
  document.querySelector('#menuToggle').setAttribute('aria-expanded', 'false');
}

document.querySelector('#start').addEventListener('click', startGame);
document.querySelector('#overlayBtn').addEventListener('click', startGame);
document.querySelector('#restart').addEventListener('click', () => { state = 'ready'; startGame(); });
document.querySelector('#pause').addEventListener('click', () => { state = 'ready'; updateUI(); });

document.querySelector('#menuToggle').addEventListener('click', () => {
  const menu = document.querySelector('#gameMenu');
  menu.hidden = !menu.hidden;
  document.querySelector('#menuToggle').setAttribute('aria-expanded', String(!menu.hidden));
});
document.querySelector('#closeMenu').addEventListener('click', () => {
  document.querySelector('#gameMenu').hidden = true;
  document.querySelector('#menuToggle').setAttribute('aria-expanded', 'false');
});

// Старт
updateUI();
requestAnimationFrame(gameLoop);