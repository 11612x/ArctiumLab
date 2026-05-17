/* Shared maritime route + ECA distance engine (searoute-ts + turf) */
(function () {
  const ECA_SUBDIVIDE_NM = 25;
  let routeEngineReady = false;
  let ecaPolygons = null;

  function waitForRouteEngine() {
    if (typeof window.searoute === 'function') {
      routeEngineReady = true;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const finish = () => {
        routeEngineReady = typeof window.searoute === 'function';
        resolve(routeEngineReady);
      };
      window.addEventListener('searoute-ready', finish, { once: true });
      setTimeout(finish, 60000);
    });
  }

  function isValidCoordinatePair(coord) {
    if (!Array.isArray(coord) || coord.length < 2) return false;
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
    return true;
  }

  function validateWaypoints(coords) {
    if (!Array.isArray(coords) || coords.length < 2) {
      return { valid: false, message: 'searoute returned no valid route geometry (path has fewer than 2 points).' };
    }
    for (let i = 0; i < coords.length; i++) {
      if (!isValidCoordinatePair(coords[i])) {
        return { valid: false, message: `searoute returned invalid coordinates at waypoint ${i + 1}.` };
      }
    }
    return { valid: true };
  }

  function portCoords(p) {
    return [Number(p.lon), Number(p.lat)];
  }

  function isValidPort(p) {
    if (!p) return false;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return false;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
    return true;
  }

  function haversineNM(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function initECA() {
    const zones = window.ARCTIUM_ECA_ZONES;
    if (!zones?.length || typeof turf === 'undefined') return;
    ecaPolygons = zones.map(z => turf.polygon([[...z.polygon, z.polygon[0]]]));
  }

  function buildRoute(from, to, { suez = true, panama = true } = {}) {
    if (!routeEngineReady || typeof window.searoute !== 'function') {
      return { error: 'Routing engine not loaded.' };
    }

    const restrictions = [];
    if (!suez) restrictions.push('suez');
    if (!panama) restrictions.push('panama');

    const options = {
      units: 'nauticalmiles',
      returnPassages: true,
    };
    if (restrictions.length) options.restrictions = restrictions;

    try {
      const result = window.searoute(from, to, options);
      const coords = result?.geometry?.coordinates;
      const check = validateWaypoints(coords);
      if (!check.valid) return { error: check.message };
      const routeNM = result.properties?.length;
      if (!Number.isFinite(routeNM) || routeNM < 1) {
        return { error: 'searoute returned invalid route length — verify port coordinates.' };
      }
      return {
        waypoints: coords,
        routeNM,
        passages: result.properties.passages || [],
      };
    } catch (e) {
      console.warn('searoute failed', from, to, e);
      return { error: e.message || 'Route calculation failed.' };
    }
  }

  function calculateECADistance(waypoints, routeNM) {
    const zones = window.ARCTIUM_ECA_ZONES || [];
    if (!ecaPolygons?.length) initECA();
    if (!ecaPolygons?.length) {
      return { ecaNM: 0, nonEcaNM: routeNM, totalNM: routeNM, zonesHit: [] };
    }

    let ecaNM = 0;
    let haversineTotal = 0;
    const zonesHit = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const segNM = haversineNM(from[1], from[0], to[1], to[0]);
      haversineTotal += segNM;
      const steps = Math.max(1, Math.ceil(segNM / ECA_SUBDIVIDE_NM));
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const lon0 = from[0] + t0 * (to[0] - from[0]);
        const lat0 = from[1] + t0 * (to[1] - from[1]);
        const lon1 = from[0] + t1 * (to[0] - from[0]);
        const lat1 = from[1] + t1 * (to[1] - from[1]);
        const subNM = haversineNM(lat0, lon0, lat1, lon1);
        const mid = turf.point([(lon0 + lon1) / 2, (lat0 + lat1) / 2]);
        zones.forEach((zone, idx) => {
          if (turf.booleanPointInPolygon(mid, ecaPolygons[idx])) {
            ecaNM += subNM;
            zonesHit.add(zone.name);
          }
        });
      }
    }
    const scale = haversineTotal > 0 ? routeNM / haversineTotal : 1;
    ecaNM *= scale;
    return { ecaNM, nonEcaNM: routeNM - ecaNM, totalNM: routeNM, zonesHit: [...zonesHit] };
  }

  async function calculateLegRoute(fromPort, toPort, canalOpts = { suez: true, panama: true }) {
    if (!isValidPort(fromPort) || !isValidPort(toPort)) {
      return { error: 'Invalid port coordinates.' };
    }
    await waitForRouteEngine();
    if (!routeEngineReady) {
      return { error: 'Routing engine not loaded. Check network and refresh.' };
    }
    initECA();

    const leg = buildRoute(portCoords(fromPort), portCoords(toPort), canalOpts);
    if (leg.error) return { error: leg.error };

    try {
      const eca = calculateECADistance(leg.waypoints, leg.routeNM);
      return {
        totalNM: eca.totalNM,
        ecaNM: eca.ecaNM,
        nonEcaNM: eca.nonEcaNM,
        zonesHit: eca.zonesHit,
        passages: leg.passages,
      };
    } catch (e) {
      return { error: 'ECA analysis failed: ' + (e.message || 'unknown error') };
    }
  }

  function computeSeaFuelMT({ nonEcaNM, ecaNM, speedKn, mtPerDay }) {
    if (speedKn <= 0 || mtPerDay <= 0) return { vlsfoMT: 0, lsmgoMT: 0, seaDays: 0 };
    const totalNM = nonEcaNM + ecaNM;
    const seaDays = totalNM / (speedKn * 24);
    const vlsfoMT = (nonEcaNM / (speedKn * 24)) * mtPerDay;
    const lsmgoMT = (ecaNM / (speedKn * 24)) * mtPerDay;
    return { vlsfoMT, lsmgoMT, seaDays };
  }

  const ready = waitForRouteEngine().then(ok => {
    if (ok) initECA();
    return ok;
  });

  window.ArctiumRouteEngine = {
    ready,
    isReady: () => routeEngineReady,
    calculateLegRoute,
    computeSeaFuelMT,
    isValidPort,
  };
})();
