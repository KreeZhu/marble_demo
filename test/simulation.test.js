const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBall,
  stepBall,
  resolveArenaWalls,
  resolveWallBounce,
  segmentCircleHit,
  tryTeleport,
  tryLauncherCapture,
  shouldResetAttemptBeforeShot,
  resolveObstacleBounce,
  resolveShapedObstacleBounce,
  targetHitThisFrame,
} = require('../src/simulation');

test('wall bounce clamps the ball inside the room and reflects velocity', () => {
  const ball = createBall({ x: 795, y: 220, vx: 360, vy: 0, radius: 12 });

  resolveWallBounce(ball, { x: 0, y: 0, width: 800, height: 500 });

  assert.equal(ball.x, 788);
  assert.equal(ball.vx, -360);
});

test('sticky arena wall absorbs the ball instead of reflecting it', () => {
  const ball = createBall({ x: 795, y: 220, vx: 360, vy: 40, radius: 12 });

  const result = resolveArenaWalls(
    ball,
    { x: 0, y: 0, width: 800, height: 500 },
    { right: 'sticky' },
  );

  assert.equal(result.stuck, true);
  assert.equal(result.bounced, false);
  assert.deepEqual(result.sides, ['right']);
  assert.equal(ball.x, 788);
  assert.equal(ball.vx, 0);
  assert.equal(ball.vy, 0);
});

test('target hit is detected across the whole frame path', () => {
  const hit = segmentCircleHit(
    { x: 100, y: 100 },
    { x: 240, y: 100 },
    { x: 210, y: 100, radius: 18 },
    8,
  );

  assert.equal(hit, true);
});

test('portal teleport preserves speed and offsets from the exit normal', () => {
  const ball = createBall({ x: 158, y: 180, vx: 220, vy: 30, radius: 8 });
  const portals = [
    { id: 'blue', x: 160, y: 180, radius: 16, pairId: 'orange' },
    { id: 'orange', x: 530, y: 315, radius: 16, pairId: 'blue', exitAngle: 0 },
  ];

  const result = tryTeleport(ball, portals);

  assert.equal(result, true);
  assert.equal(ball.x, 554);
  assert.equal(ball.y, 315);
  assert.equal(ball.vx, 220);
  assert.equal(ball.vy, 30);
  assert.ok(ball.portalCooldown > 0);
});

test('an empty relay launcher captures the ball and waits for a manual second shot', () => {
  const ball = createBall({ x: 200, y: 180, vx: 80, vy: 0, radius: 8 });
  const relays = [
    { id: 'R1', x: 200, y: 180, radius: 18, angle: -90, power: 420 },
  ];

  const relay = tryLauncherCapture(ball, relays);

  assert.equal(relay.id, 'R1');
  assert.equal(ball.active, false);
  assert.equal(ball.vx, 0);
  assert.equal(ball.vy, 0);
  assert.equal(ball.continuesAttempt, true);
});

test('start launcher can capture a returning ball without resetting state', () => {
  const ball = createBall({ x: 120, y: 180, vx: -80, vy: 0, radius: 8 });
  ball.originLauncherId = 'A1';
  const launchers = [
    { id: 'A1', x: 120, y: 180, radius: 22 },
    { id: 'A2', x: 260, y: 180, radius: 22 },
  ];

  const captured = tryLauncherCapture(ball, launchers);

  assert.equal(captured.id, 'A1');
  assert.equal(ball.active, false);
  assert.equal(ball.vx, 0);
  assert.equal(ball.vy, 0);
  assert.equal(ball.continuesAttempt, true);
  assert.ok(ball.launcherCooldown > 0);
});

test('any start launcher can capture the same ball and continue the attempt', () => {
  const ball = createBall({ x: 260, y: 180, vx: 80, vy: 0, radius: 8 });
  ball.originLauncherId = 'A1';
  const launchers = [
    { id: 'A1', x: 120, y: 180, radius: 22 },
    { id: 'A2', x: 260, y: 180, radius: 22 },
  ];

  const captured = tryLauncherCapture(ball, launchers);

  assert.equal(captured.id, 'A2');
  assert.equal(ball.originLauncherId, 'A2');
  assert.equal(ball.continuesAttempt, true);
});

test('a failed stopped ball resets the attempt, but a captured ball continues it', () => {
  const stoppedBall = createBall({ x: 300, y: 200 });
  stoppedBall.active = false;
  const capturedBall = createBall({ x: 120, y: 200 });
  capturedBall.active = false;
  capturedBall.continuesAttempt = true;

  assert.equal(shouldResetAttemptBeforeShot(stoppedBall), true);
  assert.equal(shouldResetAttemptBeforeShot(capturedBall), false);
  assert.equal(shouldResetAttemptBeforeShot(null), false);
});

test('moving obstacle collision reflects the ball using the nearest face', () => {
  const ball = createBall({ x: 220, y: 160, vx: 180, vy: 20, radius: 10 });
  const obstacle = { x: 226, y: 130, width: 42, height: 80, vx: 40, vy: 0 };

  const collided = resolveObstacleBounce(ball, obstacle);

  assert.equal(collided, true);
  assert.ok(ball.vx < 0);
  assert.equal(ball.x, 216);
});

test('rotated rectangle obstacle reflects from the rotated face', () => {
  const ball = createBall({
    x: 173.94,
    y: 133.94,
    vx: -127.3,
    vy: -127.3,
    radius: 10,
  });
  const obstacle = { shape: 'rect', x: 100, y: 80, width: 80, height: 40, angle: 45 };

  const collided = resolveShapedObstacleBounce(ball, obstacle, 1);

  assert.equal(collided, true);
  assert.ok(ball.vx > 0);
  assert.ok(ball.vy > 0);
});

test('circle obstacle collision reflects from the obstacle center', () => {
  const ball = createBall({ x: 132, y: 100, vx: -160, vy: 0, radius: 10 });
  const obstacle = { shape: 'circle', x: 100, y: 100, radius: 24 };

  const collided = resolveShapedObstacleBounce(ball, obstacle, 1);

  assert.equal(collided, true);
  assert.ok(ball.vx > 0);
  assert.equal(ball.y, 100);
});

test('triangle boost obstacle can increase reflected speed', () => {
  const ball = createBall({ x: 88, y: 100, vx: 180, vy: 0, radius: 10 });
  const obstacle = { shape: 'triangle', x: 130, y: 100, width: 80, height: 80, angle: 180, material: 'boost' };
  const before = Math.hypot(ball.vx, ball.vy);

  const collided = resolveShapedObstacleBounce(ball, obstacle, 1.22);
  const after = Math.hypot(ball.vx, ball.vy);

  assert.equal(collided, true);
  assert.ok(ball.vx < 0);
  assert.ok(after > before);
});

test('sticky obstacle absorbs the ball instead of reflecting it', () => {
  const ball = createBall({ x: 88, y: 100, vx: 180, vy: 0, radius: 10 });
  const obstacle = { shape: 'rect', x: 96, y: 80, width: 80, height: 40, material: 'sticky' };

  const collided = resolveShapedObstacleBounce(ball, obstacle, 0.94);

  assert.equal(collided, true);
  assert.equal(ball.vx, 0);
  assert.equal(ball.vy, 0);
});

test('stepBall applies velocity in seconds and decays cooldowns', () => {
  const ball = createBall({ x: 10, y: 20, vx: 30, vy: -10, radius: 6 });
  ball.portalCooldown = 0.5;
  ball.launcherCooldown = 0.5;

  stepBall(ball, 0.25);

  assert.equal(ball.x, 17.5);
  assert.equal(ball.y, 17.5);
  assert.equal(ball.portalCooldown, 0.25);
  assert.equal(ball.launcherCooldown, 0.25);
});

test('target hit ignores the artificial long segment created by teleporting', () => {
  const hit = targetHitThisFrame(
    { x: 120, y: 120 },
    { x: 780, y: 460 },
    { x: 450, y: 290, radius: 20 },
    9,
    true,
  );

  assert.equal(hit, false);
});
