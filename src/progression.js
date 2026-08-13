(function exposeProgression(root) {
  'use strict';

  function buildCompletionResult({ levelIndex, levelCount }) {
    const finalLevel = levelIndex >= levelCount - 1;

    return {
      hasNextLevel: !finalLevel,
      title: finalLevel ? '全部关卡完成' : '命中成功',
      body: finalLevel
        ? '你已完成最后一关。返回关卡菜单后，可以任选关卡继续挑战。'
        : '你已命中 B 点。可以直接进入下一关，或返回关卡菜单。',
      primaryLabel: finalLevel ? '返回关卡菜单' : '下一关',
      secondaryLabel: '返回关卡菜单',
    };
  }

  const api = { buildCompletionResult };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballProgression = api;
})(typeof window !== 'undefined' ? window : globalThis);
