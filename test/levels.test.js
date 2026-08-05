const test = require('node:test');
const assert = require('node:assert/strict');

const { levels } = require('../src/levels');
const {
  createBall,
  stepBall,
  resolveArenaWalls,
  targetHitThisFrame,
  tryTeleport,
  tryRelayLaunch,
  tryLauncherCapture,
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
  const obstacles = cloneObstacles(level);
  const relays = (level.relayLaunchers || []).map((relay) => ({
    ...relay,
    angle: level.solutionRelayAngles?.[relay.id] ?? relay.angle,
    power: fixedLauncherPower,
  }));
  const switches = cloneSwitches(level);
  const doors = cloneDoors(level);
  const solutionShots = Array.isArray(level.solutionShots) && level.solutionShots.length > 0
    ? level.solutionShots
    : [{ launcherId: level.launchers[0].id, angle: level.launchers[0].angle }];
  const trace = {
    solved: false,
    wallBounces: 0,
    obstacleBounces: new Set(),
    boostBounces: new Set(),
    teleports: new Set(),
    relayLaunches: new Set(),
    switchHits: new Set(),
    launcherReturns: 0,
    hitMovingObstacle: false,
    stuckOnArenaWall: false,
    arenaWallSides: new Set(),
    frames: 0,
  };

  for (const shot of solutionShots) {
    const launcher = level.launchers.find((item) => item.id === shot.launcherId) || level.launchers[0];
    const angle = Number.isFinite(shot.angle) ? shot.angle : launcher.angle;
    const radians = angle * Math.PI / 180;
    const ball = createBall({
      x: launcher.x,
      y: launcher.y,
      vx: Math.cos(radians) * fixedLauncherPower,
      vy: Math.sin(radians) * fixedLauncherPower,
      radius: 9,
    });
    ball.active = true;
    ball.originLauncherId = launcher.id;
    ball.launcherCooldown = 0.18;
    let captured = false;

    for (let i = 0; i < 720; i += 1) {
      const dt = 1 / 60;
      obstacles.forEach((obstacle) => updateMovingObstacle(obstacle, dt));
      const previous = { x: ball.x, y: ball.y };
      stepBall(ball, dt);

      const wallResult = resolveArenaWalls(ball, arena, level.arenaWalls, 0.96);
      wallResult.sides.forEach((side) => trace.arenaWallSides.add(side));
      if (wallResult.bounced) {
        trace.wallBounces += 1;
      }
      if (wallResult.stuck) {
        trace.stuckOnArenaWall = true;
        return trace;
      }

      let stickyHit = false;
      obstacles.concat(activeDoorObstacles(doors)).forEach((obstacle, index) => {
        if (resolveShapedObstacleBounce(ball, obstacle, obstacle.material === 'boost' ? 1.22 : 0.94)) {
          trace.obstacleBounces.add(obstacle.id);
          if (obstacle.material === 'boost') trace.boostBounces.add(obstacle.id);
          if (index < level.obstacles.length && level.obstacles[index].path) trace.hitMovingObstacle = true;
          if (obstacle.material === 'sticky') stickyHit = true;
        }
      });
      if (stickyHit) return trace;

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

      const capturedLauncher = tryLauncherCapture(ball, level.launchers);
      if (capturedLauncher) {
        trace.launcherReturns += 1;
        captured = true;
        trace.frames += i + 1;
        break;
      }

      ball.vx *= 0.998;
      ball.vy *= 0.998;
      trace.frames += 1;

      if (targetHitThisFrame(previous, ball, level.target, ball.radius, teleported || Boolean(relayed))) {
        trace.solved = true;
        return trace;
      }

      if (Math.hypot(ball.vx, ball.vy) < 28) {
        return trace;
      }
    }

    if (!captured) {
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
    assert.equal(level.launchers[0].angle, 0, `${level.name}/A1 should start facing right`);
  });
});

test('all authored relay launchers use the fixed power', () => {
  levels.forEach((level) => {
    (level.relayLaunchers || []).forEach((relay) => {
      assert.equal(relay.power, fixedLauncherPower, `${level.name}/${relay.id} should use fixed power`);
      assert.equal(relay.angle, 0, `${level.name}/${relay.id} should start facing right`);
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
    assert.ok(level.requiredMechanics.length > 0 || level.order <= 2);
  });
});

test('difficulty adds mechanics over time', () => {
  assert.equal(levels[0].portals.length, 0);
  assert.equal(levels[0].obstacles.length, 0);
  assert.ok(levels[3].obstacles.some((obstacle) => obstacle.shape === 'circle'));
  assert.ok(levels[4].obstacles.some((obstacle) => obstacle.shape === 'triangle' && obstacle.material === 'boost'));
  assert.ok(levels[5].portals.length >= 2);
  assert.ok(levels[6].requiredMechanics.includes('portal'));
  assert.ok(levels[6].requiredMechanics.includes('obstacleBounce'));
  assert.ok(levels[7].relayLaunchers.length >= 1);
  assert.ok(levels[8].requiredMechanics.includes('relay'));
  assert.ok(levels[8].requiredMechanics.includes('boostBounce'));
  assert.ok(levels[9].portals.length >= 2);
  assert.ok(levels[9].obstacles.some((obstacle) => obstacle.path));
  assert.ok(levels[9].relayLaunchers.length >= 1);
  assert.ok(levels[9].requiredMechanics.includes('boostBounce'));
  assert.ok(levels[10].switches.length >= 1);
  assert.ok(levels[10].doors.length >= 1);
  assert.ok(levels.slice(10, 15).every((level) => (level.switches || []).length >= 1));
  assert.ok(levels.slice(10, 15).every((level) => (level.doors || []).length >= 1));
  assert.ok(levels[11].requiredMechanics.includes('wallBounce'));
  assert.ok(levels[12].obstacles.some((obstacle) => obstacle.path));
  assert.ok(levels[13].portals.length >= 2);
  assert.ok(levels[14].relayLaunchers.length >= 1);
  assert.ok(levels[15].obstacles.some((obstacle) => obstacle.material === 'sticky'));
  assert.ok(levels[15].requiredMechanics.includes('launcherReturn'));
  assert.ok(levels[15].requiredMechanics.includes('relay'));
  assert.ok(levels[15].requiredMechanics.includes('portal'));
  assert.ok(levels[15].switches.length >= 1);
  assert.ok(levels[15].doors.length >= 1);
  assert.ok(levels[15].solutionShots.length >= 2);
});

test('authored bank surfaces are used while traps stay off the solution path', () => {
  levels.forEach((level) => {
    const trace = traceDefaultLauncher(level);
    const bankIds = level.obstacles.filter((obstacle) => obstacle.role === 'bank').map((obstacle) => obstacle.id);
    const trapIds = level.obstacles
      .filter((obstacle) => obstacle.role === 'deadzone' || obstacle.role === 'decoy')
      .map((obstacle) => obstacle.id);

    bankIds.forEach((id) => {
      assert.ok(trace.obstacleBounces.has(id), `${level.name} should use authored bank ${id}`);
    });
    trapIds.forEach((id) => {
      assert.equal(trace.obstacleBounces.has(id), false, `${level.name} solution should avoid trap ${id}`);
    });
  });
});

test('moving shutters create real open and closed timing windows', () => {
  levels.filter((level) => level.obstacles.some((obstacle) => obstacle.path)).forEach((level) => {
    const defaultTrace = traceDefaultLauncher(level);
    assert.equal(defaultTrace.solved, true, `${level.name} should have an authored open window`);

    const phaseOffsets = [Math.PI / 2, Math.PI, Math.PI * 1.5];
    const hasClosedWindow = phaseOffsets.some((offset) => {
      const shiftedLevel = {
        ...level,
        obstacles: level.obstacles.map((obstacle) => (
          obstacle.path ? { ...obstacle, phase: (obstacle.phase || 0) + offset } : { ...obstacle }
        )),
      };
      return !traceDefaultLauncher(shiftedLevel).solved;
    });

    assert.equal(hasClosedWindow, true, `${level.name} moving shutter should be able to block the route`);
    level.obstacles.filter((obstacle) => obstacle.path).forEach((obstacle) => {
      assert.equal(obstacle.material, 'sticky', `${level.name}/${obstacle.id} should punish a mistimed shot`);
    });
  });
});

test('arena boundary rules discourage unintended outer-wall play', () => {
  const validModes = new Set(['bounce', 'sticky']);
  levels.forEach((level) => {
    assert.ok(level.arenaWalls, `${level.name} should define arena wall behavior`);
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      assert.ok(validModes.has(level.arenaWalls[side]), `${level.name}/${side} should use a valid arena wall mode`);
    });

    const stickySides = Object.values(level.arenaWalls).filter((mode) => mode === 'sticky').length;
    if (!level.requiredMechanics.includes('wallBounce')) {
      assert.equal(stickySides, 4, `${level.name} should make every outer wall sticky when wall bounce is not required`);
    } else if (level.order !== 5) {
      assert.ok(stickySides >= 2, `${level.name} should only leave necessary outer walls bouncy`);
    }
  });
});

test('authored routes avoid outer-wall bounces unless the level teaches them', () => {
  levels.forEach((level) => {
    const trace = traceDefaultLauncher(level);
    if (!level.requiredMechanics.includes('wallBounce')) {
      assert.equal(trace.wallBounces, 0, `${level.name} should not depend on arena wall bounces`);
      assert.equal(trace.stuckOnArenaWall, false, `${level.name} should avoid sticky arena walls`);
    }
  });
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
    if (level.requiredMechanics.includes('boostBounce')) {
      assert.ok(trace.boostBounces.size > 0, `${level.name} should bounce from a boost wall`);
    }
    if (level.requiredMechanics.includes('relay')) {
      assert.ok(trace.relayLaunches.size > 0, `${level.name} should trigger a relay launcher`);
    }
    if (level.requiredMechanics.includes('switchDoor')) {
      assert.ok(trace.switchHits.size > 0, `${level.name} should hit a switch`);
    }
    if (level.requiredMechanics.includes('launcherReturn')) {
      assert.ok(trace.launcherReturns > 0, `${level.name} should return to the start launcher`);
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
