const BASE = new URL('./', import.meta.url);
const audio = new Audio();
let queue = [];
audio.addEventListener('ended', () => { if (queue.length) { audio.src = queue.shift(); audio.play().catch(() => {}); } });

// One element for every sound, started inside the tap, so iOS lets the chained clips play.
function play(urls) {
  queue = urls.slice(1);
  audio.pause();
  audio.src = urls[0];
  audio.play().catch(() => {});
}

const clipUrl = (clip) => new URL(`v/${clip}.mp3`, BASE).href;
const picUrl = (img) => new URL(`s/${img}.webp`, BASE).href;

function board(root) {
  const grid = root.querySelector('.aac__grid');
  const msg = root.querySelector('.aac__msg');
  const bar = root.querySelector('.aac__bar');
  const where = root.querySelector('.aac__where');
  const back = root.querySelector('[data-aac="back"]');
  const home = root.querySelector('[data-aac="home"]');
  const words = [];
  const path = ['home'];
  let boards = null;

  const sayLabel = () => {
    const text = words.map((w) => w.label).join(' ');
    msg.textContent = text;
    bar.setAttribute('aria-label', text ? `Say the message: ${text}` : 'Message bar, empty');
  };

  const key = (cell) => {
    if (!cell) { const gap = document.createElement('div'); gap.className = 'aac__gap'; return gap; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aac__key' + (cell.open ? ' aac__key--folder' : '');
    b.style.setProperty('--c', cell.bg);
    if (cell.open) b.dataset.open = cell.open; else b.dataset.clip = cell.clip;
    const img = new Image(160, 160);
    img.alt = '';
    img.src = picUrl(cell.img);
    const label = document.createElement('span');
    label.textContent = cell.label;
    b.append(img, label);
    if (cell.open) b.insertAdjacentHTML('beforeend', '<span class="sr-only">, opens a board</span>');
    return b;
  };

  async function show(name, focus) {
    boards ??= await fetch(new URL('boards.json', BASE)).then((r) => r.json());
    const b = boards[name];
    grid.replaceChildren(...b.cells.map(key));
    grid.setAttribute('aria-label', `${b.name} board`);
    where.textContent = b.name;
    back.disabled = path.length < 2;
    home.disabled = name === 'home';
    if (focus) grid.querySelector('button')?.focus();
  }

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.aac__key');
    if (!b) return;
    if (b.dataset.open) { path.push(b.dataset.open); show(b.dataset.open, true); return; }
    words.push({ label: b.querySelector('span').textContent, clip: b.dataset.clip });
    sayLabel();
    play([clipUrl(b.dataset.clip)]);
  });
  bar.addEventListener('click', () => { if (words.length) play(words.map((w) => clipUrl(w.clip))); });
  root.querySelector('[data-aac="delete"]').addEventListener('click', () => { words.pop(); sayLabel(); });
  root.querySelector('[data-aac="clear"]').addEventListener('click', () => { words.length = 0; sayLabel(); });
  back.addEventListener('click', () => { if (path.length > 1) { path.pop(); show(path.at(-1), true); } });
  home.addEventListener('click', () => { path.length = 1; show('home', true); });
  sayLabel();
}

document.querySelectorAll('[data-aac-live]').forEach(board);
document.querySelectorAll('[data-voice]').forEach((b) => {
  b.addEventListener('click', () => play([new URL(`voices/${b.dataset.voice}.mp3`, BASE).href]));
});
