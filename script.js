const state = {
  callsign: 'GHOST_01',
  hp: 100,
  ammo: 30,
  reserve: 120,
  currentTargetIndex: 0,
  currentScreen: 'menu',
  countdownTimer: null,
  players: [
    { name: 'GHOST_01', role: 'Host', team: 'A', score: '7 / 2' },
    { name: 'SHADOW', role: 'Scout', team: 'A', score: '4 / 3' },
    { name: 'HUNTER', role: 'Assault', team: 'B', score: '5 / 5' },
    { name: 'VIPER', role: 'Sniper', team: 'B', score: '3 / 4' }
  ],
  targets: [
    { id: 1, name: 'SHADOW', type: 'ally', hp: 100, x: 18, y: 42, scale: 0.82 },
    { id: 2, name: 'HUNTER', type: 'enemy', hp: 100, x: 58, y: 31, scale: 1.02 },
    { id: 3, name: 'VIPER', type: 'enemy', hp: 100, x: 74, y: 48, scale: 0.88 }
  ],
  feed: [
    'SYSTEM: Match initialized',
    'AR: 3 targets detected',
    'NET: lobby sync OK'
  ]
};

const ids = id => document.getElementById(id);
const screens = {
  menu: ids('screen'),
  lobby: ids('lobbyScreen'),
  countdown: ids('countdownScreen'),
  battle: ids('battleScreen'),
  results: ids('resultsScreen')
};

function setClock() {
  const now = new Date();
  ids('clock').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
setClock();
setInterval(setClock, 30000);

function switchScreen(name) {
  Object.values(screens).forEach(el => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  state.currentScreen = name;
}

function renderPlayers() {
  const container = ids('playersList');
  container.innerHTML = '';
  state.players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-left">
        <div class="avatar team-${player.team.toLowerCase()}">${index + 1}</div>
        <div>
          <div><strong>${player.name}</strong></div>
          <div class="role">${player.role} · Team ${player.team}</div>
        </div>
      </div>
      <div class="chip">${player.score}</div>
    `;
    container.appendChild(row);
  });
}

function renderTargets() {
  const layer = ids('targetLayer');
  layer.innerHTML = '';
  state.targets.forEach((target, index) => {
    const item = document.createElement('button');
    item.className = `target ${target.type} ${index === state.currentTargetIndex ? 'selected' : ''}`;
    item.style.left = `${target.x}%`;
    item.style.top = `${target.y}%`;
    item.style.transform = `translate(-50%, -50%) scale(${target.scale})`;
    item.innerHTML = `
      <div class="outline"></div>
      <div class="tag">
        ${target.name}
        <div class="hpbar"><span style="width:${target.hp}%; background:${target.type === 'enemy' ? 'var(--red)' : 'var(--green)'}"></span></div>
      </div>
      <div class="silhouette"></div>
    `;
    item.addEventListener('click', () => {
      state.currentTargetIndex = index;
      updateCombatView();
    });
    layer.appendChild(item);
  });
}

function renderFeed() {
  const feed = ids('feedItems');
  feed.innerHTML = '';
  state.feed.slice(-4).reverse().forEach(text => {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.textContent = text;
    feed.appendChild(div);
  });
}

function updateCombatView() {
  renderTargets();
  renderFeed();
  ids('hpValue').textContent = state.hp;
  ids('ammoValue').textContent = `${state.ammo}/${state.reserve}`;

  const target = state.targets[state.currentTargetIndex];
  const crosshair = ids('crosshair');
  const lockRing = ids('lockRing');
  const lockText = ids('lockText');
  crosshair.className = 'crosshair';

  if (!target) {
    crosshair.classList.add('neutral');
    lockRing.style.setProperty('--progress', 0);
    lockText.textContent = 'ПОИСК ЦЕЛИ';
    return;
  }

  if (target.type === 'ally') {
    crosshair.classList.add('ally-lock');
    lockRing.style.setProperty('--progress', 100);
    lockText.textContent = `СОЮЗНИК: ${target.name}`;
  } else {
    crosshair.classList.add(target.hp < 100 ? 'enemy-lock' : 'loading');
    lockRing.style.setProperty('--progress', target.hp < 100 ? 100 : 62);
    lockText.textContent = target.hp < 100 ? `ЗАХВАТ: ${target.name}` : `ЗАХВАТ... ${target.name}`;
  }
}

function startCountdown() {
  switchScreen('countdown');
  const values = ['3', '2', '1', 'GO'];
  let i = 0;
  ids('countdownText').textContent = values[i];
  state.countdownTimer = setInterval(() => {
    i += 1;
    if (i >= values.length) {
      clearInterval(state.countdownTimer);
      switchScreen('battle');
      updateCombatView();
      state.feed.push('SYSTEM: Combat live');
      renderFeed();
      return;
    }
    ids('countdownText').textContent = values[i];
  }, 850);
}

function fireWeapon() {
  const target = state.targets[state.currentTargetIndex];
  if (!target) return;
  if (state.ammo <= 0) {
    state.feed.push('WARN: Magazine empty');
    renderFeed();
    return;
  }
  if (target.type === 'ally') {
    state.feed.push(`SAFE: fire blocked on ally ${target.name}`);
    renderFeed();
    return;
  }

  state.ammo -= 1;
  target.hp = Math.max(0, target.hp - 50);
  ids('muzzleFlash').classList.remove('active');
  void ids('muzzleFlash').offsetWidth;
  ids('muzzleFlash').classList.add('active');

  if (target.hp === 0) {
    state.feed.push(`${state.callsign} ▶ ${target.name} eliminated`);
    target.hp = 100;
    const enemyPlayers = state.players.filter(p => p.name === target.name);
    if (enemyPlayers[0]) {
      const kd = enemyPlayers[0].score.split('/').map(v => parseInt(v.trim(), 10));
      enemyPlayers[0].score = `${kd[0]} / ${kd[1] + 1}`;
    }
  } else {
    state.feed.push(`${state.callsign} hit ${target.name} for 50`);
  }
  updateCombatView();
}

function reloadWeapon() {
  const need = 30 - state.ammo;
  const used = Math.min(need, state.reserve);
  state.ammo += used;
  state.reserve -= used;
  state.feed.push('Weapon reloaded');
  updateCombatView();
}

function takeDamage() {
  state.hp = Math.max(0, state.hp - 25);
  state.feed.push('Incoming hit: -25 HP');
  updateCombatView();
  if (state.hp === 0) {
    setTimeout(showResults, 700);
  }
}

function showResults() {
  switchScreen('results');
  const results = [
    { place: 1, name: state.callsign, meta: 'Team A · MVP', score: '7 / 2' },
    { place: 2, name: 'SHADOW', meta: 'Team A · Scout', score: '4 / 3' },
    { place: 3, name: 'HUNTER', meta: 'Team B · Assault', score: '5 / 5' },
    { place: 4, name: 'VIPER', meta: 'Team B · Sniper', score: '3 / 4' }
  ];
  ids('resultsList').innerHTML = results.map(r => `
    <div class="result-row">
      <div class="place">#${r.place}</div>
      <div>
        <div><strong>${r.name}</strong></div>
        <div class="meta">${r.meta}</div>
      </div>
      <div class="chip">${r.score}</div>
    </div>
  `).join('');
}

function resetDemo() {
  state.hp = 100;
  state.ammo = 30;
  state.reserve = 120;
  state.currentTargetIndex = 0;
  state.targets = [
    { id: 1, name: 'SHADOW', type: 'ally', hp: 100, x: 18, y: 42, scale: 0.82 },
    { id: 2, name: 'HUNTER', type: 'enemy', hp: 100, x: 58, y: 31, scale: 1.02 },
    { id: 3, name: 'VIPER', type: 'enemy', hp: 100, x: 74, y: 48, scale: 0.88 }
  ];
  state.feed = ['SYSTEM: Match initialized', 'AR: 3 targets detected', 'NET: lobby sync OK'];
  renderPlayers();
  updateCombatView();
  switchScreen('menu');
}

ids('callsignInput').addEventListener('input', e => {
  state.callsign = e.target.value || 'GHOST_01';
  state.players[0].name = state.callsign;
  renderPlayers();
});
ids('hostBtn').addEventListener('click', () => { renderPlayers(); switchScreen('lobby'); });
ids('joinBtn').addEventListener('click', () => { renderPlayers(); switchScreen('lobby'); });
ids('startMatchBtn').addEventListener('click', startCountdown);
ids('prevTargetBtn').addEventListener('click', () => {
  state.currentTargetIndex = (state.currentTargetIndex - 1 + state.targets.length) % state.targets.length;
  updateCombatView();
});
ids('nextTargetBtn').addEventListener('click', () => {
  state.currentTargetIndex = (state.currentTargetIndex + 1) % state.targets.length;
  updateCombatView();
});
ids('fireBtn').addEventListener('click', fireWeapon);
ids('reloadBtn').addEventListener('click', reloadWeapon);
ids('damageBtn').addEventListener('click', takeDamage);
ids('restartBtn').addEventListener('click', () => { resetDemo(); renderPlayers(); switchScreen('lobby'); });
ids('backToMenuBtn').addEventListener('click', resetDemo);
document.querySelectorAll('[data-back="menu"]').forEach(btn => btn.addEventListener('click', () => switchScreen('menu')));

renderPlayers();
updateCombatView();
