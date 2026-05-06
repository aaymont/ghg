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

console.log("GHG Emissions AFLEET v2.4 registered");
