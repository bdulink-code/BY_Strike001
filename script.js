const state = {
  callsign: 'GHOST_01',
  hp: 100,
  ammo: 30,
  reserve: 120,
  currentTargetIndex: 0,
  currentScreen: 'menu',
  countdownTimer: null,
  matchTimer: null,
  matchSeconds: 180,
  cameraStream: null,
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

function pushFeed(message) {
  state.feed.push(message);
  renderFeed();
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
    lockText.textContent = target.hp < 100 ? `ЦЕЛЬ ЗАХВАЧЕНА: ${target.name}` : `ЗАХВАТ ЦЕЛИ: ${target.name}`;
  }
}

function renderResults() {
  const list = ids('resultsList');
  const data = [
    { place: '1', name: state.callsign, meta: 'Team A · MVP', score: '7 / 2' },
    { place: '2', name: 'SHADOW', meta: 'Team A · Scout', score: '4 / 3' },
    { place: '3', name: 'HUNTER', meta: 'Team B · Assault', score: '5 / 5' },
    { place: '4', name: 'VIPER', meta: 'Team B · Sniper', score: '3 / 4' }
  ];
  list.innerHTML = data.map(item => `
    <div class="result-row">
      <div class="place">#${item.place}</div>
      <div>
        <div><strong>${item.name}</strong></div>
        <div class="meta">${item.meta}</div>
      </div>
      <div class="chip">${item.score}</div>
    </div>
  `).join('');
}

async function requestCamera() {
  const video = ids('cameraFeed');
  const fallback = ids('cameraFallback');
  const fallbackText = ids('fallbackText');

  fallback.classList.add('hidden');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    fallbackText.textContent = 'Этот браузер не поддерживает открытие камеры через getUserMedia.';
    fallback.classList.remove('hidden');
    return false;
  }

  try {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    state.cameraStream = stream;
    video.srcObject = stream;
    await video.play();
    return true;
  } catch (error) {
    let message = 'Не удалось открыть камеру. Разреши доступ в браузере и перезапусти демо.';
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      message = 'Камера в большинстве браузеров открывается только по HTTPS. Для показа загрузи проект на GitHub Pages.';
    } else if (error && error.name === 'NotAllowedError') {
      message = 'Доступ к камере отклонён. Разреши камеру для сайта в настройках браузера.';
    } else if (error && error.name === 'NotFoundError') {
      message = 'Камера на устройстве не найдена.';
    }
    fallbackText.textContent = message;
    fallback.classList.remove('hidden');
    return false;
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  const video = ids('cameraFeed');
  video.pause();
  video.srcObject = null;
}

function startCountdown() {
  switchScreen('countdown');
  const sequence = ['3', '2', '1', 'GO'];
  let index = 0;
  ids('countdownText').textContent = sequence[index];
  ids('countdownLabel').textContent = 'Подготовка к запуску матча';

  clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(async () => {
    index += 1;
    if (index < sequence.length) {
      ids('countdownText').textContent = sequence[index];
      if (sequence[index] === 'GO') ids('countdownLabel').textContent = 'Камера активна';
      return;
    }

    clearInterval(state.countdownTimer);
    switchScreen('battle');
    updateCombatView();
    const started = await requestCamera();
    if (started) {
      pushFeed('CAM: rear camera connected');
    }
    startMatchTimer();
  }, 900);
}

function startMatchTimer() {
  clearInterval(state.matchTimer);
  state.matchSeconds = 180;
  updateTimerLabel();
  state.matchTimer = setInterval(() => {
    state.matchSeconds -= 1;
    updateTimerLabel();
    if (state.matchSeconds <= 0) {
      clearInterval(state.matchTimer);
      finishMatch();
    }
  }, 1000);
}

function updateTimerLabel() {
  const min = String(Math.floor(state.matchSeconds / 60)).padStart(2, '0');
  const sec = String(state.matchSeconds % 60).padStart(2, '0');
  ids('timerValue').textContent = `${min}:${sec}`;
}

function cycleTarget(direction = 1) {
  state.currentTargetIndex = (state.currentTargetIndex + direction + state.targets.length) % state.targets.length;
  updateCombatView();
}

function fireShot() {
  if (state.ammo <= 0) {
    pushFeed('WEAPON: magazine empty');
    return;
  }

  const target = state.targets[state.currentTargetIndex];
  state.ammo -= 1;
  ids('ammoValue').textContent = `${state.ammo}/${state.reserve}`;
  const muzzle = ids('muzzleFlash');
  muzzle.classList.remove('active');
  void muzzle.offsetWidth;
  muzzle.classList.add('active');

  if (target.type === 'ally') {
    pushFeed(`SAFELOCK: ${target.name} is friendly`);
    updateCombatView();
    return;
  }

  target.hp = Math.max(0, target.hp - 50);
  if (target.hp === 0) {
    pushFeed(`KILL: ${state.callsign} ▶ ${target.name}`);
    target.hp = 100;
    state.currentTargetIndex = (state.currentTargetIndex + 1) % state.targets.length;
  } else {
    pushFeed(`HIT: ${target.name} -50 HP`);
  }
  updateCombatView();
}

function takeDamage() {
  state.hp = Math.max(0, state.hp - 18);
  ids('hpValue').textContent = state.hp;
  pushFeed(`DAMAGE: ${state.callsign} -18 HP`);
  document.body.classList.add('hit-flash');
  setTimeout(() => document.body.classList.remove('hit-flash'), 220);

  if (state.hp === 0) {
    finishMatch();
  }
}

function reloadWeapon() {
  if (state.reserve <= 0 || state.ammo === 30) {
    pushFeed('WEAPON: reload not needed');
    return;
  }
  const needed = 30 - state.ammo;
  const amount = Math.min(needed, state.reserve);
  state.ammo += amount;
  state.reserve -= amount;
  ids('ammoValue').textContent = `${state.ammo}/${state.reserve}`;
  pushFeed('WEAPON: reload complete');
}

function finishMatch() {
  clearInterval(state.matchTimer);
  stopCamera();
  renderResults();
  switchScreen('results');
}

function resetState() {
  state.callsign = ids('callsignInput').value.trim() || 'GHOST_01';
  state.players[0].name = state.callsign;
  state.hp = 100;
  state.ammo = 30;
  state.reserve = 120;
  state.currentTargetIndex = 1;
  state.feed = [
    'SYSTEM: Match initialized',
    'AR: 3 targets detected',
    'NET: lobby sync OK'
  ];
  state.targets = [
    { id: 1, name: 'SHADOW', type: 'ally', hp: 100, x: 18, y: 42, scale: 0.82 },
    { id: 2, name: 'HUNTER', type: 'enemy', hp: 100, x: 58, y: 31, scale: 1.02 },
    { id: 3, name: 'VIPER', type: 'enemy', hp: 100, x: 74, y: 48, scale: 0.88 }
  ];
  renderPlayers();
  renderFeed();
}

ids('hostBtn').addEventListener('click', () => {
  resetState();
  switchScreen('lobby');
});
ids('joinBtn').addEventListener('click', () => {
  resetState();
  switchScreen('lobby');
});
ids('startMatchBtn').addEventListener('click', async () => {
  resetState();
  startCountdown();
});
ids('prevTargetBtn').addEventListener('click', () => cycleTarget(-1));
ids('nextTargetBtn').addEventListener('click', () => cycleTarget(1));
ids('fireBtn').addEventListener('click', fireShot);
ids('damageBtn').addEventListener('click', takeDamage);
ids('reloadBtn').addEventListener('click', reloadWeapon);
ids('restartBtn').addEventListener('click', () => {
  resetState();
  switchScreen('lobby');
});
ids('backToMenuBtn').addEventListener('click', () => {
  clearInterval(state.matchTimer);
  stopCamera();
  switchScreen('menu');
});
ids('retryCameraBtn').addEventListener('click', requestCamera);

document.querySelectorAll('[data-back="menu"]').forEach(btn => {
  btn.addEventListener('click', () => {
    clearInterval(state.matchTimer);
    stopCamera();
    switchScreen('menu');
  });
});

window.addEventListener('beforeunload', stopCamera);

renderPlayers();
renderFeed();
renderResults();
updateCombatView();
