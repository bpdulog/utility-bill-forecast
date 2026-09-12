(function () {
  "use strict";

  var model = window.ForecastModel;
  var moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  function byId(id) {
    return document.getElementById(id);
  }

  function money(value) {
    return value === null || value === undefined ? "—" : moneyFormatter.format(value);
  }

  function number(value, digits) {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  function signedMoney(value) {
    return value > 0 ? "+" + money(value) : money(value);
  }

  function setText(id, value) {
    byId(id).textContent = value;
  }

  function readNumber(id) {
    var raw = byId(id).value.trim();
    return raw === "" ? NaN : Number(raw);
  }

  function showError(id, error) {
    var element = byId(id);
    element.textContent = error.message || String(error);
    element.hidden = false;
  }

  function clearError(id) {
    byId(id).hidden = true;
  }

  function setMetric(id, label, value, detail) {
    var card = byId(id);
    card.querySelector(".metric-label").textContent = label;
    card.querySelector(".metric-value").textContent = value;
    card.querySelector(".metric-detail").textContent = detail || "";
  }

  function renderTable(targetId, columns, rows, options) {
    options = options || {};
    var target = byId(targetId);
    target.textContent = "";
    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");
    columns.forEach(function (column) {
      var th = document.createElement("th");
      th.textContent = column.label;
      if (column.align) th.className = "align-" + column.align;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      if (options.totalRow && options.totalRow(row)) tr.className = "total-row";
      columns.forEach(function (column) {
        var td = document.createElement("td");
        td.textContent = column.format ? column.format(row[column.key], row) : row[column.key];
        if (column.align) td.className = "align-" + column.align;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    target.appendChild(table);
  }

  function calculateDirectBill() {
    clearError("usage-error");
    try {
      var therms = readNumber("therms");
      var kwh = readNumber("kwh");
      var days = readNumber("usage-days");
      var bill = model.calculateBill(therms, kwh, days);
      setMetric("usage-gas-card", "Gas", money(bill.gasPostTax), "post-tax");
      setMetric("usage-electric-card", "Electric", money(bill.electricPostTax), "post-tax");
      setMetric("usage-total-card", "Total", money(bill.totalPostTax), days + " billing days");
      setMetric("usage-pretax-card", "Pre-tax total", money(bill.totalPreTax), "presentation estimate");
      setText("usage-gas-rate", money(bill.effectiveGasRate) + "/therm");
      setText("usage-electric-rate", money(bill.effectiveElectricRate) + "/kWh");
      renderTable("usage-table", [
        { key: "charge", label: "Charge" },
        { key: "gas", label: "Natural gas", align: "right", format: money },
        { key: "electric", label: "Electricity", align: "right", format: money }
      ], [
        { charge: "Fixed", gas: bill.gasFixed, electric: bill.electricFixed },
        { charge: "Variable", gas: bill.gasVariable, electric: bill.electricVariable },
        { charge: "Pre-tax", gas: bill.gasPreTax, electric: bill.electricPreTax },
        { charge: "Post-tax", gas: bill.gasPostTax, electric: bill.electricPostTax }
      ]);
    } catch (error) {
      showError("usage-error", error);
    }
  }

  function calculateWeatherForecast() {
    clearError("weather-error");
    try {
      var mode = document.querySelector("input[name='weather-mode']:checked").value;
      var days = readNumber("weather-days");
      var forecast = mode === "month"
        ? model.forecastWeather({ month: byId("weather-month").value, billingDays: days })
        : model.forecastWeather({ meanTemperatureF: readNumber("weather-temperature"), billingDays: days });
      setMetric("weather-hdd-card", "Heating degree days", number(forecast.hdd, 1), "base 65°F");
      setMetric("weather-cdd-card", "Cooling degree days", number(forecast.cdd, 1), "base 65°F");
      setMetric("weather-therms-card", "Predicted gas", number(forecast.usage.therms, 1), "therms");
      setMetric("weather-total-card", "Estimated bill", money(forecast.bill.totalPostTax), "post-tax total");
      setText("weather-gas", money(forecast.bill.gasPostTax));
      setText("weather-electric", money(forecast.bill.electricPostTax));
      setText("weather-kwh", number(forecast.usage.kwh, 1) + " kWh");
      setText("weather-summary", forecast.month
        ? forecast.month + " normal · " + number(days, 0) + " billing days"
        : number(forecast.meanTemperatureF, 1) + "°F average · " + number(days, 0) + " billing days");
    } catch (error) {
      showError("weather-error", error);
    }
  }

  function calculateScenarios() {
    clearError("scenario-error");
    try {
      var result = model.generateScenarios(readNumber("scenario-days"), readNumber("scenario-gcf"));
      var rows = result.rows;
      renderTable("scenario-table", [
        { key: "scenario", label: "Scenario" },
        { key: "month", label: "Month" },
        { key: "hdd", label: "HDD", align: "right", format: function (value) { return number(value, 1); } },
        { key: "cdd", label: "CDD", align: "right", format: function (value) { return number(value, 1); } },
        { key: "therms", label: "Therms", align: "right", format: function (value) { return number(value, 1); } },
        { key: "kwh", label: "kWh", align: "right", format: function (value) { return number(value, 1); } },
        { key: "gasDollars", label: "Gas", align: "right", format: money },
        { key: "electricDollars", label: "Electric", align: "right", format: money },
        { key: "totalDollars", label: "Total", align: "right", format: money },
        { key: "varianceVsBaseline", label: "Variance", align: "right", format: signedMoney }
      ], rows, {
        totalRow: function (row) { return row.month === "Season total"; }
      });
      renderTable("scenario-total-table", [
        { key: "scenario", label: "Scenario" },
        { key: "hdd", label: "HDD", align: "right", format: function (value) { return number(value, 1); } },
        { key: "cdd", label: "CDD", align: "right", format: function (value) { return number(value, 1); } },
        { key: "therms", label: "Therms", align: "right", format: function (value) { return number(value, 1); } },
        { key: "kwh", label: "kWh", align: "right", format: function (value) { return number(value, 1); } },
        { key: "gasDollars", label: "Gas", align: "right", format: money },
        { key: "electricDollars", label: "Electric", align: "right", format: money },
        { key: "totalDollars", label: "Total", align: "right", format: money },
        { key: "varianceVsBaseline", label: "Variance", align: "right", format: signedMoney }
      ], result.seasonalTotals, {
        totalRow: function () { return true; }
      });
      var baseline = result.seasonalTotals[0];
      setMetric("scenario-total-card", "Baseline season", money(baseline.totalDollars), "October–April");
      setMetric("scenario-range-card", "Severe winter", money(result.seasonalTotals[2].totalDollars), "variance " + signedMoney(result.seasonalTotals[2].varianceVsBaseline));
    } catch (error) {
      showError("scenario-error", error);
    }
  }

  function calculateSetback() {
    clearError("setback-error");
    try {
      var deltaT = readNumber("setback-degrees");
      var hours = readNumber("setback-hours");
      var monthly = model.calculateSetbackSavings(deltaT, hours, 30);
      var season = model.calculateSetbackSavings(deltaT, hours, 30 * model.SETBACK_SEASON.length);
      setMetric("setback-monthly-card", "Monthly savings", money(monthly.totalDollarsSaved), "30 days");
      setMetric("setback-season-card", "November–March", money(season.totalDollarsSaved), "150 days");
      renderTable("setback-table", [
        { key: "period", label: "Period" },
        { key: "hdd", label: "HDD saved", align: "right", format: function (value) { return number(value, 1); } },
        { key: "therms", label: "Therms saved", align: "right", format: function (value) { return number(value, 2); } },
        { key: "kwh", label: "kWh saved", align: "right", format: function (value) { return number(value, 2); } },
        { key: "gas", label: "Gas saved", align: "right", format: money },
        { key: "electric", label: "Electric saved", align: "right", format: money },
        { key: "total", label: "Total saved", align: "right", format: money }
      ], [
        { period: "Monthly", hdd: monthly.effectiveHddSaved, therms: monthly.thermsSaved, kwh: monthly.kwhSaved, gas: monthly.gasDollarsSaved, electric: monthly.electricDollarsSaved, total: monthly.totalDollarsSaved },
        { period: "Nov–Mar", hdd: season.effectiveHddSaved, therms: season.thermsSaved, kwh: season.kwhSaved, gas: season.gasDollarsSaved, electric: season.electricDollarsSaved, total: season.totalDollarsSaved }
      ]);
    } catch (error) {
      showError("setback-error", error);
    }
  }

  function toggleWeatherInputs() {
    var mode = document.querySelector("input[name='weather-mode']:checked").value;
    byId("month-input-wrap").hidden = mode !== "month";
    byId("temperature-input-wrap").hidden = mode !== "temperature";
    calculateWeatherForecast();
  }

  function activateTab(button) {
    document.querySelectorAll(".tab-button").forEach(function (tabButton) {
      var active = tabButton === button;
      tabButton.classList.toggle("is-active", active);
      tabButton.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.id !== button.getAttribute("aria-controls");
    });
  }

  function bindLiveCalculation(ids, callback) {
    ids.forEach(function (id) {
      byId(id).addEventListener("input", callback);
      byId(id).addEventListener("change", callback);
    });
  }

  function initialize() {
    Object.keys(model.MONTHLY_NORMALS).forEach(function (month) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = month;
      byId("weather-month").appendChild(option);
    });
    byId("weather-month").value = "January";

    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.addEventListener("click", function () { activateTab(button); });
    });
    document.querySelectorAll("input[name='weather-mode']").forEach(function (radio) {
      radio.addEventListener("change", toggleWeatherInputs);
    });

    bindLiveCalculation(["therms", "kwh", "usage-days"], calculateDirectBill);
    bindLiveCalculation(["weather-month", "weather-days", "weather-temperature"], calculateWeatherForecast);
    bindLiveCalculation(["scenario-days", "scenario-gcf"], calculateScenarios);
    bindLiveCalculation(["setback-degrees", "setback-hours"], calculateSetback);

    calculateDirectBill();
    calculateWeatherForecast();
    calculateScenarios();
    calculateSetback();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
