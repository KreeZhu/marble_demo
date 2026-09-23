(function exposeProgression(root) {
  'use strict';

  function buildCompletionResult({ levelIndex, levelCount }) {
    const finalLevel = levelIndex >= levelCount - 1;

    return {
      hasNextLevel: !finalLevel,
      title: '已通关',
      body: finalLevel
        ? '全部关卡已完成。'
        : '可返回关卡菜单，或进入下一关。',
      primaryLabel: finalLevel ? '关卡菜单' : '下一关',
      secondaryLabel: '关卡菜单',
    };
  }

  const api = { buildCompletionResult };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballProgression = api;
})(typeof window !== 'undefined' ? window : globalThis);
