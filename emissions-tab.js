/* Emissions tab — loaded after index.html main script */

function initEmissionsPortAutocomplete() {
  ['em-pol', 'em-pod'].forEach(id => {
    const inp = document.getElementById(id);
    if (!inp || inp.dataset.portAcBound === '1') return;
    bindPortAutocomplete(inp);
  });
}

function wireEmissionsPorts() {
  initEmissionsPortAutocomplete();
  wireEmissionsCoverageAuto();
}

function wireEmissionsCoverageAuto() {
  ['em-pol', 'em-pod'].forEach(id => {
    const inp = document.getElementById(id);
    if (!inp || inp.dataset.emCoverageBound === '1') return;
    inp.dataset.emCoverageBound = '1';
    inp.addEventListener('change', emSyncCoverageFromPorts);
  });
}

function emIsEuPort(port) {
  return port && String(port.ismrv || '').toUpperCase() === 'Y';
}

function emCoverageValueFromPorts(pol, pod) {
  const euCount = [pol, pod].filter(emIsEuPort).length;
  if (euCount >= 2) return '100';
  if (euCount === 1) return '50';
  return '0';
}

function emApplyCoverageFromPorts(pol, pod) {
  if (!pol || !pod) return null;
  const value = emCoverageValueFromPorts(pol, pod);
  emSetCoverage(value);
  return value;
}

function emSyncCoverageFromPorts() {
  if (typeof getRoutePortFromInput !== 'function') return;
  const pol = getRoutePortFromInput('em-pol');
  const pod = getRoutePortFromInput('em-pod');
  if (pol && pod) emApplyCoverageFromPorts(pol, pod);
}

// ─── EMISSIONS TAB ────────────────────────────────────────────────────────────
const EM_EMISSION_FACTORS = {
  VLSFO: 3.151,
  LSMGO: 3.206,
  MDO: 3.206,
  HFO: 3.114,
  LNG: 2.750,
  Methanol: 1.375,
  Ammonia: 0.000
};
const EM_FUEL_TYPES = Object.keys(EM_EMISSION_FACTORS);
const FUELEU_GHGI = {
  HFO: { lcv: 40500, ghgi: 91.744 },
  LFO: { lcv: 41000, ghgi: 91.392 },
  VLSFO: { lcv: 41000, ghgi: 91.392 },
  MGO: { lcv: 42700, ghgi: 90.767 },
  LSMGO: { lcv: 42700, ghgi: 90.767 },
  MDO: { lcv: 42700, ghgi: 90.767 }
};
let emFuelId = 0;
let emFuelRows = [];

function getFuelEULimit(year) {
  const base = 91.16;
  if (year <= 2029) return base * (1 - 0.02);
  if (year <= 2034) return base * (1 - 0.06);
  if (year <= 2039) return base * (1 - 0.145);
  if (year <= 2044) return base * (1 - 0.31);
  if (year <= 2049) return base * (1 - 0.62);
  return base * (1 - 0.80);
}

function emInitComplianceYear() {
  const select = document.getElementById('em-fuel-eu-year');
  if (!select) return;
  const currentYear = new Date().getFullYear();
  select.innerHTML = '';
  for (let year = 2025; year <= 2050; year++) {
    const opt = document.createElement('option');
    opt.value = String(year);
    opt.textContent = String(year);
    if (year === currentYear) opt.selected = true;
    select.appendChild(opt);
  }
}

function emGetComplianceYear() {
  const year = parseInt(document.getElementById('em-fuel-eu-year')?.value, 10);
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function emFmtNum(n, decimals = 3) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function emFmtCo2(n) {
  return emFmtNum(n) + ' t';
}

function emFmtCo2Whole(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' t';
}

function emFmtEur(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return '€' + (n / 1e6).toFixed(2) + 'M';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function emFmtEurDay(n) {
  if (!n || isNaN(n)) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '/d';
}

function emFmtEua(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.ceil(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function emFmtIntensity(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return emFmtNum(n, 2) + ' gCO₂eq/MJ';
}

function emFmtGhgMass(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return emFmtNum(n, 0) + ' gCO₂eq';
}

function emFmtMj(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return emFmtNum(n, 0) + ' MJ';
}

function emFmtEurPrecise(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emCoverageFromType(voyageType) {
  if (voyageType === '50') return 0.5;
  if (voyageType === '0') return 0;
  return 1.0;
}

function emCoverageLabelFromFactor(coverage) {
  if (coverage >= 1) return '100%';
  if (coverage >= 0.5) return '50%';
  return '0%';
}

function emSetCoverage(value) {
  const input = document.getElementById('em-voyage-type');
  if (input) input.value = value;
  document.querySelectorAll('#emissions-app .coverage-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.coverage === value);
  });
}

function emNextFuelType() {
  if (!emFuelRows.length) return EM_FUEL_TYPES[0];
  const last = emFuelRows[emFuelRows.length - 1];
  const fuel = document.getElementById(`em-fuel-type-${last.id}`)?.value || last.fuel;
  const idx = EM_FUEL_TYPES.indexOf(fuel);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % EM_FUEL_TYPES.length;
  return EM_FUEL_TYPES[nextIdx];
}

function emShowEmptyState() {
  const el = document.getElementById('emissionsResults');
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true"><path fill="#a8b8a8" d="m249.46 122.18l-28.34-7.09a93.87 93.87 0 0 0-80.22-80.21l-7.08-28.34a6 6 0 0 0-11.64 0l-7.08 28.34a93.87 93.87 0 0 0-80.22 80.21l-28.34 7.09a6 6 0 0 0 0 11.64l28.34 7.09a93.87 93.87 0 0 0 80.22 80.21l7.08 28.34a6 6 0 0 0 11.64 0l7.08-28.34a93.87 93.87 0 0 0 80.22-80.21l28.34-7.09a6 6 0 0 0 0-11.64m-41.05-10.26L157 99.05l-12.92-51.46a81.87 81.87 0 0 1 64.33 64.33m-63-9.76L128 119.51l-17.36-17.35L128 32.74Zm-33.49-54.57L99.05 99.05l-51.46 12.87a81.87 81.87 0 0 1 64.33-64.33m-9.76 63.06L119.52 128l-17.36 17.35L32.74 128Zm-54.57 33.43L99.05 157l12.87 51.46a81.87 81.87 0 0 1-64.33-64.38m63.05 9.76L128 136.49l17.36 17.35L128 223.26Zm33.44 54.57L157 157l51.46-12.87a81.87 81.87 0 0 1-64.38 64.28m9.76-63.06L136.48 128l17.36-17.35L223.26 128Z"/></svg></div>
      <div>Enter voyage details and calculate ETS</div>
    </div>
  `;
}

function emShowWarning(message) {
  const el = document.getElementById('emissionsResults');
  if (!el) return;
  el.innerHTML = `<div class="em-warning">${message}</div>`;
}

function emFuelOptions(selected) {
  return EM_FUEL_TYPES.map(fuel =>
    `<option value="${fuel}" ${fuel === selected ? 'selected' : ''}>${fuel}</option>`
  ).join('');
}

function emRecalcFuelRow(rowId) {
  const row = emFuelRows.find(r => r.id === rowId);
  if (!row) return;
  const select = document.getElementById(`em-fuel-type-${rowId}`);
  const mtEl = document.getElementById(`em-fuel-mt-${rowId}`);
  const factorEl = document.getElementById(`em-fuel-factor-${rowId}`);
  const co2El = document.getElementById(`em-fuel-co2-${rowId}`);
  if (!select || !factorEl || !co2El) return;

  row.fuel = select.value;
  const factor = EM_EMISSION_FACTORS[row.fuel] ?? 0;
  factorEl.textContent = emFmtNum(factor);

  const mt = mtEl ? (parseNum(mtEl.value) || 0) : 0;
  co2El.textContent = emFmtNum(mt * factor);
}

function emRecalcAllFuelRows() {
  emFuelRows.forEach(row => emRecalcFuelRow(row.id));
}

function emRenderFuelRows() {
  const tbody = document.getElementById('em-fuel-rows');
  if (!tbody) return;

  tbody.innerHTML = emFuelRows.map(row => `
    <tr>
      <td>
        <select id="em-fuel-type-${row.id}" onchange="emRecalcFuelRow(${row.id})">
          ${emFuelOptions(row.fuel)}
        </select>
      </td>
      <td>
        <input type="text" inputmode="decimal" class="num-fmt" id="em-fuel-mt-${row.id}" data-decimals="3" value="${row.mt == null || row.mt === '' ? '' : fmtNumInput(row.mt, 3)}" oninput="emRecalcFuelRow(${row.id})">
      </td>
      <td>
        <span id="em-fuel-factor-${row.id}" class="em-derived-value"></span>
      </td>
      <td>
        <span id="em-fuel-co2-${row.id}" class="em-derived-value"></span>
      </td>
      <td>
        <button class="remove-btn" type="button" data-admin-only onclick="emRemoveFuelRow(${row.id})" aria-label="Remove fuel row">×</button>
      </td>
    </tr>
  `).join('');

  formatAllNumInputs(document.getElementById('emissions-app'));
  emRecalcAllFuelRows();
  if (typeof applyRoleUI === 'function') applyRoleUI();
}

function emAddFuelRow(defaults = {}) {
  const id = ++emFuelId;
  const fuel = defaults.fuel || emNextFuelType();
  emFuelRows.push({ id, fuel, mt: defaults.mt ?? '' });
  emRenderFuelRows();
}

function emRemoveFuelRow(id) {
  emFuelRows = emFuelRows.filter(row => row.id !== id);
  emRenderFuelRows();
}

function emFmtNM(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' NM';
}

function emGetSpeedAndFuelRate() {
  const speed = parseNum(document.getElementById('em-speed')?.value);
  const mtPerDay = parseNum(document.getElementById('em-fuel-rate')?.value);
  return {
    speedKn: speed != null && speed > 0 ? speed : 12.5,
    mtPerDay: mtPerDay != null && mtPerDay > 0 ? mtPerDay : 25,
  };
}

function emFindFuelRow(fuelType) {
  return emFuelRows.find(row => {
    const select = document.getElementById(`em-fuel-type-${row.id}`);
    const fuel = select?.value || row.fuel;
    return fuel === fuelType;
  });
}

function emSetFuelRowMt(fuelType, mt) {
  let row = emFindFuelRow(fuelType);
  if (!row) {
    emAddFuelRow({ fuel: fuelType, mt });
    return;
  }
  row.mt = mt;
  row.fuel = fuelType;
  const mtEl = document.getElementById(`em-fuel-mt-${row.id}`);
  const typeEl = document.getElementById(`em-fuel-type-${row.id}`);
  if (typeEl) typeEl.value = fuelType;
  if (mtEl) mtEl.value = fmtNumInput(mt, 3);
  emRecalcFuelRow(row.id);
}

async function emApplyRouteFuelFromPorts() {
  const pol = typeof getRoutePortFromInput === 'function' ? getRoutePortFromInput('em-pol') : null;
  const pod = typeof getRoutePortFromInput === 'function' ? getRoutePortFromInput('em-pod') : null;
  if (!pol || !pod) {
    return { ok: false, error: 'Select load and discharge ports from the dropdown' };
  }
  const engine = window.ArctiumRouteEngine;
  if (!engine?.calculateLegRoute) {
    return { ok: false, error: 'Route engine not available' };
  }

  const route = await engine.calculateLegRoute(pol, pod);
  if (route.error) return { ok: false, error: route.error };

  const { speedKn, mtPerDay } = emGetSpeedAndFuelRate();
  const fuel = engine.computeSeaFuelMT({
    nonEcaNM: route.nonEcaNM,
    ecaNM: route.ecaNM,
    speedKn,
    mtPerDay,
  });

  emSetFuelRowMt('VLSFO', fuel.vlsfoMT);
  emSetFuelRowMt('LSMGO', fuel.lsmgoMT);
  emApplyCoverageFromPorts(pol, pod);

  const voyageDaysEl = document.getElementById('em-voyage-days');
  if (voyageDaysEl && fuel.seaDays > 0) {
    voyageDaysEl.value = fmtNumInput(fuel.seaDays, 1);
    formatAllNumInputs(document.getElementById('emissions-app'));
  }

  return {
    ok: true,
    totalNM: route.totalNM,
    ecaNM: route.ecaNM,
    nonEcaNM: route.nonEcaNM,
    seaDays: fuel.seaDays,
  };
}

function emResetETS() {
  document.getElementById('em-vessel').value = '';
  emSetCoverage('100');
  clearRoutePortField('em-pol', 'em-pol-meta');
  clearRoutePortField('em-pod', 'em-pod-meta');
  document.getElementById('em-voyage-days').value = '';
  const speedEl = document.getElementById('em-speed');
  const rateEl = document.getElementById('em-fuel-rate');
  if (speedEl) speedEl.value = '12.5';
  if (rateEl) rateEl.value = '25';
  document.getElementById('em-eua-price').value = '80';
  emInitComplianceYear();
  emFuelRows = [];
  emFuelId = 0;
  emAddFuelRow({ fuel: 'VLSFO' });
  emAddFuelRow({ fuel: 'LSMGO' });
  formatAllNumInputs(document.getElementById('emissions-app'));
  emShowEmptyState();
}

function emGatherFuelData() {
  return emFuelRows.map(row => {
    const fuel = document.getElementById(`em-fuel-type-${row.id}`)?.value || row.fuel;
    const mt = parseNum(document.getElementById(`em-fuel-mt-${row.id}`)?.value) || 0;
    const factor = EM_EMISSION_FACTORS[fuel] ?? 0;
    const co2 = mt * factor;
    return { fuel, mt, factor, co2 };
  });
}

async function emCalcETS() {
  if (!emFuelRows.length) {
    emShowEmptyState();
    return;
  }

  const euaPrice = parseNum(document.getElementById('em-eua-price').value);
  if (euaPrice === null || euaPrice <= 0) {
    emShowWarning('Enter a valid EUA price');
    return;
  }

  let routeMeta = null;
  const pol = typeof getRoutePortFromInput === 'function' ? getRoutePortFromInput('em-pol') : null;
  const pod = typeof getRoutePortFromInput === 'function' ? getRoutePortFromInput('em-pod') : null;
  if (pol && pod) {
    const routeResult = await emApplyRouteFuelFromPorts();
    if (!routeResult.ok) {
      emShowWarning(routeResult.error);
      return;
    }
    routeMeta = routeResult;
  }

  const fuels = emGatherFuelData();
  const totalMt = fuels.reduce((sum, row) => sum + row.mt, 0);
  if (totalMt <= 0) {
    emShowWarning('No fuel consumption entered');
    return;
  }

  const voyageType = document.getElementById('em-voyage-type').value;
  const coverage = emCoverageFromType(voyageType);
  const coverageLabel = emCoverageLabelFromFactor(coverage);
  const totalCo2 = fuels.reduce((sum, row) => sum + row.co2, 0);
  const coveredCo2 = totalCo2 * coverage;
  const euasRequired = Math.ceil(coveredCo2);
  const totalCost = euasRequired * euaPrice;
  const voyageDays = parseNum(document.getElementById('em-voyage-days').value);
  const costPerDay = voyageDays && voyageDays > 0 ? totalCost / voyageDays : null;
  const complianceYear = emGetComplianceYear();

  emRenderResults({
    fuels,
    totalCo2,
    coverage,
    coverageLabel,
    coveredCo2,
    euasRequired,
    euaPrice,
    totalCost,
    voyageDays,
    costPerDay,
    complianceYear,
    routeMeta,
  });
}

function emSummaryRow(label, value, options = {}) {
  const { bold = false, valueClass = '' } = typeof options === 'boolean' ? { bold: options } : options;
  const valueHtml = bold ? `<strong>${value}</strong>` : value;
  const classAttr = [bold ? 'em-summary-total' : '', valueClass].filter(Boolean).join(' ');
  const valueClassAttr = classAttr ? ` class="${classAttr}"` : '';
  return `<tr><td>${label}</td><td${valueClassAttr}>${valueHtml}</td></tr>`;
}

function emComputeFuelEU(fuels, coverage, year) {
  const limit = getFuelEULimit(year);
  const rows = [];
  let totalEnergy = 0;
  let totalCoveredEnergy = 0;
  let totalGhg = 0;

  fuels.forEach(row => {
    const spec = FUELEU_GHGI[row.fuel];
    if (!spec || row.mt <= 0) {
      rows.push({ fuel: row.fuel, mt: row.mt, supported: false });
      return;
    }

    const energy = row.mt * spec.lcv;
    const wtwIntensity = spec.ghgi;
    const coveredEnergy = energy * coverage;

    totalEnergy += energy;
    totalCoveredEnergy += coveredEnergy;
    totalGhg += coveredEnergy * wtwIntensity;

    rows.push({
      fuel: row.fuel,
      mt: row.mt,
      lcv: spec.lcv,
      energy,
      wtwIntensity,
      coveredEnergy,
      supported: true
    });
  });

  const shipIntensity = totalCoveredEnergy > 0 ? totalGhg / totalCoveredEnergy : null;
  const complianceBalance = shipIntensity !== null ? (limit - shipIntensity) * totalCoveredEnergy : null;
  const deficit = complianceBalance !== null && complianceBalance < 0;
  const nonCompliantEnergy = deficit && shipIntensity > 0 ? Math.abs(complianceBalance) / shipIntensity : 0;
  const penaltyEur = deficit ? nonCompliantEnergy * 0.058 : 0;

  return {
    year,
    limit,
    rows,
    totalEnergy,
    totalCoveredEnergy,
    shipIntensity,
    complianceBalance,
    deficit,
    nonCompliantEnergy,
    penaltyEur
  };
}

function emRenderFuelEU(container, data, fuelEu, etsFuelRowsHtml, etsTotalsHtml) {
  const fuelRows = fuelEu.rows.map(row => {
    if (!row.supported) {
      return `
        <tr>
          <td>${row.fuel}</td>
          <td>${emFmtNum(row.mt)}</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${row.fuel}</td>
        <td>${emFmtNum(row.mt)}</td>
        <td>${emFmtNum(row.lcv, 0)}</td>
        <td>${emFmtMj(row.energy)}</td>
        <td>${emFmtIntensity(row.wtwIntensity)}</td>
        <td>${emFmtMj(row.coveredEnergy)}</td>
      </tr>
    `;
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.innerHTML = `
    <div class="section-title">Fuel Breakdown</div>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Fuel</th>
          <th>MT consumed</th>
          <th>Emission Factor</th>
          <th>CO₂ (t)</th>
          <th>Covered CO₂ (t)</th>
          <th>EUAs</th>
        </tr>
      </thead>
      <tbody>
        ${etsFuelRowsHtml}
        ${etsTotalsHtml}
      </tbody>
    </table>
    <div class="section-title">FuelEU Maritime</div>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Fuel</th>
          <th>MT consumed</th>
          <th>LCV (MJ/tn)</th>
          <th>Energy (MJ)</th>
          <th>WtW Intensity</th>
          <th>Covered Energy (MJ)</th>
        </tr>
      </thead>
      <tbody>${fuelRows}</tbody>
    </table>
    <div class="em-fuel-eu-note">FuelEU penalty is calculated on a per-voyage basis as an approximation. Official compliance is assessed annually across all voyages.</div>
  `;
  container.appendChild(wrap);
}

function emRenderResults(data) {
  const container = document.getElementById('emissionsResults');
  container.innerHTML = '';
  const fuelEu = emComputeFuelEU(data.fuels, data.coverage, data.complianceYear);
  const totalEmissionsCost = data.totalCost + fuelEu.penaltyEur;
  const limitLabel = `GHG Intensity Limit (${fuelEu.year})`;
  const fuelEuPenaltyValue = fuelEu.deficit
    ? emFmtEurPrecise(fuelEu.penaltyEur)
    : '<span class="em-fuel-eu-compliant">€0 — Compliant</span>';
  const fuelEuPenaltyClass = fuelEu.deficit ? 'val-neg' : 'em-fuel-eu-compliant';

  const verdictBody = `
    <strong>${emFmtEur(totalEmissionsCost)}</strong> total,
    <strong>${emFmtEur(data.totalCost)}</strong> in EU ETS,
    <strong>${emFmtEur(fuelEu.penaltyEur)}</strong> in Fuel EU.
  `;

  const verdictEl = document.createElement('div');
  verdictEl.innerHTML = `
    <div class="verdict-box">
      <div class="v-icon">◈</div>
      <div class="v-text">
        <div class="v-title">Total Costs</div>
        <div class="v-body">${verdictBody}</div>
      </div>
    </div>
  `;
  container.appendChild(verdictEl);

  const summaryRows = [
    emSummaryRow('Total CO₂ emitted', emFmtCo2Whole(data.totalCo2)),
  ];
  if (data.routeMeta?.totalNM != null) {
    summaryRows.push(emSummaryRow('Total distance', emFmtNM(data.routeMeta.totalNM)));
    summaryRows.push(emSummaryRow('ECA distance', emFmtNM(data.routeMeta.ecaNM)));
    summaryRows.push(emSummaryRow('Non-ECA distance', emFmtNM(data.routeMeta.nonEcaNM)));
  }
  summaryRows.push(
    emSummaryRow('Route coverage factor', data.coverageLabel),
    emSummaryRow('EUAs required', emFmtEua(data.euasRequired)),
    emSummaryRow('EUA price', emFmtEur(data.euaPrice) + '/tCO₂'),
    emSummaryRow('Weighted WtW Intensity', emFmtIntensity(fuelEu.shipIntensity)),
    emSummaryRow(limitLabel, emFmtIntensity(fuelEu.limit)),
    emSummaryRow('EU ETS cost', emFmtEur(data.totalCost)),
    emSummaryRow('FuelEU penalty', fuelEuPenaltyValue, { valueClass: fuelEuPenaltyClass }),
    emSummaryRow('Total emissions cost', emFmtEur(totalEmissionsCost), true),
  );
  if (data.costPerDay !== null) {
    summaryRows.splice(4, 0, emSummaryRow('Cost per day', emFmtEurDay(data.costPerDay)));
  }

  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'card';
  summaryWrap.innerHTML = `
    <div class="section-title">Emissions Summary</div>
    <table class="summary-table">
      <tbody>${summaryRows.join('')}</tbody>
    </table>
  `;
  container.appendChild(summaryWrap);

  const fuelRows = data.fuels.map(row => {
    const covered = row.co2 * data.coverage;
    const euas = Math.ceil(covered);
    return `
      <tr>
        <td>${row.fuel}</td>
        <td>${emFmtNum(row.mt)}</td>
        <td>${emFmtNum(row.factor)}</td>
        <td>${emFmtNum(row.co2)}</td>
        <td>${emFmtNum(covered)}</td>
        <td>${emFmtEua(euas)}</td>
      </tr>
    `;
  }).join('');

  const totals = data.fuels.reduce((acc, row) => {
    const covered = row.co2 * data.coverage;
    acc.mt += row.mt;
    acc.co2 += row.co2;
    acc.covered += covered;
    acc.euas += Math.ceil(covered);
    return acc;
  }, { mt: 0, co2: 0, covered: 0, euas: 0 });
  totals.euas = data.euasRequired;

  const etsTotalsHtml = `
    <tr>
      <td><strong>Total</strong></td>
      <td><strong>${emFmtNum(totals.mt)}</strong></td>
      <td>—</td>
      <td><strong>${emFmtNum(totals.co2)}</strong></td>
      <td><strong>${emFmtNum(totals.covered)}</strong></td>
      <td><strong>${emFmtEua(totals.euas)}</strong></td>
    </tr>
  `;

  emRenderFuelEU(container, data, fuelEu, fuelRows, etsTotalsHtml);
}

function emInitApp() {
  const root = document.getElementById('emissions-app');
  if (!root || root.dataset.emInit === '1') return;
  root.dataset.emInit = '1';
  wireEmissionsPorts();
  if (!emFuelRows.length) {
    emAddFuelRow({ fuel: 'VLSFO' });
    emAddFuelRow({ fuel: 'LSMGO' });
  }
  emInitComplianceYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', emInitApp);
} else {
  emInitApp();
}
