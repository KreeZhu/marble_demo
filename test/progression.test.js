const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCompletionResult } = require('../src/progression');

test('completion result offers the next level and menu before the final level', () => {
  const result = buildCompletionResult({ levelIndex: 0, levelCount: 10, shots: 2 });

  assert.equal(result.hasNextLevel, true);
  assert.equal(result.title, '命中成功');
  assert.equal(result.primaryLabel, '下一关');
  assert.equal(result.secondaryLabel, '返回关卡菜单');
  assert.match(result.body, /2 次发射/);
  assert.match(result.body, /下一关/);
});

test('completion result also returns to the level menu after the final level', () => {
  const result = buildCompletionResult({ levelIndex: 9, levelCount: 10, shots: 5 });

  assert.equal(result.hasNextLevel, false);
  assert.equal(result.title, '全部关卡完成');
  assert.equal(result.primaryLabel, '返回关卡菜单');
  assert.equal(result.secondaryLabel, '返回关卡菜单');
});
