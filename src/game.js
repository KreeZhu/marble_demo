(function startGame() {
  'use strict';

  const {
    createBall,
    stepBall,
    resolveArenaWalls,
    targetHitThisFrame,
    tryTeleport,
    tryRelayLaunch,
    tryLauncherCapture,
    resolveObstacleBounce,
    resolveShapedObstacleBounce,
    rotatedRectPoints,
    trianglePoints,
    updateMovingObstacle,
    clamp,
  } = window.PinballSandbox;
  const { levels: officialLevels } = window.PinballLevels;
  const { shotMeetsRequiredMechanics } = window.PinballMechanics;
  const { buildCompletionResult } = window.PinballProgression;

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const customStorageKey = 'pinballSandboxCustomLevels.v1';
  const fixedLauncherPower = 700;
  canvas.tabIndex = 0;

  const ui = {
    shell: document.querySelector('.shell'),
    startScreen: document.querySelector('#startScreen'),
    startGame: document.querySelector('#startGame'),
    exitGame: document.querySelector('#exitGame'),
    startExitStatus: document.querySelector('#startExitStatus'),
    levelMenu: document.querySelector('#levelMenu'),
    levelGrid: document.querySelector('#levelGrid'),
    openEditor: document.querySelector('#openEditor'),
    openMenu: document.querySelector('#openMenu'),
    playPanel: document.querySelector('#playPanel'),
    editorPanel: document.querySelector('#editorPanel'),
    prevLevel: document.querySelector('#prevLevel'),
    nextLevel: document.querySelector('#nextLevel'),
    levelNumber: document.querySelector('#levelNumber'),
    levelName: document.querySelector('#levelName'),
    levelFocus: document.querySelector('#levelFocus'),
    shotCount: document.querySelector('#shotCount'),
    launcherName: document.querySelector('#launcherName'),
    launcherButtons: document.querySelector('#launcherButtons'),
    angle: document.querySelector('#angle'),
    angleValue: document.querySelector('#angleValue'),
    power: document.querySelector('#power'),
    powerValue: document.querySelector('#powerValue'),
    previewLength: document.querySelector('#previewLength'),
    previewLengthValue: document.querySelector('#previewLengthValue'),
    shoot: document.querySelector('#shoot'),
    reset: document.querySelector('#reset'),
    status: document.querySelector('#status'),
    dialog: document.querySelector('#levelCompleteDialog'),
    completeTitle: document.querySelector('#completeTitle'),
    completeBody: document.querySelector('#completeBody'),
    continueLevel: document.querySelector('#continueLevel'),
    replayLevel: document.querySelector('#replayLevel'),
    editorLevelName: document.querySelector('#editorLevelName'),
    newCustomLevel: document.querySelector('#newCustomLevel'),
    saveCustomLevel: document.querySelector('#saveCustomLevel'),
    playEditedLevel: document.querySelector('#playEditedLevel'),
    backToMenuFromEditor: document.querySelector('#backToMenuFromEditor'),
    deleteCustomLevel: document.querySelector('#deleteCustomLevel'),
    editorTools: [...document.querySelectorAll('[data-editor-tool]')],
    editorSelectedType: document.querySelector('#editorSelectedType'),
    editorX: document.querySelector('#editorX'),
    editorY: document.querySelector('#editorY'),
    editorWidth: document.querySelector('#editorWidth'),
    editorHeight: document.querySelector('#editorHeight'),
    editorRadius: document.querySelector('#editorRadius'),
    editorMaterial: document.querySelector('#editorMaterial'),
    editorAngle: document.querySelector('#editorAngle'),
    editorPower: document.querySelector('#editorPower'),
    editorPathX: document.querySelector('#editorPathX'),
    editorPathY: document.querySelector('#editorPathY'),
    editorSpeed: document.querySelector('#editorSpeed'),
    deleteEditorObject: document.querySelector('#deleteEditorObject'),
    customLevelList: document.querySelector('#customLevelList'),
    editorStatus: document.querySelector('#editorStatus'),
  };

  const arena = { x: 36, y: 36, width: 888, height: 528 };
  const soundVolume = 1.9;
  const relayColor = '#9b7cff';
  const relayGlow = 'rgba(155, 124, 255, 0.42)';
  const stickyArenaWalls = { top: 'sticky', right: 'sticky', bottom: 'sticky', left: 'sticky' };
  const art = {
    metal: '#596977',
    metalDark: '#303943',
    boost: '#d96cff',
    boostCore: '#67f0ff',
    sticky: '#8a5a34',
    stickyDark: '#3f2515',
    moving: '#ffbf47',
    start: '#41d692',
    target: '#41d692',
    bluePortal: '#55a7ff',
    orangePortal: '#ff8f57',
    red: '#e43d35',
  };

  const state = {
    mode: 'menu',
    levelIndex: 0,
    activeLauncherIndex: 0,
    selectedDeviceType: 'start',
    selectedRelayIndex: 0,
    launchers: [],
    relayLaunchers: [],
    switches: [],
    doors: [],
    shots: 0,
    ball: null,
    obstacles: [],
    completed: false,
    completedLevels: new Set(),
    customLevels: loadCustomLevels(),
    testLevel: null,
    previewDistance: 480,
    draggingAim: false,
    dragMode: null,
    dragOffset: { x: 0, y: 0 },
    lastTime: 0,
    effects: [],
    successPulse: null,
    lastImpactSoundAt: 0,
    completionResult: null,
    shotEvents: null,
    editor: {
      draft: createEditorDraft(),
      savedId: null,
      selected: null,
      tool: 'start',
      dragging: false,
      dragOffset: { x: 0, y: 0 },
    },
  };

  const audio = { context: null, unlocked: false };

  function allLevels() {
    return officialLevels.concat(state.customLevels);
  }

  function freshId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function loadCustomLevels() {
    try {
      const raw = window.localStorage.getItem(customStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((level, index) => normalizeCustomLevel(level, index)).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveCustomLevels() {
    window.localStorage.setItem(customStorageKey, JSON.stringify(state.customLevels));
  }

  function normalizeArenaWalls(walls = stickyArenaWalls) {
    const normalized = { ...stickyArenaWalls };
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      normalized[side] = walls && walls[side] === 'bounce' ? 'bounce' : 'sticky';
    });
    return normalized;
  }

  function arenaWallModes(levelData = level()) {
    if (!levelData || !levelData.arenaWalls) return normalizeArenaWalls(stickyArenaWalls);
    return normalizeArenaWalls(levelData.arenaWalls);
  }

  function normalizeCustomLevel(level, index) {
    if (!level || !Array.isArray(level.launchers) || !level.target) return null;
    return {
      id: level.id || freshId('level'),
      custom: true,
      order: officialLevels.length + index + 1,
      name: String(level.name || `自定义关卡 ${index + 1}`).slice(0, 18),
      focus: '自定义布局',
      hint: '这是你保存的自定义关卡。调整发射器，让球碰到 B 点。',
      requiredMechanics: Array.isArray(level.requiredMechanics) ? level.requiredMechanics : [],
      arenaWalls: normalizeArenaWalls(level.arenaWalls),
      target: { x: level.target.x || 812, y: level.target.y || 300, radius: level.target.radius || 18 },
      launchers: level.launchers.length > 0
        ? level.launchers.map((launcher, launcherIndex) => ({
            id: launcher.id || `A${launcherIndex + 1}`,
            x: launcher.x || 124,
            y: launcher.y || 300,
            angle: Number.isFinite(launcher.angle) ? launcher.angle : 0,
            power: fixedLauncherPower,
          }))
        : [{ id: 'A1', x: 124, y: 300, angle: 0, power: fixedLauncherPower }],
      relayLaunchers: (level.relayLaunchers || []).map((relay, relayIndex) => ({
        id: relay.id || `R${relayIndex + 1}`,
        x: relay.x || 420,
        y: relay.y || 316,
        radius: relay.radius || 24,
        angle: Number.isFinite(relay.angle) ? relay.angle : 0,
        power: fixedLauncherPower,
        movable: true,
        purpose: relay.purpose || '自定义中继发射器。',
      })),
      obstacles: (level.obstacles || []).map((obstacle, obstacleIndex) => ({
        id: obstacle.id || `wall-${obstacleIndex + 1}`,
        role: obstacle.role || (obstacle.path ? 'movingGate' : 'blocker'),
        shape: obstacle.shape || 'rect',
        material: obstacle.material || 'normal',
        purpose: obstacle.purpose || '自定义组件。',
        x: obstacle.x || 360,
        y: obstacle.y || 260,
        width: obstacle.width || 90,
        height: obstacle.height || 34,
        radius: obstacle.radius || 28,
        angle: obstacle.angle || 0,
        ...(obstacle.path ? { path: obstacle.path, speed: obstacle.speed || 1, phase: obstacle.phase || 0 } : {}),
      })),
      switches: (level.switches || []).map((switchItem, switchIndex) => ({
        id: switchItem.id || `red-switch-${switchIndex + 1}`,
        color: switchItem.color || 'red',
        x: switchItem.x || 350,
        y: switchItem.y || 300,
        radius: switchItem.radius || 18,
        activated: false,
        purpose: switchItem.purpose || '红色按钮，被球击中后打开红色门。',
      })),
      doors: (level.doors || []).map((door, doorIndex) => ({
        id: door.id || `red-door-${doorIndex + 1}`,
        color: door.color || 'red',
        x: door.x || 560,
        y: door.y || 220,
        width: door.width || 38,
        height: door.height || 170,
        shape: 'rect',
        material: 'normal',
        open: false,
        purpose: door.purpose || '红色门，红色按钮触发后打开。',
      })),
      portals: normalizePortalPairs(level.portals || []),
    };
  }

  function normalizePortalPairs(portals) {
    return portals.map((portal, index) => ({
      id: portal.id || (index % 2 === 0 ? `blue-${index}` : `orange-${index}`),
      purpose: portal.purpose || '自定义传送门。',
      x: portal.x || 300,
      y: portal.y || 300,
      radius: portal.radius || 18,
      pairId: portal.pairId || '',
      exitAngle: Number.isFinite(portal.exitAngle) ? portal.exitAngle : 0,
    }));
  }

  function createEditorDraft() {
    return {
      id: freshId('draft'),
      name: '我的关卡',
      target: { x: 820, y: 300, radius: 18 },
      launchers: [{ id: 'A1', x: 128, y: 300, angle: 0, power: fixedLauncherPower }],
      relayLaunchers: [],
      obstacles: [],
      switches: [],
      doors: [],
      portals: [],
      arenaWalls: normalizeArenaWalls(),
    };
  }

  function draftToLevel(draft, index = state.customLevels.length) {
    const normalized = normalizeCustomLevel({
      id: state.editor.savedId || draft.id || freshId('level'),
      name: draft.name,
      target: draft.target,
      launchers: draft.launchers,
      relayLaunchers: draft.relayLaunchers,
      obstacles: draft.obstacles,
      switches: draft.switches,
      doors: draft.doors,
      portals: draft.portals,
      arenaWalls: draft.arenaWalls,
      requiredMechanics: [],
    }, index);
    normalized.focus = '自定义布局';
    return normalized;
  }

  function levelToDraft(level) {
    return {
      id: level.id || freshId('draft'),
      name: level.name || '我的关卡',
      target: { ...level.target },
      launchers: level.launchers.map((launcher) => ({ ...launcher, power: fixedLauncherPower })),
      relayLaunchers: (level.relayLaunchers || []).map((relay) => ({ ...relay, power: fixedLauncherPower, movable: true })),
      obstacles: level.obstacles.map((obstacle) => ({ ...obstacle, path: obstacle.path ? { ...obstacle.path } : undefined })),
      switches: (level.switches || []).map((switchItem) => ({ ...switchItem, activated: false })),
      doors: (level.doors || []).map((door) => ({ ...door, open: false })),
      portals: level.portals.map((portal) => ({ ...portal })),
      arenaWalls: normalizeArenaWalls(level.arenaWalls),
    };
  }

  function cloneLevelObstacles(level) {
    return level.obstacles.map((obstacle) => ({
      ...obstacle,
      path: obstacle.path ? { ...obstacle.path } : undefined,
      originX: obstacle.x,
      originY: obstacle.y,
      vx: 0,
      vy: 0,
      phase: obstacle.phase || 0,
    }));
  }

  function obstacleRestitution(obstacle) {
    if (obstacle.material === 'sticky') return 0;
    return obstacle.material === 'boost' ? 1.22 : 0.94;
  }

  function activeDoorObstacles(doors = state.doors) {
    return (doors || []).filter((door) => !door.open).map((door) => ({
      ...door,
      role: 'door',
      shape: 'rect',
      material: 'normal',
    }));
  }

  function triggerSwitch(switchItem, doors = state.doors) {
    if (switchItem.activated) return false;
    switchItem.activated = true;
    doors.forEach((door) => {
      if (door.color === switchItem.color) door.open = true;
    });
    return true;
  }

  function updateSwitchHits(ball, switches = state.switches, doors = state.doors, events = state.shotEvents) {
    let hit = false;
    switches.forEach((switchItem) => {
      if (switchItem.activated) return;
      if (Math.hypot(ball.x - switchItem.x, ball.y - switchItem.y) <= switchItem.radius + ball.radius) {
        if (triggerSwitch(switchItem, doors)) {
          hit = true;
          if (events) events.switchHits.add(switchItem.id);
        }
      }
    });
    return hit;
  }

  function cloneLevelLaunchers(level) {
    return level.launchers.map((launcher) => ({ ...launcher, power: fixedLauncherPower }));
  }

  function cloneRelayLaunchers(level) {
    return (level.relayLaunchers || []).map((launcher) => ({ ...launcher, power: fixedLauncherPower }));
  }

  function cloneSwitches(level) {
    return (level.switches || []).map((switchItem) => ({ ...switchItem, activated: false }));
  }

  function cloneDoors(level) {
    return (level.doors || []).map((door) => ({ ...door, open: false, shape: 'rect', material: 'normal' }));
  }

  function level() {
    if (state.testLevel) return state.testLevel;
    return allLevels()[state.levelIndex] || allLevels()[0];
  }

  function activeLauncher() {
    return state.launchers[state.activeLauncherIndex] || state.launchers[0];
  }

  function shotLauncher() {
    return activeLauncher();
  }

  function selectedLauncher() {
    if (state.selectedDeviceType === 'relay' && state.relayLaunchers[state.selectedRelayIndex]) {
      return state.relayLaunchers[state.selectedRelayIndex];
    }
    return activeLauncher();
  }

  function setStatus(text, tone) {
    ui.status.textContent = text;
    ui.status.style.borderLeftColor = tone || 'var(--blue)';
  }

  function setEditorStatus(text, tone) {
    ui.editorStatus.textContent = text;
    ui.editorStatus.style.borderLeftColor = tone || 'var(--blue)';
  }

  function ensureAudio() {
    if (!audio.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio.context = new AudioContext();
    }
    if (audio.context.state === 'suspended') audio.context.resume();
    audio.unlocked = true;
    return audio.context;
  }

  function playTone({ frequency, start = 0, duration = 0.08, type = 'sine', gain = 0.08, endFrequency }) {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime + start;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    const outputGain = Math.min(gain * soundVolume, 0.24);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(outputGain, now + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function playSound(name) {
    if (name === 'shoot') {
      playTone({ frequency: 150, endFrequency: 92, duration: 0.11, type: 'triangle', gain: 0.11 });
    } else if (name === 'impact') {
      playTone({ frequency: 290, endFrequency: 180, duration: 0.055, type: 'square', gain: 0.045 });
    } else if (name === 'portal') {
      playTone({ frequency: 360, endFrequency: 760, duration: 0.13, type: 'sine', gain: 0.07 });
      playTone({ frequency: 180, start: 0.035, endFrequency: 420, duration: 0.12, type: 'triangle', gain: 0.045 });
    } else if (name === 'relay') {
      playTone({ frequency: 260, endFrequency: 520, duration: 0.12, type: 'triangle', gain: 0.075 });
      playTone({ frequency: 620, start: 0.06, duration: 0.08, type: 'sine', gain: 0.045 });
    } else if (name === 'success') {
      playTone({ frequency: 523.25, duration: 0.13, type: 'sine', gain: 0.08 });
      playTone({ frequency: 659.25, start: 0.09, duration: 0.13, type: 'sine', gain: 0.08 });
      playTone({ frequency: 783.99, start: 0.18, duration: 0.22, type: 'triangle', gain: 0.095 });
    }
  }

  function selectStartLauncher(index = 0) {
    state.selectedDeviceType = 'start';
    state.activeLauncherIndex = clamp(index, 0, state.launchers.length - 1);
    syncControlsFromLauncher();
    syncUi();
  }

  function selectRelayLauncher(index = 0) {
    if (!state.relayLaunchers[index]) return;
    state.selectedDeviceType = 'relay';
    state.selectedRelayIndex = index;
    syncControlsFromLauncher();
    syncUi();
  }

  function syncControlsFromLauncher() {
    const launcher = selectedLauncher();
    launcher.power = fixedLauncherPower;
    ui.angle.value = String(Math.round(launcher.angle));
    ui.power.value = String(fixedLauncherPower);
    ui.previewLength.value = String(state.previewDistance);
  }

  function syncLevelMenu() {
    ui.levelGrid.innerHTML = '';
    allLevels().forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-card';
      if (index === state.levelIndex) button.classList.add('current');
      if (state.completedLevels.has(index)) button.classList.add('completed');
      if (item.custom) button.classList.add('custom');
      button.innerHTML = `<strong>${item.order}</strong><span>${item.custom ? '自定义' : item.focus}</span>`;
      button.addEventListener('click', () => {
        ensureAudio();
        startLevel(index);
      });
      ui.levelGrid.append(button);
    });
  }

  function syncUi() {
    const current = level();
    const launcher = selectedLauncher();
    const levels = allLevels();
    ui.levelNumber.textContent = String(state.levelIndex + 1);
    ui.levelName.textContent = current.name;
    ui.levelFocus.textContent = current.focus;
    ui.shotCount.textContent = String(state.shots);
    ui.launcherName.textContent = launcher.id;
    ui.openMenu.textContent = '返回关卡菜单';
    ui.angleValue.textContent = `${Math.round(launcher.angle)}°`;
    launcher.power = fixedLauncherPower;
    ui.powerValue.textContent = String(fixedLauncherPower);
    ui.previewLengthValue.textContent = String(Math.round(state.previewDistance));
    ui.power.disabled = state.selectedDeviceType === 'relay';
    ui.prevLevel.disabled = Boolean(state.testLevel) || state.levelIndex === 0;
    ui.nextLevel.disabled = Boolean(state.testLevel) || state.levelIndex === levels.length - 1;
    ui.shoot.disabled = state.mode !== 'play' || Boolean(state.ball && state.ball.active) || state.completed;

    ui.launcherButtons.innerHTML = '';
    state.launchers.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.id;
      button.className = state.selectedDeviceType === 'start' && index === state.activeLauncherIndex ? 'active' : '';
      button.addEventListener('click', () => {
        if (state.ball && state.ball.active) return;
        selectStartLauncher(index);
        setStatus(`${item.id} 已选中。拖动画布调整方向，力度固定为 700。`, 'var(--blue)');
      });
      ui.launcherButtons.append(button);
    });
    state.relayLaunchers.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.id;
      button.className = `relay ${state.selectedDeviceType === 'relay' && index === state.selectedRelayIndex ? 'active' : ''}`;
      button.addEventListener('click', () => {
        if (state.ball && state.ball.active) return;
        selectRelayLauncher(index);
        setStatus(`${item.id} 已选中。它的位置固定，只能调整方向，力度固定为 700。`, 'var(--amber)');
      });
      ui.launcherButtons.append(button);
    });
    syncLevelMenu();
  }

  function hideCompletionPrompt() {
    state.completionResult = null;
    ui.dialog.classList.add('hidden');
  }

  function openStartScreen() {
    state.mode = 'start';
    state.testLevel = null;
    state.draggingAim = false;
    state.ball = null;
    hideCompletionPrompt();
    ui.startExitStatus.textContent = '';
    ui.startScreen.classList.remove('hidden');
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.add('menu-open');
    ui.playPanel.classList.remove('hidden');
    ui.editorPanel.classList.add('hidden');
  }

  function openLevelMenu() {
    state.mode = 'menu';
    state.testLevel = null;
    state.draggingAim = false;
    state.ball = null;
    hideCompletionPrompt();
    ui.startScreen.classList.add('hidden');
    ui.levelMenu.classList.remove('hidden');
    ui.shell.classList.add('menu-open');
    ui.playPanel.classList.remove('hidden');
    ui.editorPanel.classList.add('hidden');
    syncUi();
  }

  function startLevel(index) {
    state.mode = 'play';
    state.testLevel = null;
    ui.startScreen.classList.add('hidden');
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.remove('hidden');
    ui.editorPanel.classList.add('hidden');
    setLevel(index);
    canvas.focus({ preventScroll: true });
  }

  function openEditor(levelId = null) {
    state.mode = 'editor';
    state.testLevel = null;
    state.ball = null;
    hideCompletionPrompt();
    ui.startScreen.classList.add('hidden');
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.add('hidden');
    ui.editorPanel.classList.remove('hidden');
    if (levelId) {
      const custom = state.customLevels.find((item) => item.id === levelId);
      if (custom) {
        state.editor.draft = levelToDraft(custom);
        state.editor.savedId = custom.id;
      }
    }
    state.editor.selected = { type: 'launcher', index: 0 };
    ui.editorLevelName.value = state.editor.draft.name;
    setEditorStatus('选择组件后，在画布中拖动摆放。保存后会加入关卡菜单。', 'var(--blue)');
    syncEditorUi();
  }

  function showCompletionPrompt() {
    const result = buildCompletionResult({
      levelIndex: state.levelIndex,
      levelCount: allLevels().length,
      shots: state.shots,
    });
    state.completedLevels.add(state.levelIndex);
    state.completionResult = result;
    ui.completeTitle.textContent = result.title;
    ui.completeBody.textContent = result.body;
    ui.continueLevel.textContent = result.primaryLabel;
    ui.replayLevel.textContent = result.secondaryLabel;
    ui.dialog.classList.remove('hidden');
    ui.continueLevel.focus();
    syncLevelMenu();
  }

  function spawnSuccessEffect() {
    const target = level().target;
    state.successPulse = { x: target.x, y: target.y, age: 0, duration: 0.9 };
    for (let i = 0; i < 34; i += 1) {
      const angle = (Math.PI * 2 * i) / 34;
      const speed = 90 + (i % 7) * 22;
      state.effects.push({
        x: target.x,
        y: target.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        duration: 0.7 + (i % 5) * 0.05,
        radius: 3 + (i % 4),
        color: i % 3 === 0 ? '#41d692' : i % 3 === 1 ? '#ffbf47' : '#55a7ff',
      });
    }
  }

  function resetLevel(keepStatus) {
    state.ball = null;
    state.shots = 0;
    state.completed = false;
    state.effects = [];
    state.successPulse = null;
    state.launchers = cloneLevelLaunchers(level());
    state.relayLaunchers = cloneRelayLaunchers(level());
    state.obstacles = cloneLevelObstacles(level());
    state.switches = cloneSwitches(level());
    state.doors = cloneDoors(level());
    state.activeLauncherIndex = 0;
    if (state.selectedDeviceType === 'relay' && !state.relayLaunchers[state.selectedRelayIndex]) {
      state.selectedDeviceType = 'start';
      state.selectedRelayIndex = 0;
    }
    state.shotEvents = null;
    hideCompletionPrompt();
    syncControlsFromLauncher();
    if (!keepStatus) setStatus(level().hint, 'var(--blue)');
    syncUi();
  }

  function setLevel(index) {
    state.levelIndex = clamp(index, 0, allLevels().length - 1);
    state.activeLauncherIndex = 0;
    state.selectedDeviceType = 'start';
    state.selectedRelayIndex = 0;
    resetLevel();
  }

  function launcherVector(launcher = selectedLauncher()) {
    const radians = launcher.angle * Math.PI / 180;
    return { x: Math.cos(radians), y: Math.sin(radians), speed: launcher.power };
  }

  function shoot() {
    if (state.mode !== 'play') return;
    if (state.ball && state.ball.active) return;
    if (state.completed) return;
    ensureAudio();
    const launcher = shotLauncher();
    launcher.power = fixedLauncherPower;
    const vector = launcherVector(launcher);
    state.ball = createBall({
      x: launcher.x,
      y: launcher.y,
      vx: vector.x * vector.speed,
      vy: vector.y * vector.speed,
      radius: 9,
    });
    state.ball.active = true;
    state.ball.originLauncherId = launcher.id;
    state.ball.launcherCooldown = 0.18;
    state.shots += 1;
    if (!state.shotEvents) {
      state.shotEvents = {
        wallBounces: 0,
        obstacleBounces: new Set(),
        teleports: new Set(),
        relayLaunches: new Set(),
        switchHits: new Set(),
        launcherReturns: 0,
        hitMovingObstacle: false,
      };
    }
    playSound('shoot');
    setStatus('飞行中。观察短预线之外的真实反弹，再微调下一次发射。', 'var(--amber)');
    syncUi();
  }

  function screenToWorld(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  function relayAtPoint(point) {
    return state.relayLaunchers.findIndex((relay) => (
      Math.hypot(point.x - relay.x, point.y - relay.y) <= (relay.radius || 22) + 12
    ));
  }

  function moveSelectedRelayFromPointer(event) {
    const relay = state.relayLaunchers[state.selectedRelayIndex];
    if (!relay) return;
    const point = screenToWorld(event);
    const radius = relay.radius || 22;
    relay.x = clamp(point.x - state.dragOffset.x, arena.x + radius, arena.x + arena.width - radius);
    relay.y = clamp(point.y - state.dragOffset.y, arena.y + radius, arena.y + arena.height - radius);
    syncUi();
  }

  function updateAimFromPointer(event) {
    if (state.mode !== 'play') return;
    const launcher = selectedLauncher();
    const point = screenToWorld(event);
    const angle = Math.atan2(point.y - launcher.y, point.x - launcher.x) * 180 / Math.PI;
    launcher.angle = Math.round(clamp(angle, -180, 180));
    launcher.power = fixedLauncherPower;
    syncControlsFromLauncher();
    syncUi();
  }

  function update(dt) {
    const current = level();
    state.obstacles.forEach((obstacle) => updateMovingObstacle(obstacle, dt));
    state.effects.forEach((effect) => {
      effect.age += dt;
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 180 * dt;
    });
    state.effects = state.effects.filter((effect) => effect.age < effect.duration);
    if (state.successPulse) {
      state.successPulse.age += dt;
      if (state.successPulse.age >= state.successPulse.duration) state.successPulse = null;
    }
    if (state.mode !== 'play') return;
    if (!state.ball || !state.ball.active) return;

    const previous = { x: state.ball.x, y: state.ball.y };
    stepBall(state.ball, dt);
    const wallResult = resolveArenaWalls(state.ball, arena, arenaWallModes(current), 0.96);
    const wallBounced = wallResult.bounced;
    if (wallBounced && state.shotEvents) state.shotEvents.wallBounces += 1;

    if (wallResult.stuck) {
      state.ball.active = false;
      setStatus('碰到咖啡色卸力边界，球被吸住了。这个关卡不能依赖这条外框反弹。', 'var(--red)');
      playSound('impact');
      syncUi();
      return;
    }

    let obstacleBounced = false;
    let stickyHit = false;
    state.obstacles.concat(activeDoorObstacles()).forEach((obstacle) => {
      const hitObstacle = resolveShapedObstacleBounce(state.ball, obstacle, obstacleRestitution(obstacle));
      if (hitObstacle && state.shotEvents) {
        state.shotEvents.obstacleBounces.add(obstacle.id);
        if (obstacle.path) state.shotEvents.hitMovingObstacle = true;
      }
      if (hitObstacle && obstacle.material === 'sticky') stickyHit = true;
      obstacleBounced = hitObstacle || obstacleBounced;
    });

    if (stickyHit) {
      state.ball.active = false;
      setStatus('碰到咖啡色卸力墙，球被吸住了。避开这片区域再试。', 'var(--red)');
      playSound('impact');
      syncUi();
      return;
    }

    const switchHit = updateSwitchHits(state.ball);

    const beforePortal = { x: state.ball.x, y: state.ball.y };
    const teleported = tryTeleport(state.ball, current.portals);
    if (teleported && state.shotEvents) {
      const entry = current.portals.find((portal) => (
        Math.hypot(beforePortal.x - portal.x, beforePortal.y - portal.y) <= portal.radius + state.ball.radius
      ));
      if (entry) state.shotEvents.teleports.add(entry.id);
    }

    const relayed = tryRelayLaunch(state.ball, state.relayLaunchers);
    if (relayed && state.shotEvents) {
      state.shotEvents.relayLaunches.add(relayed.id);
      state.effects.push({ x: relayed.x, y: relayed.y, vx: 0, vy: 0, age: 0, duration: 0.42, radius: 18, color: relayColor });
    }

    const capturedLauncher = tryLauncherCapture(state.ball, state.launchers);
    if (capturedLauncher) {
      const capturedIndex = state.launchers.findIndex((launcher) => launcher.id === capturedLauncher.id);
      if (capturedIndex >= 0) {
        state.activeLauncherIndex = capturedIndex;
        state.selectedDeviceType = 'start';
      }
      if (state.shotEvents) state.shotEvents.launcherReturns += 1;
      playSound('relay');
      setStatus(`${capturedLauncher.id} 接住了球。开关和门不会重置，调整方向后可以再次发射。`, 'var(--green)');
      syncControlsFromLauncher();
      syncUi();
      return;
    }

    if (switchHit) playSound('success');
    else if (relayed) playSound('relay');
    else if (teleported) playSound('portal');
    else if ((wallBounced || obstacleBounced) && performance.now() - state.lastImpactSoundAt > 70) {
      state.lastImpactSoundAt = performance.now();
      playSound('impact');
    }

    state.ball.vx *= 0.998;
    state.ball.vy *= 0.998;
    state.ball.trail.push({ x: state.ball.x, y: state.ball.y });
    if (state.ball.trail.length > 44) state.ball.trail.shift();

    if (targetHitThisFrame(previous, state.ball, current.target, state.ball.radius, teleported || Boolean(relayed))) {
      const mechanicResult = shotMeetsRequiredMechanics({ requiredMechanics: current.requiredMechanics, events: state.shotEvents });
      if (!mechanicResult.ok) {
        state.ball.active = false;
        setStatus(`碰到 B 点了，但还缺少：${mechanicResult.missing.join('、')}。`, 'var(--red)');
        syncUi();
        return;
      }
      state.ball.active = false;
      state.completed = true;
      spawnSuccessEffect();
      playSound('success');
      setStatus(`命中 B 点，用了 ${state.shots} 次发射。`, 'var(--green)');
      showCompletionPrompt();
      syncUi();
      return;
    }

    if (Math.hypot(state.ball.vx, state.ball.vy) < 28) {
      state.ball.active = false;
      setStatus('球停下了。调整方向再试一次。', 'var(--red)');
      syncUi();
    }
  }

  function simulatePreview(launcher, levelData, obstacleData, relayData, options = {}) {
    const vector = launcherVector(launcher);
    const ball = createBall({ x: launcher.x, y: launcher.y, vx: vector.x * vector.speed, vy: vector.y * vector.speed, radius: 9 });
    ball.originLauncherId = launcher.id;
    ball.launcherCooldown = 0.18;
    const previewObstacles = obstacleData.map((obstacle) => ({ ...obstacle, path: obstacle.path ? { ...obstacle.path } : undefined }));
    const previewSwitches = (levelData.switches || []).map((switchItem) => ({ ...switchItem, activated: false }));
    const previewDoors = (levelData.doors || []).map((door) => ({ ...door, open: false }));
    const points = [{ x: ball.x, y: ball.y }];
    let travelled = 0;
    for (let i = 0; i < 110 && travelled < state.previewDistance; i += 1) {
      const dt = 1 / 60;
      previewObstacles.forEach((obstacle) => updateMovingObstacle(obstacle, dt));
      const previous = { x: ball.x, y: ball.y };
      stepBall(ball, dt);
      const wallResult = resolveArenaWalls(ball, arena, arenaWallModes(levelData), 0.96);
      if (wallResult.stuck) {
        points.push({ x: ball.x, y: ball.y });
        break;
      }
      let previewStickyHit = false;
      previewObstacles.concat(activeDoorObstacles(previewDoors)).forEach((obstacle) => {
        if (resolveShapedObstacleBounce(ball, obstacle, obstacleRestitution(obstacle)) && obstacle.material === 'sticky') {
          previewStickyHit = true;
        }
      });
      if (previewStickyHit) {
        points.push({ x: ball.x, y: ball.y });
        break;
      }
      updateSwitchHits(ball, previewSwitches, previewDoors, null);
      const teleported = tryTeleport(ball, levelData.portals);
      if (teleported) points.push({ break: true });
      if (options.includeRelays) {
        const relayed = tryRelayLaunch(ball, relayData);
        if (relayed) points.push({ break: true });
      }
      if (tryLauncherCapture(ball, levelData.launchers || [])) {
        points.push({ x: ball.x, y: ball.y });
        break;
      }
      ball.vx *= 0.998;
      ball.vy *= 0.998;
      travelled += Math.hypot(ball.x - previous.x, ball.y - previous.y);
      if (i % 3 === 0) points.push({ x: ball.x, y: ball.y });
      if (targetHitThisFrame(previous, ball, levelData.target, ball.radius, teleported)) break;
      if (Math.hypot(ball.vx, ball.vy) < 28) break;
    }
    return points;
  }

  function roundRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function traceObstacleShape(obstacle) {
    ctx.beginPath();
    if (obstacle.shape === 'circle') {
      ctx.arc(obstacle.x, obstacle.y, obstacle.radius || 28, 0, Math.PI * 2);
    } else if (obstacle.shape === 'triangle') {
      const points = trianglePoints(obstacle);
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.lineTo(points[2].x, points[2].y);
      ctx.closePath();
    } else {
      if (obstacle.angle) {
        const points = rotatedRectPoints(obstacle);
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.closePath();
      } else {
        roundRectPath(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5);
      }
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(116, 137, 154, 0.11)';
    ctx.lineWidth = 1;
    for (let x = arena.x; x <= arena.x + arena.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, arena.y);
      ctx.lineTo(x, arena.y + arena.height);
      ctx.stroke();
    }
    for (let y = arena.y; y <= arena.y + arena.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(arena.x, y);
      ctx.lineTo(arena.x + arena.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawArenaWallSide(side, mode) {
    const sticky = mode === 'sticky';
    const color = sticky ? art.sticky : '#7e8e9d';
    const glow = sticky ? 'rgba(138, 90, 52, 0.38)' : 'rgba(126, 142, 157, 0.18)';
    const lineWidth = sticky ? 10 : 7;
    const x1 = side === 'right' ? arena.x + arena.width : arena.x;
    const y1 = side === 'bottom' ? arena.y + arena.height : arena.y;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = glow;
    ctx.shadowBlur = sticky ? 12 : 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    if (side === 'top' || side === 'bottom') {
      ctx.moveTo(arena.x, y1);
      ctx.lineTo(arena.x + arena.width, y1);
    } else {
      ctx.moveTo(x1, arena.y);
      ctx.lineTo(x1, arena.y + arena.height);
    }
    ctx.stroke();

    if (sticky) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 222, 180, 0.34)';
      ctx.lineWidth = 2;
      if (side === 'top' || side === 'bottom') {
        const y = side === 'top' ? arena.y + 8 : arena.y + arena.height - 8;
        for (let x = arena.x + 20; x < arena.x + arena.width - 8; x += 34) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 16, side === 'top' ? y + 10 : y - 10);
          ctx.stroke();
        }
      } else {
        const x = side === 'left' ? arena.x + 8 : arena.x + arena.width - 8;
        for (let y = arena.y + 20; y < arena.y + arena.height - 8; y += 34) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(side === 'left' ? x + 10 : x - 10, y + 16);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawArenaWallSides(levelData = level()) {
    const modes = arenaWallModes(levelData);
    ['top', 'right', 'bottom', 'left'].forEach((side) => drawArenaWallSide(side, modes[side]));
  }

  function drawArena(levelData = level()) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, '#0d1116');
    background.addColorStop(0.58, '#141a20');
    background.addColorStop(1, '#101316');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const floor = ctx.createLinearGradient(arena.x, arena.y, arena.x, arena.y + arena.height);
    floor.addColorStop(0, '#1a232b');
    floor.addColorStop(1, '#12191f');
    ctx.fillStyle = floor;
    ctx.fillRect(arena.x, arena.y, arena.width, arena.height);
    drawGrid();
    drawArenaWallSides(levelData);
    ctx.strokeStyle = 'rgba(65, 214, 146, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(arena.x + 12, arena.y + 12, arena.width - 24, arena.height - 24);
  }

  function drawTarget(target = level().target, selected = false) {
    const pulse = 0.5 + Math.sin(performance.now() / 260) * 0.5;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = `rgba(65, 214, 146, ${selected ? 0.28 : 0.12 + pulse * 0.04})`;
    ctx.beginPath();
    ctx.arc(0, 0, target.radius + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = art.target;
    ctx.lineWidth = selected ? 6 : 4;
    ctx.beginPath();
    ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,247,251,0.34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, target.radius + 7, 0.2, Math.PI * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-target.radius - 10, 0);
    ctx.lineTo(-target.radius - 3, 0);
    ctx.moveTo(target.radius + 3, 0);
    ctx.lineTo(target.radius + 10, 0);
    ctx.moveTo(0, -target.radius - 10);
    ctx.lineTo(0, -target.radius - 3);
    ctx.moveTo(0, target.radius + 3);
    ctx.lineTo(0, target.radius + 10);
    ctx.stroke();
    ctx.fillStyle = '#f4f7fb';
    ctx.font = '700 18px Microsoft YaHei, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', 0, 1);
    ctx.restore();
  }

  function drawLauncherShape(launcher, color, label, active = false) {
    const radians = launcher.angle * Math.PI / 180;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 18 : 7;
    ctx.fillStyle = 'rgba(244,247,251,0.08)';
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, active ? 27 : 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(launcher.x, launcher.y);
    ctx.rotate(radians);
    const barrel = ctx.createLinearGradient(0, -8, 38, 8);
    barrel.addColorStop(0, color);
    barrel.addColorStop(1, '#f4f7fb');
    ctx.fillStyle = barrel;
    roundRectPath(0, -7, 36, 14, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(7, 18, 13, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(27, -13);
    ctx.lineTo(27, 13);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    ctx.save();
    const base = ctx.createRadialGradient(launcher.x - 5, launcher.y - 6, 3, launcher.x, launcher.y, active ? 21 : 17);
    base.addColorStop(0, '#f4f7fb');
    base.addColorStop(0.2, color);
    base.addColorStop(1, '#182027');
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, active ? 17 : (launcher.radius || 14), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = active ? '#f4f7fb' : 'rgba(255,255,255,0.24)';
    ctx.lineWidth = active ? 3 : 1;
    ctx.stroke();
    ctx.fillStyle = '#07120d';
    ctx.font = '800 13px Microsoft YaHei, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, launcher.x, launcher.y + 1);
    ctx.restore();
  }

  function obstacleColor(obstacle) {
    if (obstacle.material === 'boost') return art.boost;
    if (obstacle.material === 'sticky') return art.sticky;
    if (obstacle.path) return art.moving;
    return art.metal;
  }

  function obstacleBounds(obstacle) {
    if (obstacle.shape === 'circle') {
      const radius = obstacle.radius || 28;
      return { x: obstacle.x - radius, y: obstacle.y - radius, width: radius * 2, height: radius * 2 };
    }
    if (obstacle.shape === 'triangle') {
      const points = trianglePoints(obstacle);
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
    if (obstacle.angle) {
      const points = rotatedRectPoints(obstacle);
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
    return { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
  }

  function drawObstacleShape(obstacle, fillStyle) {
    const bounds = obstacleBounds(obstacle);
    const isBoost = obstacle.material === 'boost';
    const isSticky = obstacle.material === 'sticky';
    const gradient = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);
    gradient.addColorStop(0, fillStyle);
    gradient.addColorStop(1, isBoost ? '#6735a8' : isSticky ? art.stickyDark : art.metalDark);
    ctx.fillStyle = gradient;
    traceObstacleShape(obstacle);
    ctx.fill();
    ctx.strokeStyle = isBoost ? 'rgba(103,240,255,0.75)' : isSticky ? 'rgba(255, 214, 150, 0.82)' : 'rgba(244,247,251,0.24)';
    ctx.lineWidth = isSticky ? 3 : 2;
    ctx.stroke();

    ctx.save();
    traceObstacleShape(obstacle);
    ctx.clip();
    ctx.globalAlpha = isBoost ? 0.82 : isSticky ? 0.72 : 0.36;
    ctx.strokeStyle = isBoost ? art.boostCore : isSticky ? 'rgba(46, 26, 13, 0.72)' : 'rgba(244,247,251,0.28)';
    ctx.lineWidth = isBoost ? 3 : isSticky ? 4 : 1;
    const step = isBoost ? 22 : isSticky ? 20 : 18;
    for (let x = bounds.x - bounds.height; x < bounds.x + bounds.width + bounds.height; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.y + bounds.height + 8);
      ctx.lineTo(x + bounds.height, bounds.y - 8);
      ctx.stroke();
    }
    if (isSticky) {
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = 'rgba(255, 214, 150, 0.78)';
      ctx.font = `800 ${Math.max(13, Math.min(22, bounds.height * 0.42))}px Microsoft YaHei, Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('停', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 1);
    }
    if (obstacle.path) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(7, 18, 13, 0.42)';
      ctx.beginPath();
      ctx.arc(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, Math.min(12, bounds.width / 3, bounds.height / 3), 0, Math.PI * 2);
      ctx.fill();
    }
    if (obstacle.shape === 'circle') {
      const radius = obstacle.radius || 28;
      const angle = (obstacle.angle || 0) * Math.PI / 180;
      ctx.globalAlpha = 0.88;
      ctx.strokeStyle = obstacle.material === 'boost' ? art.boostCore : 'rgba(244,247,251,0.58)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(obstacle.x, obstacle.y);
      ctx.lineTo(obstacle.x + Math.cos(angle) * radius * 0.72, obstacle.y + Math.sin(angle) * radius * 0.72);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(obstacle.x + Math.cos(angle) * radius * 0.78, obstacle.y + Math.sin(angle) * radius * 0.78, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawObstacles(obstacles = state.obstacles, selected = null) {
    obstacles.forEach((obstacle, index) => {
      const moving = Boolean(obstacle.path);
      const active = selected && selected.type === 'obstacle' && selected.index === index;
      const bounds = obstacleBounds(obstacle);
      ctx.save();
      if (moving) {
        const originX = obstacle.originX || obstacle.x;
        const originY = obstacle.originY || obstacle.y;
        const centerOffsetX = obstacle.shape === 'rect' || !obstacle.shape ? obstacle.width / 2 : 0;
        const centerOffsetY = obstacle.shape === 'rect' || !obstacle.shape ? obstacle.height / 2 : 0;
        ctx.strokeStyle = active ? 'rgba(255, 191, 71, 0.82)' : 'rgba(255, 191, 71, 0.32)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 9]);
        ctx.beginPath();
        ctx.moveTo(originX + centerOffsetX, originY + centerOffsetY);
        ctx.lineTo(originX + centerOffsetX + obstacle.path.x, originY + centerOffsetY + obstacle.path.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 191, 71, 0.18)';
        ctx.beginPath();
        ctx.arc(originX + centerOffsetX, originY + centerOffsetY, 5, 0, Math.PI * 2);
        ctx.arc(originX + centerOffsetX + obstacle.path.x, originY + centerOffsetY + obstacle.path.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowColor = obstacle.material === 'boost' ? art.boost : obstacle.material === 'sticky' ? art.sticky : (moving ? art.moving : '#000');
      ctx.shadowBlur = obstacle.material === 'boost' ? 12 : obstacle.material === 'sticky' ? 9 : (moving ? 8 : 2);
      drawObstacleShape(obstacle, obstacleColor(obstacle));
      if (active) {
        ctx.strokeStyle = '#f4f7fb';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
      }
      ctx.restore();
    });
  }

  function drawPortals(portals = level().portals, selected = null) {
    portals.forEach((portal, index) => {
      const color = portal.id.includes('blue') ? art.bluePortal : art.orangePortal;
      const active = selected && selected.type === 'portal' && selected.index === index;
      const spin = performance.now() / 520 + index * Math.PI;
      ctx.save();
      ctx.translate(portal.x, portal.y);
      ctx.shadowColor = color;
      ctx.shadowBlur = active ? 20 : 12;
      ctx.fillStyle = portal.id.includes('blue') ? 'rgba(85, 167, 255, 0.08)' : 'rgba(255, 143, 87, 0.08)';
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = active ? 7 : 5;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(spin);
      ctx.strokeStyle = '#f4f7fb';
      ctx.globalAlpha = active ? 0.86 : 0.62;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius + 7, 0, Math.PI * 0.62);
      ctx.stroke();
      ctx.strokeStyle = active ? '#f4f7fb' : 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, portal.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      if (Number.isFinite(portal.exitAngle)) {
        ctx.rotate(portal.exitAngle - spin);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(portal.radius + 12, 0);
        ctx.lineTo(portal.radius + 1, -6);
        ctx.lineTo(portal.radius + 1, 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawSwitches(switches = state.switches, selected = null) {
    switches.forEach((switchItem, index) => {
      const active = selected && selected.type === 'switch' && selected.index === index;
      const radius = switchItem.radius || 18;
      const isOn = Boolean(switchItem.activated);
      const pulse = 0.5 + Math.sin(performance.now() / 360 + index * 0.8) * 0.5;
      const glowAlpha = isOn ? 0.5 + pulse * 0.32 : 0.24 + pulse * 0.22;
      ctx.save();
      ctx.translate(switchItem.x, switchItem.y);
      ctx.shadowColor = art.red;
      ctx.shadowBlur = active ? 24 : isOn ? 18 + pulse * 8 : 10 + pulse * 7;
      ctx.fillStyle = `rgba(255, 48, 54, ${glowAlpha * 0.22})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 18 + pulse * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(38, 6, 8, 0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, radius + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 214, 170, ${0.46 + pulse * 0.34})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 6, -Math.PI / 2, Math.PI * (1.45 + pulse * 0.25));
      ctx.stroke();
      const button = ctx.createRadialGradient(-6, -8, 2, 0, 0, radius);
      button.addColorStop(0, isOn ? '#fff4da' : '#ffd0ca');
      button.addColorStop(0.28, isOn ? '#ffbc4e' : '#ff5b5f');
      button.addColorStop(0.7, isOn ? '#ff3d35' : '#c6202b');
      button.addColorStop(1, isOn ? '#9a1419' : '#5b0d13');
      ctx.fillStyle = button;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? '#f4f7fb' : isOn ? '#ffe59e' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = active ? 4 : 2.5;
      ctx.stroke();
      ctx.fillStyle = isOn ? '#fff8dd' : '#fff7f5';
      ctx.font = `900 ${isOn ? 10 : 9}px Microsoft YaHei, Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isOn ? 'ON' : 'OFF', 0, 1);
      ctx.fillStyle = `rgba(255, 235, 190, ${0.38 + pulse * 0.32})`;
      ctx.beginPath();
      ctx.arc(-radius * 0.32, -radius * 0.38, Math.max(3, radius * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSwitchDoorLinks(switches = state.switches, doors = state.doors) {
    switches.forEach((switchItem, switchIndex) => {
      const linkedDoors = doors.filter((door) => door.color === switchItem.color);
      linkedDoors.forEach((door, doorIndex) => {
        const pulse = 0.5 + Math.sin(performance.now() / 420 + switchIndex + doorIndex * 0.7) * 0.5;
        const doorCenter = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
        const alpha = switchItem.activated ? 0.42 + pulse * 0.28 : 0.16 + pulse * 0.18;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 66, 74, ${alpha})`;
        ctx.lineWidth = switchItem.activated ? 4 : 3;
        ctx.setLineDash(switchItem.activated ? [12, 8] : [5, 12]);
        ctx.lineDashOffset = -performance.now() / (switchItem.activated ? 42 : 72);
        ctx.beginPath();
        ctx.moveTo(switchItem.x, switchItem.y);
        ctx.lineTo(doorCenter.x, doorCenter.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255, 206, 128, ${alpha + 0.18})`;
        ctx.beginPath();
        ctx.arc(doorCenter.x, doorCenter.y, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });
  }

  function drawDoors(doors = state.doors, selected = null) {
    doors.forEach((door, index) => {
      const active = selected && selected.type === 'door' && selected.index === index;
      const pulse = 0.5 + Math.sin(performance.now() / 380 + index * 0.9) * 0.5;
      ctx.save();
      ctx.globalAlpha = door.open ? 0.34 : 1;
      ctx.shadowColor = art.red;
      ctx.shadowBlur = door.open ? 9 + pulse * 8 : 16 + pulse * 7;
      const body = ctx.createLinearGradient(door.x, door.y, door.x + door.width, door.y + door.height);
      body.addColorStop(0, door.open ? '#ffcf77' : '#ff8d7f');
      body.addColorStop(0.42, door.open ? '#ff4f45' : '#e43238');
      body.addColorStop(1, door.open ? '#741012' : '#5f0e12');
      ctx.fillStyle = body;
      roundRectPath(door.x, door.y, door.width, door.height, 5);
      ctx.fill();
      ctx.strokeStyle = active ? '#f4f7fb' : `rgba(255, 224, 154, ${door.open ? 0.8 : 0.48 + pulse * 0.32})`;
      ctx.lineWidth = active ? 4 : 2.5;
      ctx.stroke();
      ctx.save();
      roundRectPath(door.x, door.y, door.width, door.height, 5);
      ctx.clip();
      ctx.strokeStyle = door.open ? `rgba(255, 237, 196, ${0.38 + pulse * 0.28})` : 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 3;
      for (let y = door.y + 8; y < door.y + door.height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(door.x + 5, y);
        ctx.lineTo(door.x + door.width - 5, y + 13);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = door.open ? 'rgba(255, 215, 135, 0.2)' : 'rgba(7,18,13,0.42)';
      ctx.fillRect(door.x + 6, door.y + 6, Math.max(4, door.width - 12), Math.max(4, door.height - 12));
      ctx.fillStyle = door.open ? '#fff2c1' : '#fff7f5';
      ctx.font = '900 10px Microsoft YaHei, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(door.open ? 'ON' : 'OFF', door.x + door.width / 2, door.y + door.height / 2);
      ctx.restore();
    });
  }

  function drawPreviewPath(points, color, alpha = 0.5) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    let needsMove = true;
    points.forEach((point, index) => {
      if (point.break) {
        needsMove = true;
        return;
      }
      if (index === 0 || needsMove) {
        ctx.moveTo(point.x, point.y);
        needsMove = false;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawPreview() {
    if (state.mode !== 'play') return;
    if (state.ball && state.ball.active) return;
    if (state.completed) return;
    const current = level();
    drawPreviewPath(
      simulatePreview(activeLauncher(), current, state.obstacles, state.relayLaunchers, { includeRelays: true }),
      '#41d692',
      state.selectedDeviceType === 'start' ? 0.68 : 0.38,
    );
    state.relayLaunchers.forEach((relay, index) => {
      drawPreviewPath(
        simulatePreview(relay, current, state.obstacles, state.relayLaunchers, { includeRelays: false }),
        relayColor,
        state.selectedDeviceType === 'relay' && state.selectedRelayIndex === index ? 0.74 : 0.4,
      );
    });
  }

  function drawLaunchers() {
    state.launchers.forEach((launcher, index) => {
      const active = state.selectedDeviceType === 'start' && index === state.activeLauncherIndex;
      drawLauncherShape(launcher, active ? '#41d692' : '#8a98a4', launcher.id.replace('A', ''), active);
    });
  }

  function drawRelayLaunchers() {
    state.relayLaunchers.forEach((launcher, index) => {
      const active = state.selectedDeviceType === 'relay' && state.selectedRelayIndex === index;
      ctx.save();
      ctx.strokeStyle = active ? relayGlow : 'rgba(155, 124, 255, 0.24)';
      ctx.lineWidth = active ? 4 : 3;
      ctx.beginPath();
      ctx.arc(launcher.x, launcher.y, (launcher.radius || 22) + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawLauncherShape(launcher, relayColor, launcher.id.replace('R', 'R'), active);
    });
  }

  function drawBall() {
    if (!state.ball) return;
    ctx.save();
    state.ball.trail.forEach((point, index) => {
      const alpha = index / state.ball.trail.length;
      ctx.fillStyle = `rgba(85, 167, 255, ${alpha * 0.34})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 + alpha * 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#f4f7fb';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#55a7ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawSuccessEffects() {
    if (state.successPulse) {
      const progress = state.successPulse.age / state.successPulse.duration;
      ctx.save();
      ctx.translate(state.successPulse.x, state.successPulse.y);
      ctx.strokeStyle = `rgba(65, 214, 146, ${1 - progress})`;
      ctx.lineWidth = 6 - progress * 3;
      ctx.beginPath();
      ctx.arc(0, 0, 28 + progress * 92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    state.effects.forEach((effect) => {
      const progress = effect.age / effect.duration;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * (1 - progress * 0.45), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawLabels() {
    ctx.save();
    ctx.fillStyle = 'rgba(244, 247, 251, 0.82)';
    ctx.font = '700 13px Microsoft YaHei, Segoe UI, sans-serif';
    if (state.mode === 'editor') {
      ctx.fillText('编辑模式：拖动组件摆放，右侧可精确修改数值', arena.x + 16, arena.y + 24);
    } else {
      ctx.fillText('A 点发射器', arena.x + 16, arena.y + 24);
      const stickySides = Object.values(arenaWallModes()).filter((mode) => mode === 'sticky').length;
      const wallTip = stickySides > 0 ? '咖啡色外框会卸力，尽量不要碰边界' : '普通外框可以反弹';
      ctx.fillText(state.relayLaunchers.length > 0 ? `R 是中继发射器：球碰进去后自动二次发射｜${wallTip}` : wallTip, arena.x + 424, arena.y + arena.height - 18);
    }
    ctx.restore();
  }

  function renderGame() {
    drawArena(level());
    drawPreview();
    drawPortals();
    drawObstacles();
    drawSwitchDoorLinks();
    drawDoors();
    drawSwitches();
    drawTarget();
    drawRelayLaunchers();
    drawLaunchers();
    drawBall();
    drawSuccessEffects();
    drawLabels();
  }

  function renderEditor() {
    const draft = state.editor.draft;
    const obstacles = draft.obstacles.map((obstacle) => ({
      ...obstacle,
      originX: obstacle.x,
      originY: obstacle.y,
      vx: 0,
      vy: 0,
      phase: obstacle.phase || 0,
    }));
    drawArena(draft);
    draft.launchers.forEach((launcher, index) => {
      drawPreviewPath(simulatePreview(launcher, draft, obstacles, draft.relayLaunchers, { includeRelays: true }), '#41d692', 0.45);
      drawLauncherShape(launcher, '#41d692', launcher.id.replace('A', ''), selectedIs('launcher', index));
    });
    draft.relayLaunchers.forEach((relay, index) => {
      drawPreviewPath(simulatePreview(relay, draft, obstacles, draft.relayLaunchers, { includeRelays: false }), relayColor, 0.5);
      drawLauncherShape(relay, relayColor, relay.id.replace('R', 'R'), selectedIs('relay', index));
    });
    drawPortals(draft.portals, state.editor.selected);
    drawObstacles(obstacles, state.editor.selected);
    drawSwitchDoorLinks(draft.switches, draft.doors);
    drawDoors(draft.doors, state.editor.selected);
    drawSwitches(draft.switches, state.editor.selected);
    drawTarget(draft.target, selectedIs('target', 0));
    drawLabels();
  }

  function render() {
    if (state.mode === 'editor') renderEditor();
    else renderGame();
  }

  function frame(timestamp) {
    const dt = Math.min((timestamp - state.lastTime) / 1000 || 0, 1 / 30);
    state.lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function selectedIs(type, index) {
    return state.editor.selected && state.editor.selected.type === type && state.editor.selected.index === index;
  }

  function getEditorObject(selection = state.editor.selected) {
    if (!selection) return null;
    const draft = state.editor.draft;
    if (selection.type === 'launcher') return draft.launchers[selection.index];
    if (selection.type === 'relay') return draft.relayLaunchers[selection.index];
    if (selection.type === 'target') return draft.target;
    if (selection.type === 'obstacle') return draft.obstacles[selection.index];
    if (selection.type === 'switch') return draft.switches[selection.index];
    if (selection.type === 'door') return draft.doors[selection.index];
    if (selection.type === 'portal') return draft.portals[selection.index];
    return null;
  }

  function editorSelectionLabel(selection = state.editor.selected) {
    if (!selection) return '未选择';
    if (selection.type === 'launcher') return state.editor.draft.launchers[selection.index]?.id || '发射器';
    if (selection.type === 'relay') return state.editor.draft.relayLaunchers[selection.index]?.id || '中继';
    if (selection.type === 'target') return 'B 目标';
    if (selection.type === 'obstacle') return state.editor.draft.obstacles[selection.index]?.role === 'movingGate' ? '移动机关' : '墙';
    if (selection.type === 'switch') return '红按钮';
    if (selection.type === 'door') return '红门';
    if (selection.type === 'portal') return state.editor.draft.portals[selection.index]?.id || '传送门';
    return '未选择';
  }

  function syncEditorUi() {
    const object = getEditorObject();
    ui.editorLevelName.value = state.editor.draft.name;
    ui.editorSelectedType.textContent = editorSelectionLabel();
    const hasObject = Boolean(object);
    ui.deleteEditorObject.classList.toggle('hidden', !hasObject || state.editor.selected.type === 'target');
    const launcherVisible = hasObject && (state.editor.selected.type === 'launcher' || state.editor.selected.type === 'relay');
    const obstacleVisible = hasObject && state.editor.selected.type === 'obstacle';
    const doorVisible = hasObject && state.editor.selected.type === 'door';
    const switchVisible = hasObject && state.editor.selected.type === 'switch';
    const circleVisible = (obstacleVisible && object.shape === 'circle') || switchVisible;
    const angleVisible = launcherVisible ||
      (hasObject && state.editor.selected.type === 'portal') ||
      obstacleVisible;
    const rectVisible = (hasObject && state.editor.selected.type === 'obstacle') || doorVisible;
    const movingVisible = rectVisible && object.path;
    document.querySelectorAll('.angle-prop').forEach((node) => node.classList.toggle('hidden', !angleVisible));
    document.querySelectorAll('.power-prop').forEach((node) => node.classList.add('hidden'));
    document.querySelectorAll('.rect-prop').forEach((node) => node.classList.toggle('hidden', !rectVisible || circleVisible));
    document.querySelectorAll('.circle-prop').forEach((node) => node.classList.toggle('hidden', !circleVisible));
    document.querySelectorAll('.material-prop').forEach((node) => node.classList.toggle('hidden', !obstacleVisible));
    document.querySelectorAll('.moving-prop').forEach((node) => node.classList.toggle('hidden', !movingVisible));
    [ui.editorX, ui.editorY, ui.editorWidth, ui.editorHeight, ui.editorRadius, ui.editorMaterial, ui.editorAngle, ui.editorPower, ui.editorPathX, ui.editorPathY, ui.editorSpeed].forEach((input) => {
      input.disabled = !hasObject;
    });
    if (object) {
      ui.editorX.value = Math.round(object.x);
      ui.editorY.value = Math.round(object.y);
      ui.editorWidth.value = Math.round(object.width || object.radius * 2 || 36);
      ui.editorHeight.value = Math.round(object.height || object.radius * 2 || 36);
      ui.editorRadius.value = Math.round(object.radius || Math.max(object.width || 0, object.height || 0) / 2 || 28);
      ui.editorMaterial.value = object.material || 'normal';
      ui.editorAngle.value = Math.round(object.angle || 0);
      if (state.editor.selected.type === 'portal') ui.editorAngle.value = Math.round((object.exitAngle || 0) * 180 / Math.PI);
      ui.editorPower.value = fixedLauncherPower;
      ui.editorPathX.value = Math.round(object.path?.x || 0);
      ui.editorPathY.value = Math.round(object.path?.y || 0);
      ui.editorSpeed.value = Number(object.speed || 1).toFixed(1);
    }
    ui.editorTools.forEach((button) => button.classList.toggle('active', button.dataset.editorTool === state.editor.tool));
    syncCustomLevelList();
  }

  function syncCustomLevelList() {
    ui.customLevelList.innerHTML = '';
    if (state.customLevels.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'eyebrow';
      empty.textContent = '暂无自定义关卡';
      ui.customLevelList.append(empty);
      return;
    }
    state.customLevels.forEach((custom) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${custom.order}. ${custom.name}`;
      button.addEventListener('click', () => openEditor(custom.id));
      ui.customLevelList.append(button);
    });
  }

  function clampEditorObject(object) {
    if (!object) return;
    const radius = object.radius || 0;
    if (object.shape === 'circle') {
      object.x = clamp(object.x, arena.x + radius, arena.x + arena.width - radius);
      object.y = clamp(object.y, arena.y + radius, arena.y + arena.height - radius);
      return;
    } else if (object.shape === 'triangle') {
      const bounds = obstacleBounds(object);
      if (bounds.x < arena.x) object.x += arena.x - bounds.x;
      if (bounds.y < arena.y) object.y += arena.y - bounds.y;
      if (bounds.x + bounds.width > arena.x + arena.width) object.x -= bounds.x + bounds.width - arena.x - arena.width;
      if (bounds.y + bounds.height > arena.y + arena.height) object.y -= bounds.y + bounds.height - arena.y - arena.height;
      return;
    } else if (object.width && object.height) {
      const bounds = obstacleBounds(object);
      if (bounds.width <= arena.width) {
        if (bounds.x < arena.x) object.x += arena.x - bounds.x;
        if (bounds.x + bounds.width > arena.x + arena.width) object.x -= bounds.x + bounds.width - arena.x - arena.width;
      } else {
        object.x = arena.x + (arena.width - object.width) / 2;
      }
      if (bounds.height <= arena.height) {
        if (bounds.y < arena.y) object.y += arena.y - bounds.y;
        if (bounds.y + bounds.height > arena.y + arena.height) object.y -= bounds.y + bounds.height - arena.y - arena.height;
      } else {
        object.y = arena.y + (arena.height - object.height) / 2;
      }
      return;
    } else {
      object.x = clamp(object.x, arena.x + radius, arena.x + arena.width - radius);
      object.y = clamp(object.y, arena.y + radius, arena.y + arena.height - radius);
    }
  }

  function addEditorObject(tool) {
    const draft = state.editor.draft;
    if (tool === 'start') {
      const id = `A${draft.launchers.length + 1}`;
      draft.launchers.push({ id, x: 128, y: 220 + draft.launchers.length * 72, angle: 0, power: fixedLauncherPower });
      state.editor.selected = { type: 'launcher', index: draft.launchers.length - 1 };
    } else if (tool === 'relay') {
      const id = `R${draft.relayLaunchers.length + 1}`;
      draft.relayLaunchers.push({ id, x: 420, y: 316, radius: 24, angle: -10, power: fixedLauncherPower, movable: true, purpose: '自定义中继发射器。' });
      state.editor.selected = { type: 'relay', index: draft.relayLaunchers.length - 1 };
    } else if (tool === 'target') {
      draft.target = { x: 820, y: 300, radius: 18 };
      state.editor.selected = { type: 'target', index: 0 };
    } else if (tool === 'wall') {
      draft.obstacles.push({ id: `wall-${draft.obstacles.length + 1}`, role: 'blocker', shape: 'rect', material: 'normal', purpose: '自定义墙。', x: 410, y: 260, width: 120, height: 36, angle: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'triangleWall') {
      draft.obstacles.push({ id: `tri-${draft.obstacles.length + 1}`, role: 'blocker', shape: 'triangle', material: 'normal', purpose: '自定义三角墙。', x: 470, y: 300, width: 110, height: 92, angle: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'circleWall') {
      draft.obstacles.push({ id: `circle-${draft.obstacles.length + 1}`, role: 'blocker', shape: 'circle', material: 'normal', purpose: '自定义圆形墙。', x: 470, y: 300, radius: 34, width: 68, height: 68, angle: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'boostWall') {
      draft.obstacles.push({ id: `boost-${draft.obstacles.length + 1}`, role: 'blocker', shape: 'rect', material: 'boost', purpose: '自定义高弹墙。', x: 410, y: 260, width: 120, height: 36, angle: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'stickyWall') {
      draft.obstacles.push({ id: `sticky-${draft.obstacles.length + 1}`, role: 'deadzone', shape: 'rect', material: 'sticky', purpose: '自定义卸力墙，碰到后球会停住。', x: 410, y: 260, width: 140, height: 42, angle: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'redSwitch') {
      draft.switches.push({ id: `red-switch-${draft.switches.length + 1}`, color: 'red', x: 350, y: 300, radius: 18, activated: false, purpose: '红色按钮，被球击中后打开红色门。' });
      state.editor.selected = { type: 'switch', index: draft.switches.length - 1 };
    } else if (tool === 'redDoor') {
      draft.doors.push({ id: `red-door-${draft.doors.length + 1}`, color: 'red', x: 560, y: 218, width: 40, height: 176, open: false, shape: 'rect', material: 'normal', purpose: '红色门，红色按钮触发后打开。' });
      state.editor.selected = { type: 'door', index: draft.doors.length - 1 };
    } else if (tool === 'moving') {
      draft.obstacles.push({ id: `moving-${draft.obstacles.length + 1}`, role: 'movingGate', shape: 'rect', material: 'normal', purpose: '自定义移动机关。', x: 450, y: 240, width: 110, height: 28, angle: 0, path: { x: 0, y: 130 }, speed: 1, phase: 0 });
      state.editor.selected = { type: 'obstacle', index: draft.obstacles.length - 1 };
    } else if (tool === 'portal') {
      const pair = draft.portals.length / 2 + 1;
      const blueId = `blue-${pair}`;
      const orangeId = `orange-${pair}`;
      draft.portals.push({ id: blueId, purpose: '自定义入口传送门。', x: 300, y: 300, radius: 18, pairId: orangeId, exitAngle: 0 });
      draft.portals.push({ id: orangeId, purpose: '自定义出口传送门。', x: 690, y: 300, radius: 18, pairId: blueId, exitAngle: 0 });
      state.editor.selected = { type: 'portal', index: draft.portals.length - 2 };
    }
    state.editor.tool = tool;
    setEditorStatus(`${editorSelectionLabel()} 已添加。可以直接拖动或修改右侧数值。`, 'var(--amber)');
    syncEditorUi();
  }

  function hitEditorObject(point) {
    const draft = state.editor.draft;
    for (let i = draft.portals.length - 1; i >= 0; i -= 1) {
      const portal = draft.portals[i];
      if (Math.hypot(point.x - portal.x, point.y - portal.y) <= portal.radius + 12) return { type: 'portal', index: i };
    }
    for (let i = draft.relayLaunchers.length - 1; i >= 0; i -= 1) {
      const relay = draft.relayLaunchers[i];
      if (Math.hypot(point.x - relay.x, point.y - relay.y) <= (relay.radius || 22) + 16) return { type: 'relay', index: i };
    }
    for (let i = draft.launchers.length - 1; i >= 0; i -= 1) {
      const launcher = draft.launchers[i];
      if (Math.hypot(point.x - launcher.x, point.y - launcher.y) <= 28) return { type: 'launcher', index: i };
    }
    if (Math.hypot(point.x - draft.target.x, point.y - draft.target.y) <= draft.target.radius + 16) return { type: 'target', index: 0 };
    for (let i = draft.switches.length - 1; i >= 0; i -= 1) {
      const switchItem = draft.switches[i];
      if (Math.hypot(point.x - switchItem.x, point.y - switchItem.y) <= (switchItem.radius || 18) + 12) return { type: 'switch', index: i };
    }
    for (let i = draft.doors.length - 1; i >= 0; i -= 1) {
      const door = draft.doors[i];
      if (point.x >= door.x && point.x <= door.x + door.width && point.y >= door.y && point.y <= door.y + door.height) {
        return { type: 'door', index: i };
      }
    }
    for (let i = draft.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = draft.obstacles[i];
      const bounds = obstacleBounds(obstacle);
      if (obstacle.shape === 'circle' && Math.hypot(point.x - obstacle.x, point.y - obstacle.y) <= (obstacle.radius || 28) + 8) {
        return { type: 'obstacle', index: i };
      }
      if (obstacle.shape === 'triangle' && point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
        return { type: 'obstacle', index: i };
      }
      if (
        obstacle.shape !== 'circle' &&
        obstacle.shape !== 'triangle' &&
        pointInRotatedRect(point, obstacle)
      ) {
        return { type: 'obstacle', index: i };
      }
    }
    return null;
  }

  function pointInRotatedRect(point, obstacle) {
    const width = obstacle.width || 90;
    const height = obstacle.height || 34;
    const cx = obstacle.x + width / 2;
    const cy = obstacle.y + height / 2;
    const angle = (obstacle.angle || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - cx;
    const dy = point.y - cy;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    return Math.abs(localX) <= width / 2 + 8 && Math.abs(localY) <= height / 2 + 8;
  }

  function moveEditorSelection(point) {
    const object = getEditorObject();
    if (!object) return;
    object.x = point.x - state.editor.dragOffset.x;
    object.y = point.y - state.editor.dragOffset.y;
    clampEditorObject(object);
    syncEditorUi();
  }

  function applyEditorPropertyChange() {
    const object = getEditorObject();
    if (!object) return;
    object.x = Number(ui.editorX.value);
    object.y = Number(ui.editorY.value);
    if (state.editor.selected.type === 'obstacle') {
      object.material = ui.editorMaterial.value;
      if (object.shape === 'circle') {
        object.radius = Number(ui.editorRadius.value);
        object.width = object.radius * 2;
        object.height = object.radius * 2;
      } else {
        object.width = Number(ui.editorWidth.value);
        object.height = Number(ui.editorHeight.value);
      }
      object.angle = Number(ui.editorAngle.value);
      if (object.path) {
        object.path.x = Number(ui.editorPathX.value);
        object.path.y = Number(ui.editorPathY.value);
        object.speed = Number(ui.editorSpeed.value);
      }
    }
    if (state.editor.selected.type === 'switch') {
      object.radius = Number(ui.editorRadius.value);
    }
    if (state.editor.selected.type === 'door') {
      object.width = Number(ui.editorWidth.value);
      object.height = Number(ui.editorHeight.value);
    }
    if (state.editor.selected.type === 'launcher' || state.editor.selected.type === 'relay') {
      object.angle = Number(ui.editorAngle.value);
      object.power = fixedLauncherPower;
    }
    if (state.editor.selected.type === 'portal') {
      object.exitAngle = Number(ui.editorAngle.value) * Math.PI / 180;
    }
    clampEditorObject(object);
    syncEditorUi();
  }

  function deleteEditorSelection() {
    const selection = state.editor.selected;
    if (!selection || selection.type === 'target') return;
    const draft = state.editor.draft;
    if (selection.type === 'launcher') {
      if (draft.launchers.length <= 1) {
        setEditorStatus('至少需要保留一个 A 发射器。', 'var(--red)');
        return;
      }
      draft.launchers.splice(selection.index, 1);
      draft.launchers.forEach((launcher, index) => { launcher.id = `A${index + 1}`; });
    } else if (selection.type === 'relay') {
      draft.relayLaunchers.splice(selection.index, 1);
      draft.relayLaunchers.forEach((relay, index) => { relay.id = `R${index + 1}`; });
    } else if (selection.type === 'obstacle') {
      draft.obstacles.splice(selection.index, 1);
    } else if (selection.type === 'switch') {
      draft.switches.splice(selection.index, 1);
    } else if (selection.type === 'door') {
      draft.doors.splice(selection.index, 1);
    } else if (selection.type === 'portal') {
      const portal = draft.portals[selection.index];
      draft.portals = draft.portals.filter((item) => item.id !== portal.id && item.id !== portal.pairId);
    }
    state.editor.selected = { type: 'launcher', index: 0 };
    setEditorStatus('组件已删除。', 'var(--amber)');
    syncEditorUi();
  }

  function saveEditedLevel() {
    const draft = state.editor.draft;
    draft.name = ui.editorLevelName.value.trim() || '我的关卡';
    if (draft.launchers.length === 0 || !draft.target) {
      setEditorStatus('保存失败：至少需要一个 A 发射器和一个 B 目标。', 'var(--red)');
      return null;
    }
    const existingIndex = state.customLevels.findIndex((item) => item.id === state.editor.savedId);
    const levelIndex = existingIndex >= 0 ? existingIndex : state.customLevels.length;
    const custom = draftToLevel(draft, levelIndex);
    custom.id = state.editor.savedId || custom.id;
    if (existingIndex >= 0) state.customLevels[existingIndex] = custom;
    else {
      state.customLevels.push(custom);
      state.editor.savedId = custom.id;
      state.editor.draft.id = custom.id;
    }
    state.customLevels = state.customLevels.map((item, index) => normalizeCustomLevel(item, index)).filter(Boolean);
    saveCustomLevels();
    syncLevelMenu();
    syncEditorUi();
    setEditorStatus('关卡已保存，并已加入关卡菜单。', 'var(--green)');
    return custom.id;
  }

  function playEditedLevel() {
    const draft = state.editor.draft;
    draft.name = ui.editorLevelName.value.trim() || '试玩草稿';
    if (draft.launchers.length === 0 || !draft.target) {
      setEditorStatus('试玩失败：至少需要一个 A 发射器和一个 B 目标。', 'var(--red)');
      return;
    }
    state.testLevel = draftToLevel(draft, state.customLevels.length);
    state.testLevel.name = `${draft.name}（试玩）`;
    state.testLevel.focus = '草稿试玩';
    state.mode = 'play';
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.remove('hidden');
    ui.editorPanel.classList.add('hidden');
    state.levelIndex = allLevels().length - 1;
    resetLevel();
  }

  function deleteCurrentCustomLevel() {
    if (!state.editor.savedId) {
      state.editor.draft = createEditorDraft();
      state.editor.selected = { type: 'launcher', index: 0 };
      ui.editorLevelName.value = state.editor.draft.name;
      setEditorStatus('当前是未保存的新关卡，已清空草稿。', 'var(--amber)');
      syncEditorUi();
      return;
    }
    const existingIndex = state.customLevels.findIndex((item) => item.id === state.editor.savedId);
    if (existingIndex >= 0) {
      state.customLevels.splice(existingIndex, 1);
      state.customLevels = state.customLevels.map((item, index) => normalizeCustomLevel(item, index)).filter(Boolean);
      saveCustomLevels();
    }
    state.editor.draft = createEditorDraft();
    state.editor.savedId = null;
    state.editor.selected = { type: 'launcher', index: 0 };
    ui.editorLevelName.value = state.editor.draft.name;
    setEditorStatus('自定义关卡已删除。', 'var(--red)');
    syncLevelMenu();
    syncEditorUi();
  }

  function exitEditorWithoutSaving() {
    state.editor.draft = createEditorDraft();
    state.editor.savedId = null;
    state.editor.selected = { type: 'launcher', index: 0 };
    ui.editorLevelName.value = state.editor.draft.name;
    openLevelMenu();
  }

  ui.openEditor.addEventListener('click', () => openEditor());
  ui.startGame.addEventListener('click', () => {
    ensureAudio();
    openLevelMenu();
  });
  ui.exitGame.addEventListener('click', () => {
    state.mode = 'start';
    state.ball = null;
    hideCompletionPrompt();
    ui.startExitStatus.textContent = '游戏已退出';
    window.close();
  });
  ui.openMenu.addEventListener('click', openLevelMenu);
  ui.prevLevel.addEventListener('click', () => startLevel(state.levelIndex - 1));
  ui.nextLevel.addEventListener('click', () => startLevel(state.levelIndex + 1));
  ui.shoot.addEventListener('click', shoot);
  ui.reset.addEventListener('click', () => resetLevel());
  ui.continueLevel.addEventListener('click', () => {
    ensureAudio();
    openLevelMenu();
  });
  ui.replayLevel.addEventListener('click', () => {
    ensureAudio();
    resetLevel();
  });
  ui.angle.addEventListener('input', () => {
    if (state.mode !== 'play') return;
    selectedLauncher().angle = Number(ui.angle.value);
    syncUi();
  });
  ui.power.addEventListener('input', () => {
    if (state.mode !== 'play') return;
    selectedLauncher().power = fixedLauncherPower;
    syncControlsFromLauncher();
    syncUi();
  });
  ui.previewLength.addEventListener('input', () => {
    state.previewDistance = Number(ui.previewLength.value);
    syncUi();
    if (state.mode === 'editor') syncEditorUi();
  });

  ui.editorTools.forEach((button) => {
    button.addEventListener('click', () => addEditorObject(button.dataset.editorTool));
  });
  ui.editorLevelName.addEventListener('input', () => {
    state.editor.draft.name = ui.editorLevelName.value;
  });
  ui.newCustomLevel.addEventListener('click', () => {
    state.editor.draft = createEditorDraft();
    state.editor.savedId = null;
    state.editor.selected = { type: 'launcher', index: 0 };
    ui.editorLevelName.value = state.editor.draft.name;
    setEditorStatus('已创建新的空白关卡。', 'var(--blue)');
    syncEditorUi();
  });
  ui.saveCustomLevel.addEventListener('click', saveEditedLevel);
  ui.playEditedLevel.addEventListener('click', playEditedLevel);
  ui.backToMenuFromEditor.addEventListener('click', exitEditorWithoutSaving);
  ui.deleteCustomLevel.addEventListener('click', deleteCurrentCustomLevel);
  ui.deleteEditorObject.addEventListener('click', deleteEditorSelection);
  [ui.editorX, ui.editorY, ui.editorWidth, ui.editorHeight, ui.editorRadius, ui.editorMaterial, ui.editorAngle, ui.editorPower, ui.editorPathX, ui.editorPathY, ui.editorSpeed].forEach((input) => {
    input.addEventListener('input', applyEditorPropertyChange);
    input.addEventListener('change', applyEditorPropertyChange);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (state.mode === 'editor') {
      const point = screenToWorld(event);
      const selection = hitEditorObject(point);
      if (selection) {
        state.editor.selected = selection;
        const object = getEditorObject(selection);
        state.editor.dragging = true;
        state.editor.dragOffset = { x: point.x - object.x, y: point.y - object.y };
        canvas.setPointerCapture(event.pointerId);
        syncEditorUi();
      }
      return;
    }
    if (state.mode !== 'play') return;
    if (state.ball && state.ball.active) return;
    canvas.focus({ preventScroll: true });
    const point = screenToWorld(event);
    const relayIndex = relayAtPoint(point);
    canvas.setPointerCapture(event.pointerId);
    state.draggingAim = true;
    if (relayIndex >= 0) {
      selectRelayLauncher(relayIndex);
      state.dragMode = 'aim';
      setStatus(`${state.relayLaunchers[relayIndex].id} 已选中。拖动调整方向，位置固定，力度固定为 700。`, 'var(--amber)');
      return;
    }
    state.dragMode = 'aim';
    updateAimFromPointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (state.mode === 'editor') {
      if (!state.editor.dragging) return;
      moveEditorSelection(screenToWorld(event));
      return;
    }
    if (!state.draggingAim) return;
    if (state.dragMode === 'moveRelay') moveSelectedRelayFromPointer(event);
    else updateAimFromPointer(event);
  });

  canvas.addEventListener('pointerup', (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    state.draggingAim = false;
    state.dragMode = null;
    state.editor.dragging = false;
  });

  function isFormEditingTarget(target) {
    if (!target || !target.closest) return false;
    const control = target.closest('input, textarea, select, [contenteditable="true"]');
    if (!control) return false;
    if (control.tagName === 'INPUT' && control.type === 'range') return false;
    return true;
  }

  function isCommandTarget(target) {
    return Boolean(target && target.closest && target.closest('button, a'));
  }

  window.addEventListener('keydown', (event) => {
    const editingText = isFormEditingTarget(event.target);
    const usingCommand = isCommandTarget(event.target);
    const defaultShootKey = event.code === 'Space' || event.code === 'Enter';

    if (defaultShootKey && state.mode === 'play' && !editingText && !usingCommand && ui.dialog.classList.contains('hidden')) {
      event.preventDefault();
      if (!event.repeat) shoot();
    } else if (!editingText && event.key.toLowerCase() === 'r' && state.mode === 'play') {
      resetLevel();
    } else if (!editingText && event.key === 'Escape') {
      openLevelMenu();
    } else if (!editingText && event.key === 'Delete' && state.mode === 'editor') {
      deleteEditorSelection();
    }
  });

  setLevel(0);
  openStartScreen();
  requestAnimationFrame(frame);
})();
