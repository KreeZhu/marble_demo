const test = require('node:test');
const assert = require('node:assert/strict');

const { levels } = require('../src/levels');
const {
  createBall,
  stepBall,
  resolveWallBounce,
  targetHitThisFrame,
  tryTeleport,
  tryRelayLaunch,
  resolveObstacleBounce,
  resolveShapedObstacleBounce,
  updateMovingObstacle,
} = require('../src/simulation');

const arena = { x: 36, y: 36, width: 888, height: 528 };
const fixedLauncherPower = 700;

function cloneObstacles(level) {
  return level.obstacles.map((obstacle) => ({
    ...obstacle,
    originX: obstacle.x,
    originY: obstacle.y,
    vx: 0,
    vy: 0,
    phase: obstacle.phase || 0,
  }));
}

function cloneSwitches(level) {
  return (level.switches || []).map((switchItem) => ({ ...switchItem, activated: false }));
}

function cloneDoors(level) {
  return (level.doors || []).map((door) => ({ ...door, open: false, shape: 'rect', material: 'normal' }));
}

function activeDoorObstacles(doors) {
  return doors.filter((door) => !door.open).map((door) => ({ ...door, role: 'door', shape: 'rect' }));
}

function updateSwitchHits(ball, switches, doors, trace) {
  switches.forEach((switchItem) => {
    if (switchItem.activated) return;
    if (Math.hypot(ball.x - switchItem.x, ball.y - switchItem.y) <= switchItem.radius + ball.radius) {
      switchItem.activated = true;
      trace.switchHits.add(switchItem.id);
      doors.forEach((door) => {
        if (door.color === switchItem.color) door.open = true;
      });
    }
  });
}

function traceDefaultLauncher(level) {
  const launcher = level.launchers[0];
  const radians = launcher.angle * Math.PI / 180;
  const ball = createBall({
    x: launcher.x,
    y: launcher.y,
    vx: Math.cos(radians) * fixedLauncherPower,
    vy: Math.sin(radians) * fixedLauncherPower,
    radius: 9,
  });
  const obstacles = cloneObstacles(level);
  const relays = (level.relayLaunchers || []).map((relay) => ({ ...relay, power: fixedLauncherPower }));
  const switches = cloneSwitches(level);
  const doors = cloneDoors(level);
  const trace = {
    solved: false,
    wallBounces: 0,
    obstacleBounces: new Set(),
    teleports: new Set(),
    relayLaunches: new Set(),
    switchHits: new Set(),
    hitMovingObstacle: false,
    frames: 0,
  };

  for (let i = 0; i < 720; i += 1) {
    const dt = 1 / 60;
    obstacles.forEach((obstacle) => updateMovingObstacle(obstacle, dt));
    const previous = { x: ball.x, y: ball.y };
    stepBall(ball, dt);

    if (resolveWallBounce(ball, arena, 0.96)) {
      trace.wallBounces += 1;
    }

    obstacles.concat(activeDoorObstacles(doors)).forEach((obstacle, index) => {
      if (resolveShapedObstacleBounce(ball, obstacle, obstacle.material === 'boost' ? 1.22 : 0.94)) {
        trace.obstacleBounces.add(obstacle.id);
        if (index < level.obstacles.length && level.obstacles[index].path) trace.hitMovingObstacle = true;
      }
    });

    updateSwitchHits(ball, switches, doors, trace);

    const beforePortal = { x: ball.x, y: ball.y };
    const teleported = tryTeleport(ball, level.portals);
    if (teleported) {
      const entry = level.portals.find((portal) => (
        Math.hypot(beforePortal.x - portal.x, beforePortal.y - portal.y) <= portal.radius + ball.radius
      ));
      if (entry) trace.teleports.add(entry.id);
    }

    const relayed = tryRelayLaunch(ball, relays);
    if (relayed) trace.relayLaunches.add(relayed.id);

    ball.vx *= 0.998;
    ball.vy *= 0.998;
    trace.frames = i + 1;

    if (targetHitThisFrame(previous, ball, level.target, ball.radius, teleported || Boolean(relayed))) {
      trace.solved = true;
      return trace;
    }

    if (Math.hypot(ball.vx, ball.vy) < 28) {
      return trace;
    }
  }

  return trace;
}

function inArenaCircle(circle) {
  return (
    circle.x >= arena.x &&
    circle.x <= arena.x + arena.width &&
    circle.y >= arena.y &&
    circle.y <= arena.y + arena.height
  );
}

test('game has progressively numbered levels', () => {
  assert.equal(levels.length, 16);
  levels.forEach((level, index) => {
    assert.equal(level.order, index + 1);
  });
});

test('every level has one adjustable start launcher', () => {
  levels.forEach((level) => {
    assert.equal(level.launchers.length, 1, `${level.name} should only expose A1`);
    assert.equal(level.launchers[0].id, 'A1');
    assert.equal(level.launchers[0].power, fixedLauncherPower, `${level.name}/A1 should use fixed power`);
  });
});

test('all authored relay launchers use the fixed power', () => {
  levels.forEach((level) => {
    (level.relayLaunchers || []).forEach((relay) => {
      assert.equal(relay.power, fixedLauncherPower, `${level.name}/${relay.id} should use fixed power`);
    });
  });
});

test('relay launchers only appear in later difficult levels', () => {
  levels.slice(0, 7).forEach((level) => {
    assert.equal((level.relayLaunchers || []).length, 0, `${level.name} should not have a relay launcher`);
  });

  levels.filter((level) => (level.relayLaunchers || []).length > 0).forEach((level) => {
    assert.ok((level.relayLaunchers || []).length >= 1, `${level.name} should introduce relay play`);
    assert.ok(level.requiredMechanics.includes('relay'), `${level.name} should require using a relay`);
    level.relayLaunchers.forEach((relay) => {
      assert.equal(relay.movable, false, `${level.name}/${relay.id} should keep a fixed play position`);
    });
  });
});

test('each level declares a focused player skill and useful hint', () => {
  const focuses = new Set(levels.map((level) => level.focus));

  assert.equal(focuses.size, levels.length);
  levels.forEach((level) => {
    assert.ok(level.name.length >= 2);
    assert.ok(level.hint.length >= 8);
    assert.ok(level.focus.length >= 4);
    assert.ok(level.target.radius > 0);
    assert.ok(Array.isArray(level.obstacles));
    assert.ok(Array.isArray(level.portals));
    assert.ok(Array.isArray(level.requiredMechanics));
    assert.ok(Array.isArray(level.relayLaunchers));
    assert.ok(level.requiredMechanics.length > 0 || level.order === 1 || level.order === 4);
  });
});

test('difficulty adds mechanics over time', () => {
  assert.equal(levels[0].portals.length, 0);
  assert.equal(levels[0].obstacles.length, 0);
  assert.ok(levels.some((level) => level.portals.length >= 2));
  assert.ok(levels.some((level) => level.obstacles.some((obstacle) => obstacle.path)));
  assert.ok(levels.some((level) => (level.relayLaunchers || []).length > 0));
  assert.ok(levels[9].portals.length >= 2);
  assert.ok(levels[9].obstacles.some((obstacle) => obstacle.path));
  assert.ok(levels[9].relayLaunchers.length >= 1);
  assert.ok(levels[10].switches.length >= 1);
  assert.ok(levels[10].doors.length >= 1);
  assert.ok(levels.slice(10, 15).every((level) => (level.switches || []).length >= 1));
  assert.ok(levels.slice(10, 15).every((level) => (level.doors || []).length >= 1));
  assert.ok(levels[11].requiredMechanics.includes('wallBounce'));
  assert.ok(levels[12].obstacles.some((obstacle) => obstacle.path));
  assert.ok(levels[13].portals.length >= 2);
  assert.ok(levels[14].relayLaunchers.length >= 1);
  assert.ok(levels[15].obstacles.some((obstacle) => obstacle.material === 'sticky'));
});

test('each level can be solved by its authored default launcher route', () => {
  levels.forEach((level) => {
    assert.equal(traceDefaultLauncher(level).solved, true, level.name);
  });
});

test('declared mechanics are actually used by the authored default solution', () => {
  levels.forEach((level) => {
    const trace = traceDefaultLauncher(level);

    if (level.requiredMechanics.includes('wallBounce')) {
      assert.ok(trace.wallBounces > 0, `${level.name} should use wall bounce`);
    }
    if (level.requiredMechanics.includes('portal')) {
      assert.ok(trace.teleports.size > 0, `${level.name} should use a portal`);
    }
    if (level.requiredMechanics.includes('obstacleBounce')) {
      assert.ok(trace.obstacleBounces.size > 0, `${level.name} should bounce from an obstacle`);
    }
    if (level.requiredMechanics.includes('relay')) {
      assert.ok(trace.relayLaunches.size > 0, `${level.name} should trigger a relay launcher`);
    }
    if (level.requiredMechanics.includes('switchDoor')) {
      assert.ok(trace.switchHits.size > 0, `${level.name} should hit a switch`);
    }
    if (level.requiredMechanics.includes('movingGate')) {
      assert.ok(trace.hitMovingObstacle, `${level.name} should hit a moving obstacle`);
    }
  });
});

test('authored objects have ids, purpose text, and stay inside the arena', () => {
  levels.forEach((level) => {
    assert.ok(inArenaCircle(level.target), `${level.name} target should be inside the arena`);
    assert.ok(inArenaCircle(level.launchers[0]), `${level.name} launcher should be inside the arena`);

    level.relayLaunchers.forEach((relay) => {
      assert.ok(relay.id, `${level.name} has a relay without id`);
      assert.ok(relay.purpose, `${level.name}/${relay.id} is missing purpose`);
      assert.ok(inArenaCircle(relay), `${level.name}/${relay.id} should be inside the arena`);
    });

    level.obstacles.forEach((obstacle) => {
      assert.ok(obstacle.id, `${level.name} has an obstacle without id`);
      assert.ok(obstacle.role, `${level.name}/${obstacle.id} is missing role`);
      assert.ok(obstacle.purpose, `${level.name}/${obstacle.id} is missing purpose`);
      assert.ok(obstacle.x >= arena.x, `${level.name}/${obstacle.id} should stay inside the arena`);
      assert.ok(obstacle.y >= arena.y, `${level.name}/${obstacle.id} should stay inside the arena`);
      assert.ok(obstacle.x + obstacle.width <= arena.x + arena.width, `${level.name}/${obstacle.id} should stay inside the arena`);
      assert.ok(obstacle.y + obstacle.height <= arena.y + arena.height, `${level.name}/${obstacle.id} should stay inside the arena`);
    });

    level.portals.forEach((portal) => {
      assert.ok(portal.id, `${level.name} has a portal without id`);
      assert.ok(portal.purpose, `${level.name}/${portal.id} is missing purpose`);
      assert.ok(portal.pairId, `${level.name}/${portal.id} is missing pairId`);
      assert.ok(inArenaCircle(portal), `${level.name}/${portal.id} should be inside the arena`);
    });

    (level.switches || []).forEach((switchItem) => {
      assert.ok(switchItem.id, `${level.name} has a switch without id`);
      assert.ok(switchItem.purpose, `${level.name}/${switchItem.id} is missing purpose`);
      assert.ok(switchItem.color, `${level.name}/${switchItem.id} is missing color`);
      assert.ok(inArenaCircle(switchItem), `${level.name}/${switchItem.id} should be inside the arena`);
    });

    (level.doors || []).forEach((door) => {
      assert.ok(door.id, `${level.name} has a door without id`);
      assert.ok(door.purpose, `${level.name}/${door.id} is missing purpose`);
      assert.ok(door.color, `${level.name}/${door.id} is missing color`);
      assert.ok(door.x >= arena.x, `${level.name}/${door.id} should stay inside the arena`);
      assert.ok(door.y >= arena.y, `${level.name}/${door.id} should stay inside the arena`);
      assert.ok(door.x + door.width <= arena.x + arena.width, `${level.name}/${door.id} should stay inside the arena`);
      assert.ok(door.y + door.height <= arena.y + arena.height, `${level.name}/${door.id} should stay inside the arena`);
    });
  });
});
