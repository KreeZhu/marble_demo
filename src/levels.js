(function exposeLevels(root) {
  'use strict';

  const stickyWalls = { top: 'sticky', right: 'sticky', bottom: 'sticky', left: 'sticky' };
  const topBounceWalls = { ...stickyWalls, top: 'bounce' };
  const leftBounceWalls = { ...stickyWalls, left: 'bounce' };

  const levels = [
    {
      order: 1,
      name: '直线起步',
      focus: '基础方向校准',
      hint: '力度固定为 700。先让发射器保持向右，熟悉发射、重置和轨迹参考。',
      requiredMechanics: [],
      arenaWalls: stickyWalls,
      target: { x: 820, y: 300, radius: 20 },
      launchers: [{ id: 'A1', x: 120, y: 300, angle: 0, power: 700 }],
      relayLaunchers: [],
      obstacles: [],
      portals: [],
    },
    {
      order: 2,
      name: '错位窄门',
      focus: '斜线精确瞄准',
      hint: '两道门缝在同一条斜线上。只调整角度，别让球碰到黄色外框。',
      requiredMechanics: [],
      arenaWalls: stickyWalls,
      target: { x: 824, y: 178, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 454, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -21.4 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'near-gate-top', role: 'deadzone', material: 'sticky', purpose: '第一道门的黄色上沿，碰到即失败并排除过陡角度。', x: 338, y: 36, width: 38, height: 294 },
        { id: 'near-gate-bottom', role: 'deadzone', material: 'sticky', purpose: '第一道门的黄色下沿，碰到即失败并排除过缓角度。', x: 338, y: 390, width: 38, height: 174 },
        { id: 'far-gate-top', role: 'deadzone', material: 'sticky', purpose: '第二道错位门的黄色上沿，禁止借门框反弹通关。', x: 604, y: 36, width: 38, height: 196 },
        { id: 'far-gate-bottom', role: 'deadzone', material: 'sticky', purpose: '第二道错位门的黄色下沿，收窄最终瞄准误差。', x: 604, y: 292, width: 38, height: 272 },
      ],
      portals: [],
    },
    {
      order: 3,
      name: '顶板回廊',
      focus: '内部墙面反弹',
      hint: '中间的黄色墙会吃掉直线球。把球送到上方横板，再利用反射回到 B 点。',
      requiredMechanics: ['obstacleBounce'],
      arenaWalls: stickyWalls,
      target: { x: 820, y: 480, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 480, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -46.8 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'ceiling-bank', role: 'bank', purpose: '这一关唯一安全的反弹面，把上升路线折回右下方目标。', x: 356, y: 70, width: 232, height: 28 },
        { id: 'straight-line-trap', role: 'deadzone', material: 'sticky', purpose: '封住最明显的水平直达路线，提醒黄色墙不能用来反弹。', x: 304, y: 430, width: 148, height: 92 },
      ],
      portals: [],
    },
    {
      order: 4,
      name: '圆柱转角',
      focus: '曲面反射判断',
      hint: '圆形墙会根据接触位置改变方向。瞄准圆柱下缘，让球折向右下方。',
      requiredMechanics: ['obstacleBounce'],
      arenaWalls: stickyWalls,
      target: { x: 820, y: 430, radius: 30 },
      launchers: [{ id: 'A1', x: 120, y: 450, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -32.6 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'round-bank', role: 'bank', shape: 'circle', purpose: '关键曲面反弹点；只有击中下缘附近才能转向 B 点。', x: 440, y: 188, radius: 48, width: 96, height: 96 },
        { id: 'direct-route-trap', role: 'deadzone', material: 'sticky', purpose: '挡住 A 到 B 的直接浅角度路线，让圆柱反弹具有必要性。', x: 300, y: 400, width: 150, height: 96 },
      ],
      portals: [],
    },
    {
      order: 5,
      name: '绿色弹射',
      focus: '弹力材质加速',
      hint: '绿色三角墙会增强弹力。击中它的斜面，把球高速送往右上角。',
      requiredMechanics: ['boostBounce'],
      arenaWalls: stickyWalls,
      target: { x: 826, y: 156, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 470, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -32 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'boost-triangle', role: 'bank', shape: 'triangle', material: 'boost', purpose: '关键绿色弹力斜面，把左下入射转成高速右上出射。', x: 470, y: 220, width: 130, height: 120, angle: 0 },
        { id: 'tempting-sticky-circle', role: 'decoy', shape: 'circle', material: 'sticky', purpose: '看似能缩短直达路线，实际会吸住浅角度球，是有意设置的诱饵。', x: 340, y: 410, radius: 35, width: 70, height: 70 },
      ],
      portals: [],
    },
    {
      order: 6,
      name: '跨墙传送',
      focus: '传送方向延续',
      hint: '传送门不会替你转向。用一条连续斜线进入蓝门，并从橙门继续飞向 B 点。',
      requiredMechanics: ['portal'],
      arenaWalls: stickyWalls,
      target: { x: 840, y: 164, radius: 19 },
      launchers: [{ id: 'A1', x: 120, y: 430, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -19.3 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'portal-divider', role: 'blocker', material: 'sticky', purpose: '黄色隔断完全分开左右区域，碰到会卸力，传送门因此不可替代。', x: 462, y: 36, width: 46, height: 528 },
      ],
      portals: [
        { id: 'blue', purpose: '接收左侧斜线并跨过中央隔断。', x: 320, y: 360, radius: 20, pairId: 'orange' },
        { id: 'orange', purpose: '保持原速度方向，在右侧继续同一条斜线。', x: 650, y: 230, radius: 20, pairId: 'blue', exitAngle: -0.337 },
      ],
    },
    {
      order: 7,
      name: '传送折角',
      focus: '传送接曲面反弹',
      hint: '先穿过隔断，再让出口后的球擦过圆柱上缘，完成第二次转向。',
      requiredMechanics: ['portal', 'obstacleBounce'],
      arenaWalls: stickyWalls,
      target: { x: 850, y: 180, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 140, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: 21.8 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'angled-portal-divider', role: 'blocker', material: 'sticky', purpose: '黄色隔断切断所有直接路线，也禁止借隔断反弹绕过传送门。', x: 444, y: 36, width: 44, height: 528 },
        { id: 'exit-round-bank', role: 'bank', shape: 'circle', purpose: '承接传送出口方向，把向右下的球折向右上目标。', x: 757, y: 435, radius: 48, width: 96, height: 96 },
      ],
      portals: [
        { id: 'blue', purpose: '接收第一段向右下的路线并跨过隔断。', x: 300, y: 212, radius: 19, pairId: 'orange' },
        { id: 'orange', purpose: '在圆柱左上方释放球，为曲面反弹提供正确入射方向。', x: 620, y: 338, radius: 19, pairId: 'blue', exitAngle: 0.38 },
      ],
    },
    {
      order: 8,
      name: '中继换向',
      focus: '两段独立瞄准',
      hint: '先把球送进 R1，再单独调整 R1 的方向。两段路线需要两个不同角度。',
      requiredMechanics: ['relay'],
      arenaWalls: stickyWalls,
      target: { x: 830, y: 120, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 450, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -16.9 }],
      solutionRelayAngles: { R1: -28.6 },
      relayLaunchers: [
        { id: 'R1', x: 350, y: 380, radius: 24, angle: 0, power: 700, movable: false, purpose: '把低位第一段改造成通往高位 B 点的第二段。' },
      ],
      obstacles: [
        { id: 'false-direct-circle', role: 'decoy', shape: 'circle', material: 'sticky', purpose: '吸住看似最短的 A 到 B 直线，提示玩家必须利用 R1 换向。', x: 300, y: 350, radius: 20, width: 40, height: 40 },
      ],
      portals: [],
    },
    {
      order: 9,
      name: '中继弹射',
      focus: '中继接增弹墙',
      hint: 'A 点只负责送入 R1。R1 要瞄准上方绿色墙，反弹后才有通往 B 点的路线。',
      requiredMechanics: ['relay', 'boostBounce'],
      arenaWalls: stickyWalls,
      target: { x: 840, y: 430, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 480, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -21.1 }],
      solutionRelayAngles: { R1: -50.3 },
      relayLaunchers: [
        { id: 'R1', x: 350, y: 390, radius: 24, angle: 0, power: 700, movable: false, purpose: '把第一段转成射向高位绿色墙的陡角路线。' },
      ],
      obstacles: [
        { id: 'relay-boost-bank', role: 'bank', material: 'boost', purpose: 'R1 的必经弹力墙，增强反弹并把球送回右下目标。', x: 494, y: 76, width: 152, height: 30 },
        { id: 'low-shortcut-trap', role: 'deadzone', material: 'sticky', purpose: '封住 A 点直接瞄准目标的低位捷径。', x: 470, y: 406, width: 180, height: 86 },
      ],
      portals: [],
    },
    {
      order: 10,
      name: '计时回旋',
      focus: '中继传送与动态折返',
      hint: '先进入 R1 和蓝门；传送后借绿色墙折返，并抓住黄色移动门让出的窗口。',
      requiredMechanics: ['relay', 'portal', 'boostBounce'],
      arenaWalls: stickyWalls,
      target: { x: 690, y: 229, radius: 18 },
      launchers: [{ id: 'A1', x: 110, y: 500, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -18.5 }],
      solutionRelayAngles: { R1: -29.7 },
      relayLaunchers: [
        { id: 'R1', x: 320, y: 430, radius: 24, angle: 0, power: 700, movable: false, purpose: '把起点浅角路线改成通往蓝色传送门的第二段。' },
      ],
      obstacles: [
        { id: 'final-boost-bank', role: 'bank', material: 'boost', purpose: '传送后的关键绿色折返墙，把右上速度改成向左上飞向目标。', x: 860, y: 180, width: 28, height: 240 },
        { id: 'return-window', role: 'movingGate', material: 'sticky', purpose: '周期性扫过绿色墙折返后的路线，碰到会卸力，必须等待开放窗口。', x: 742, y: 150, width: 28, height: 60, path: { x: 0, y: 90 }, speed: 1.2, phase: -2.5 },
        { id: 'timed-portal-divider', role: 'blocker', material: 'sticky', purpose: '黄色隔断禁止普通反弹路线，确保中继之后仍必须传送。', x: 610, y: 36, width: 48, height: 528 },
      ],
      portals: [
        { id: 'blue', purpose: '承接 R1 的斜线并跨过黄色隔断。', x: 530, y: 310, radius: 20, pairId: 'orange' },
        { id: 'orange', purpose: '在隔断右侧保留 R1 的速度方向，送往绿色折返墙。', x: 680, y: 420, radius: 20, pairId: 'blue', exitAngle: -0.518 },
      ],
    },
    {
      order: 11,
      name: '红门通电',
      focus: '开关门基础顺序',
      hint: '球先碰红色 OFF 开关，红门才会打开。沿同一条路线继续命中 B 点。',
      requiredMechanics: ['switchDoor'],
      arenaWalls: stickyWalls,
      target: { x: 826, y: 300, radius: 18 },
      launchers: [{ id: 'A1', x: 150, y: 300, angle: 0, power: 700 }],
      relayLaunchers: [],
      obstacles: [],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '教学开关；球经过后立刻打开同色红门。', x: 310, y: 300, radius: 19 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '完整封住目标通道，必须先触发同色开关。', x: 548, y: 196, width: 42, height: 208 },
      ],
      portals: [],
    },
    {
      order: 12,
      name: '反弹开门',
      focus: '外墙反弹触发',
      hint: '只有上边界可以反弹。借上墙命中红开关，随后穿过已经打开的门。',
      requiredMechanics: ['switchDoor', 'wallBounce'],
      arenaWalls: topBounceWalls,
      target: { x: 812, y: 180, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 500, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -41 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'lower-direct-lock', role: 'blocker', purpose: '挡住不经过上墙的低位直达路线，让反弹成为必要步骤。', x: 418, y: 314, width: 154, height: 36 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '位于上墙反射后的必经路线，触发后打开右侧高位门。', x: 636, y: 72, radius: 22 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '封住反弹后的目标走廊，等待上方开关触发。', x: 700, y: 68, width: 42, height: 202 },
      ],
      portals: [],
    },
    {
      order: 13,
      name: '红门节拍',
      focus: '状态保留与动态时机',
      hint: '第一发向左开门并回到 A 点；第二发等待移动砖块让出水平通道。',
      requiredMechanics: ['switchDoor', 'wallBounce', 'launcherReturn'],
      arenaWalls: leftBounceWalls,
      target: { x: 830, y: 300, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 300, angle: 0, power: 700 }],
      solutionShots: [
        { launcherId: 'A1', angle: 180 },
        { launcherId: 'A1', angle: 0 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'switch-lane-shutter', role: 'movingGate', material: 'sticky', purpose: '周期性扫过第二发的水平通道，碰到会卸力，迫使玩家观察窗口再出手。', x: 430, y: 240, width: 36, height: 120, path: { x: 0, y: 180 }, speed: 1.2, phase: -2.2 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '第一发向左时触发，开门后借左墙回到 A 点。', x: 72, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '封住第二发的水平终点通道，必须先完成左侧回环。', x: 580, y: 220, width: 42, height: 160 },
      ],
      portals: [],
    },
    {
      order: 14,
      name: '开门跃迁',
      focus: '开关接传送门',
      hint: '一条斜线要连续完成三件事：触发开关、穿过红门、进入蓝色传送门。',
      requiredMechanics: ['switchDoor', 'portal'],
      arenaWalls: stickyWalls,
      target: { x: 842, y: 182, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 440, angle: 0, power: 700 }],
      solutionShots: [{ launcherId: 'A1', angle: -19.7 }],
      relayLaunchers: [],
      obstacles: [
        { id: 'switch-portal-divider', role: 'blocker', material: 'sticky', purpose: '黄色隔断隔开目标区域，也禁止借墙反弹绕过传送门。', x: 480, y: 36, width: 46, height: 528 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '位于蓝门前的正确斜线上，先为入口红门通电。', x: 258, y: 391, radius: 19 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '挡住蓝门入口；只有同一发先触发红开关才会放行。', x: 326, y: 292, width: 38, height: 154 },
      ],
      portals: [
        { id: 'blue', purpose: '红门打开后接收第一段斜线，跨过中央隔断。', x: 392, y: 343, radius: 19, pairId: 'orange' },
        { id: 'orange', purpose: '保持原斜线方向，把球送往右上方 B 点。', x: 650, y: 250, radius: 19, pairId: 'blue', exitAngle: -0.344 },
      ],
    },
    {
      order: 15,
      name: '双段解锁',
      focus: '回收蓄力与中继',
      hint: '第一发水平触发开关，再借绿色墙回到 A 点；第二发进入 R1 完成穿门。',
      requiredMechanics: ['switchDoor', 'boostBounce', 'launcherReturn', 'relay'],
      arenaWalls: stickyWalls,
      target: { x: 830, y: 200, radius: 18 },
      launchers: [{ id: 'A1', x: 120, y: 470, angle: 0, power: 700 }],
      solutionShots: [
        { launcherId: 'A1', angle: 0 },
        { launcherId: 'A1', angle: -35 },
      ],
      solutionRelayAngles: { R1: -8.3 },
      relayLaunchers: [
        { id: 'R1', x: 420, y: 260, radius: 24, angle: 0, power: 700, movable: false, purpose: '第二发的换向点，把左下斜线改成穿过红门的浅角路线。' },
      ],
      obstacles: [
        { id: 'return-boost-wall', role: 'bank', material: 'boost', purpose: '第一发的绿色回收墙，触发开关后把球弹回 A 点。', x: 390, y: 420, width: 30, height: 120 },
        { id: 'relay-gap-top', role: 'blocker', material: 'sticky', purpose: '黄色隔断上段，只给红门位置留下中继通道。', x: 520, y: 36, width: 44, height: 189 },
        { id: 'relay-gap-bottom', role: 'blocker', material: 'sticky', purpose: '黄色隔断下段，封住从低位绕过红门的路线。', x: 520, y: 325, width: 44, height: 239 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '第一发水平经过时触发，为第二次发射提前打开红门。', x: 300, y: 470, radius: 19 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '填满黄色隔断的唯一缺口，验证第一发是否先完成开关。', x: 520, y: 225, width: 44, height: 100 },
      ],
      portals: [],
    },
    {
      order: 16,
      name: '回环终局',
      focus: '保留状态再发射',
      hint: '第一发向左开门并回到 A 点；第二发进 R1，等移动砖块让路后穿过传送门。',
      requiredMechanics: ['switchDoor', 'wallBounce', 'launcherReturn', 'relay', 'portal'],
      arenaWalls: leftBounceWalls,
      target: { x: 842, y: 293, radius: 18 },
      launchers: [{ id: 'A1', x: 150, y: 300, angle: 0, power: 700 }],
      solutionShots: [
        { launcherId: 'A1', angle: 180 },
        { launcherId: 'A1', angle: 0 },
      ],
      solutionRelayAngles: { R1: -25.5 },
      relayLaunchers: [
        { id: 'R1', x: 420, y: 300, radius: 24, angle: 0, power: 700, movable: false, purpose: '第二发的中继点，把水平路线改向左上方蓝门。' },
      ],
      obstacles: [
        { id: 'final-moving-sentry', role: 'movingGate', material: 'sticky', purpose: '扫过 R1 到蓝门的路线，碰到会卸力，让第二发还需要判断时机。', x: 500, y: 250, width: 28, height: 90, path: { x: 0, y: 120 }, speed: 0.7, phase: -2.3 },
        { id: 'final-portal-divider', role: 'blocker', material: 'sticky', purpose: '完全隔开终点区域；不用传送门的球会被黄色隔断吸住。', x: 694, y: 36, width: 44, height: 528 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '第一发向左时必须触发，开启第二发通往蓝门的红门。', x: 72, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '位于 R1 到蓝门的路线上，迫使玩家先完成回环开关步骤。', x: 548, y: 152, width: 42, height: 142 },
      ],
      portals: [
        { id: 'blue', purpose: '接收 R1 的第二段路线并跨过最终黄色隔断。', x: 650, y: 190, radius: 19, pairId: 'orange' },
        { id: 'orange', purpose: '在隔断右侧延续 R1 的速度方向，送往最终 B 点。', x: 760, y: 330, radius: 19, pairId: 'blue', exitAngle: -0.445 },
      ],
    },
  ];

  const api = { levels };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
