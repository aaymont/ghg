function calculateAndRender(forceRender) {
  if (_isProcessing && !forceRender) return;
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

function csvCell(value) {
  if (value === null || typeof value === "undefined") value = "";
  var s = String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function csvRow(values) {
  var out = [];
  for (var i = 0; i < values.length; i++) out.push(csvCell(values[i]));
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
  var version = "2.2";
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
  a.download = "ghg-emissions-afleet-v2.2.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
