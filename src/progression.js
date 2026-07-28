(function exposeProgression(root) {
  'use strict';

  function buildCompletionResult({ levelIndex, levelCount, shots }) {
    const finalLevel = levelIndex >= levelCount - 1;

    return {
      hasNextLevel: !finalLevel,
      title: finalLevel ? '全部关卡完成' : '命中成功',
      body: finalLevel
        ? `你用了 ${shots} 次发射完成最后一关。回到关卡菜单后，可以任选关卡挑战更少发射次数。`
        : `你用了 ${shots} 次发射命中 B 点。确认后回到关卡菜单，自选下一关继续。`,
      primaryLabel: '返回关卡菜单',
      secondaryLabel: '重玩本关',
    };
  }

  const api = { buildCompletionResult };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballProgression = api;
})(typeof window !== 'undefined' ? window : globalThis);
