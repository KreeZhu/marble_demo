const test = require('node:test');
const assert = require('node:assert/strict');

const { shotMeetsRequiredMechanics } = require('../src/mechanics');

test('shot mechanic check accepts only mechanics the player actually used', () => {
  const result = shotMeetsRequiredMechanics({
    requiredMechanics: ['wallBounce', 'portal', 'movingGate', 'relay', 'switchDoor'],
    events: {
      wallBounces: 1,
      teleports: new Set(['blue']),
      relayLaunches: new Set(['R1']),
      switchHits: new Set(['red-switch']),
      obstacleBounces: new Set(),
      hitMovingObstacle: true,
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});

test('shot mechanic check reports missing active mechanics', () => {
  const result = shotMeetsRequiredMechanics({
    requiredMechanics: ['wallBounce', 'portal', 'movingGate', 'relay', 'switchDoor'],
    events: {
      wallBounces: 0,
      teleports: new Set(),
      relayLaunches: new Set(),
      switchHits: new Set(),
      obstacleBounces: new Set(),
      hitMovingObstacle: false,
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['墙面反弹', '传送门', '移动障碍时机', '中继发射器', '开关门']);
});
