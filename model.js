/*
 * Browser-safe version of the utility bill forecasting model.
 *
 * This file intentionally has no DOM dependencies.  It mirrors the formulas
 * in engine.py so the static GitHub Pages app and the Python CLI stay aligned.
 */
(function (global) {
  "use strict";

  var MODEL = {
    GAS_INTERCEPT: 31.57,
    GAS_RATE: 2.4216,
    ELECTRIC_INTERCEPT: 8.52,
    ELECTRIC_RATE: 0.3555,
    GAS_USAGE_INTERCEPT: 2.218,
    GAS_THERMS_PER_HDD: 0.1163,
    ELECTRIC_USAGE_INTERCEPT: 290.94,
    ELECTRIC_KWH_PER_HDD: 0.1176,
    ELECTRIC_KWH_PER_CDD: 0.5083,
    GAS_MIN_THERMS: 4.0,
    ELECTRIC_MIN_KWH: 235.0,
    // GCF is a gas supply charge in dollars/therm. $0.80/therm is the model's
    // reference assumption, not a verified winter price. See RATE_REVIEW.md.
    BASELINE_GCF: 0.80,
    // Tax multiplier on a supply-price difference: +$0.10/therm in GCF adds
    // $0.108809/therm to the all-in gas rate.
    GCF_TO_GAS_RATE: 1.08809,
    WESTCHESTER_GRT_RATE: 0.0265,
    WHITE_PLAINS_SALES_TAX_RATE: 0.06,
    ELECTRIC_TAX_RATE: 0.06
  };

  var MONTHLY_NORMALS = {
    January: { hdd: 1080.0, cdd: 0.0 },
    February: { hdd: 950.0, cdd: 0.0 },
    March: { hdd: 790.0, cdd: 0.0 },
    April: { hdd: 430.0, cdd: 0.0 },
    May: { hdd: 180.0, cdd: 20.0 },
    June: { hdd: 30.0, cdd: 150.0 },
    July: { hdd: 0.0, cdd: 280.0 },
    August: { hdd: 0.0, cdd: 240.0 },
    September: { hdd: 60.0, cdd: 70.0 },
    October: { hdd: 330.0, cdd: 5.0 },
    November: { hdd: 580.0, cdd: 0.0 },
    December: { hdd: 910.0, cdd: 0.0 }
  };

  var HEATING_SEASON = ["October", "November", "December", "January", "February", "March", "April"];
  var SETBACK_SEASON = ["November", "December", "January", "February", "March"];

  function nonNegative(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(name + " must be finite");
    }
    if (number < 0) {
      throw new Error(name + " cannot be negative");
    }
    return number;
  }

  function positive(value, name) {
    var number = nonNegative(value, name);
    if (number === 0) {
      throw new Error(name + " must be greater than zero");
    }
    return number;
  }

  function monthName(month) {
    var normalized = String(month).trim().toLowerCase();
    var names = Object.keys(MONTHLY_NORMALS);
    for (var i = 0; i < names.length; i += 1) {
      if (names[i].toLowerCase() === normalized) {
        return names[i];
      }
    }
    throw new Error("Unknown month " + month);
  }

  function degreeDays(meanTemperatureF, days) {
    var temperature = Number(meanTemperatureF);
    if (!Number.isFinite(temperature)) {
      throw new Error("mean temperature must be finite");
    }
    var dayCount = positive(days === undefined ? 30 : days, "billing days");
    return {
      hdd: Math.max(0, 65 - temperature) * dayCount,
      cdd: Math.max(0, temperature - 65) * dayCount
    };
  }

  function predictUsage(hdd, cdd) {
    var heatingDays = nonNegative(hdd, "hdd");
    var coolingDays = nonNegative(cdd, "cdd");
    return {
      therms: Math.max(MODEL.GAS_MIN_THERMS, MODEL.GAS_USAGE_INTERCEPT + MODEL.GAS_THERMS_PER_HDD * heatingDays),
      kwh: Math.max(
        MODEL.ELECTRIC_MIN_KWH,
        MODEL.ELECTRIC_USAGE_INTERCEPT + MODEL.ELECTRIC_KWH_PER_HDD * heatingDays + MODEL.ELECTRIC_KWH_PER_CDD * coolingDays
      )
    };
  }

  // Converts a supply cost in $/therm into an all-in $/therm gas rate.
  // 0.80 is the model reference, so only the distance from it is priced in:
  // gasRateForGcf(0.80) returns GAS_RATE, and 0.84 adds 0.04 * GCF_TO_GAS_RATE.
  function gasRateForGcf(gcf) {
    var factor = nonNegative(gcf === undefined ? MODEL.BASELINE_GCF : gcf, "GCF");
    return MODEL.GAS_RATE + (factor - MODEL.BASELINE_GCF) * MODEL.GCF_TO_GAS_RATE;
  }

  function calculateBill(therms, kwh, billingDays, gasRate, electricTaxRate) {
    var gasUsage = nonNegative(therms, "therms");
    var electricUsage = nonNegative(kwh, "kWh");
    var dayCount = positive(billingDays === undefined ? 30 : billingDays, "billing days");
    var marginalGasRate = nonNegative(gasRate === undefined ? MODEL.GAS_RATE : gasRate, "gas rate");
    var electricTax = nonNegative(
      electricTaxRate === undefined ? MODEL.ELECTRIC_TAX_RATE : electricTaxRate,
      "electric tax rate"
    );

    var gasFixed = MODEL.GAS_INTERCEPT * dayCount / 30;
    var electricFixed = MODEL.ELECTRIC_INTERCEPT * dayCount / 30;
    var gasVariable = marginalGasRate * gasUsage;
    var electricVariable = MODEL.ELECTRIC_RATE * electricUsage;
    var gasTaxMultiplier = (1 + MODEL.WESTCHESTER_GRT_RATE) * (1 + MODEL.WHITE_PLAINS_SALES_TAX_RATE);
    var gasPreTax = gasFixed + gasVariable / gasTaxMultiplier;
    var electricPreTax = electricFixed + electricVariable / (1 + electricTax);
    var gasPostTax = gasFixed + gasVariable;
    var electricPostTax = electricFixed + electricVariable;

    return {
      billingDays: dayCount,
      gasFixed: gasFixed,
      gasVariable: gasVariable,
      gasPreTax: gasPreTax,
      gasPostTax: gasPostTax,
      electricFixed: electricFixed,
      electricVariable: electricVariable,
      electricPreTax: electricPreTax,
      electricPostTax: electricPostTax,
      totalPreTax: gasPreTax + electricPreTax,
      totalPostTax: gasPostTax + electricPostTax,
      effectiveGasRate: gasUsage ? gasPostTax / gasUsage : null,
      effectiveElectricRate: electricUsage ? electricPostTax / electricUsage : null
    };
  }

  function forecastWeather(options) {
    options = options || {};
    var dayCount = positive(options.billingDays === undefined ? 30 : options.billingDays, "billing days");
    var hasMonth = options.month !== undefined && options.month !== null && options.month !== "";
    var hasTemperature = options.meanTemperatureF !== undefined && options.meanTemperatureF !== null;
    if (hasMonth && hasTemperature) {
      throw new Error("Provide either a month or a temperature, not both");
    }
    if (!hasMonth && !hasTemperature) {
      throw new Error("Provide a month or a temperature");
    }

    var month = null;
    var temperature = null;
    var days;
    if (hasMonth) {
      month = monthName(options.month);
      days = MONTHLY_NORMALS[month];
    } else {
      temperature = Number(options.meanTemperatureF);
      days = degreeDays(temperature, dayCount);
    }
    var usage = predictUsage(days.hdd, days.cdd);
    return {
      month: month,
      billingDays: dayCount,
      meanTemperatureF: temperature,
      hdd: days.hdd,
      cdd: days.cdd,
      usage: usage,
      bill: calculateBill(usage.therms, usage.kwh, dayCount)
    };
  }

  // baselineGcf sets the gas rate every scenario starts from (see
  // gasRateForGcf); the mild and severe definitions then scale that rate
  // directly by a fixed -4% / +6%.
  function generateScenarios(billingDays, baselineGcf, months) {
    var dayCount = positive(billingDays === undefined ? 30 : billingDays, "billing days");
    var startingGcf = nonNegative(baselineGcf === undefined ? MODEL.BASELINE_GCF : baselineGcf, "baseline GCF");
    var selectedMonths = (months || HEATING_SEASON).map(monthName);
    if (!selectedMonths.length) {
      throw new Error("months must contain at least one month");
    }

    var definitions = [
      { name: "Baseline", hddFactor: 1.00, rateAdjustment: 0.00 },
      { name: "Mild Winter", hddFactor: 0.88, rateAdjustment: -0.04 },
      { name: "Severe Winter", hddFactor: 1.12, rateAdjustment: 0.06 }
    ];
    var baselineRate = gasRateForGcf(startingGcf);
    var baselineRows = {};
    selectedMonths.forEach(function (month) {
      var normal = MONTHLY_NORMALS[month];
      var usage = predictUsage(normal.hdd, normal.cdd);
      var bill = calculateBill(usage.therms, usage.kwh, dayCount, baselineRate);
      baselineRows[month] = { therms: usage.therms, kwh: usage.kwh, total: bill.totalPostTax };
    });

    var rows = [];
    definitions.forEach(function (definition) {
      var scenarioRate = baselineRate * (1 + definition.rateAdjustment);
      selectedMonths.forEach(function (month) {
        var normal = MONTHLY_NORMALS[month];
        var hdd = normal.hdd * definition.hddFactor;
        var cdd = normal.cdd;
        var usage = predictUsage(hdd, cdd);
        var bill = calculateBill(usage.therms, usage.kwh, dayCount, scenarioRate);
        rows.push({
          scenario: definition.name,
          month: month,
          hdd: hdd,
          cdd: cdd,
          therms: usage.therms,
          kwh: usage.kwh,
          gasDollars: bill.gasPostTax,
          electricDollars: bill.electricPostTax,
          totalDollars: bill.totalPostTax,
          varianceVsBaseline: bill.totalPostTax - baselineRows[month].total
        });
      });
    });

    var totals = definitions.map(function (definition) {
      var scenarioRows = rows.filter(function (row) { return row.scenario === definition.name; });
      var baselineTotal = selectedMonths.reduce(function (sum, month) { return sum + baselineRows[month].total; }, 0);
      return {
        scenario: definition.name,
        month: "Season total",
        hdd: scenarioRows.reduce(function (sum, row) { return sum + row.hdd; }, 0),
        cdd: scenarioRows.reduce(function (sum, row) { return sum + row.cdd; }, 0),
        therms: scenarioRows.reduce(function (sum, row) { return sum + row.therms; }, 0),
        kwh: scenarioRows.reduce(function (sum, row) { return sum + row.kwh; }, 0),
        gasDollars: scenarioRows.reduce(function (sum, row) { return sum + row.gasDollars; }, 0),
        electricDollars: scenarioRows.reduce(function (sum, row) { return sum + row.electricDollars; }, 0),
        totalDollars: scenarioRows.reduce(function (sum, row) { return sum + row.totalDollars; }, 0),
        varianceVsBaseline: scenarioRows.reduce(function (sum, row) { return sum + row.totalDollars; }, 0) - baselineTotal
      };
    });

    return { rows: rows, seasonalTotals: totals };
  }

  function calculateSetbackSavings(deltaT, hoursPerDay, days) {
    var setback = nonNegative(deltaT, "setback");
    var activeHours = nonNegative(hoursPerDay === undefined ? 24 : hoursPerDay, "hours per day");
    if (activeHours > 24) {
      throw new Error("hours per day cannot exceed 24");
    }
    var dayCount = positive(days === undefined ? 30 : days, "days");
    var effectiveHddSaved = setback * (activeHours / 24) * dayCount;
    var thermsSaved = effectiveHddSaved * MODEL.GAS_THERMS_PER_HDD;
    var gasDollarsSaved = thermsSaved * MODEL.GAS_RATE;
    var kwhSaved = effectiveHddSaved * MODEL.ELECTRIC_KWH_PER_HDD;
    var electricDollarsSaved = kwhSaved * MODEL.ELECTRIC_RATE;
    return {
      deltaT: setback,
      hoursPerDay: activeHours,
      days: dayCount,
      effectiveHddSaved: effectiveHddSaved,
      thermsSaved: thermsSaved,
      gasDollarsSaved: gasDollarsSaved,
      kwhSaved: kwhSaved,
      electricDollarsSaved: electricDollarsSaved,
      totalDollarsSaved: gasDollarsSaved + electricDollarsSaved
    };
  }

  function compareSpaceHeating(options) {
    options = options || {};
    var therms = nonNegative(options.baselineTherms, "baseline therms");
    var kwh = nonNegative(options.baselineKwh, "baseline kWh");
    var days = positive(options.days, "billing days");
    var watts = nonNegative(options.heaterWatts, "heater watts");
    var heaterHours = nonNegative(options.heaterHoursPerDay, "heater hours per day");
    if (heaterHours > 24) throw new Error("heater hours per day cannot exceed 24");
    var setback = calculateSetbackSavings(options.setbackDegrees, options.setbackHoursPerDay, days);
    var thermsSaved = Math.min(setback.thermsSaved, Math.max(0, therms - MODEL.GAS_MIN_THERMS));
    var kwhSaved = Math.min(setback.kwhSaved, Math.max(0, kwh - MODEL.ELECTRIC_MIN_KWH));
    var heaterKwh = watts / 1000 * heaterHours * days;
    var baseline = calculateBill(therms, kwh, days);
    var targeted = calculateBill(therms - thermsSaved, kwh - kwhSaved + heaterKwh, days);
    var gasSaved = baseline.gasPostTax - targeted.gasPostTax;
    var otherElectricSaved = kwhSaved * MODEL.ELECTRIC_RATE;
    var heaterCost = heaterKwh * MODEL.ELECTRIC_RATE;
    var netSavings = baseline.totalPostTax - targeted.totalPostTax;
    var breakEvenHoursPerDay = watts > 0
      ? (gasSaved + otherElectricSaved) / (watts / 1000 * days * MODEL.ELECTRIC_RATE)
      : null;
    return {
      baseline: baseline,
      targeted: targeted,
      thermsSaved: thermsSaved,
      otherKwhSaved: kwhSaved,
      heaterKwh: heaterKwh,
      gasSaved: gasSaved,
      otherElectricSaved: otherElectricSaved,
      heaterCost: heaterCost,
      netSavings: netSavings,
      breakEvenHoursPerDay: breakEvenHoursPerDay
    };
  }

  global.ForecastModel = {
    MODEL: MODEL,
    MONTHLY_NORMALS: MONTHLY_NORMALS,
    HEATING_SEASON: HEATING_SEASON,
    SETBACK_SEASON: SETBACK_SEASON,
    degreeDays: degreeDays,
    predictUsage: predictUsage,
    gasRateForGcf: gasRateForGcf,
    calculateBill: calculateBill,
    forecastWeather: forecastWeather,
    generateScenarios: generateScenarios,
    calculateSetbackSavings: calculateSetbackSavings,
    compareSpaceHeating: compareSpaceHeating
  };
})(window);
