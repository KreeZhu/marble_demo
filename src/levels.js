(function exposeLevels(root) {
  'use strict';

  const stickyWalls = { top: 'sticky', right: 'sticky', bottom: 'sticky', left: 'sticky' };
  const allBounceWalls = { top: 'bounce', right: 'bounce', bottom: 'bounce', left: 'bounce' };
  const topBounceWalls = { ...stickyWalls, top: 'bounce' };
  const bottomBounceWalls = { ...stickyWalls, bottom: 'bounce' };
  const leftBounceWalls = { ...stickyWalls, left: 'bounce' };

  const levels = [
    {
      order: 1,
      name: '直线校准',
      focus: '基础瞄准',
      hint: '第一关只考验方向：力度固定为 700，让球从 A 点直线碰到 B 点。',
      requiredMechanics: [],
      arenaWalls: stickyWalls,
      target: { x: 812, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 124, y: 300, angle: 0, power: 700 },
      ],
      relayLaunchers: [],
      obstacles: [],
      portals: [],
    },
    {
      order: 2,
      name: '上墙折返',
      focus: '单墙反弹',
      hint: '直接路线被挡住了，利用上墙做一次折返。',
      requiredMechanics: ['wallBounce'],
      arenaWalls: topBounceWalls,
      target: { x: 810, y: 180, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 500, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -42 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'center-blocker', role: 'blocker', purpose: '挡住 A 到 B 的直接斜线，迫使玩家使用上墙反弹。', x: 360, y: 298, width: 165, height: 38 },
      ],
      portals: [],
    },
    {
      order: 3,
      name: '下墙折返',
      focus: '反射角判断',
      hint: '换成从下墙折返，观察预线里的入射角和反射角关系。',
      requiredMechanics: ['wallBounce'],
      arenaWalls: bottomBounceWalls,
      target: { x: 820, y: 420, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 120, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: 39 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'mid-blocker', role: 'blocker', purpose: '切断直接斜线，让下墙反射成为可靠路线。', x: 430, y: 250, width: 135, height: 42 },
      ],
      portals: [],
    },
    {
      order: 4,
      name: '窄门角度',
      focus: '固定力度角度',
      hint: '力度固定为 700，只需要调整角度，让球稳定穿过错位窄门。',
      requiredMechanics: [],
      arenaWalls: stickyWalls,
      target: { x: 836, y: 330, radius: 17 },
      launchers: [
        { id: 'A1', x: 116, y: 272, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: 5 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'gate-1-top', role: 'gate', purpose: '形成第一道窄门上沿，限制偏高路线。', x: 348, y: 36, width: 46, height: 224 },
        { id: 'gate-1-bottom', role: 'gate', purpose: '形成第一道窄门下沿，限制偏低路线。', x: 348, y: 330, width: 46, height: 234 },
        { id: 'gate-2-top', role: 'gate', purpose: '形成第二道错位窄门上沿，要求角度稳定。', x: 590, y: 36, width: 42, height: 260 },
        { id: 'gate-2-bottom', role: 'gate', purpose: '形成第二道错位窄门下沿，要求角度稳定。', x: 590, y: 366, width: 42, height: 198 },
      ],
      portals: [],
    },
    {
      order: 5,
      name: '双墙通道',
      focus: '连续反弹',
      hint: '起点仍然只有一个。用更陡的角度让球先碰上墙，再落进高位目标区。',
      requiredMechanics: ['wallBounce'],
      arenaWalls: allBounceWalls,
      target: { x: 812, y: 142, radius: 18 },
      launchers: [
        { id: 'A1', x: 142, y: 500, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -29 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'lower-lane-wall', role: 'blocker', purpose: '封住低位直达路线，让玩家必须把球抬到上方通道。', x: 308, y: 224, width: 48, height: 270 },
        { id: 'upper-lane-wall', role: 'blocker', purpose: '限制上方通道宽度，迫使路线贴墙折返。', x: 522, y: 36, width: 44, height: 232 },
      ],
      portals: [],
    },
    {
      order: 6,
      name: '传送入门',
      focus: '传送门基础',
      hint: '把球送进蓝色传送门，它会从橙色传送门旁继续前进。',
      requiredMechanics: ['portal'],
      arenaWalls: stickyWalls,
      target: { x: 838, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 118, y: 300, angle: 0, power: 700 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'portal-required-wall', role: 'blocker', purpose: '隔开左右区域，要求玩家使用传送门。', x: 422, y: 76, width: 44, height: 428 },
        { id: 'exit-lane-guide', role: 'guide', purpose: '限制传送出口后的路线宽度。', x: 652, y: 226, width: 36, height: 148 },
      ],
      portals: [
        { id: 'blue', purpose: '入口传送门，连接被墙隔开的右侧区域。', x: 292, y: 300, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '出口传送门，把球送到右侧通道。', x: 720, y: 300, radius: 18, pairId: 'blue', exitAngle: 0 },
      ],
    },
    {
      order: 7,
      name: '传送折返',
      focus: '传送与反弹组合',
      hint: '先用墙面修正角度，再进入传送门完成后半段。',
      requiredMechanics: ['wallBounce', 'portal'],
      arenaWalls: leftBounceWalls,
      target: { x: 832, y: 456, radius: 18 },
      launchers: [
        { id: 'A1', x: 126, y: 116, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: 14 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'pre-portal-wall', role: 'blocker', purpose: '挡住直接进入目标区的路线，迫使上半段先从下墙折返回门。', x: 370, y: 36, width: 42, height: 264 },
        { id: 'exit-lane-wall', role: 'guide', purpose: '封住直接斜射到 B 点的中段路线，强调传送出口。', x: 620, y: 336, width: 118, height: 40 },
      ],
      portals: [
        { id: 'blue', purpose: '需要通过墙面折返后才能稳定进入的入口。', x: 648, y: 418, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '把球送到下方目标走廊。', x: 704, y: 456, radius: 18, pairId: 'blue', exitAngle: 0 },
      ],
    },
    {
      order: 8,
      name: '中继发射',
      focus: '二段发射',
      hint: '把球打进 R1。R1 会按自己的方向，以固定 700 力度再发射一次。',
      requiredMechanics: ['relay'],
      arenaWalls: stickyWalls,
      target: { x: 836, y: 250, radius: 18 },
      launchers: [
        { id: 'A1', x: 118, y: 450, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -24 },
      ],
      solutionRelayAngles: { R1: -9 },
      relayLaunchers: [
        { id: 'R1', x: 420, y: 316, radius: 24, angle: 0, power: 700, movable: false, purpose: '第一枚中继发射器，把球从左下路线转接到右侧目标。' },
      ],
      obstacles: [
        { id: 'relay-lane-wall', role: 'blocker', purpose: '挡住 A1 直达 B 的路线，让玩家必须先进入 R1。', x: 536, y: 336, width: 46, height: 148 },
      ],
      portals: [],
    },
    {
      order: 9,
      name: '中继传送',
      focus: '二段路线规划',
      hint: '先进入 R1，再让 R1 把球送进传送门。',
      requiredMechanics: ['relay', 'portal'],
      arenaWalls: stickyWalls,
      target: { x: 846, y: 104, radius: 18 },
      launchers: [
        { id: 'A1', x: 118, y: 500, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -25 },
      ],
      solutionRelayAngles: { R1: -29 },
      relayLaunchers: [
        { id: 'R1', x: 380, y: 378, radius: 24, angle: 0, power: 700, movable: false, purpose: '承接第一段斜线，再把球送入传送入口。' },
      ],
      obstacles: [
        { id: 'top-route-lock', role: 'blocker', purpose: '封锁 A1 上方直达路线。', x: 320, y: 36, width: 42, height: 286 },
        { id: 'exit-route-lock', role: 'guide', purpose: '让传送出口后的路线从上侧通过。', x: 720, y: 170, width: 38, height: 304 },
      ],
      portals: [
        { id: 'blue', purpose: '由 R1 接上的入口传送门。', x: 610, y: 250, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '出口通向高位目标。', x: 760, y: 130, radius: 18, pairId: 'blue', exitAngle: -0.29 },
      ],
    },
    {
      order: 10,
      name: '终局箱庭',
      focus: '中继综合判断',
      hint: '先打进 R1，再通过传送门和移动障碍区完成最后一段。',
      requiredMechanics: ['relay', 'portal'],
      arenaWalls: stickyWalls,
      target: { x: 846, y: 420, radius: 17 },
      launchers: [
        { id: 'A1', x: 118, y: 510, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -23 },
      ],
      solutionRelayAngles: { R1: -17 },
      relayLaunchers: [
        { id: 'R1', x: 402, y: 385, radius: 24, angle: 0, power: 700, movable: false, purpose: '把第一段路线转接到传送入口。' },
      ],
      obstacles: [
        { id: 'left-lock-wall', role: 'blocker', purpose: '阻断从左侧直接横穿的路线。', x: 294, y: 36, width: 44, height: 330 },
        { id: 'center-lock-wall', role: 'blocker', purpose: '阻断低位直达目标的路线，同时给 R1 到传送门留出上方通道。', x: 520, y: 380, width: 44, height: 146 },
        { id: 'exit-moving-gate', role: 'movingGate', purpose: '传送出口附近的移动门，制造最终路线的时机变化。', x: 674, y: 244, width: 104, height: 28, path: { x: 0, y: 186 }, speed: 1.35, phase: -1.45 },
        { id: 'entry-moving-gate', role: 'movingGate', purpose: '传送入口前的移动门，防止无脑直射。', x: 382, y: 430, width: 132, height: 26, path: { x: 110, y: 0 }, speed: 1.1, phase: 1.2 },
      ],
      portals: [
        { id: 'blue', purpose: '中继路线必须进入的传送入口。', x: 640, y: 312, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '出口通向最终 B 点下方走廊。', x: 724, y: 448, radius: 18, pairId: 'blue', exitAngle: 0 },
      ],
    },
    {
      order: 11,
      name: '红门开关',
      focus: '开关门机制',
      hint: '先让球碰到红色按钮，红门打开后再命中 B 点。',
      requiredMechanics: ['switchDoor'],
      arenaWalls: stickyWalls,
      target: { x: 826, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 300, angle: 0, power: 700 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'top-guide', role: 'guide', purpose: '形成红门机制教学通道。', x: 430, y: 180, width: 260, height: 28 },
        { id: 'bottom-guide', role: 'guide', purpose: '形成红门机制教学通道。', x: 430, y: 392, width: 260, height: 28 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '击中后打开对应红门。', x: 360, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '红色按钮触发后打开。', x: 560, y: 220, width: 42, height: 160 },
      ],
      portals: [],
    },
    {
      order: 12,
      name: '反弹开门',
      focus: '反弹开关',
      hint: '先利用上墙反弹触发红色按钮，红门打开后再进入目标通道。',
      requiredMechanics: ['switchDoor', 'wallBounce'],
      arenaWalls: topBounceWalls,
      target: { x: 810, y: 180, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 500, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -41 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'lower-lock', role: 'blocker', purpose: '挡住低位直达路线，迫使玩家从上墙反弹接入红按钮。', x: 430, y: 315, width: 130, height: 34 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '反弹路线上的红色按钮，触发后打开红门。', x: 640, y: 70, radius: 22 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '按钮触发后打开的高位红门。', x: 700, y: 70, width: 42, height: 190 },
      ],
      portals: [],
    },
    {
      order: 13,
      name: '移动红门',
      focus: '移动砖块时机',
      hint: '红门仍然要先开，移动砖块会周期性扫过通道，观察窗口后发射。',
      requiredMechanics: ['switchDoor'],
      arenaWalls: stickyWalls,
      target: { x: 826, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 300, angle: 0, power: 700 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'moving-window', role: 'movingGate', purpose: '周期性扫过红门前通道，制造发射时机。', x: 430, y: 156, width: 42, height: 108, path: { x: 0, y: 220 }, speed: 1.15, phase: -1.45 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '红色按钮打开前方红门。', x: 330, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '按钮触发后打开的通道门。', x: 565, y: 220, width: 42, height: 160 },
      ],
      portals: [],
    },
    {
      order: 14,
      name: '传送红门',
      focus: '开关与传送',
      hint: '先开红门，再进入传送门，出口会把球送进下方目标线。',
      requiredMechanics: ['switchDoor', 'portal'],
      arenaWalls: stickyWalls,
      target: { x: 826, y: 420, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 300, angle: 0, power: 700 },
      ],
      relayLaunchers: [],
      obstacles: [
        { id: 'portal-lock', role: 'blocker', purpose: '隔开中段路线，要求通过传送门完成后半段。', x: 500, y: 106, width: 42, height: 330 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '打开传送入口前的红门。', x: 310, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '按钮触发后打开，允许球进入传送入口。', x: 452, y: 220, width: 42, height: 160 },
      ],
      portals: [
        { id: 'blue', purpose: '红门打开后才能稳定进入的入口传送门。', x: 430, y: 300, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '出口通向下方目标线。', x: 710, y: 420, radius: 18, pairId: 'blue', exitAngle: 0 },
      ],
    },
    {
      order: 15,
      name: '中继红门',
      focus: '开关与子发射器',
      hint: '第一段先开红门并进入 R1，R1 位置固定，力度为 700，只能调整方向完成最后一段。',
      requiredMechanics: ['switchDoor', 'relay'],
      arenaWalls: stickyWalls,
      target: { x: 836, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 450, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: -24 },
      ],
      relayLaunchers: [
        { id: 'R1', x: 420, y: 316, radius: 24, angle: 0, power: 700, movable: false, purpose: '固定位置和固定力度的子发射器，承接开关门后的路线。' },
      ],
      obstacles: [
        { id: 'relay-wall', role: 'blocker', purpose: '挡住 A1 直接进目标的路线，要求先进入 R1。', x: 520, y: 336, width: 42, height: 130 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '第一段路线上的红按钮，触发后打开 R1 后方红门。', x: 332, y: 356, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '按钮触发后打开，允许 R1 后半段路线通过。', x: 620, y: 220, width: 42, height: 160 },
      ],
      portals: [],
    },
    {
      order: 16,
      name: '回环终局',
      focus: '回收再发射',
      hint: '第一发向左触发红按钮并借左墙回到 A 点；红门保持打开后，第二发再进 R1 和传送门命中 B 点。',
      requiredMechanics: ['switchDoor', 'wallBounce', 'launcherReturn', 'relay', 'portal'],
      arenaWalls: leftBounceWalls,
      target: { x: 820, y: 300, radius: 18 },
      launchers: [
        { id: 'A1', x: 120, y: 300, angle: 0, power: 700 },
      ],
      solutionShots: [
        { launcherId: 'A1', angle: 180 },
        { launcherId: 'A1', angle: 0 },
      ],
      relayLaunchers: [
        { id: 'R1', x: 420, y: 300, radius: 24, angle: 0, power: 700, movable: false, purpose: '红门打开后承接第二发，把球送进传送门。' },
      ],
      obstacles: [
        { id: 'upper-sticky-rail', role: 'deadzone', material: 'sticky', purpose: '咖啡色卸力墙，封住高位偷线。', x: 250, y: 190, width: 300, height: 32 },
        { id: 'lower-sticky-rail', role: 'deadzone', material: 'sticky', purpose: '咖啡色卸力墙，封住低位偷线。', x: 250, y: 378, width: 300, height: 32 },
        { id: 'moving-sentry', role: 'movingGate', purpose: '第二段路线附近的移动限制，逼迫玩家观察开门后的发射时机。', x: 548, y: 112, width: 26, height: 82, path: { x: 0, y: 54 }, speed: 1.1, phase: -1.25 },
      ],
      switches: [
        { id: 'red-switch-1', color: 'red', purpose: '第一发必须先触发的红按钮，打开 R1 后方红门。', x: 72, y: 300, radius: 18 },
      ],
      doors: [
        { id: 'red-door-1', color: 'red', purpose: '红按钮触发后打开，允许第二段从 R1 进入传送门。', x: 610, y: 220, width: 42, height: 160 },
      ],
      portals: [
        { id: 'blue', purpose: '红门打开后进入的传送入口。', x: 700, y: 300, radius: 18, pairId: 'orange' },
        { id: 'orange', purpose: '出口把球送到 B 点前方。', x: 774, y: 300, radius: 18, pairId: 'blue', exitAngle: 0 },
      ],
    },
  ];

  const api = { levels };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
