(function startGame() {
  'use strict';

  const {
    createBall,
    stepBall,
    resolveArenaWalls,
    targetHitThisFrame,
    tryTeleport,
    tryLauncherCapture,
    isFailedAttempt,
    resolveObstacleBounce,
    resolveShapedObstacleBounce,
    rotatedRectPoints,
    trianglePoints,
    updateMovingObstacle,
    clamp,
  } = window.PinballSandbox;
  const { levels: officialLevels } = window.PinballLevels;
  const { buildCompletionResult } = window.PinballProgression;

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const customStorageKey = 'pinballSandboxCustomLevels.v1';
  const overrideStorageKey = 'pinballSandboxLevelOverrides.v3';
  const previousOverrideStorageKey = 'pinballSandboxLevelOverrides.v2';
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
    editCurrentLevel: document.querySelector('#editCurrentLevel'),
    playPanel: document.querySelector('#playPanel'),
    editorPanel: document.querySelector('#editorPanel'),
    prevLevel: document.querySelector('#prevLevel'),
    nextLevel: document.querySelector('#nextLevel'),
    levelNumber: document.querySelector('#levelNumber'),
    levelName: document.querySelector('#levelName'),
    levelFocus: document.querySelector('#levelFocus'),
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
    completeActions: document.querySelector('.completion-actions'),
    continueLevel: document.querySelector('#continueLevel'),
    replayLevel: document.querySelector('#replayLevel'),
    unsavedEditorDialog: document.querySelector('#unsavedEditorDialog'),
    saveEditorExit: document.querySelector('#saveEditorExit'),
    discardEditorExit: document.querySelector('#discardEditorExit'),
    editorLevelName: document.querySelector('#editorLevelName'),
    newCustomLevel: document.querySelector('#newCustomLevel'),
    saveCustomLevel: document.querySelector('#saveCustomLevel'),
    playEditedLevel: document.querySelector('#playEditedLevel'),
    backToMenuFromEditor: document.querySelector('#backToMenuFromEditor'),
    undoEditor: document.querySelector('#undoEditor'),
    redoEditor: document.querySelector('#redoEditor'),
    editorMapSmall: document.querySelector('#editorMapSmall'),
    editorMapMedium: document.querySelector('#editorMapMedium'),
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

  const mapSizes = {
    small: {
      label: '小型地图',
      canvas: { width: 960, height: 600 },
      arena: { x: 36, y: 36, width: 888, height: 528 },
    },
    medium: {
      label: '中型地图',
      canvas: { width: 1440, height: 900 },
      arena: { x: 54, y: 54, width: 1332, height: 792 },
    },
  };
  const arena = { ...mapSizes.small.arena };
  const soundVolume = 1.35;
  const launcherColor = '#41d692';
  const launcherGlow = 'rgba(65, 214, 146, 0.42)';
  const relayColor = launcherColor;
  const relayGlow = launcherGlow;
  const emptyLauncherColor = '#9b7cff';
  const emptyLauncherGlow = 'rgba(155, 124, 255, 0.36)';
  const stickyArenaWalls = { top: 'sticky', right: 'sticky', bottom: 'sticky', left: 'sticky' };
  const art = {
    metal: '#596977',
    metalDark: '#303943',
    boost: '#4ee06f',
    boostCore: '#d7ff7a',
    sticky: '#f2c84b',
    stickyDark: '#6f5712',
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
    ball: null,
    obstacles: [],
    completed: false,
    completedLevels: new Set(),
    levelOverrides: loadLevelOverrides(),
    customLevels: loadCustomLevels(),
    testLevel: null,
    previewDistance: 480,
    draggingAim: false,
    dragMode: null,
    dragOffset: { x: 0, y: 0 },
    lastTime: 0,
    physicsAccumulator: 0,
    effects: [],
    successPulse: null,
    lastImpactSoundAt: 0,
    completionResult: null,
    shotEvents: null,
    activeShotPath: [],
    lastFailedShotPath: null,
    lastAimPreviewPath: null,
    editor: {
      draft: createEditorDraft(),
      savedId: null,
      source: { type: 'new' },
      selected: null,
      tool: 'start',
      dragging: false,
      dragMode: null,
      dragOffset: { x: 0, y: 0 },
      transformStart: null,
      history: [],
      redoHistory: [],
      pendingSnapshot: null,
      savedDraftKey: null,
    },
  };

  const audio = {
    context: null,
    unlocked: false,
    master: null,
    compressor: null,
    output: null,
    reverb: null,
    reverbGain: null,
    noiseSeed: 0x3a7f29c1,
  };

  function allLevels() {
    const official = officialLevels.map((item, index) => {
      const override = state.levelOverrides[String(index)];
      if (!override) return item;
      return {
        ...override,
        custom: false,
        edited: true,
        officialIndex: index,
        order: item.order,
      };
    });
    return official.concat(state.customLevels);
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

  function loadLevelOverrides() {
    try {
      const currentRaw = window.localStorage.getItem(overrideStorageKey);
      const previousRaw = window.localStorage.getItem(previousOverrideStorageKey);
      const raw = currentRaw || previousRaw;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const migrated = Object.entries(parsed).reduce((overrides, [key, levelData]) => {
        const previousIndex = Number(key);
        if (!currentRaw && previousIndex === 8) return overrides;
        const index = !currentRaw && previousIndex > 8 ? previousIndex - 1 : previousIndex;
        if (!Number.isInteger(index) || !officialLevels[index]) return overrides;
        if (String(levelData?.name || '').trim() === '取消') return overrides;
        const normalized = normalizeOfficialOverride(levelData, index);
        if (normalized) overrides[String(index)] = normalized;
        return overrides;
      }, {});
      if (!currentRaw) window.localStorage.setItem(overrideStorageKey, JSON.stringify(migrated));
      return migrated;
    } catch {
      return {};
    }
  }

  function saveLevelOverrides() {
    window.localStorage.setItem(overrideStorageKey, JSON.stringify(state.levelOverrides));
  }

  function normalizeArenaWalls(walls = stickyArenaWalls) {
    const normalized = { ...stickyArenaWalls };
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      normalized[side] = walls && walls[side] === 'bounce' ? 'bounce' : 'sticky';
    });
    return normalized;
  }

  function normalizeMapSize(size) {
    return size === 'medium' ? 'medium' : 'small';
  }

  function mapConfig(size = 'small') {
    return mapSizes[normalizeMapSize(size)] || mapSizes.small;
  }

  function applyMapSize(size = 'small') {
    const normalized = normalizeMapSize(size);
    const config = mapConfig(normalized);
    if (canvas.width !== config.canvas.width) canvas.width = config.canvas.width;
    if (canvas.height !== config.canvas.height) canvas.height = config.canvas.height;
    Object.assign(arena, config.arena);
    ui.shell.dataset.mapSize = normalized;
  }

  function currentMapSize(levelData = level()) {
    return normalizeMapSize(levelData?.mapSize);
  }

  function scalePointBetweenMaps(point, fromSize, toSize) {
    const from = mapConfig(fromSize).arena;
    const to = mapConfig(toSize).arena;
    return {
      x: to.x + ((point.x - from.x) / from.width) * to.width,
      y: to.y + ((point.y - from.y) / from.height) * to.height,
    };
  }

  function scaleDraftBetweenMaps(draft, fromSize, toSize) {
    const from = mapConfig(fromSize).arena;
    const to = mapConfig(toSize).arena;
    const scaleX = to.width / from.width;
    const scaleY = to.height / from.height;
    const scaleRadius = (scaleX + scaleY) / 2;
    const scalePosition = (object) => {
      if (!object) return;
      const point = scalePointBetweenMaps(object, fromSize, toSize);
      object.x = point.x;
      object.y = point.y;
    };
    const scaleBox = (object) => {
      if (!object) return;
      scalePosition(object);
      if (Number.isFinite(object.width)) object.width *= scaleX;
      if (Number.isFinite(object.height)) object.height *= scaleY;
    };
    const scaleCircle = (object) => {
      if (!object) return;
      scalePosition(object);
      if (Number.isFinite(object.radius)) object.radius *= scaleRadius;
      if (Number.isFinite(object.width)) object.width *= scaleRadius;
      if (Number.isFinite(object.height)) object.height *= scaleRadius;
    };

    scaleCircle(draft.target);
    draft.launchers.forEach(scaleCircle);
    draft.relayLaunchers.forEach(scaleCircle);
    draft.switches.forEach(scaleCircle);
    draft.portals.forEach(scaleCircle);
    draft.doors.forEach(scaleBox);
    draft.obstacles.forEach((obstacle) => {
      if (obstacle.shape === 'circle') scaleCircle(obstacle);
      else scaleBox(obstacle);
      if (obstacle.path) {
        obstacle.path.x *= scaleX;
        obstacle.path.y *= scaleY;
      }
    });
    draft.mapSize = normalizeMapSize(toSize);
  }

  function arenaWallModes(levelData = level()) {
    if (!levelData || !levelData.arenaWalls) return normalizeArenaWalls(stickyArenaWalls);
    return normalizeArenaWalls(levelData.arenaWalls);
  }

  function normalizeCustomLevel(level, index) {
    if (!level || !Array.isArray(level.launchers) || !level.target) return null;
    const normalizedMapSize = normalizeMapSize(level.mapSize);
    return {
      id: level.id || freshId('level'),
      custom: true,
      order: officialLevels.length + index + 1,
      name: String(level.name || `自定义关卡 ${index + 1}`).slice(0, 18),
      mapSize: normalizedMapSize,
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
        purpose: relay.purpose || '自定义空发射器；接到球后可手动瞄准并发射。',
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

  function normalizeOfficialOverride(level, index) {
    if (!officialLevels[index]) return null;
    const normalized = normalizeCustomLevel(level, 0);
    if (!normalized) return null;
    return {
      ...normalized,
      id: `official-${index + 1}`,
      custom: false,
      edited: true,
      officialIndex: index,
      order: officialLevels[index].order,
      focus: level.focus || '已编辑布局',
      hint: level.hint || '这是你修改后的关卡。调整发射器，让球碰到 B 点。',
      requiredMechanics: [],
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
      mapSize: 'small',
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
      mapSize: draft.mapSize,
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
      mapSize: normalizeMapSize(level.mapSize),
      target: { ...level.target },
      launchers: level.launchers.map((launcher) => ({ ...launcher, power: fixedLauncherPower })),
      relayLaunchers: (level.relayLaunchers || []).map((relay) => ({ ...relay, power: fixedLauncherPower, movable: true })),
      obstacles: (level.obstacles || []).map((obstacle) => ({ ...obstacle, path: obstacle.path ? { ...obstacle.path } : undefined })),
      switches: (level.switches || []).map((switchItem) => ({ ...switchItem, activated: false })),
      doors: (level.doors || []).map((door) => ({ ...door, open: false })),
      portals: (level.portals || []).map((portal) => ({ ...portal })),
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

  function selectedLauncher() {
    if (state.selectedDeviceType === 'relay' && state.relayLaunchers[state.selectedRelayIndex]) {
      return state.relayLaunchers[state.selectedRelayIndex];
    }
    return activeLauncher();
  }

  function shotLauncher() {
    return selectedLauncher();
  }

  function launcherIsLoaded(type, index) {
    if (state.completed || (state.ball && state.ball.active)) return false;
    if (!state.ball) return type === 'start' && index === 0;
    if (!state.ball.continuesAttempt) return false;
    if (type === 'relay') return state.selectedDeviceType === 'relay' && state.selectedRelayIndex === index;
    return state.selectedDeviceType === 'start' && state.activeLauncherIndex === index;
  }

  function launcherCanAim(type, index) {
    return launcherIsLoaded(type, index);
  }

  function selectedLauncherCanShoot() {
    const index = state.selectedDeviceType === 'relay' ? state.selectedRelayIndex : state.activeLauncherIndex;
    return launcherCanAim(state.selectedDeviceType, index);
  }

  function setStatus(text, tone) {
    ui.status.textContent = text;
    ui.status.style.borderLeftColor = tone || 'var(--blue)';
  }

  function clearShotPaths() {
    state.activeShotPath = [];
    state.lastFailedShotPath = null;
    state.lastAimPreviewPath = null;
  }

  function clearFailedShotPath() {
    state.activeShotPath = [];
    state.lastFailedShotPath = null;
  }

  function rememberAimPreview(launcher, levelData = level()) {
    state.lastAimPreviewPath = simulatePreview(
      launcher,
      levelData,
      state.obstacles,
      state.relayLaunchers,
      { switches: state.switches, doors: state.doors },
    ).map((point) => ({ ...point }));
  }

  function recordShotPoint(point, options = {}) {
    if (!state.activeShotPath) state.activeShotPath = [];
    if (options.break) state.activeShotPath.push({ break: true });
    const last = [...state.activeShotPath].reverse().find((item) => !item.break);
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 3) return;
    state.activeShotPath.push({ x: point.x, y: point.y });
    if (state.activeShotPath.length > 900) state.activeShotPath.shift();
  }

  function keepFailedShotPath() {
    const points = (state.activeShotPath || []).map((point) => ({ ...point }));
    const visiblePoints = points.filter((point) => !point.break);
    state.activeShotPath = [];
    if (visiblePoints.length < 2) {
      state.lastFailedShotPath = null;
      return;
    }
    state.lastFailedShotPath = {
      points,
      age: 0,
      duration: 4.2,
    };
  }

  function clearActiveShotPath() {
    state.activeShotPath = [];
  }

  function setEditorStatus(text, tone) {
    ui.editorStatus.textContent = text;
    ui.editorStatus.style.borderLeftColor = tone || 'var(--blue)';
  }

  function cloneEditorDraft(draft = state.editor.draft) {
    return JSON.parse(JSON.stringify(draft));
  }

  function cloneEditorSelection(selection = state.editor.selected) {
    return selection ? { ...selection } : null;
  }

  function editorSnapshot() {
    return {
      draft: cloneEditorDraft(),
      savedId: state.editor.savedId,
      source: { ...state.editor.source },
      selected: cloneEditorSelection(),
      tool: state.editor.tool,
    };
  }

  function editorDraftKey(draft = state.editor.draft) {
    return JSON.stringify(draft);
  }

  function markEditorClean() {
    state.editor.savedDraftKey = editorDraftKey();
  }

  function editorHasUnsavedChanges() {
    commitEditorHistory();
    return editorDraftKey() !== state.editor.savedDraftKey;
  }

  function hideUnsavedEditorPrompt() {
    ui.unsavedEditorDialog.classList.add('hidden');
  }

  function showUnsavedEditorPrompt() {
    ui.unsavedEditorDialog.classList.remove('hidden');
    ui.saveEditorExit.focus();
  }

  function resetEditorHistory() {
    state.editor.history = [];
    state.editor.redoHistory = [];
    state.editor.pendingSnapshot = null;
    syncEditorHistoryButtons();
  }

  function syncEditorHistoryButtons() {
    if (!ui.undoEditor || !ui.redoEditor) return;
    ui.undoEditor.disabled = state.editor.history.length === 0 && !state.editor.pendingSnapshot;
    ui.redoEditor.disabled = state.editor.redoHistory.length === 0;
  }

  function beginEditorHistory() {
    if (state.mode !== 'editor') return;
    if (!state.editor.pendingSnapshot) state.editor.pendingSnapshot = editorSnapshot();
    syncEditorHistoryButtons();
  }

  function commitEditorHistory() {
    const snapshot = state.editor.pendingSnapshot;
    if (!snapshot) return false;
    state.editor.pendingSnapshot = null;
    if (editorDraftKey(snapshot.draft) !== editorDraftKey()) {
      state.editor.history.push(snapshot);
      if (state.editor.history.length > 80) state.editor.history.shift();
      state.editor.redoHistory = [];
      syncEditorHistoryButtons();
      return true;
    }
    syncEditorHistoryButtons();
    return false;
  }

  function restoreEditorSnapshot(snapshot) {
    state.editor.draft = cloneEditorDraft(snapshot.draft);
    state.editor.savedId = snapshot.savedId;
    state.editor.source = snapshot.source || { type: state.editor.savedId ? 'custom' : 'new' };
    state.editor.selected = cloneEditorSelection(snapshot.selected) || { type: 'launcher', index: 0 };
    state.editor.tool = snapshot.tool || 'start';
    ui.editorLevelName.value = state.editor.draft.name;
    applyMapSize(state.editor.draft.mapSize);
    syncEditorUi();
  }

  function undoEditorChange() {
    if (state.mode !== 'editor') return;
    commitEditorHistory();
    const snapshot = state.editor.history.pop();
    if (!snapshot) {
      syncEditorHistoryButtons();
      return;
    }
    state.editor.redoHistory.push(editorSnapshot());
    restoreEditorSnapshot(snapshot);
    setEditorStatus('已撤销到上一次有效调整。', 'var(--amber)');
    syncEditorHistoryButtons();
  }

  function redoEditorChange() {
    if (state.mode !== 'editor') return;
    const snapshot = state.editor.redoHistory.pop();
    if (!snapshot) {
      syncEditorHistoryButtons();
      return;
    }
    state.editor.history.push(editorSnapshot());
    restoreEditorSnapshot(snapshot);
    setEditorStatus('已重做刚才撤销的调整。', 'var(--green)');
    syncEditorHistoryButtons();
  }

  function ensureAudio() {
    if (!audio.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio.context = new AudioContext();
      const context = audio.context;
      audio.master = context.createGain();
      audio.compressor = context.createDynamicsCompressor();
      audio.output = context.createGain();
      audio.master.gain.value = 0.88;
      audio.output.gain.value = 1.35;
      audio.compressor.threshold.value = -18;
      audio.compressor.knee.value = 18;
      audio.compressor.ratio.value = 5;
      audio.compressor.attack.value = 0.004;
      audio.compressor.release.value = 0.18;
      audio.master.connect(audio.compressor);
      audio.compressor.connect(audio.output);
      audio.output.connect(context.destination);

      if (context.createConvolver) {
        const duration = 1.45;
        const length = Math.floor(context.sampleRate * duration);
        const impulse = context.createBuffer(2, length, context.sampleRate);
        let seed = 0x71c3e29d;
        for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
          const data = impulse.getChannelData(channel);
          for (let i = 0; i < length; i += 1) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const noise = seed / 0xffffffff * 2 - 1;
            const envelope = Math.pow(1 - i / length, 2.8);
            const earlyReflection = i < context.sampleRate * 0.08 ? 0.52 : 1;
            data[i] = noise * envelope * earlyReflection * (channel === 0 ? 0.92 : 0.84);
          }
        }
        audio.reverb = context.createConvolver();
        audio.reverb.buffer = impulse;
        audio.reverbGain = context.createGain();
        audio.reverbGain.gain.value = 0.34;
        audio.reverb.connect(audio.reverbGain);
        audio.reverbGain.connect(audio.master);
      }
    }
    if (audio.context.state === 'suspended') audio.context.resume();
    audio.unlocked = true;
    return audio.context;
  }

  function connectSoundVoice(context, sourceNode, {
    pan = 0,
    endPan,
    startTime = context.currentTime,
    duration = 0,
    wet = 0.2,
  } = {}) {
    let output = sourceNode;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -1, 1), startTime);
      if (Number.isFinite(endPan) && duration > 0) {
        panner.pan.linearRampToValueAtTime(clamp(endPan, -1, 1), startTime + duration);
      }
      output.connect(panner);
      output = panner;
    }
    output.connect(audio.master || context.destination);
    if (audio.reverb && wet > 0) {
      const send = context.createGain();
      send.gain.value = clamp(wet, 0, 1);
      output.connect(send);
      send.connect(audio.reverb);
    }
  }

  function playTone({
    frequency,
    start = 0,
    duration = 0.08,
    type = 'sine',
    gain = 0.08,
    endFrequency,
    attack = 0.006,
    filterFrequency = 12000,
    endFilterFrequency,
    filterType = 'lowpass',
    resonance = 0.7,
    detune = 0,
    pan = 0,
    endPan,
    wet = 0.2,
  }) {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime + start;
    const end = now + duration;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detune, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFrequency, now);
    filter.Q.value = resonance;
    if (endFilterFrequency) filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFilterFrequency), end);
    const outputGain = Math.min(gain * soundVolume, 0.3);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(outputGain, now + Math.min(attack, duration * 0.35));
    volume.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(filter);
    filter.connect(volume);
    connectSoundVoice(context, volume, { pan, endPan, startTime: now, duration, wet });
    oscillator.start(now);
    oscillator.stop(end + 0.03);
  }

  function playNoiseBurst({
    start = 0,
    duration = 0.06,
    gain = 0.08,
    filterFrequency = 1400,
    endFilterFrequency,
    filterType = 'bandpass',
    resonance = 1.2,
    attack = 0,
    pan = 0,
    endPan,
    wet = 0.12,
  } = {}) {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime + start;
    const end = now + duration;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      audio.noiseSeed = (audio.noiseSeed * 1664525 + 1013904223) >>> 0;
      data[i] = (audio.noiseSeed / 0xffffffff * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFrequency, now);
    filter.Q.value = resonance;
    if (endFilterFrequency) filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFilterFrequency), end);
    const outputGain = Math.min(gain * soundVolume, 0.28);
    if (attack > 0) {
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(outputGain, now + Math.min(attack, duration * 0.45));
    } else {
      volume.gain.setValueAtTime(outputGain, now);
    }
    volume.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(volume);
    connectSoundVoice(context, volume, { pan, endPan, startTime: now, duration, wet });
    source.start(now);
    source.stop(end + 0.02);
  }

  function playSound(name) {
    if (name === 'shoot') {
      playNoiseBurst({ duration: 0.045, gain: 0.18, filterFrequency: 1900, endFilterFrequency: 720, resonance: 1.6, pan: -0.12, wet: 0.08 });
      playTone({ frequency: 760, endFrequency: 170, duration: 0.12, type: 'square', gain: 0.12, filterFrequency: 2200, endFilterFrequency: 620, resonance: 1.3, pan: -0.08, wet: 0.18 });
      playTone({ frequency: 132, endFrequency: 58, start: 0.006, duration: 0.27, type: 'sine', gain: 0.19, filterFrequency: 320, pan: 0, wet: 0.12 });
      playTone({ frequency: 510, endFrequency: 1180, start: 0.025, duration: 0.15, type: 'sawtooth', gain: 0.075, filterFrequency: 2800, endFilterFrequency: 5200, resonance: 1.8, pan: 0.15, wet: 0.34 });
      playNoiseBurst({ start: 0.035, duration: 0.34, gain: 0.14, filterFrequency: 6200, endFilterFrequency: 950, filterType: 'bandpass', resonance: 0.55, attack: 0.055, pan: -0.85, endPan: 0.9, wet: 0.16 });
      playNoiseBurst({ start: 0.06, duration: 0.22, gain: 0.075, filterFrequency: 2400, endFilterFrequency: 7800, filterType: 'highpass', resonance: 0.4, attack: 0.035, pan: -0.65, endPan: 0.75, wet: 0.12 });
      playTone({ frequency: 1850, endFrequency: 420, start: 0.055, duration: 0.28, type: 'sine', gain: 0.035, filterFrequency: 7200, pan: -0.72, endPan: 0.78, wet: 0.3 });
      playTone({ frequency: 1480, endFrequency: 930, start: 0.105, duration: 0.16, type: 'sine', gain: 0.055, pan: 0.28, wet: 0.58 });
      playTone({ frequency: 620, endFrequency: 360, start: 0.25, duration: 0.18, type: 'triangle', gain: 0.04, pan: -0.24, wet: 0.72 });
      playTone({ frequency: 620, endFrequency: 390, start: 0.42, duration: 0.16, type: 'sine', gain: 0.025, pan: 0.22, wet: 0.78 });
    } else if (name === 'impact') {
      playNoiseBurst({ duration: 0.035, gain: 0.07, filterFrequency: 1100, endFilterFrequency: 520, wet: 0.08 });
      playTone({ frequency: 340, endFrequency: 190, duration: 0.065, type: 'square', gain: 0.055, filterFrequency: 1600, wet: 0.1 });
      playTone({ frequency: 520, endFrequency: 290, start: 0.014, duration: 0.07, type: 'triangle', gain: 0.035, pan: 0.12, wet: 0.16 });
    } else if (name === 'boostImpact') {
      playNoiseBurst({ duration: 0.045, gain: 0.075, filterFrequency: 2400, endFilterFrequency: 5200, filterType: 'highpass', wet: 0.28 });
      playTone({ frequency: 420, endFrequency: 920, duration: 0.14, type: 'triangle', gain: 0.09, pan: -0.16, wet: 0.34 });
      playTone({ frequency: 840, endFrequency: 1480, start: 0.025, duration: 0.12, type: 'sine', gain: 0.052, pan: 0.2, wet: 0.5 });
      playTone({ frequency: 660, endFrequency: 1080, start: 0.105, duration: 0.11, type: 'triangle', gain: 0.04, wet: 0.58 });
    } else if (name === 'stickyImpact') {
      playNoiseBurst({ duration: 0.14, gain: 0.075, filterFrequency: 520, endFilterFrequency: 140, filterType: 'lowpass', resonance: 0.7, wet: 0.05 });
      playTone({ frequency: 165, endFrequency: 46, duration: 0.28, type: 'sawtooth', gain: 0.085, filterFrequency: 560, endFilterFrequency: 120, wet: 0.08 });
      playTone({ frequency: 88, endFrequency: 42, start: 0.04, duration: 0.24, type: 'sine', gain: 0.065, wet: 0.05 });
    } else if (name === 'portal') {
      playTone({ frequency: 310, endFrequency: 1040, duration: 0.19, type: 'sine', gain: 0.075, pan: -0.38, wet: 0.68 });
      playTone({ frequency: 170, start: 0.025, endFrequency: 520, duration: 0.17, type: 'triangle', gain: 0.052, pan: 0.35, wet: 0.62 });
      playTone({ frequency: 1240, start: 0.11, endFrequency: 760, duration: 0.2, type: 'sine', gain: 0.035, wet: 0.8 });
    } else if (name === 'relay') {
      playNoiseBurst({ duration: 0.04, gain: 0.09, filterFrequency: 1650, endFilterFrequency: 820, wet: 0.12 });
      playTone({ frequency: 240, endFrequency: 560, duration: 0.15, type: 'triangle', gain: 0.085, pan: -0.16, wet: 0.34 });
      playTone({ frequency: 620, endFrequency: 980, start: 0.055, duration: 0.13, type: 'sine', gain: 0.05, pan: 0.16, wet: 0.5 });
      playTone({ frequency: 980, endFrequency: 720, start: 0.17, duration: 0.14, type: 'sine', gain: 0.028, wet: 0.72 });
    } else if (name === 'switch') {
      playNoiseBurst({ duration: 0.035, gain: 0.11, filterFrequency: 2100, endFilterFrequency: 980, wet: 0.08 });
      playTone({ frequency: 293.66, duration: 0.11, type: 'square', gain: 0.065, filterFrequency: 1800, pan: -0.12, wet: 0.24 });
      playTone({ frequency: 880, start: 0.07, duration: 0.18, type: 'sine', gain: 0.07, pan: 0.16, wet: 0.48 });
      playTone({ frequency: 1174.66, start: 0.13, duration: 0.2, type: 'sine', gain: 0.04, wet: 0.62 });
    } else if (name === 'success') {
      playNoiseBurst({ duration: 0.24, gain: 0.055, filterFrequency: 4200, endFilterFrequency: 9800, filterType: 'highpass', resonance: 0.6, wet: 0.72 });
      playTone({ frequency: 130.81, endFrequency: 65.41, duration: 0.48, type: 'sine', gain: 0.14, filterFrequency: 420, wet: 0.24 });
      playTone({ frequency: 523.25, duration: 0.2, type: 'triangle', gain: 0.095, pan: -0.32, wet: 0.52 });
      playTone({ frequency: 1046.5, duration: 0.22, type: 'sine', gain: 0.042, detune: 5, pan: -0.22, wet: 0.68 });
      playTone({ frequency: 659.25, start: 0.12, duration: 0.22, type: 'triangle', gain: 0.095, pan: 0.22, wet: 0.54 });
      playTone({ frequency: 1318.51, start: 0.12, duration: 0.24, type: 'sine', gain: 0.04, detune: -5, pan: 0.3, wet: 0.7 });
      playTone({ frequency: 783.99, start: 0.24, duration: 0.26, type: 'triangle', gain: 0.1, pan: -0.12, wet: 0.58 });
      playTone({ frequency: 1567.98, start: 0.24, duration: 0.28, type: 'sine', gain: 0.038, detune: 4, pan: 0.12, wet: 0.72 });
      playTone({ frequency: 1046.5, start: 0.38, duration: 0.62, type: 'triangle', gain: 0.115, pan: 0.08, wet: 0.72 });
      playTone({ frequency: 2093, start: 0.38, duration: 0.48, type: 'sine', gain: 0.046, detune: -4, pan: -0.08, wet: 0.82 });
      playTone({ frequency: 261.63, start: 0.4, duration: 0.72, type: 'sine', gain: 0.075, filterFrequency: 900, wet: 0.42 });
      playTone({ frequency: 783.99, start: 0.72, duration: 0.42, type: 'sine', gain: 0.032, pan: -0.28, wet: 0.86 });
      playTone({ frequency: 1046.5, start: 0.88, duration: 0.48, type: 'sine', gain: 0.026, pan: 0.3, wet: 0.9 });
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
      if (item.edited) button.classList.add('custom');
      button.innerHTML = `<strong>${item.order}</strong><span>${item.custom ? '自定义' : item.edited ? '已编辑' : item.focus}</span>`;
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
    const canControlLauncher = selectedLauncherCanShoot();
    ui.levelNumber.textContent = String(state.levelIndex + 1);
    ui.levelName.textContent = current.name;
    ui.levelFocus.textContent = current.focus;
    ui.launcherName.textContent = launcher.id;
    ui.openMenu.textContent = state.testLevel?.editorTest ? '回到编辑器' : '返回关卡菜单';
    ui.editCurrentLevel.textContent = state.testLevel?.editorTest ? '编辑器试玩中' : '编辑当前关卡';
    ui.editCurrentLevel.disabled = Boolean(state.testLevel?.editorTest);
    ui.angleValue.textContent = `${Math.round(launcher.angle)}°`;
    launcher.power = fixedLauncherPower;
    ui.powerValue.textContent = String(fixedLauncherPower);
    ui.previewLengthValue.textContent = String(Math.round(state.previewDistance));
    ui.angle.disabled = !canControlLauncher;
    ui.power.disabled = true;
    ui.prevLevel.disabled = Boolean(state.testLevel) || state.levelIndex === 0;
    ui.nextLevel.disabled = Boolean(state.testLevel) || state.levelIndex === levels.length - 1;
    ui.shoot.disabled = state.mode !== 'play' || Boolean(state.ball && state.ball.active) || state.completed || !canControlLauncher;
    ui.shoot.textContent = '发射 Space';

    ui.launcherButtons.innerHTML = '';
    state.launchers.forEach((item, index) => {
      const loaded = launcherIsLoaded('start', index);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${item.id} · ${loaded ? '有球' : '空'}`;
      button.className = loaded ? 'active' : '';
      button.disabled = !loaded;
      button.addEventListener('click', () => {
        if (state.ball && state.ball.active) return;
        selectStartLauncher(index);
        setStatus(`${item.id} 内有球。调整方向后再次发射，力度固定为 700。`, 'var(--green)');
      });
      ui.launcherButtons.append(button);
    });
    state.relayLaunchers.forEach((item, index) => {
      const loaded = launcherIsLoaded('relay', index);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${item.id} · ${loaded ? '有球' : '空'}`;
      button.className = `relay ${loaded ? 'active' : ''}`;
      button.disabled = !loaded;
      button.addEventListener('click', () => {
        if (state.ball && state.ball.active) return;
        selectRelayLauncher(index);
        setStatus(`${item.id} 内有球。重新瞄准后再次发射，位置固定，力度固定为 700。`, 'var(--green)');
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
    clearShotPaths();
    hideCompletionPrompt();
    hideUnsavedEditorPrompt();
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
    clearShotPaths();
    hideCompletionPrompt();
    hideUnsavedEditorPrompt();
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
    clearShotPaths();
    hideCompletionPrompt();
    hideUnsavedEditorPrompt();
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
        state.editor.source = { type: 'custom', id: custom.id };
      } else {
        state.editor.draft = createEditorDraft();
        state.editor.savedId = null;
        state.editor.source = { type: 'new' };
      }
    } else {
      state.editor.draft = createEditorDraft();
      state.editor.savedId = null;
      state.editor.source = { type: 'new' };
    }
    applyMapSize(state.editor.draft.mapSize);
    state.editor.selected = { type: 'launcher', index: 0 };
    resetEditorHistory();
    markEditorClean();
    ui.editorLevelName.value = state.editor.draft.name;
    setEditorStatus('选择组件后，在画布中拖动摆放。保存后会加入关卡菜单。', 'var(--blue)');
    syncEditorUi();
  }

  function openEditorForLevel(index = state.levelIndex) {
    const levels = allLevels();
    const selected = levels[index];
    if (!selected) {
      openEditor();
      return;
    }
    state.mode = 'editor';
    state.testLevel = null;
    state.ball = null;
    clearShotPaths();
    hideCompletionPrompt();
    ui.startScreen.classList.add('hidden');
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.add('hidden');
    ui.editorPanel.classList.remove('hidden');
    state.editor.draft = levelToDraft(selected);
    if (index < officialLevels.length) {
      state.editor.savedId = `official-${index + 1}`;
      state.editor.source = { type: 'official', index };
    } else {
      state.editor.savedId = selected.id;
      state.editor.source = { type: 'custom', id: selected.id };
    }
    applyMapSize(state.editor.draft.mapSize);
    state.editor.selected = { type: 'launcher', index: 0 };
    resetEditorHistory();
    markEditorClean();
    ui.editorLevelName.value = state.editor.draft.name;
    setEditorStatus('正在编辑当前关卡。保存后会替换原来的关卡。', 'var(--green)');
    syncEditorUi();
  }

  function showCompletionPrompt() {
    if (state.testLevel?.editorTest) {
      state.completionResult = {
        title: '试玩命中成功',
        body: '草稿可以完成。可以回编辑器继续调整，也可以直接保存。',
      };
      ui.completeTitle.textContent = state.completionResult.title;
      ui.completeBody.textContent = state.completionResult.body;
      ui.continueLevel.textContent = '回到编辑器继续修改';
      ui.replayLevel.textContent = '保存并返回菜单';
      ui.continueLevel.className = 'primary';
      ui.replayLevel.className = '';
      ui.continueLevel.classList.remove('hidden');
      ui.completeActions.classList.remove('single-action');
      ui.dialog.classList.remove('hidden');
      ui.continueLevel.focus();
      return;
    }
    const result = buildCompletionResult({
      levelIndex: state.levelIndex,
      levelCount: allLevels().length,
    });
    state.completedLevels.add(state.levelIndex);
    state.completionResult = result;
    ui.completeTitle.textContent = result.title;
    ui.completeBody.textContent = result.body;
    ui.continueLevel.textContent = result.primaryLabel;
    ui.replayLevel.textContent = result.secondaryLabel;
    ui.continueLevel.className = 'primary next-level-action';
    ui.replayLevel.className = '';
    ui.continueLevel.classList.toggle('hidden', !result.hasNextLevel);
    ui.completeActions.classList.toggle('single-action', !result.hasNextLevel);
    ui.dialog.classList.remove('hidden');
    if (result.hasNextLevel) ui.continueLevel.focus();
    else ui.replayLevel.focus();
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
    applyMapSize(currentMapSize());
    state.ball = null;
    clearShotPaths();
    state.completed = false;
    state.effects = [];
    state.successPulse = null;
    state.launchers = cloneLevelLaunchers(level());
    state.relayLaunchers = cloneRelayLaunchers(level());
    state.obstacles = cloneLevelObstacles(level());
    state.switches = cloneSwitches(level());
    state.doors = cloneDoors(level());
    state.activeLauncherIndex = 0;
    state.selectedDeviceType = 'start';
    state.selectedRelayIndex = 0;
    state.shotEvents = null;
    hideCompletionPrompt();
    syncControlsFromLauncher();
    if (!keepStatus) setStatus(level().hint, 'var(--blue)');
    syncUi();
  }

  function resetAttemptRuntime() {
    state.ball = null;
    state.completed = false;
    state.effects = [];
    state.successPulse = null;
    state.obstacles = cloneLevelObstacles(level());
    state.switches = cloneSwitches(level());
    state.doors = cloneDoors(level());
    state.selectedDeviceType = 'start';
    state.activeLauncherIndex = 0;
    state.selectedRelayIndex = 0;
    state.shotEvents = null;
    hideCompletionPrompt();
    syncControlsFromLauncher();
  }

  function finishFailedAttempt(message, soundName) {
    if (!state.ball) return;
    state.ball.active = false;
    if (!isFailedAttempt(state.ball)) return;
    keepFailedShotPath();
    resetAttemptRuntime();
    setStatus(`${message} 关卡已重置，可以立即从 A1 重新发射。`, 'var(--red)');
    if (soundName) playSound(soundName);
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
    if (!selectedLauncherCanShoot()) return;
    const launcher = shotLauncher();
    const firedFromRelay = state.selectedDeviceType === 'relay';
    launcher.power = fixedLauncherPower;
    const vector = launcherVector(launcher);
    clearFailedShotPath();
    rememberAimPreview(launcher);
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
    recordShotPoint({ x: state.ball.x, y: state.ball.y });
    if (!state.shotEvents) {
      state.shotEvents = {
        wallBounces: 0,
        obstacleBounces: new Set(),
        boostBounces: new Set(),
        teleports: new Set(),
        relayLaunches: new Set(),
        switchHits: new Set(),
        launcherReturns: 0,
        hitMovingObstacle: false,
      };
    }
    if (firedFromRelay) state.shotEvents.relayLaunches.add(launcher.id);
    playSound('shoot');
    setStatus(`${launcher.id} 已发射。球进入任意发射器后会停下，等待你重新瞄准。`, 'var(--amber)');
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

  function completeCurrentLevel() {
    state.ball.active = false;
    clearActiveShotPath();
    state.completed = true;
    spawnSuccessEffect();
    playSound('success');
    setStatus('命中 B 点。', 'var(--green)');
    showCompletionPrompt();
    syncUi();
  }

  function updateStep(dt) {
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
    if (state.lastFailedShotPath) {
      state.lastFailedShotPath.age += dt;
      if (state.lastFailedShotPath.age >= state.lastFailedShotPath.duration) state.lastFailedShotPath = null;
    }
    if (state.mode !== 'play') return;
    if (!state.ball || !state.ball.active) return;

    const previous = { x: state.ball.x, y: state.ball.y };
    stepBall(state.ball, dt);
    const targetHitDuringMovement = targetHitThisFrame(previous, state.ball, current.target, state.ball.radius, false);
    const wallResult = resolveArenaWalls(state.ball, arena, arenaWallModes(current), 0.96);
    const wallBounced = wallResult.bounced;
    if (wallBounced && state.shotEvents) state.shotEvents.wallBounces += 1;

    if (wallResult.stuck) {
      if (targetHitDuringMovement) {
        completeCurrentLevel();
        return;
      }
      recordShotPoint({ x: state.ball.x, y: state.ball.y });
      finishFailedAttempt('碰到黄色卸力边界，球被吸住了。这个关卡不能依赖这条外框反弹。', 'stickyImpact');
      return;
    }

    let obstacleBounced = false;
    let stickyHit = false;
    let boostHit = false;
    let normalObstacleHit = false;
    state.obstacles.concat(activeDoorObstacles()).forEach((obstacle) => {
      const hitObstacle = resolveShapedObstacleBounce(state.ball, obstacle, obstacleRestitution(obstacle));
      if (hitObstacle && state.shotEvents) {
        state.shotEvents.obstacleBounces.add(obstacle.id);
        if (obstacle.material === 'boost') state.shotEvents.boostBounces.add(obstacle.id);
        if (obstacle.path) state.shotEvents.hitMovingObstacle = true;
      }
      if (hitObstacle && obstacle.material === 'sticky') stickyHit = true;
      if (hitObstacle && obstacle.material === 'boost') boostHit = true;
      if (hitObstacle && obstacle.material !== 'boost' && obstacle.material !== 'sticky') normalObstacleHit = true;
      obstacleBounced = hitObstacle || obstacleBounced;
    });

    if (stickyHit) {
      if (targetHitDuringMovement) {
        completeCurrentLevel();
        return;
      }
      recordShotPoint({ x: state.ball.x, y: state.ball.y });
      finishFailedAttempt('碰到黄色卸力墙，球被吸住了。避开这片区域再试。', 'stickyImpact');
      return;
    }

    const switchHit = updateSwitchHits(state.ball);

    const beforePortal = { x: state.ball.x, y: state.ball.y };
    const teleported = tryTeleport(state.ball, current.portals);
    if (teleported) recordShotPoint(beforePortal);
    if (teleported && state.shotEvents) {
      const entry = current.portals.find((portal) => (
        Math.hypot(beforePortal.x - portal.x, beforePortal.y - portal.y) <= portal.radius + state.ball.radius
      ));
      if (entry) state.shotEvents.teleports.add(entry.id);
    }

    if (targetHitDuringMovement || targetHitThisFrame(previous, state.ball, current.target, state.ball.radius, teleported)) {
      completeCurrentLevel();
      return;
    }

    let capturedType = 'start';
    let capturedLauncher = tryLauncherCapture(state.ball, state.launchers);
    if (!capturedLauncher) {
      capturedType = 'relay';
      capturedLauncher = tryLauncherCapture(state.ball, state.relayLaunchers);
    }
    if (capturedLauncher) {
      if (capturedType === 'start') {
        const capturedIndex = state.launchers.findIndex((launcher) => launcher.id === capturedLauncher.id);
        state.activeLauncherIndex = capturedIndex;
        state.selectedDeviceType = 'start';
        if (state.shotEvents) state.shotEvents.launcherReturns += 1;
      } else {
        state.selectedRelayIndex = state.relayLaunchers.findIndex((launcher) => launcher.id === capturedLauncher.id);
        state.selectedDeviceType = 'relay';
      }
      clearActiveShotPath();
      playSound('relay');
      state.effects.push({ x: capturedLauncher.x, y: capturedLauncher.y, vx: 0, vy: 0, age: 0, duration: 0.42, radius: 18, color: relayColor });
      setStatus(`${capturedLauncher.id} 接住了球。开关和门保持当前状态，请重新瞄准后再次发射。`, 'var(--green)');
      syncControlsFromLauncher();
      syncUi();
      return;
    }

    if (switchHit) playSound('switch');
    else if (teleported) playSound('portal');
    else if ((wallBounced || obstacleBounced) && performance.now() - state.lastImpactSoundAt > 70) {
      state.lastImpactSoundAt = performance.now();
      if (boostHit) playSound('boostImpact');
      else if (normalObstacleHit || wallBounced) playSound('impact');
    }

    state.ball.vx *= 0.998;
    state.ball.vy *= 0.998;
    recordShotPoint({ x: state.ball.x, y: state.ball.y }, { break: teleported });
    state.ball.trail.push({ x: state.ball.x, y: state.ball.y });
    if (state.ball.trail.length > 44) state.ball.trail.shift();

    if (Math.hypot(state.ball.vx, state.ball.vy) < 28) {
      finishFailedAttempt('球停下了，本次尝试失败。');
    }
  }

  function update(dt) {
    const fixedStep = 1 / 60;
    state.physicsAccumulator = Math.min(state.physicsAccumulator + Math.max(0, dt), 0.1);

    while (state.physicsAccumulator >= fixedStep) {
      updateStep(fixedStep);
      state.physicsAccumulator -= fixedStep;
    }
  }

  function simulatePreview(launcher, levelData, obstacleData, relayData, runtime = null) {
    const vector = launcherVector(launcher);
    const ball = createBall({ x: launcher.x, y: launcher.y, vx: vector.x * vector.speed, vy: vector.y * vector.speed, radius: 9 });
    ball.originLauncherId = launcher.id;
    ball.launcherCooldown = 0.18;
    const previewObstacles = obstacleData.map((obstacle) => ({ ...obstacle, path: obstacle.path ? { ...obstacle.path } : undefined }));
    const previewSwitches = (runtime?.switches || levelData.switches || []).map((switchItem) => ({
      ...switchItem,
      activated: Boolean(runtime ? switchItem.activated : false),
    }));
    const previewDoors = (runtime?.doors || levelData.doors || []).map((door) => ({
      ...door,
      open: Boolean(runtime ? door.open : false),
    }));
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
      if (targetHitThisFrame(previous, ball, levelData.target, ball.radius, teleported)) break;
      const captureLaunchers = [...(levelData.launchers || []), ...(relayData || [])];
      if (tryLauncherCapture(ball, captureLaunchers)) {
        points.push({ x: ball.x, y: ball.y });
        break;
      }
      ball.vx *= 0.998;
      ball.vy *= 0.998;
      travelled += Math.hypot(ball.x - previous.x, ball.y - previous.y);
      if (i % 3 === 0) points.push({ x: ball.x, y: ball.y });
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

  function obstacleCenter(obstacle) {
    if (obstacle.shape === 'circle' || obstacle.shape === 'triangle') {
      return { x: obstacle.x, y: obstacle.y };
    }
    return {
      x: obstacle.x + (obstacle.width || 90) / 2,
      y: obstacle.y + (obstacle.height || 34) / 2,
    };
  }

  function obstacleSize(obstacle) {
    if (obstacle.shape === 'circle') {
      const diameter = (obstacle.radius || 28) * 2;
      return { width: diameter, height: diameter };
    }
    return {
      width: obstacle.width || (obstacle.shape === 'triangle' ? 96 : 90),
      height: obstacle.height || (obstacle.shape === 'triangle' ? 84 : 34),
    };
  }

  function obstacleLocalToWorld(obstacle, localX, localY) {
    const center = obstacleCenter(obstacle);
    const angle = (obstacle.angle || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center.x + localX * cos - localY * sin,
      y: center.y + localX * sin + localY * cos,
    };
  }

  function pointToObstacleLocal(point, obstacle, centerOverride = obstacleCenter(obstacle), angleOverride = obstacle.angle || 0) {
    const angle = angleOverride * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - centerOverride.x;
    const dy = point.y - centerOverride.y;
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  }

  function setObstacleCenter(obstacle, center) {
    if (obstacle.shape === 'circle' || obstacle.shape === 'triangle') {
      obstacle.x = center.x;
      obstacle.y = center.y;
      return;
    }
    obstacle.x = center.x - (obstacle.width || 90) / 2;
    obstacle.y = center.y - (obstacle.height || 34) / 2;
  }

  function normalizeAngle(angle) {
    let normalized = angle;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    return normalized;
  }

  function obstacleTransformHandles(obstacle) {
    const size = obstacleSize(obstacle);
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;
    const rotateDistance = halfHeight + 36;
    const handles = [
      { mode: 'rotate', handle: 'rotate', point: obstacleLocalToWorld(obstacle, 0, -rotateDistance) },
    ];

    if (obstacle.shape === 'circle') {
      const radius = obstacle.radius || 28;
      [
        { handle: 'e', x: radius, y: 0 },
        { handle: 's', x: 0, y: radius },
        { handle: 'w', x: -radius, y: 0 },
        { handle: 'n', x: 0, y: -radius },
      ].forEach((item) => {
        handles.push({ mode: 'resize', handle: item.handle, point: obstacleLocalToWorld(obstacle, item.x, item.y) });
      });
      return handles;
    }

    [
      { handle: 'nw', x: -halfWidth, y: -halfHeight },
      { handle: 'ne', x: halfWidth, y: -halfHeight },
      { handle: 'se', x: halfWidth, y: halfHeight },
      { handle: 'sw', x: -halfWidth, y: halfHeight },
    ].forEach((item) => {
      handles.push({ mode: 'resize', handle: item.handle, point: obstacleLocalToWorld(obstacle, item.x, item.y) });
    });
    return handles;
  }

  function drawObstacleTransformHandles(obstacle) {
    const center = obstacleCenter(obstacle);
    const rotateHandle = obstacleTransformHandles(obstacle).find((handle) => handle.mode === 'rotate');
    const handles = obstacleTransformHandles(obstacle).filter((handle) => handle.mode === 'resize');

    ctx.save();
    ctx.strokeStyle = 'rgba(244,247,251,0.78)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    traceObstacleShape(obstacle);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(103,240,255,0.76)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(rotateHandle.point.x, rotateHandle.point.y);
    ctx.stroke();

    ctx.fillStyle = '#67f0ff';
    ctx.strokeStyle = '#07120d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rotateHandle.point.x, rotateHandle.point.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#07120d';
    ctx.font = '900 11px Microsoft YaHei, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻', rotateHandle.point.x, rotateHandle.point.y + 0.5);

    handles.forEach((handle) => {
      ctx.save();
      ctx.translate(handle.point.x, handle.point.y);
      ctx.rotate((obstacle.angle || 0) * Math.PI / 180);
      ctx.fillStyle = '#f4f7fb';
      ctx.strokeStyle = '#67f0ff';
      ctx.lineWidth = 2;
      roundRectPath(-6, -6, 12, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
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
      ctx.fillText('吸', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 1);
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
        ctx.strokeStyle = 'rgba(244,247,251,0.38)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
        drawObstacleTransformHandles(obstacle);
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
    if (!selectedLauncherCanShoot()) return;
    const current = level();
    drawPreviewPath(
      simulatePreview(
        selectedLauncher(),
        current,
        state.obstacles,
        state.relayLaunchers,
        { switches: state.switches, doors: state.doors },
      ),
      state.selectedDeviceType === 'relay' ? emptyLauncherColor : launcherColor,
      0.72,
    );
  }

  function drawLastAimPreview() {
    if (state.mode !== 'play') return;
    if (state.completed) return;
    if (!state.lastAimPreviewPath || state.lastAimPreviewPath.length < 2) return;
    drawPreviewPath(
      state.lastAimPreviewPath,
      '#b8efff',
      state.ball && state.ball.active ? 0.46 : 0.32,
    );
  }

  function drawFailedShotPath() {
    const trace = state.lastFailedShotPath;
    if (!trace || !trace.points || trace.points.length < 2 || state.completed) return;
    const fadeStart = trace.duration * 0.58;
    const fadeProgress = trace.age <= fadeStart ? 0 : (trace.age - fadeStart) / (trace.duration - fadeStart);
    const alpha = Math.max(0, 0.76 * (1 - fadeProgress));
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#b8efff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(85, 167, 255, 0.38)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    let needsMove = true;
    trace.points.forEach((point, index) => {
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

  function drawLaunchers() {
    state.launchers.forEach((launcher, index) => {
      const loaded = launcherCanAim('start', index);
      drawLauncherShape(launcher, loaded ? launcherColor : emptyLauncherColor, launcher.id.replace('A', ''), loaded);
    });
  }

  function drawRelayLaunchers() {
    state.relayLaunchers.forEach((launcher, index) => {
      const loaded = launcherIsLoaded('relay', index);
      ctx.save();
      ctx.strokeStyle = loaded ? relayGlow : emptyLauncherGlow;
      ctx.lineWidth = loaded ? 4 : 3;
      ctx.beginPath();
      ctx.arc(launcher.x, launcher.y, (launcher.radius || 22) + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawLauncherShape(launcher, loaded ? relayColor : emptyLauncherColor, launcher.id.replace('R', 'R'), loaded);
    });
  }

  function drawBall() {
    if (!state.ball) return;
    ctx.save();
    if (state.ball.active) {
      state.ball.trail.forEach((point, index) => {
        const alpha = index / state.ball.trail.length;
        ctx.fillStyle = `rgba(85, 167, 255, ${alpha * 0.34})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 + alpha * 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
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
      ctx.fillText('绿色发射器有球，紫色发射器为空', arena.x + 16, arena.y + 24);
      const stickySides = Object.values(arenaWallModes()).filter((mode) => mode === 'sticky').length;
      const wallTip = stickySides > 0 ? '黄色外框会卸力，尽量不要碰边界' : '普通外框可以反弹';
      ctx.fillText(state.relayLaunchers.length > 0 ? `球进入 A 或 R 后会停下，等待重新瞄准｜${wallTip}` : wallTip, arena.x + 424, arena.y + arena.height - 18);
    }
    ctx.restore();
  }

  function renderGame() {
    drawArena(level());
    drawLastAimPreview();
    drawPreview();
    drawFailedShotPath();
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
      drawPreviewPath(simulatePreview(launcher, draft, obstacles, draft.relayLaunchers), launcherColor, 0.45);
      drawLauncherShape(launcher, launcherColor, launcher.id.replace('A', ''), selectedIs('launcher', index));
    });
    draft.relayLaunchers.forEach((relay, index) => {
      drawPreviewPath(simulatePreview(relay, draft, obstacles, draft.relayLaunchers), emptyLauncherColor, 0.5);
      drawLauncherShape(relay, emptyLauncherColor, relay.id.replace('R', 'R'), selectedIs('relay', index));
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
    const mapSize = normalizeMapSize(state.editor.draft.mapSize);
    ui.editorMapSmall.classList.toggle('active', mapSize === 'small');
    ui.editorMapMedium.classList.toggle('active', mapSize === 'medium');
    ui.editorX.min = String(arena.x);
    ui.editorY.min = String(arena.y);
    ui.editorX.max = String(canvas.width);
    ui.editorY.max = String(canvas.height);
    ui.editorWidth.max = String(arena.width);
    ui.editorHeight.max = String(arena.height);
    ui.editorRadius.max = String(Math.round(Math.min(arena.width, arena.height) / 3));
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
    syncEditorHistoryButtons();
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
    if (tool === 'start' && draft.launchers.length >= 1) {
      setEditorStatus('每个关卡只能有一个开局持球的 A 发射器；其余接球点请使用 R 空发射器。', 'var(--red)');
      return;
    }
    beginEditorHistory();
    if (tool === 'start') {
      const id = `A${draft.launchers.length + 1}`;
      draft.launchers.push({ id, x: 128, y: 220 + draft.launchers.length * 72, angle: 0, power: fixedLauncherPower });
      state.editor.selected = { type: 'launcher', index: draft.launchers.length - 1 };
    } else if (tool === 'relay') {
      const id = `R${draft.relayLaunchers.length + 1}`;
      draft.relayLaunchers.push({ id, x: 420, y: 316, radius: 24, angle: 0, power: fixedLauncherPower, movable: true, purpose: '自定义空发射器；接到球后可手动瞄准并发射。' });
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
    commitEditorHistory();
    state.editor.tool = tool;
    setEditorStatus(`${editorSelectionLabel()} 已添加。可以直接拖动或修改右侧数值。`, 'var(--amber)');
    syncEditorUi();
  }

  function switchEditorMapSize(size) {
    const nextSize = normalizeMapSize(size);
    const currentSize = normalizeMapSize(state.editor.draft.mapSize);
    if (nextSize === currentSize) return;
    beginEditorHistory();
    scaleDraftBetweenMaps(state.editor.draft, currentSize, nextSize);
    applyMapSize(nextSize);
    clampEditorObject(getEditorObject());
    commitEditorHistory();
    setEditorStatus(`已切换到${mapConfig(nextSize).label}，现有组件已按比例放大/缩小。`, 'var(--green)');
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

  function hitEditorTransformHandle(point) {
    if (!state.editor.selected || state.editor.selected.type !== 'obstacle') return null;
    const obstacle = getEditorObject();
    if (!obstacle) return null;
    const handles = obstacleTransformHandles(obstacle);

    for (const handle of handles) {
      const radius = handle.mode === 'rotate' ? 13 : 10;
      if (Math.hypot(point.x - handle.point.x, point.y - handle.point.y) <= radius) {
        return handle;
      }
    }
    return null;
  }

  function cloneObstacleForTransform(obstacle) {
    return {
      ...obstacle,
      path: obstacle.path ? { ...obstacle.path } : undefined,
      center: obstacleCenter(obstacle),
    };
  }

  function beginEditorTransform(point, handle) {
    const object = getEditorObject();
    state.editor.dragging = true;
    state.editor.dragMode = handle.mode;
    state.editor.transformStart = {
      handle: handle.handle,
      object: cloneObstacleForTransform(object),
      pointer: point,
    };
  }

  function resizeObstacleFromPointer(object, point, start) {
    const source = start.object;
    const center = source.center;

    if (source.shape === 'circle') {
      const radius = clamp(Math.hypot(point.x - center.x, point.y - center.y), 12, 160);
      object.radius = radius;
      object.width = radius * 2;
      object.height = radius * 2;
      object.x = center.x;
      object.y = center.y;
      return;
    }

    const local = pointToObstacleLocal(point, source, center, source.angle || 0);
    const width = clamp(Math.abs(local.x) * 2, 20, 500);
    const height = clamp(Math.abs(local.y) * 2, 20, 500);
    object.width = width;
    object.height = height;
    object.angle = source.angle || 0;
    if (source.shape === 'triangle') {
      object.x = center.x;
      object.y = center.y;
    } else {
      object.x = center.x - width / 2;
      object.y = center.y - height / 2;
    }
  }

  function rotateObstacleFromPointer(object, point, start) {
    const center = start.object.center;
    object.angle = normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI + 90);
    setObstacleCenter(object, center);
  }

  function transformEditorSelection(point) {
    const object = getEditorObject();
    const start = state.editor.transformStart;
    if (!object || !start) return;

    if (state.editor.dragMode === 'rotate') {
      rotateObstacleFromPointer(object, point, start);
    } else if (state.editor.dragMode === 'resize') {
      resizeObstacleFromPointer(object, point, start);
    }
    clampEditorObject(object);
    syncEditorUi();
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
    beginEditorHistory();
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
      beginEditorHistory();
      draft.launchers.splice(selection.index, 1);
      draft.launchers.forEach((launcher, index) => { launcher.id = `A${index + 1}`; });
    } else if (selection.type === 'relay') {
      beginEditorHistory();
      draft.relayLaunchers.splice(selection.index, 1);
      draft.relayLaunchers.forEach((relay, index) => { relay.id = `R${index + 1}`; });
    } else if (selection.type === 'obstacle') {
      beginEditorHistory();
      draft.obstacles.splice(selection.index, 1);
    } else if (selection.type === 'switch') {
      beginEditorHistory();
      draft.switches.splice(selection.index, 1);
    } else if (selection.type === 'door') {
      beginEditorHistory();
      draft.doors.splice(selection.index, 1);
    } else if (selection.type === 'portal') {
      beginEditorHistory();
      const portal = draft.portals[selection.index];
      draft.portals = draft.portals.filter((item) => item.id !== portal.id && item.id !== portal.pairId);
    }
    state.editor.selected = { type: 'launcher', index: 0 };
    commitEditorHistory();
    setEditorStatus('组件已删除。', 'var(--amber)');
    syncEditorUi();
  }

  function saveEditedLevel(options = {}) {
    const { exitAfterSave = false } = options;
    commitEditorHistory();
    const draft = state.editor.draft;
    draft.name = ui.editorLevelName.value.trim() || '我的关卡';
    if (draft.launchers.length === 0 || !draft.target) {
      setEditorStatus('保存失败：至少需要一个 A 发射器和一个 B 目标。', 'var(--red)');
      return null;
    }
    if (state.editor.source?.type === 'official') {
      const index = state.editor.source.index;
      const custom = draftToLevel(draft, 0);
      const override = normalizeOfficialOverride({
        ...custom,
        id: `official-${index + 1}`,
        name: draft.name,
        focus: '已编辑布局',
        hint: '这是你修改后的关卡。调整发射器，让球碰到 B 点。',
        requiredMechanics: [],
      }, index);
      if (!override) {
        setEditorStatus('保存失败：找不到原关卡。', 'var(--red)');
        return null;
      }
      state.levelOverrides[String(index)] = override;
      saveLevelOverrides();
      state.levelIndex = index;
      syncLevelMenu();
      markEditorClean();
      setEditorStatus('关卡已保存，并已替换原关卡。', 'var(--green)');
      if (exitAfterSave) openLevelMenu();
      else syncEditorUi();
      return override.id;
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
      state.editor.source = { type: 'custom', id: custom.id };
    }
    state.customLevels = state.customLevels.map((item, index) => normalizeCustomLevel(item, index)).filter(Boolean);
    saveCustomLevels();
    syncLevelMenu();
    markEditorClean();
    syncEditorUi();
    setEditorStatus('关卡已保存，并已加入关卡菜单。', 'var(--green)');
    if (exitAfterSave) openLevelMenu();
    return custom.id;
  }

  function playEditedLevel() {
    commitEditorHistory();
    const draft = state.editor.draft;
    draft.name = ui.editorLevelName.value.trim() || '试玩草稿';
    if (draft.launchers.length === 0 || !draft.target) {
      setEditorStatus('试玩失败：至少需要一个 A 发射器和一个 B 目标。', 'var(--red)');
      return;
    }
    state.testLevel = draftToLevel(draft, state.customLevels.length);
    state.testLevel.name = `${draft.name}（试玩）`;
    state.testLevel.focus = '草稿试玩';
    state.testLevel.editorTest = true;
    state.mode = 'play';
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.remove('hidden');
    ui.editorPanel.classList.add('hidden');
    state.levelIndex = allLevels().length - 1;
    resetLevel();
  }

  function returnToEditorFromTest() {
    state.mode = 'editor';
    state.testLevel = null;
    state.ball = null;
    clearShotPaths();
    state.completed = false;
    hideCompletionPrompt();
    ui.startScreen.classList.add('hidden');
    ui.levelMenu.classList.add('hidden');
    ui.shell.classList.remove('menu-open');
    ui.playPanel.classList.add('hidden');
    ui.editorPanel.classList.remove('hidden');
    applyMapSize(state.editor.draft.mapSize);
    setEditorStatus('已回到编辑器，可以继续修改或保存。', 'var(--green)');
    syncEditorUi();
  }

  function exitEditorWithoutSaving() {
    if (editorHasUnsavedChanges()) {
      showUnsavedEditorPrompt();
      return;
    }
    discardEditorAndExit();
  }

  function discardEditorAndExit() {
    hideUnsavedEditorPrompt();
    state.editor.draft = createEditorDraft();
    state.editor.savedId = null;
    state.editor.source = { type: 'new' };
    state.editor.selected = { type: 'launcher', index: 0 };
    markEditorClean();
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
  ui.openMenu.addEventListener('click', () => {
    if (state.testLevel?.editorTest) returnToEditorFromTest();
    else openLevelMenu();
  });
  ui.editCurrentLevel.addEventListener('click', () => openEditorForLevel(state.levelIndex));
  ui.prevLevel.addEventListener('click', () => startLevel(state.levelIndex - 1));
  ui.nextLevel.addEventListener('click', () => startLevel(state.levelIndex + 1));
  ui.shoot.addEventListener('click', shoot);
  ui.reset.addEventListener('click', () => resetLevel());
  ui.continueLevel.addEventListener('click', () => {
    ensureAudio();
    if (state.testLevel?.editorTest) returnToEditorFromTest();
    else if (state.completionResult?.hasNextLevel) startLevel(state.levelIndex + 1);
    else openLevelMenu();
  });
  ui.replayLevel.addEventListener('click', () => {
    ensureAudio();
    if (state.testLevel?.editorTest) saveEditedLevel({ exitAfterSave: true });
    else openLevelMenu();
  });
  ui.angle.addEventListener('input', () => {
    if (state.mode !== 'play') return;
    if (!selectedLauncherCanShoot()) return;
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
    beginEditorHistory();
    state.editor.draft.name = ui.editorLevelName.value;
  });
  ui.editorLevelName.addEventListener('change', commitEditorHistory);
  ui.editorLevelName.addEventListener('blur', commitEditorHistory);
  ui.newCustomLevel.addEventListener('click', () => {
    beginEditorHistory();
    state.editor.draft = createEditorDraft();
    state.editor.savedId = null;
    state.editor.source = { type: 'new' };
    state.editor.selected = { type: 'launcher', index: 0 };
    ui.editorLevelName.value = state.editor.draft.name;
    applyMapSize(state.editor.draft.mapSize);
    commitEditorHistory();
    setEditorStatus('已创建新的空白关卡。', 'var(--blue)');
    syncEditorUi();
  });
  ui.saveEditorExit.addEventListener('click', () => {
    hideUnsavedEditorPrompt();
    saveEditedLevel({ exitAfterSave: true });
  });
  ui.discardEditorExit.addEventListener('click', discardEditorAndExit);
  ui.undoEditor.addEventListener('click', undoEditorChange);
  ui.redoEditor.addEventListener('click', redoEditorChange);
  ui.editorMapSmall.addEventListener('click', () => switchEditorMapSize('small'));
  ui.editorMapMedium.addEventListener('click', () => switchEditorMapSize('medium'));
  ui.saveCustomLevel.addEventListener('click', saveEditedLevel);
  ui.playEditedLevel.addEventListener('click', playEditedLevel);
  ui.backToMenuFromEditor.addEventListener('click', exitEditorWithoutSaving);
  ui.deleteEditorObject.addEventListener('click', deleteEditorSelection);
  [ui.editorX, ui.editorY, ui.editorWidth, ui.editorHeight, ui.editorRadius, ui.editorMaterial, ui.editorAngle, ui.editorPower, ui.editorPathX, ui.editorPathY, ui.editorSpeed].forEach((input) => {
    input.addEventListener('input', applyEditorPropertyChange);
    input.addEventListener('change', () => {
      applyEditorPropertyChange();
      commitEditorHistory();
    });
    input.addEventListener('blur', commitEditorHistory);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (state.mode === 'editor') {
      const point = screenToWorld(event);
      const transformHandle = hitEditorTransformHandle(point);
      if (transformHandle) {
        beginEditorHistory();
        beginEditorTransform(point, transformHandle);
        canvas.setPointerCapture(event.pointerId);
        setEditorStatus(transformHandle.mode === 'rotate' ? '拖动蓝色旋转手柄调整墙体角度。' : '拖动白色尺寸手柄调整墙体大小。', 'var(--amber)');
        syncEditorUi();
        return;
      }
      const selection = hitEditorObject(point);
      if (selection) {
        state.editor.selected = selection;
        const object = getEditorObject(selection);
        beginEditorHistory();
        state.editor.dragging = true;
        state.editor.dragMode = 'move';
        state.editor.dragOffset = { x: point.x - object.x, y: point.y - object.y };
        canvas.setPointerCapture(event.pointerId);
        syncEditorUi();
      }
      return;
    }
    if (state.mode !== 'play') return;
    if (state.ball && state.ball.active) return;
    if (!selectedLauncherCanShoot()) return;
    canvas.focus({ preventScroll: true });
    const point = screenToWorld(event);
    const relayIndex = relayAtPoint(point);
    if (relayIndex >= 0) {
      if (!launcherIsLoaded('relay', relayIndex)) {
        setStatus(`${state.relayLaunchers[relayIndex].id} 目前是空发射器。球进入后才能瞄准和发射。`, 'var(--amber)');
        return;
      }
      selectRelayLauncher(relayIndex);
      canvas.setPointerCapture(event.pointerId);
      state.draggingAim = true;
      state.dragMode = 'aim';
      setStatus(`${state.relayLaunchers[relayIndex].id} 内有球。拖动调整方向后再次发射。`, 'var(--green)');
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    state.draggingAim = true;
    state.dragMode = 'aim';
    updateAimFromPointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (state.mode === 'editor') {
      if (!state.editor.dragging) return;
      const point = screenToWorld(event);
      if (state.editor.dragMode === 'rotate' || state.editor.dragMode === 'resize') {
        transformEditorSelection(point);
      } else {
        moveEditorSelection(point);
      }
      return;
    }
    if (!state.draggingAim) return;
    if (state.dragMode === 'moveRelay') moveSelectedRelayFromPointer(event);
    else updateAimFromPointer(event);
  });

  canvas.addEventListener('pointerup', (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (state.mode === 'editor') commitEditorHistory();
    state.draggingAim = false;
    state.dragMode = null;
    state.editor.dragging = false;
    state.editor.dragMode = null;
    state.editor.transformStart = null;
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
    const key = event.key.toLowerCase();
    const editorUndoKey = state.mode === 'editor' && (event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey;
    const editorRedoKey = state.mode === 'editor' && (event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey));

    if (editorUndoKey) {
      event.preventDefault();
      undoEditorChange();
    } else if (editorRedoKey) {
      event.preventDefault();
      redoEditorChange();
    } else if (defaultShootKey && state.mode === 'play' && !editingText && !usingCommand && ui.dialog.classList.contains('hidden')) {
      event.preventDefault();
      if (!event.repeat) shoot();
    } else if (!editingText && key === 'r' && state.mode === 'play') {
      resetLevel();
    } else if (!editingText && event.key === 'Escape') {
      if (state.testLevel?.editorTest) returnToEditorFromTest();
      else if (state.mode === 'editor') exitEditorWithoutSaving();
      else openLevelMenu();
    } else if (!editingText && event.key === 'Delete' && state.mode === 'editor') {
      deleteEditorSelection();
    }
  });

  setLevel(0);
  openStartScreen();
  requestAnimationFrame(frame);
})();
