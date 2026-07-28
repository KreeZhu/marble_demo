(function exposeMechanics(root) {
  'use strict';

  const mechanicLabels = {
    wallBounce: '墙面反弹',
    portal: '传送门',
    movingGate: '移动障碍时机',
    obstacleBounce: '障碍反弹',
    relay: '中继发射器',
    switchDoor: '开关门',
  };

  function shotMeetsRequiredMechanics({ requiredMechanics, events }) {
    const missing = [];

    requiredMechanics.forEach((mechanic) => {
      if (mechanic === 'wallBounce' && events.wallBounces <= 0) {
        missing.push(mechanicLabels.wallBounce);
      } else if (mechanic === 'portal' && events.teleports.size <= 0) {
        missing.push(mechanicLabels.portal);
      } else if (mechanic === 'movingGate' && !events.hitMovingObstacle) {
        missing.push(mechanicLabels.movingGate);
      } else if (mechanic === 'obstacleBounce' && events.obstacleBounces.size <= 0) {
        missing.push(mechanicLabels.obstacleBounce);
      } else if (mechanic === 'relay' && events.relayLaunches.size <= 0) {
        missing.push(mechanicLabels.relay);
      } else if (mechanic === 'switchDoor' && events.switchHits.size <= 0) {
        missing.push(mechanicLabels.switchDoor);
      }
    });

    return {
      ok: missing.length === 0,
      missing,
    };
  }

  const api = { shotMeetsRequiredMechanics };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PinballMechanics = api;
})(typeof window !== 'undefined' ? window : globalThis);
