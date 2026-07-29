(function exposeSimulation(root) {
  'use strict';

  const EPSILON = 0.00001;

  function createBall({ x, y, vx = 0, vy = 0, radius = 9 }) {
    return {
      x,
      y,
      vx,
      vy,
      radius,
      active: false,
      portalCooldown: 0,
      relayCooldown: 0,
      trail: [],
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function stepBall(ball, dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.portalCooldown = Math.max(0, ball.portalCooldown - dt);
    ball.relayCooldown = Math.max(0, ball.relayCooldown - dt);
  }

  function resolveWallBounce(ball, bounds, restitution = 1) {
    const left = bounds.x + ball.radius;
    const right = bounds.x + bounds.width - ball.radius;
    const top = bounds.y + ball.radius;
    const bottom = bounds.y + bounds.height - ball.radius;
    let bounced = false;

    if (ball.x < left) {
      ball.x = left;
      ball.vx = Math.abs(ball.vx) * restitution;
      bounced = true;
    } else if (ball.x > right) {
      ball.x = right;
      ball.vx = -Math.abs(ball.vx) * restitution;
      bounced = true;
    }

    if (ball.y < top) {
      ball.y = top;
      ball.vy = Math.abs(ball.vy) * restitution;
      bounced = true;
    } else if (ball.y > bottom) {
      ball.y = bottom;
      ball.vy = -Math.abs(ball.vy) * restitution;
      bounced = true;
    }

    return bounced;
  }

  function segmentCircleHit(start, end, circle, movingRadius = 0) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < EPSILON) {
      return Math.hypot(start.x - circle.x, start.y - circle.y) <= circle.radius + movingRadius;
    }

    const t = clamp(((circle.x - start.x) * dx + (circle.y - start.y) * dy) / lengthSq, 0, 1);
    const closest = { x: start.x + dx * t, y: start.y + dy * t };
    return Math.hypot(closest.x - circle.x, closest.y - circle.y) <= circle.radius + movingRadius;
  }

  function targetHitThisFrame(start, end, target, movingRadius = 0, teleported = false) {
    if (teleported) {
      return Math.hypot(end.x - target.x, end.y - target.y) <= target.radius + movingRadius;
    }

    return segmentCircleHit(start, end, target, movingRadius);
  }

  function tryTeleport(ball, portals) {
    if (ball.portalCooldown > 0) return false;

    const entry = portals.find((portal) => distance(ball, portal) <= portal.radius + ball.radius);
    if (!entry) return false;

    const exit = portals.find((portal) => portal.id === entry.pairId);
    if (!exit) return false;

    const exitAngle = Number.isFinite(exit.exitAngle) ? exit.exitAngle : Math.atan2(ball.vy, ball.vx);
    const offset = exit.radius + ball.radius;
    ball.x = exit.x + Math.cos(exitAngle) * offset;
    ball.y = exit.y + Math.sin(exitAngle) * offset;
    ball.portalCooldown = 0.35;
    return true;
  }

  function tryRelayLaunch(ball, relayLaunchers = []) {
    if (ball.relayCooldown > 0) return null;

    const relay = relayLaunchers.find((launcher) => (
      distance(ball, launcher) <= (launcher.radius || 22) + ball.radius
    ));
    if (!relay) return null;

    const radians = relay.angle * Math.PI / 180;
    const offset = (relay.radius || 22) + ball.radius + 2;
    ball.x = relay.x + Math.cos(radians) * offset;
    ball.y = relay.y + Math.sin(radians) * offset;
    ball.vx = Math.cos(radians) * relay.power;
    ball.vy = Math.sin(radians) * relay.power;
    ball.relayCooldown = 0.45;
    return relay;
  }

  function resolveObstacleBounce(ball, rect, restitution = 1) {
    const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const distSq = dx * dx + dy * dy;

    if (distSq > ball.radius * ball.radius) return false;

    let nx = 0;
    let ny = 0;

    if (distSq > EPSILON) {
      const dist = Math.sqrt(distSq);
      nx = dx / dist;
      ny = dy / dist;
    } else {
      const leftOverlap = Math.abs(ball.x - rect.x);
      const rightOverlap = Math.abs(rect.x + rect.width - ball.x);
      const topOverlap = Math.abs(ball.y - rect.y);
      const bottomOverlap = Math.abs(rect.y + rect.height - ball.y);
      const min = Math.min(leftOverlap, rightOverlap, topOverlap, bottomOverlap);

      if (min === leftOverlap) nx = -1;
      else if (min === rightOverlap) nx = 1;
      else if (min === topOverlap) ny = -1;
      else ny = 1;
    }

    if (Math.abs(nx) > Math.abs(ny)) {
      ball.x = nx < 0 ? rect.x - ball.radius : rect.x + rect.width + ball.radius;
    } else {
      ball.y = ny < 0 ? rect.y - ball.radius : rect.y + rect.height + ball.radius;
    }

    const obstacleVx = rect.vx || 0;
    const obstacleVy = rect.vy || 0;
    const rvx = ball.vx - obstacleVx;
    const rvy = ball.vy - obstacleVy;
    const dot = rvx * nx + rvy * ny;

    if (dot < 0) {
      ball.vx = (rvx - 2 * dot * nx) * restitution + obstacleVx;
      ball.vy = (rvy - 2 * dot * ny) * restitution + obstacleVy;
    }

    return true;
  }

  function reflectBallFromNormal(ball, nx, ny, obstacle, restitution = 1) {
    const obstacleVx = obstacle.vx || 0;
    const obstacleVy = obstacle.vy || 0;
    const rvx = ball.vx - obstacleVx;
    const rvy = ball.vy - obstacleVy;
    const dot = rvx * nx + rvy * ny;

    if (dot < 0) {
      ball.vx = (rvx - 2 * dot * nx) * restitution + obstacleVx;
      ball.vy = (rvy - 2 * dot * ny) * restitution + obstacleVy;
    }
  }

  function resolveCircleObstacleBounce(ball, circle, restitution = 1) {
    const radius = circle.radius || Math.max(circle.width || 0, circle.height || 0) / 2 || 24;
    const dx = ball.x - circle.x;
    const dy = ball.y - circle.y;
    const minDist = radius + ball.radius;
    const distSq = dx * dx + dy * dy;

    if (distSq > minDist * minDist) return false;

    const dist = Math.max(Math.sqrt(distSq), EPSILON);
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = circle.x + nx * minDist;
    ball.y = circle.y + ny * minDist;
    reflectBallFromNormal(ball, nx, ny, circle, restitution);
    return true;
  }

  function trianglePoints(triangle) {
    const width = triangle.width || 96;
    const height = triangle.height || 84;
    const angle = (triangle.angle || 0) * Math.PI / 180;
    const local = [
      { x: width / 2, y: 0 },
      { x: -width / 2, y: -height / 2 },
      { x: -width / 2, y: height / 2 },
    ];

    return local.map((point) => ({
      x: triangle.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: triangle.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    }));
  }

  function closestPointOnSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < EPSILON) return { x: a.x, y: a.y };
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function pointInTriangle(point, a, b, c) {
    const area = (p1, p2, p3) => (
      Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2)
    );
    const whole = area(a, b, c);
    const sum = area(point, b, c) + area(a, point, c) + area(a, b, point);
    return Math.abs(whole - sum) < 0.5;
  }

  function resolveTriangleObstacleBounce(ball, triangle, restitution = 1) {
    const points = trianglePoints(triangle);
    let closest = null;
    let closestDistSq = Infinity;

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const candidate = closestPointOnSegment(ball, a, b);
      const dx = ball.x - candidate.x;
      const dy = ball.y - candidate.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = candidate;
      }
    }

    const inside = pointInTriangle(ball, points[0], points[1], points[2]);
    if (!inside && closestDistSq > ball.radius * ball.radius) return false;

    let nx = ball.x - closest.x;
    let ny = ball.y - closest.y;
    const dist = Math.max(Math.hypot(nx, ny), EPSILON);
    nx /= dist;
    ny /= dist;
    ball.x = closest.x + nx * ball.radius;
    ball.y = closest.y + ny * ball.radius;
    reflectBallFromNormal(ball, nx, ny, triangle, restitution);
    return true;
  }

  function resolveShapedObstacleBounce(ball, obstacle, restitution = 1) {
    const isSticky = obstacle.material === 'sticky';
    const effectiveRestitution = isSticky ? 0 : restitution;
    const collided = obstacle.shape === 'circle'
      ? resolveCircleObstacleBounce(ball, obstacle, effectiveRestitution)
      : obstacle.shape === 'triangle'
        ? resolveTriangleObstacleBounce(ball, obstacle, effectiveRestitution)
        : resolveObstacleBounce(ball, obstacle, effectiveRestitution);

    if (collided && isSticky) {
      ball.vx = 0;
      ball.vy = 0;
    }

    return collided;
  }

  function updateMovingObstacle(rect, dt) {
    if (!rect.path) return;

    rect.phase = (rect.phase || 0) + dt * (rect.speed || 1);
    const wave = Math.sin(rect.phase);
    const previousX = rect.x;
    const previousY = rect.y;
    rect.x = rect.originX + rect.path.x * wave;
    rect.y = rect.originY + rect.path.y * wave;
    rect.vx = (rect.x - previousX) / Math.max(dt, EPSILON);
    rect.vy = (rect.y - previousY) / Math.max(dt, EPSILON);
  }

  const api = {
    createBall,
    stepBall,
    resolveWallBounce,
    segmentCircleHit,
    targetHitThisFrame,
    tryTeleport,
    tryRelayLaunch,
    resolveObstacleBounce,
    resolveCircleObstacleBounce,
    resolveTriangleObstacleBounce,
    resolveShapedObstacleBounce,
    trianglePoints,
    updateMovingObstacle,
    clamp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballSandbox = api;
})(typeof window !== 'undefined' ? window : globalThis);
