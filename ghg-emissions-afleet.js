var _debugData = {};
var _devices = [];
var _groups = [];
var _groupMap = {};
var _tripAgg = {};
var _ruleIdleAgg = {};
var _tripIdleAgg = {};
var _idleCandidates = [];
var _rows = [];
var _tripCount = 0;
var _ruleIdleCount = 0;
var _candidateCount = 0;
var _skippedLongIdle = 0;
var _ignChecked = 0;
var _ignConfirmed = 0;
var _ignNoData = 0;
var _ignOff = 0;
var _ignTimeouts = 0;
var _ignErrors = 0;
var _tripCalls = 0;
var _idleCalls = 0;
var _ignWindowCalls = 0;
var _splitCount = 0;
var _chart = null;
var _distanceChart = null;
var _runToken = 0;
var _factorPanelExpanded = false;
var FACTOR_KEY = "ghg_afleet_factors_v07";
var OVERRIDE_KEY = "ghg_afleet_vehicle_fuels_v07";
var fuelTypes = [
  "Gasoline",
  "Diesel",
  "Gasoline HEV",
  "Gasoline PHEV",
  "Gasoline EREV",
  "All-Electric EV",
  "G.H2 FCV",
  "Diesel HEV",
  "Diesel HHV",
  "B20",
  "B100",
  "RD20",
  "RD100",
  "E85",
  "LPG",
  "CNG",
  "LNG",
  "LNG Diesel Pilot",
];
var defaultFactors = {
  Gasoline: { mile: 0.404, idleUnit: 8.887, idleRate: 0.3 },
  Diesel: { mile: 0.445, idleUnit: 10.18, idleRate: 0.75 },
  "Gasoline HEV": { mile: 0.255, idleUnit: 8.887, idleRate: 0.2 },
  "Gasoline PHEV": { mile: 0.19, idleUnit: 8.887, idleRate: 0.15 },
  "Gasoline EREV": { mile: 0.16, idleUnit: 8.887, idleRate: 0.1 },
  "All-Electric EV": { mile: 0.115, idleUnit: 0, idleRate: 0 },
  "G.H2 FCV": { mile: 0.06, idleUnit: 0, idleRate: 0 },
  "Diesel HEV": { mile: 0.33, idleUnit: 10.18, idleRate: 0.45 },
  "Diesel HHV": { mile: 0.335, idleUnit: 10.18, idleRate: 0.45 },
  B20: { mile: 0.405, idleUnit: 9.5, idleRate: 0.75 },
  B100: { mile: 0.26, idleUnit: 5.4, idleRate: 0.75 },
  RD20: { mile: 0.395, idleUnit: 9.4, idleRate: 0.75 },
  RD100: { mile: 0.15, idleUnit: 3.0, idleRate: 0.75 },
  E85: { mile: 0.285, idleUnit: 6.5, idleRate: 0.3 },
  LPG: { mile: 0.315, idleUnit: 5.75, idleRate: 0.35 },
  CNG: { mile: 0.33, idleUnit: 8.887, idleRate: 0.75 },
  LNG: { mile: 0.36, idleUnit: 6.06, idleRate: 0.75 },
  "LNG Diesel Pilot": { mile: 0.39, idleUnit: 7.5, idleRate: 0.75 },
};
function debugLog(msg) {
  var el = document.getElementById("debug-log");
  if (el) {
    el.textContent +=
      "[" + new Date().toLocaleTimeString() + "] " + msg + "\\n";
    el.scrollTop = el.scrollHeight;
  }
}
function debugSample(key, arr) {
  _debugData[key] = { total: arr.length, sample: arr.slice(0, 10) };
}
function copyDebugData() {
  var t = document.createElement("textarea");
  t.value = JSON.stringify(_debugData, null, 2);
  document.body.appendChild(t);
  t.select();
  document.execCommand("copy");
  document.body.removeChild(t);
  alert(
    "Debug data copied to clipboard! Paste it back to the AI chat for analysis.",
  );
}
function setStatus(msg, isError) {
  var el = document.getElementById("status");
  el.style.background = isError ? "#fef2f2" : "#eff6ff";
  el.style.borderColor = isError ? "#fecaca" : "#bfdbfe";
  el.style.color = isError ? "#991b1b" : "#1e40af";
  el.textContent = msg;
}
function nfmt(n, d) {
  if (n === null || typeof n === "undefined" || isNaN(n)) return "--";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function getSavedJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
}
function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    debugLog("Local storage save failed: " + (e.message || e));
  }
}
function getUnitMode() {
  var e = document.getElementById("unitMode");
  return e ? e.value : "us";
}
function ghgLabel() {
  return getUnitMode() === "metric" ? "metric tonnes CO2e" : "short tons CO2e";
}
function distanceLabel() {
  return getUnitMode() === "metric" ? "km" : "mi";
}
function displayGhgFromKg(kg) {
  return getUnitMode() === "metric" ? kg / 1000 : kg / 907.18474;
}
function displayDistanceFromMiles(mi) {
  return getUnitMode() === "metric" ? mi / 0.621371 : mi;
}
function clampInt(value, fallback, min, max) {
  var n = parseInt(value, 10);
  if (isNaN(n)) n = fallback;
  if (typeof min === "number" && n < min) n = min;
  if (typeof max === "number" && n > max) n = max;
  return n;
}
function getFactors() {
  var saved = getSavedJson(FACTOR_KEY, null);
  var factors = {};
  var i;
  for (i = 0; i < fuelTypes.length; i++) {
    var f = fuelTypes[i];
    factors[f] = {
      mile: defaultFactors[f].mile,
      idleUnit: defaultFactors[f].idleUnit,
      idleRate: defaultFactors[f].idleRate,
    };
  }
  if (saved) {
    for (i = 0; i < fuelTypes.length; i++) {
      var k = fuelTypes[i];
      if (saved[k]) {
        if (typeof saved[k].mile !== "undefined")
          factors[k].mile = parseFloat(saved[k].mile);
        if (typeof saved[k].idleUnit !== "undefined")
          factors[k].idleUnit = parseFloat(saved[k].idleUnit);
        if (typeof saved[k].idleRate !== "undefined")
          factors[k].idleRate = parseFloat(saved[k].idleRate);
      }
    }
  }
  return factors;
}
function setDefaultDates() {
  var today = new Date();
  var from = new Date();
  from.setDate(today.getDate() - 30);
  document.getElementById("toDate").value = today.toISOString().substr(0, 10);
  document.getElementById("fromDate").value = from.toISOString().substr(0, 10);
}
function buildGroupMap(groups) {
  _groupMap = {};
  var i;
  for (i = 0; i < groups.length; i++) {
    _groupMap[groups[i].id] = groups[i];
  }
}
function groupName(id) {
  var g = _groupMap[id];
  return g ? g.name || g.id : id;
}
function getParentGroupId(group) {
  if (!group) return null;
  if (group.parent && typeof group.parent === "object" && group.parent.id)
    return group.parent.id;
  if (typeof group.parent === "string") return group.parent;
  if (
    group.parentGroup &&
    typeof group.parentGroup === "object" &&
    group.parentGroup.id
  )
    return group.parentGroup.id;
  if (typeof group.parentGroup === "string") return group.parentGroup;
  return null;
}
function normalizeGroupLabel(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function getGroupPathToRoot(groupId) {
  var path = [];
  var seen = {};
  var currentId = groupId;
  while (currentId && !seen[currentId]) {
    seen[currentId] = true;
    var grp = _groupMap[currentId];
    if (!grp) break;
    path.push(grp);
    currentId = getParentGroupId(grp);
  }
  return path;
}
function pathFromSlashSeparatedName(name) {
  var raw = String(name || "");
  if (raw.indexOf("/") === -1) return [];
  var parts = raw.split("/");
  var out = [];
  var i;
  for (i = 0; i < parts.length; i++) {
    var part = String(parts[i] || "").trim();
    if (part) out.push(part);
  }
  return out;
}
function mapFuelSubtypeName(name) {
  var n = normalizeGroupLabel(name);
  var explicit = {
    "battery electric vehicle": "All-Electric EV",
    "plug-in hybrid electric vehicle": "Gasoline PHEV",
    "hybrid electric (hev)": "Gasoline HEV",
    "low voltage electric": "All-Electric EV",
    "fuel cell electric vehicle": "G.H2 FCV",
    "gasoline or petrol": "Gasoline",
    diesel: "Diesel",
    biodiesel: "B100",
    "compressed natural gas": "CNG",
    ethanol: "E85",
    "propane or liquified petroleum gas": "LPG",
    "propane or liquefied petroleum gas": "LPG",
    "electric or plug-in hybrid": null,
    "manually classified powertrain": null,
    "liquefied natural gas": "LNG",
    "other fuel type": null,
  };
  if (explicit.hasOwnProperty(n)) return explicit[n];
  return normFuel(name);
}
function fuelFromAssetInfoPath(pathNames) {
  if (!pathNames || pathNames.length === 0) return null;
  var normalized = [];
  var i;
  for (i = 0; i < pathNames.length; i++) {
    normalized.push(normalizeGroupLabel(pathNames[i]));
  }
  var assetIx = -1;
  var powertrainIx = -1;
  for (i = 0; i < normalized.length; i++) {
    if (assetIx === -1 && normalized[i] === "asset information") assetIx = i;
    if (
      powertrainIx === -1 &&
      normalized[i] === "powertrain and fuel type" &&
      assetIx > -1 &&
      i > assetIx
    )
      powertrainIx = i;
  }
  if (powertrainIx === -1) return null;
  for (i = pathNames.length - 1; i > powertrainIx; i--) {
    var f = mapFuelSubtypeName(pathNames[i]);
    if (f) return f;
  }
  return null;
}
function normFuel(text) {
  var s = String(text || "").toLowerCase();
  if (s.indexOf("lng") > -1 && s.indexOf("pilot") > -1)
    return "LNG Diesel Pilot";
  if (s.indexOf("phev") > -1 || s.indexOf("plug") > -1) return "Gasoline PHEV";
  if (s.indexOf("erev") > -1 || s.indexOf("extended range") > -1)
    return "Gasoline EREV";
  if (s.indexOf("diesel") > -1 && s.indexOf("hybrid") > -1) return "Diesel HEV";
  if (s.indexOf("hydraulic") > -1) return "Diesel HHV";
  if (s.indexOf("hybrid") > -1) return "Gasoline HEV";
  if (s.indexOf("electric") > -1 || s === "ev") return "All-Electric EV";
  if (
    s.indexOf("hydrogen") > -1 ||
    s.indexOf("fuel cell") > -1 ||
    s.indexOf("g.h2") > -1
  )
    return "G.H2 FCV";
  if (s.indexOf("rd100") > -1 || s.indexOf("renewable diesel 100") > -1)
    return "RD100";
  if (s.indexOf("rd20") > -1 || s.indexOf("renewable diesel 20") > -1)
    return "RD20";
  if (s.indexOf("b100") > -1 || s.indexOf("biodiesel 100") > -1) return "B100";
  if (s.indexOf("b20") > -1 || s.indexOf("biodiesel 20") > -1) return "B20";
  if (s.indexOf("e85") > -1 || s.indexOf("ethanol") > -1) return "E85";
  if (s.indexOf("propane") > -1 || s.indexOf("lpg") > -1) return "LPG";
  if (s.indexOf("cng") > -1 || s.indexOf("compressed natural gas") > -1)
    return "CNG";
  if (s.indexOf("lng") > -1 || s.indexOf("liquefied natural gas") > -1)
    return "LNG";
  if (s.indexOf("diesel") > -1) return "Diesel";
  if (s.indexOf("gasoline") > -1 || s.indexOf("petrol") > -1) return "Gasoline";
  return null;
}
function classifyFuel(device) {
  var overrides = getSavedJson(OVERRIDE_KEY, {});
  var manualOverride = overrides[device.id] || null;
  var groups = device.groups || [];
  var best = null;
  var src = "No fuel group found; defaulted to Gasoline";
  var i;
  for (i = 0; i < groups.length; i++) {
    var groupRef = groups[i] || {};
    var id = groupRef.id || "";
    var pathNames = [];
    var pathLeafToRoot = getGroupPathToRoot(id);
    var pathRootToLeaf = pathLeafToRoot.slice().reverse();
    var j;
    for (j = 0; j < pathRootToLeaf.length; j++) {
      pathNames.push(pathRootToLeaf[j].name || pathRootToLeaf[j].id || "");
    }
    if (pathNames.length === 0) {
      var inlinePath = pathFromSlashSeparatedName(groupRef.name || "");
      if (inlinePath.length > 0) pathNames = inlinePath;
    }
    if (pathNames.length === 0 && (groupRef.name || id)) {
      pathNames = [groupRef.name || groupName(id)];
    }
    var fuelFromPath = fuelFromAssetInfoPath(pathNames);
    var nm = groupName(id);
    var combined = id + " " + pathNames.join(" > ");
    var f = fuelFromPath || normFuel(combined);
    if (f) {
      var score = 1;
      if (fuelFromPath) score = 1000 + pathNames.length;
      else if (id.indexOf("Group") === 0) score = 2;
      if (!best || score > best.score) {
        best = { fuel: f, score: score };
        src = fuelFromPath ? pathNames.join(" > ") : nm + " (" + id + ")";
      }
    }
  }
  if (best) return { fuel: best.fuel, source: src };
  if (manualOverride)
    return {
      fuel: manualOverride,
      source: "Manual override (used because no Asset Information fuel group matched)",
    };
  return { fuel: "Gasoline", source: src };
}
function makeFuelSelect(deviceId, selected) {
  var select = document.createElement("select");
  select.style.cssText =
    "width:170px;padding:6px;border:1px solid #d1d5db;border-radius:6px;background:white;";
  var i;
  for (i = 0; i < fuelTypes.length; i++) {
    var opt = document.createElement("option");
    opt.value = fuelTypes[i];
    opt.textContent = fuelTypes[i];
    if (fuelTypes[i] === selected) opt.selected = true;
    select.appendChild(opt);
  }
  select.onchange = function () {
    var map = getSavedJson(OVERRIDE_KEY, {});
    map[deviceId] = select.value;
    saveJson(OVERRIDE_KEY, map);
    calculateAndRender();
  };
  return select;
}
function renderFactors() {
  var factors = getFactors();
  var wrap = document.getElementById("factorTable");
  wrap.innerHTML = "";
  var table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px;";
  var head = document.createElement("tr");
  head.innerHTML =
    '<th style="text-align:left;padding:5px;border-bottom:1px solid #e5e7eb;">Fuel</th><th style="text-align:right;padding:5px;border-bottom:1px solid #e5e7eb;">kg/mi</th><th style="text-align:right;padding:5px;border-bottom:1px solid #e5e7eb;">kg/unit</th><th style="text-align:right;padding:5px;border-bottom:1px solid #e5e7eb;">unit/hr</th>';
  table.appendChild(head);
  var i;
  for (i = 0; i < fuelTypes.length; i++) {
    (function (fuel) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      td1.style.cssText = "padding:5px;border-bottom:1px solid #f3f4f6;";
      td1.textContent = fuel;
      var td2 = document.createElement("td");
      var td3 = document.createElement("td");
      var td4 = document.createElement("td");
      td2.style.cssText =
        "padding:5px;border-bottom:1px solid #f3f4f6;text-align:right;";
      td3.style.cssText = td2.style.cssText;
      td4.style.cssText = td2.style.cssText;
      var in1 = document.createElement("input");
      var in2 = document.createElement("input");
      var in3 = document.createElement("input");
      in1.type = "number";
      in2.type = "number";
      in3.type = "number";
      in1.step = "0.001";
      in2.step = "0.001";
      in3.step = "0.001";
      in1.min = "0";
      in2.min = "0";
      in3.min = "0";
      in1.value = factors[fuel].mile;
      in2.value = factors[fuel].idleUnit;
      in3.value = factors[fuel].idleRate;
      in1.style.cssText =
        "width:58px;padding:4px;border:1px solid #d1d5db;border-radius:5px;text-align:right;";
      in2.style.cssText = in1.style.cssText;
      in3.style.cssText = in1.style.cssText;
      function saveFactor() {
        var nf = getFactors();
        nf[fuel] = {
          mile: parseFloat(in1.value) || 0,
          idleUnit: parseFloat(in2.value) || 0,
          idleRate: parseFloat(in3.value) || 0,
        };
        saveJson(FACTOR_KEY, nf);
        calculateAndRender();
      }
      in1.onchange = saveFactor;
      in2.onchange = saveFactor;
      in3.onchange = saveFactor;
      td2.appendChild(in1);
      td3.appendChild(in2);
      td4.appendChild(in3);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      table.appendChild(tr);
    })(fuelTypes[i]);
  }
  wrap.appendChild(table);
}
function updateFactorPanelUi() {
  var panel = document.getElementById("factorPanelContent");
  var btn = document.getElementById("factorToggleBtn");
  if (!panel || !btn) return;
  panel.style.display = _factorPanelExpanded ? "block" : "none";
  btn.textContent = _factorPanelExpanded ? "Hide" : "Show";
}
function initializeFactorPanelToggle() {
  var btn = document.getElementById("factorToggleBtn");
  if (!btn) return;
  _factorPanelExpanded = false;
  updateFactorPanelUi();
  btn.onclick = function () {
    _factorPanelExpanded = !_factorPanelExpanded;
    updateFactorPanelUi();
  };
}
function getDeviceMap() {
  var m = {};
  var i;
  for (i = 0; i < _devices.length; i++) m[_devices[i].id] = _devices[i];
  return m;
}
function hoursBetween(a, b) {
  var ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}
function parseDurationHours(ev) {
  if (ev.duration) {
    var d = String(ev.duration);
    var p = d.split(":");
    if (p.length === 3)
      return (
        (parseFloat(p[0]) || 0) +
        (parseFloat(p[1]) || 0) / 60 +
        (parseFloat(p[2]) || 0) / 3600
      );
  }
  if (ev.activeFrom && ev.activeTo)
    return hoursBetween(ev.activeFrom, ev.activeTo);
  return 0;
}
function addTrips(arr) {
  var maxKm = parseFloat(document.getElementById("idleKm").value) || 0.1;
  var minHr = (parseFloat(document.getElementById("idleMin").value) || 3) / 60;
  var maxHr = parseFloat(document.getElementById("maxIdleHours").value) || 4;
  var i;
  for (i = 0; i < arr.length; i++) {
    var t = arr[i];
    if (t.device && t.device.id) {
      var id = t.device.id;
      var km = t.distance || 0;
      var miles = km * 0.621371;
      var hrs = hoursBetween(t.start, t.stop);
      if (!_tripAgg[id])
        _tripAgg[id] = { miles: 0, kilometers: 0, trips: 0, drivingHours: 0 };
      _tripAgg[id].miles += miles;
      _tripAgg[id].kilometers += km;
      _tripAgg[id].trips += 1;
      _tripCount += 1;
      if (km <= maxKm && hrs >= minHr) {
        if (hrs <= maxHr) {
          _idleCandidates.push({
            deviceId: id,
            start: t.start,
            stop: t.stop,
            hours: hrs,
            distance: km,
          });
          _candidateCount += 1;
        } else {
          _skippedLongIdle += 1;
        }
      } else {
        _tripAgg[id].drivingHours += hrs;
      }
    }
  }
}
function addRuleIdle(arr) {
  var i;
  for (i = 0; i < arr.length; i++) {
    var ev = arr[i];
    if (ev.device && ev.device.id) {
      var id = ev.device.id;
      if (!_ruleIdleAgg[id]) _ruleIdleAgg[id] = { hours: 0, events: 0 };
      _ruleIdleAgg[id].hours += parseDurationHours(ev);
      _ruleIdleAgg[id].events += 1;
      _ruleIdleCount += 1;
    }
  }
}
function isIgnitionOnValue(v) {
  if (v === true) return true;
  if (v === 1) return true;
  if (typeof v === "number" && v > 0) return true;
  var s = String(v).toLowerCase();
  if (s === "true" || s === "on" || s === "1" || s.indexOf("ignitionon") > -1)
    return true;
  return false;
}
function addConfirmedIdle(c) {
  if (!_tripIdleAgg[c.deviceId])
    _tripIdleAgg[c.deviceId] = { hours: 0, events: 0 };
  _tripIdleAgg[c.deviceId].hours += c.hours;
  _tripIdleAgg[c.deviceId].events += 1;
  _ignConfirmed += 1;
}
function groupKeyForCandidate(c) {
  var d = new Date(c.start);
  return (
    c.deviceId +
    "|" +
    d.getUTCFullYear() +
    "-" +
    (d.getUTCMonth() + 1) +
    "-" +
    d.getUTCDate()
  );
}
function buildIgnitionGroups() {
  var map = {};
  var keys = [];
  var i;
  for (i = 0; i < _idleCandidates.length; i++) {
    var c = _idleCandidates[i];
    var key = groupKeyForCandidate(c);
    if (!map[key]) {
      map[key] = {
        key: key,
        deviceId: c.deviceId,
        from: new Date(new Date(c.start).getTime() - 120000),
        to: new Date(c.stop),
        candidates: [],
        rows: [],
      };
      keys.push(key);
    }
    map[key].candidates.push(c);
    if (new Date(c.start).getTime() - 120000 < map[key].from.getTime())
      map[key].from = new Date(new Date(c.start).getTime() - 120000);
    if (new Date(c.stop).getTime() > map[key].to.getTime())
      map[key].to = new Date(c.stop);
  }
  var arr = [];
  for (i = 0; i < keys.length; i++) arr.push(map[keys[i]]);
  return arr;
}
function ignitionWindowReq(g) {
  return [
    "Get",
    {
      typeName: "StatusData",
      search: {
        deviceSearch: { id: g.deviceId },
        diagnosticSearch: {
          id:
            document.getElementById("ignDiag").value || "DiagnosticIgnitionId",
        },
        fromDate: g.from.toISOString(),
        toDate: g.to.toISOString(),
      },
      resultsLimit: 5000,
      propertySelector: {
        fields: ["device", "diagnostic", "dateTime", "data"],
        isIncluded: true,
      },
    },
  ];
}
function hasIgnitionOnDuring(c, rows) {
  var start = new Date(c.start).getTime() - 120000;
  var stop = new Date(c.stop).getTime();
  var hasRows = false;
  var i;
  for (i = 0; i < rows.length; i++) {
    var tm = new Date(rows[i].dateTime).getTime();
    if (tm >= start && tm <= stop) {
      hasRows = true;
      if (isIgnitionOnValue(rows[i].data)) return 1;
    }
  }
  return hasRows ? 0 : -1;
}
function evaluateIgnitionGroup(group) {
  var j, result;
  group.evaluated = true;
  for (j = 0; j < group.candidates.length; j++) {
    _ignChecked += 1;
    result = hasIgnitionOnDuring(group.candidates[j], group.rows || []);
    if (result === 1) addConfirmedIdle(group.candidates[j]);
    else if (result === -1) _ignNoData += 1;
    else _ignOff += 1;
  }
}
function markIgnitionGroupNoData(group, reason) {
  var j;
  group.rows = [];
  group.evaluated = true;
  group.errorReason = reason || "no data";
  for (j = 0; j < group.candidates.length; j++) {
    _ignChecked += 1;
    _ignNoData += 1;
  }
  if (_debugData.ignitionWindowSamples.length < 20) {
    _debugData.ignitionWindowSamples.push({
      deviceId: group.deviceId,
      from: group.from.toISOString(),
      to: group.to.toISOString(),
      candidates: group.candidates.length,
      statusRows: 0,
      reason: reason || "no data",
      sample: [],
    });
  }
}
function recordIgnitionWindowSample(group) {
  if (_debugData.ignitionWindowSamples.length < 20) {
    _debugData.ignitionWindowSamples.push({
      deviceId: group.deviceId,
      from: group.from.toISOString(),
      to: group.to.toISOString(),
      candidates: group.candidates.length,
      statusRows: (group.rows || []).length,
      sample: (group.rows || []).slice(0, 5),
    });
  }
}
function loadIgnitionGroups(
  api,
  groups,
  index,
  batchSize,
  maxBatchSize,
  token,
  onDone,
  onError,
) {
  if (token !== _runToken) return;
  if (index >= groups.length) {
    onDone();
    return;
  }
  maxBatchSize = clampInt(maxBatchSize, batchSize, 1, 50);
  batchSize = clampInt(batchSize, 1, 1, maxBatchSize);
  if (batchSize < 1) batchSize = 1;
  var batch = groups.slice(index, index + batchSize);
  var calls = [];
  var i;
  for (i = 0; i < batch.length; i++) calls.push(ignitionWindowReq(batch[i]));
  setStatus(
    "Loading ignition measurement windows " +
      (index + 1) +
      "-" +
      (index + batch.length) +
      " of " +
      groups.length +
      " (batch " +
      batchSize +
      ")" +
      "... checked " +
      _ignChecked +
      " of " +
      _candidateCount +
      " idle candidates",
    false,
  );
  var completed = false;
  var timeoutMs = batchSize > 1 ? 45000 : 30000;
  var callStarted = new Date().getTime();
  var timer = setTimeout(function () {
    if (completed || token !== _runToken) return;
    completed = true;
    debugLog(
      "Ignition StatusData timeout at windows " +
        (index + 1) +
        "-" +
        (index + batch.length) +
        " with batch size " +
        batchSize,
    );
    if (batchSize > 1) {
      loadIgnitionGroups(
        api,
        groups,
        index,
        Math.max(1, Math.floor(batchSize / 2)),
        maxBatchSize,
        token,
        onDone,
        onError,
      );
    } else {
      _ignTimeouts += 1;
      markIgnitionGroupNoData(batch[0], "StatusData timeout");
      calculateAndRender();
      setTimeout(function () {
        loadIgnitionGroups(
          api,
          groups,
          index + 1,
          1,
          maxBatchSize,
          token,
          onDone,
          onError,
        );
      }, 0);
    }
  }, timeoutMs);
  api.multiCall(
    calls,
    function (results) {
      if (completed || token !== _runToken) return;
      completed = true;
      clearTimeout(timer);
      var j;
      for (j = 0; j < results.length; j++) {
        _ignWindowCalls += 1;
        batch[j].rows = results[j] || [];
        recordIgnitionWindowSample(batch[j]);
        evaluateIgnitionGroup(batch[j]);
      }
      var elapsed = new Date().getTime() - callStarted;
      var nextBatchSize = batchSize;
      if (
        batch.length === batchSize &&
        batchSize < maxBatchSize &&
        elapsed < 8000
      ) {
        nextBatchSize = Math.min(maxBatchSize, batchSize + 1);
      }
      calculateAndRender();
      setTimeout(function () {
        loadIgnitionGroups(
          api,
          groups,
          index + batch.length,
          nextBatchSize,
          maxBatchSize,
          token,
          onDone,
          onError,
        );
      }, 0);
    },
    function (err) {
      if (completed || token !== _runToken) return;
      completed = true;
      clearTimeout(timer);
      debugLog(
        "Ignition StatusData error at windows " +
          (index + 1) +
          "-" +
          (index + batch.length) +
          ": " +
          (err.message || err),
      );
      if (batchSize > 1) {
        loadIgnitionGroups(
          api,
          groups,
          index,
          Math.max(1, Math.floor(batchSize / 2)),
          maxBatchSize,
          token,
          onDone,
          onError,
        );
      } else {
        _ignErrors += 1;
        markIgnitionGroupNoData(
          batch[0],
          "StatusData error: " + (err.message || err),
        );
        calculateAndRender();
        setTimeout(function () {
          loadIgnitionGroups(
            api,
            groups,
            index + 1,
            1,
            maxBatchSize,
            token,
            onDone,
            onError,
          );
        }, 0);
      }
    },
  );
}
function totalHours(agg) {
  var ids = Object.keys(agg);
  var total = 0;
  var i;
  for (i = 0; i < ids.length; i++) total += agg[ids[i]].hours || 0;
  return total;
}
function buildWindows(fromDate, toDate, days) {
  var w = [];
  var s = new Date(fromDate + "T00:00:00");
  var endFinal = new Date(toDate + "T23:59:59");
  while (s < endFinal) {
    var e = new Date(s.getTime());
    e.setDate(e.getDate() + days);
    if (e > endFinal) e = endFinal;
    w.push({ from: new Date(s.getTime()), to: new Date(e.getTime()) });
    s = new Date(e.getTime() + 1000);
  }
  return w;
}
function tripReq(w) {
  return [
    "Get",
    {
      typeName: "Trip",
      search: { fromDate: w.from.toISOString(), toDate: w.to.toISOString() },
      resultsLimit: 5000,
      propertySelector: {
        fields: ["device", "distance", "start", "stop"],
        isIncluded: true,
      },
    },
  ];
}
function idleReq(w) {
  return [
    "Get",
    {
      typeName: "ExceptionEvent",
      search: {
        fromDate: w.from.toISOString(),
        toDate: w.to.toISOString(),
        ruleSearch: { id: "RuleIdlingId" },
      },
      resultsLimit: 5000,
      propertySelector: {
        fields: ["device", "rule", "activeFrom", "activeTo", "duration"],
        isIncluded: true,
      },
    },
  ];
}
function loadWindows(
  api,
  kind,
  windows,
  index,
  batchSize,
  maxBatchSize,
  token,
  onDone,
  onError,
) {
  if (token !== _runToken) return;
  if (index >= windows.length) {
    onDone();
    return;
  }
  maxBatchSize = clampInt(maxBatchSize, batchSize, 1, 50);
  batchSize = clampInt(batchSize, 1, 1, maxBatchSize);
  var batch = windows.slice(index, index + batchSize);
  var calls = [];
  var i;
  for (i = 0; i < batch.length; i++)
    calls.push(kind === "trip" ? tripReq(batch[i]) : idleReq(batch[i]));
  setStatus(
    "Loading " +
      kind +
      " batches " +
      (index + 1) +
      "-" +
      (index + batch.length) +
      " of " +
      windows.length +
      " (batch " +
      batchSize +
      ")" +
      "...",
    false,
  );
  var callStarted = new Date().getTime();
  api.multiCall(
    calls,
    function (results) {
      if (token !== _runToken) return;
      var retry = [];
      var j;
      for (j = 0; j < results.length; j++) {
        var arr = results[j] || [];
        if (kind === "trip") _tripCalls += 1;
        else _idleCalls += 1;
        if (kind === "trip" && _debugData.tripWindowSamples.length < 20)
          _debugData.tripWindowSamples.push({
            from: batch[j].from.toISOString(),
            to: batch[j].to.toISOString(),
            count: arr.length,
            sample: arr.slice(0, 3),
          });
        if (kind === "idle" && _debugData.idleWindowSamples.length < 20)
          _debugData.idleWindowSamples.push({
            from: batch[j].from.toISOString(),
            to: batch[j].to.toISOString(),
            count: arr.length,
            sample: arr.slice(0, 3),
          });
        if (arr.length >= 5000) {
          var ms = batch[j].to.getTime() - batch[j].from.getTime();
          if (ms > 3600000) {
            var mid = new Date(batch[j].from.getTime() + Math.floor(ms / 2));
            retry.push({ from: batch[j].from, to: mid });
            retry.push({
              from: new Date(mid.getTime() + 1000),
              to: batch[j].to,
            });
            _splitCount += 1;
          } else {
            if (kind === "trip") addTrips(arr);
            else addRuleIdle(arr);
            _debugData.cappedWindows.push({
              kind: kind,
              from: batch[j].from.toISOString(),
              to: batch[j].to.toISOString(),
              count: arr.length,
            });
          }
        } else {
          if (kind === "trip") addTrips(arr);
          else addRuleIdle(arr);
        }
      }
      if (retry.length > 0)
        windows = windows
          .slice(0, index + batch.length)
          .concat(retry)
          .concat(windows.slice(index + batch.length));
      var elapsed = new Date().getTime() - callStarted;
      var nextBatchSize = batchSize;
      if (
        retry.length === 0 &&
        batch.length === batchSize &&
        batchSize < maxBatchSize &&
        elapsed < 4000
      ) {
        nextBatchSize = Math.min(maxBatchSize, batchSize + 2);
      }
      calculateAndRender();
      loadWindows(
        api,
        kind,
        windows,
        index + batch.length,
        nextBatchSize,
        maxBatchSize,
        token,
        onDone,
        onError,
      );
    },
    function (err) {
      if (token !== _runToken) return;
      debugLog(
        "Window load error for " +
          kind +
          " batches " +
          (index + 1) +
          "-" +
          (index + batch.length) +
          " at batch size " +
          batchSize +
          ": " +
          (err.message || err),
      );
      if (batchSize > 1) {
        loadWindows(
          api,
          kind,
          windows,
          index,
          Math.max(1, Math.floor(batchSize / 2)),
          maxBatchSize,
          token,
          onDone,
          onError,
        );
      } else {
        onError(err);
      }
    },
  );
}
function calculateAndRender() {
  var dm = getDeviceMap();
  var factors = getFactors();
  var useRule = totalHours(_ruleIdleAgg) > 0;
  var idleAgg = useRule ? _ruleIdleAgg : _tripIdleAgg;
  var src = useRule
    ? "RuleIdlingId exceptions"
    : "Grouped ignition-confirmed trip fallback";
  _rows = [];
  var ids = {};
  var a = Object.keys(_tripAgg);
  var b = Object.keys(idleAgg);
  var i;
  for (i = 0; i < a.length; i++) ids[a[i]] = true;
  for (i = 0; i < b.length; i++) ids[b[i]] = true;
  var all = Object.keys(ids);
  for (i = 0; i < all.length; i++) {
    var id = all[i];
    var dev = dm[id] || { id: id, name: id, groups: [] };
    var cls = classifyFuel(dev);
    var ff = factors[cls.fuel] || { mile: 0, idleUnit: 0, idleRate: 0 };
    var miles = (_tripAgg[id] || {}).miles || 0;
    var kilometers = (_tripAgg[id] || {}).kilometers || 0;
    var trips = (_tripAgg[id] || {}).trips || 0;
    var dh = (_tripAgg[id] || {}).drivingHours || 0;
    var ih = (idleAgg[id] || {}).hours || 0;
    var ie = (idleAgg[id] || {}).events || 0;
    var driveKg = miles * ff.mile;
    var idleKg = ih * ff.idleRate * ff.idleUnit;
    _rows.push({
      device: dev,
      fuel: cls.fuel,
      source: cls.source,
      miles: miles,
      kilometers: kilometers,
      trips: trips,
      drivingHours: dh,
      idleHours: ih,
      idleEvents: ie,
      drivingKg: driveKg,
      idlingKg: idleKg,
      totalKg: driveKg + idleKg,
      mileFactor: ff.mile,
      idleUnitFactor: ff.idleUnit,
      idleRate: ff.idleRate,
      idleSource: src,
    });
  }
  _rows.sort(function (x, y) {
    return y.totalKg - x.totalKg;
  });
  renderSummary(src);
  renderVehicleTable();
  renderChart();
}
function renderSummary(src) {
  var dk = 0,
    ik = 0,
    ih = 0,
    dh = 0,
    totalMiles = 0,
    i;
  for (i = 0; i < _rows.length; i++) {
    dk += _rows[i].drivingKg;
    ik += _rows[i].idlingKg;
    ih += _rows[i].idleHours;
    dh += _rows[i].drivingHours || 0;
    totalMiles += _rows[i].miles || 0;
  }
  document.getElementById("totalGhg").textContent = nfmt(
    displayGhgFromKg(dk + ik),
    2,
  );
  document.getElementById("driveGhg").textContent = nfmt(
    displayGhgFromKg(dk),
    2,
  );
  document.getElementById("idleGhg").textContent = nfmt(
    displayGhgFromKg(ik),
    2,
  );
  document.getElementById("totalGhgLabel").textContent = ghgLabel();
  document.getElementById("driveGhgLabel").textContent = ghgLabel();
  document.getElementById("idleGhgLabel").textContent = ghgLabel();
  document.getElementById("idleHours").textContent = nfmt(ih, 1);
  document.getElementById("drivingHours").textContent = nfmt(dh, 1);
  document.getElementById("idleSource").textContent = src || "source";
  document.getElementById("totalDistance").textContent = nfmt(
    displayDistanceFromMiles(totalMiles),
    1,
  );
  document.getElementById("totalDistanceLabel").textContent = distanceLabel();
}
function renderVehicleTable() {
  var wrap = document.getElementById("vehicleTable");
  wrap.innerHTML = "";
  if (_rows.length === 0) {
    wrap.innerHTML =
      '<div style="text-align:center;padding:20px;color:#999;">No trips or ignition-confirmed idling data found for this date range.</div>';
    return;
  }
  var table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px;";
  var h = document.createElement("tr");
  h.innerHTML =
    '<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Vehicle</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Fuel subtype</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Source group</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Trips</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Distance (' +
    distanceLabel() +
    ')</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Driving hrs</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Idle hrs</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Idle events</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Drive ' +
    ghgLabel() +
    '</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Idle ' +
    ghgLabel() +
    '</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;">Total ' +
    ghgLabel() +
    "</th>";
  table.appendChild(h);
  var lim = Math.min(_rows.length, 500);
  var i;
  for (i = 0; i < lim; i++) {
    var r = _rows[i];
    var tr = document.createElement("tr");
    var tdV = document.createElement("td");
    tdV.style.cssText = "padding:8px;border-bottom:1px solid #f3f4f6;";
    var link = document.createElement("a");
    link.textContent = r.device.name || "Unnamed Vehicle";
    link.href = "#";
    link.style.cssText =
      "color:#2563eb;cursor:pointer;text-decoration:underline;";
    (function (deviceId) {
      link.onclick = function (e) {
        e.preventDefault();
        window.parent.location.hash = "device,id:" + deviceId;
      };
    })(r.device.id);
    tdV.appendChild(link);
    var tdF = document.createElement("td");
    tdF.style.cssText = "padding:8px;border-bottom:1px solid #f3f4f6;";
    tdF.appendChild(makeFuelSelect(r.device.id, r.fuel));
    var tdS = document.createElement("td");
    tdS.style.cssText =
      "padding:8px;border-bottom:1px solid #f3f4f6;color:#4b5563;max-width:250px;";
    tdS.textContent = r.source;
    tr.appendChild(tdV);
    tr.appendChild(tdF);
    tr.appendChild(tdS);
    var vals = [
      r.trips,
      nfmt(displayDistanceFromMiles(r.miles), 1),
      nfmt(r.drivingHours || 0, 1),
      nfmt(r.idleHours, 1),
      nfmt(r.idleEvents, 0),
      nfmt(displayGhgFromKg(r.drivingKg), 3),
      nfmt(displayGhgFromKg(r.idlingKg), 3),
      nfmt(displayGhgFromKg(r.totalKg), 3),
    ];
    for (var j = 0; j < vals.length; j++) {
      var td = document.createElement("td");
      td.style.cssText =
        "padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;";
      if (j === 7) td.style.fontWeight = "bold";
      td.textContent = vals[j];
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  if (_rows.length > lim) {
    var note = document.createElement("div");
    note.style.cssText = "padding:8px;color:#6b7280;font-size:12px;";
    note.textContent =
      "Showing top " +
      lim +
      " of " +
      _rows.length +
      " vehicles. CSV includes all vehicles.";
    wrap.appendChild(note);
  }
}
function renderChart() {
  var byFuel = {};
  var milesByFuel = {};
  var i;
  for (i = 0; i < _rows.length; i++) {
    if (!byFuel[_rows[i].fuel]) byFuel[_rows[i].fuel] = 0;
    if (!milesByFuel[_rows[i].fuel]) milesByFuel[_rows[i].fuel] = 0;
    byFuel[_rows[i].fuel] += displayGhgFromKg(_rows[i].totalKg);
    milesByFuel[_rows[i].fuel] += displayDistanceFromMiles(_rows[i].miles || 0);
  }
  var labels = [];
  var ghgValues = [];
  var distanceValues = [];
  var keys = Object.keys(byFuel).sort(function (a, b) {
    return byFuel[b] - byFuel[a];
  });
  for (i = 0; i < keys.length; i++) {
    labels.push(keys[i]);
    ghgValues.push(Math.round(byFuel[keys[i]] * 1000) / 1000);
    distanceValues.push(Math.round(milesByFuel[keys[i]] * 10) / 10);
  }
  var ctx = document.getElementById("fuelChart");
  var distanceCtx = document.getElementById("distanceChart");
  if (_chart) _chart.destroy();
  if (_distanceChart) _distanceChart.destroy();
  if (typeof Chart === "undefined") {
    debugLog("Chart.js not loaded");
    return;
  }
  _chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{ label: ghgLabel(), data: ghgValues }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
  _distanceChart = new Chart(distanceCtx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{ label: distanceLabel(), data: distanceValues }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}
function loadData(api) {
  _runToken += 1;
  var token = _runToken;
  var from = document.getElementById("fromDate").value;
  var to = document.getElementById("toDate").value;
  var days = parseInt(document.getElementById("windowDays").value, 10) || 1;
  var tripIdleBatchSize = clampInt(
    (document.getElementById("windowCallBatchSize") || {}).value,
    16,
    1,
    50,
  );
  var ignitionBatchSize = clampInt(
    (document.getElementById("ignitionCallBatchSize") || {}).value,
    10,
    1,
    50,
  );
  if (!from || !to) {
    setStatus("Please select a from date and to date.", true);
    return;
  }
  _tripAgg = {};
  _ruleIdleAgg = {};
  _tripIdleAgg = {};
  _idleCandidates = [];
  _rows = [];
  _tripCount = 0;
  _ruleIdleCount = 0;
  _candidateCount = 0;
  _skippedLongIdle = 0;
  _ignChecked = 0;
  _ignConfirmed = 0;
  _ignNoData = 0;
  _ignOff = 0;
  _ignTimeouts = 0;
  _ignErrors = 0;
  _tripCalls = 0;
  _idleCalls = 0;
  _ignWindowCalls = 0;
  _splitCount = 0;
  _debugData = {
    dateRange: { fromDate: from, toDate: to },
    idleFallbackSettings: {
      idleMin: document.getElementById("idleMin").value,
      idleKm: document.getElementById("idleKm").value,
      maxIdleHours: document.getElementById("maxIdleHours").value,
      ignitionDiagnosticId: document.getElementById("ignDiag").value,
    },
    multicallSettings: {
      tripIdleBatchSize: tripIdleBatchSize,
      ignitionBatchSize: ignitionBatchSize,
    },
    unitMode: getUnitMode(),
    tripWindowSamples: [],
    idleWindowSamples: [],
    ignitionWindowSamples: [],
    cappedWindows: [],
    note: "v0.7 groups idle candidates by device/day, queries ignition StatusData by grouped windows, then evaluates every candidate locally. This avoids one StatusData API call per candidate and exposes checked/candidate counts.",
  };
  setStatus("Loading devices and groups...", false);
  document.getElementById("vehicleTable").innerHTML =
    '<div style="text-align:center;padding:20px;color:#666;">Loading...</div>';
  api.multiCall(
    [
      ["Get", { typeName: "Device", resultsLimit: 5000 }],
      ["Get", { typeName: "Group", resultsLimit: 5000 }],
    ],
    function (res) {
      if (token !== _runToken) return;
      _devices = res[0] || [];
      _groups = res[1] || [];
      buildGroupMap(_groups);
      debugSample("devices", _devices);
      debugSample("groups", _groups);
      var windows = buildWindows(from, to, days);
      _debugData.initialWindows = windows.length;
      loadWindows(
        api,
        "trip",
        windows,
        0,
        tripIdleBatchSize,
        tripIdleBatchSize,
        token,
        function () {
          loadWindows(
            api,
            "idle",
            windows,
            0,
            tripIdleBatchSize,
            tripIdleBatchSize,
            token,
            function () {
              if (totalHours(_ruleIdleAgg) > 0) {
                _debugData.idleSourceUsed = "RuleIdlingId exceptions";
                finishRun();
              } else {
                var groups = buildIgnitionGroups();
                _debugData.ignitionGroupedWindowCount = groups.length;
                debugLog(
                  "Idle candidates " +
                    _candidateCount +
                    " grouped into " +
                    groups.length +
                    " ignition windows",
                );
                loadIgnitionGroups(
                  api,
                  groups,
                  0,
                  ignitionBatchSize,
                  ignitionBatchSize,
                  token,
                  function () {
                    _debugData.idleSourceUsed =
                      "Grouped ignition-confirmed trip fallback";
                    finishRun();
                  },
                  function (err) {
                    _debugData.lastError = String(err.message || err);
                    finishRun();
                  },
                );
              }
            },
            function (err) {
              _debugData.lastError = String(err.message || err);
              finishRun();
            },
          );
        },
        function (err) {
          _debugData.lastError = String(err.message || err);
          setStatus("Error loading trips: " + (err.message || err), true);
        },
      );
    },
    function (err) {
      _debugData.lastError = String(err.message || err);
      setStatus("Error loading devices/groups: " + (err.message || err), true);
    },
  );
  function finishRun() {
    _debugData.finalTripCount = _tripCount;
    _debugData.ruleIdleEventCount = _ruleIdleCount;
    _debugData.idleCandidateCount = _candidateCount;
    _debugData.skippedLongIdleCandidates = _skippedLongIdle;
    _debugData.ignitionCheckedCandidateCount = _ignChecked;
    _debugData.ignitionConfirmedCount = _ignConfirmed;
    _debugData.ignitionNoDataCount = _ignNoData;
    _debugData.ignitionOffCount = _ignOff;
    _debugData.ignitionTimeoutCount = _ignTimeouts;
    _debugData.ignitionErrorCount = _ignErrors;
    _debugData.tripCalls = _tripCalls;
    _debugData.idleCalls = _idleCalls;
    _debugData.ignitionWindowCalls = _ignWindowCalls;
    _debugData.splitCount = _splitCount;
    calculateAndRender();
    setStatus(
      "Calculation complete. Trips: " +
        nfmt(_tripCount, 0) +
        ". Idle candidates: " +
        nfmt(_candidateCount, 0) +
        ". Ignition checked: " +
        nfmt(_ignChecked, 0) +
        ". Confirmed: " +
        nfmt(_ignConfirmed, 0) +
        ". No data: " +
        nfmt(_ignNoData, 0) +
        ". Off: " +
        nfmt(_ignOff, 0) +
        ". Long candidates skipped: " +
        nfmt(_skippedLongIdle, 0) +
        ".",
      false,
    );
  }
}
function csvCell(value) {
  if (value === null || typeof value === "undefined") value = "";
  var s = String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}
function csvRow(values) {
  var out = [];
  for (var i = 0; i < values.length; i++) {
    out.push(csvCell(values[i]));
  }
  return out.join(",");
}
function downloadCsv() {
  if (!_rows || _rows.length === 0) {
    alert("No rows to export yet.");
    return;
  }
  var fromDate = (document.getElementById("fromDate") || {}).value || "";
  var toDate = (document.getElementById("toDate") || {}).value || "";
  var unitMode = getUnitMode();
  var version = "1.5";
  var lines = [];
  lines.push(
    csvRow([
      "Report Version",
      "Unit Mode",
      "Date From",
      "Date To",
      "Vehicle Id",
      "Vehicle",
      "Fuel Subtype",
      "Source Group",
      "Trips",
      "Miles",
      "Kilometers",
      "Driving Hours",
      "Idle Hours",
      "Idle Events",
      "Driving kg CO2e",
      "Idling kg CO2e",
      "Total kg CO2e",
      "Driving lb CO2e",
      "Idling lb CO2e",
      "Total lb CO2e",
      "Total metric tonnes CO2e",
      "Total short tons CO2e",
      "Driving Factor kg CO2e/mi",
      "Idle Emission Factor kg CO2e/fuel unit",
      "Idle Fuel Rate fuel units/hr",
      "Idle Source",
    ]),
  );
  for (var i = 0; i < _rows.length; i++) {
    var r = _rows[i];
    lines.push(
      csvRow([
        version,
        unitMode,
        fromDate,
        toDate,
        r.device.id || "",
        r.device.name || r.device.id || "",
        r.fuel,
        r.source,
        r.trips,
        r.miles.toFixed(2),
        (r.kilometers || r.miles / 0.621371).toFixed(2),
        (r.drivingHours || 0).toFixed(2),
        r.idleHours.toFixed(2),
        r.idleEvents,
        r.drivingKg.toFixed(2),
        r.idlingKg.toFixed(2),
        r.totalKg.toFixed(2),
        (r.drivingKg * 2.2046226218).toFixed(2),
        (r.idlingKg * 2.2046226218).toFixed(2),
        (r.totalKg * 2.2046226218).toFixed(2),
        (r.totalKg / 1000).toFixed(4),
        (r.totalKg / 907.18474).toFixed(4),
        typeof r.mileFactor === "number" ? r.mileFactor.toFixed(6) : "",
        typeof r.idleUnitFactor === "number" ? r.idleUnitFactor.toFixed(6) : "",
        typeof r.idleRate === "number" ? r.idleRate.toFixed(6) : "",
        r.idleSource,
      ]),
    );
  }
  var csvText = lines.join(String.fromCharCode(10));
  var blob = new Blob(["\ufeff" + csvText], {
    type: "text/csv;charset=utf-8;",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "ghg-emissions-afleet-v1.5.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
geotab.addin["ghg-emissions-afleet-v012"] = function () {
  return {
    initialize: function (api, state, callback) {
      initializeFactorPanelToggle();
      setDefaultDates();
      renderFactors();
      document.getElementById("runBtn").onclick = function () {
        loadData(api);
      };
      document.getElementById("csvBtn").onclick = function () {
        downloadCsv();
      };
      document.getElementById("unitMode").onchange = function () {
        calculateAndRender();
      };
      document.getElementById("resetFactorsBtn").onclick = function () {
        localStorage.removeItem(FACTOR_KEY);
        renderFactors();
        calculateAndRender();
      };
      callback();
    },
    focus: function (api, state) {
      setStatus(
        "Ready. Select a date range and click Calculate to run the emissions report.",
        false,
      );
    },
    blur: function (api, state) {
      _runToken += 1;
    },
  };
};
console.log("GHG Emissions AFLEET v1.5 registered");
