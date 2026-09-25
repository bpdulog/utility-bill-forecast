(function () {
  "use strict";

  var model = window.ForecastModel;
  var moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  var usageChartInstance = null;
  var scenarioChartInstance = null;
  var currentUsageView = "stacked";
  var currentScenarioView = "dollars";
  var latestBillData = null;
  var latestScenarioResult = null;

  if (window.Chart) {
    Chart.defaults.font.family = "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    Chart.defaults.color = "#6f7d78";
    Chart.defaults.plugins.tooltip.backgroundColor = "#12372f";
    Chart.defaults.plugins.tooltip.titleColor = "#ffffff";
    Chart.defaults.plugins.tooltip.bodyColor = "#cce7d4";
    Chart.defaults.plugins.tooltip.borderColor = "#1d4b3f";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 4;
    Chart.defaults.plugins.tooltip.boxPadding = 5;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'DM Mono', monospace", size: 12 };
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Manrope', sans-serif", weight: "700", size: 12 };
  }

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

  function renderUsageChart(bill) {
    if (!window.Chart || !bill) return;
    latestBillData = bill;
    var canvas = byId("usage-chart");
    if (!canvas) return;

    if (usageChartInstance) {
      usageChartInstance.destroy();
      usageChartInstance = null;
    }

    var ctx = canvas.getContext("2d");

    if (currentUsageView === "stacked") {
      usageChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Natural Gas", "Electricity"],
          datasets: [
            {
              label: "Fixed Charge",
              data: [bill.gasFixed, bill.electricFixed],
              backgroundColor: "#8ebca0",
              hoverBackgroundColor: "#78ac8d",
              borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
              borderSkipped: false,
              stack: "cost"
            },
            {
              label: "Variable Charge",
              data: [bill.gasVariable, bill.electricVariable],
              backgroundColor: "#1d4b3f",
              hoverBackgroundColor: "#12372f",
              borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
              borderSkipped: false,
              stack: "cost"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                font: { size: 11, weight: "600" },
                color: "#6f7d78",
                padding: 10
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  var total = context.dataIndex === 0 ? bill.gasPostTax : bill.electricPostTax;
                  var pct = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) + "%" : "0%";
                  return " " + context.dataset.label + ": " + money(context.parsed.y) + " (" + pct + ")";
                },
                afterBody: function (contexts) {
                  var idx = contexts[0].dataIndex;
                  var total = idx === 0 ? bill.gasPostTax : bill.electricPostTax;
                  return "Total " + (idx === 0 ? "Gas" : "Electric") + ": " + money(total);
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { weight: "700", size: 12 },
                color: "#17221f"
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: "#edf1ed" },
              ticks: {
                font: { family: "'DM Mono', monospace", size: 11 },
                color: "#6f7d78",
                callback: function (val) {
                  return "$" + val;
                }
              }
            }
          }
        }
      });
    } else {
      var gasPct = bill.totalPostTax > 0 ? ((bill.gasPostTax / bill.totalPostTax) * 100).toFixed(1) : 0;
      var elPct = bill.totalPostTax > 0 ? ((bill.electricPostTax / bill.totalPostTax) * 100).toFixed(1) : 0;
      usageChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Natural Gas (" + gasPct + "%)", "Electricity (" + elPct + "%)"],
          datasets: [
            {
              data: [bill.gasPostTax, bill.electricPostTax],
              backgroundColor: ["#1d4b3f", "#f0b65b"],
              hoverBackgroundColor: ["#12372f", "#dfa447"],
              borderColor: "#ffffff",
              borderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          cutout: "64%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                font: { size: 12, weight: "700" },
                color: "#17221f",
                padding: 16
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  var total = bill.totalPostTax;
                  var val = context.parsed;
                  var pct = total > 0 ? ((val / total) * 100).toFixed(1) + "%" : "0%";
                  return " " + context.label.split(" (")[0] + ": " + money(val) + " (" + pct + " of bill)";
                }
              }
            }
          }
        }
      });
    }
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
      renderUsageChart(bill);
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

  function renderScenarioChart(result) {
    if (!window.Chart || !result) return;
    latestScenarioResult = result;
    var canvas = byId("scenario-chart");
    if (!canvas) return;

    if (scenarioChartInstance) {
      scenarioChartInstance.destroy();
      scenarioChartInstance = null;
    }

    var ctx = canvas.getContext("2d");

    var baselineRows = result.rows.filter(function (r) { return r.scenario === "Baseline"; });
    var mildRows = result.rows.filter(function (r) { return r.scenario === "Mild Winter"; });
    var severeRows = result.rows.filter(function (r) { return r.scenario === "Severe Winter"; });
    var months = baselineRows.map(function (r) { return r.month; });

    var datasets = [];
    var yAxisConfig = {
      grid: { color: "#edf1ed" },
      ticks: {
        font: { family: "'DM Mono', monospace", size: 11 },
        color: "#6f7d78"
      }
    };
    var tooltipCallbacks = {};

    if (currentScenarioView === "dollars") {
      datasets = [
        {
          label: "Mild Winter (-4% GCF, -12% HDD)",
          data: mildRows.map(function (r) { return r.totalDollars; }),
          backgroundColor: "#8ebca0",
          hoverBackgroundColor: "#78ac8d",
          borderRadius: 4
        },
        {
          label: "Baseline",
          data: baselineRows.map(function (r) { return r.totalDollars; }),
          backgroundColor: "#1d4b3f",
          hoverBackgroundColor: "#12372f",
          borderRadius: 4
        },
        {
          label: "Severe Winter (+6% GCF, +12% HDD)",
          data: severeRows.map(function (r) { return r.totalDollars; }),
          backgroundColor: "#f0b65b",
          hoverBackgroundColor: "#dfa447",
          borderRadius: 4
        }
      ];
      yAxisConfig.beginAtZero = true;
      yAxisConfig.ticks.callback = function (val) { return "$" + val; };
      tooltipCallbacks = {
        label: function (context) {
          return " " + context.dataset.label.split(" (")[0] + ": " + money(context.parsed.y);
        },
        afterLabel: function (context) {
          var monthIdx = context.dataIndex;
          var datasetIdx = context.datasetIndex;
          var row = datasetIdx === 0 ? mildRows[monthIdx] : datasetIdx === 1 ? baselineRows[monthIdx] : severeRows[monthIdx];
          var lines = [
            "  Gas: " + money(row.gasDollars) + " · Electric: " + money(row.electricDollars),
            "  Therms: " + number(row.therms, 1) + " · kWh: " + number(row.kwh, 1)
          ];
          if (row.varianceVsBaseline !== 0) {
            lines.push("  Variance vs Baseline: " + signedMoney(row.varianceVsBaseline));
          }
          return lines.join("\n");
        }
      };
    } else if (currentScenarioView === "therms") {
      datasets = [
        {
          label: "Mild Winter",
          data: mildRows.map(function (r) { return r.therms; }),
          backgroundColor: "#8ebca0",
          hoverBackgroundColor: "#78ac8d",
          borderRadius: 4
        },
        {
          label: "Baseline",
          data: baselineRows.map(function (r) { return r.therms; }),
          backgroundColor: "#1d4b3f",
          hoverBackgroundColor: "#12372f",
          borderRadius: 4
        },
        {
          label: "Severe Winter",
          data: severeRows.map(function (r) { return r.therms; }),
          backgroundColor: "#f0b65b",
          hoverBackgroundColor: "#dfa447",
          borderRadius: 4
        }
      ];
      yAxisConfig.beginAtZero = true;
      yAxisConfig.ticks.callback = function (val) { return val + " th"; };
      tooltipCallbacks = {
        label: function (context) {
          return " " + context.dataset.label + ": " + number(context.parsed.y, 1) + " therms";
        }
      };
    } else if (currentScenarioView === "variance") {
      datasets = [
        {
          label: "Mild Winter (Savings)",
          data: mildRows.map(function (r) { return r.varianceVsBaseline; }),
          backgroundColor: "#8ebca0",
          hoverBackgroundColor: "#78ac8d",
          borderRadius: 4
        },
        {
          label: "Severe Winter (Added Cost)",
          data: severeRows.map(function (r) { return r.varianceVsBaseline; }),
          backgroundColor: "#f0b65b",
          hoverBackgroundColor: "#dfa447",
          borderRadius: 4
        }
      ];
      yAxisConfig.ticks.callback = function (val) {
        return (val > 0 ? "+$" : val < 0 ? "-$" : "$") + Math.abs(val);
      };
      tooltipCallbacks = {
        label: function (context) {
          return " " + context.dataset.label + ": " + signedMoney(context.parsed.y);
        }
      };
    }

    scenarioChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        categoryPercentage: 0.78,
        barPercentage: 0.88,
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              font: { size: 11, weight: "600" },
              color: "#6f7d78",
              padding: 12
            }
          },
          tooltip: {
            callbacks: tooltipCallbacks
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { weight: "700", size: 11 },
              color: "#17221f"
            }
          },
          y: yAxisConfig
        }
      }
    });
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
      renderScenarioChart(result);
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
    var targetId = button.getAttribute("aria-controls");
    if (targetId === "usage-panel" && usageChartInstance) {
      usageChartInstance.resize();
    } else if (targetId === "scenario-panel" && scenarioChartInstance) {
      scenarioChartInstance.resize();
    }
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

    var usageToggleStack = byId("usage-toggle-stack");
    var usageToggleDonut = byId("usage-toggle-donut");
    if (usageToggleStack && usageToggleDonut) {
      usageToggleStack.addEventListener("click", function () {
        currentUsageView = "stacked";
        usageToggleStack.classList.add("is-active");
        usageToggleDonut.classList.remove("is-active");
        renderUsageChart(latestBillData);
      });
      usageToggleDonut.addEventListener("click", function () {
        currentUsageView = "donut";
        usageToggleDonut.classList.add("is-active");
        usageToggleStack.classList.remove("is-active");
        renderUsageChart(latestBillData);
      });
    }

    var scenarioToggles = [
      { id: "scenario-toggle-dollars", view: "dollars" },
      { id: "scenario-toggle-therms", view: "therms" },
      { id: "scenario-toggle-variance", view: "variance" }
    ];

    scenarioToggles.forEach(function (item) {
      var btn = byId(item.id);
      if (btn) {
        btn.addEventListener("click", function () {
          currentScenarioView = item.view;
          scenarioToggles.forEach(function (t) {
            var b = byId(t.id);
            if (b) b.classList.toggle("is-active", t.view === item.view);
          });
          renderScenarioChart(latestScenarioResult);
        });
      }
    });

    bindLiveCalculation(["therms", "kwh", "usage-days"], calculateDirectBill);
    bindLiveCalculation(["weather-month", "weather-days", "weather-temperature"], calculateWeatherForecast);
    bindLiveCalculation(["scenario-days", "scenario-gcf"], calculateScenarios);
    bindLiveCalculation(["setback-degrees", "setback-hours"], calculateSetback);

    document.querySelectorAll(".gcf-preset").forEach(function (button) {
      button.addEventListener("click", function () {
        byId("scenario-gcf").value = button.getAttribute("data-gcf");
        calculateScenarios();
      });
    });

    calculateDirectBill();
    calculateWeatherForecast();
    calculateScenarios();
    calculateSetback();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
