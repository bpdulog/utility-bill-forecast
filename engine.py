"""Core models for forecasting a dual-fuel residential utility bill.

The calibrated coefficients in this module are intentionally kept in one place so
that the CLI, Streamlit app, and downstream callers use identical calculations.
All monetary values are represented as floats and should be formatted at the
presentation boundary with two decimal places.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Iterable, Mapping


# Calibrated all-in coefficients from the supplied household model.
GAS_INTERCEPT = 31.57
GAS_RATE = 2.4216
ELECTRIC_INTERCEPT = 8.52
ELECTRIC_RATE = 0.3555

GAS_USAGE_INTERCEPT = 2.218
GAS_THERMS_PER_HDD = 0.1163
ELECTRIC_USAGE_INTERCEPT = 290.94
ELECTRIC_KWH_PER_HDD = 0.1176
ELECTRIC_KWH_PER_CDD = 0.5083

GAS_MIN_THERMS = 4.0
ELECTRIC_MIN_KWH = 235.0
BASELINE_GCF = 0.80
GCF_TO_GAS_RATE = 1.08809

# The gas regression explicitly identifies these tax overlays. The supplied
# electric model says local taxes are included but does not give a breakdown;
# 6% is therefore an explicit, configurable presentation assumption.
WESTCHESTER_GRT_RATE = 0.0265
WHITE_PLAINS_SALES_TAX_RATE = 0.06
ELECTRIC_TAX_RATE = 0.06

MONTHLY_NORMALS: dict[str, dict[str, float]] = {
    "January": {"hdd": 1080.0, "cdd": 0.0},
    "February": {"hdd": 950.0, "cdd": 0.0},
    "March": {"hdd": 790.0, "cdd": 0.0},
    "April": {"hdd": 430.0, "cdd": 0.0},
    "May": {"hdd": 180.0, "cdd": 20.0},
    "June": {"hdd": 30.0, "cdd": 150.0},
    "July": {"hdd": 0.0, "cdd": 280.0},
    "August": {"hdd": 0.0, "cdd": 240.0},
    "September": {"hdd": 60.0, "cdd": 70.0},
    "October": {"hdd": 330.0, "cdd": 5.0},
    "November": {"hdd": 580.0, "cdd": 0.0},
    "December": {"hdd": 910.0, "cdd": 0.0},
}

HEATING_SEASON = ("October", "November", "December", "January", "February", "March", "April")
SETBACK_SEASON = ("November", "December", "January", "February", "March")


def _non_negative(value: float, name: str) -> float:
    """Validate a numeric input that cannot physically be negative."""

    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number") from exc
    if not math.isfinite(number):
        raise ValueError(f"{name} must be finite")
    if number < 0:
        raise ValueError(f"{name} cannot be negative")
    return number


def _positive(value: float, name: str) -> float:
    number = _non_negative(value, name)
    if number == 0:
        raise ValueError(f"{name} must be greater than zero")
    return number


def _month_name(month: str) -> str:
    normalized = str(month).strip().lower()
    for name in MONTHLY_NORMALS:
        if name.lower() == normalized:
            return name
    raise ValueError(f"Unknown month {month!r}; expected a full month name")


@dataclass(frozen=True)
class Usage:
    therms: float
    kwh: float


@dataclass(frozen=True)
class Bill:
    billing_days: float
    gas_fixed: float
    gas_variable: float
    gas_pre_tax: float
    gas_post_tax: float
    electric_fixed: float
    electric_variable: float
    electric_pre_tax: float
    electric_post_tax: float
    total_pre_tax: float
    total_post_tax: float
    effective_gas_rate: float | None
    effective_electric_rate: float | None

    def as_dict(self) -> dict[str, float | None]:
        return asdict(self)


@dataclass(frozen=True)
class WeatherForecast:
    month: str | None
    billing_days: float
    mean_temperature_f: float | None
    hdd: float
    cdd: float
    usage: Usage
    bill: Bill


@dataclass(frozen=True)
class ScenarioMonth:
    scenario: str
    month: str
    hdd: float
    cdd: float
    therms: float
    kwh: float
    gas_dollars: float
    electric_dollars: float
    total_dollars: float
    variance_vs_baseline: float


@dataclass(frozen=True)
class ScenarioResult:
    rows: tuple[ScenarioMonth, ...]
    seasonal_totals: tuple[ScenarioMonth, ...]

    def rows_as_dicts(self) -> list[dict[str, float | str]]:
        return [asdict(row) for row in self.rows]

    def totals_as_dicts(self) -> list[dict[str, float | str]]:
        return [asdict(row) for row in self.seasonal_totals]


@dataclass(frozen=True)
class SetbackSavings:
    delta_t: float
    hours_per_day: float
    days: float
    effective_hdd_saved: float
    therms_saved: float
    gas_dollars_saved: float
    kwh_saved: float
    electric_dollars_saved: float
    total_dollars_saved: float

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


def degree_days(mean_temperature_f: float, days: float = 30.0) -> tuple[float, float]:
    """Return HDD and CDD using a 65 F base temperature."""

    try:
        temperature = float(mean_temperature_f)
    except (TypeError, ValueError) as exc:
        raise ValueError("mean_temperature_f must be a number") from exc
    if not math.isfinite(temperature):
        raise ValueError("mean_temperature_f must be finite")
    day_count = _positive(days, "days")
    return max(0.0, 65.0 - temperature) * day_count, max(0.0, temperature - 65.0) * day_count


def predict_usage(hdd: float, cdd: float) -> Usage:
    """Predict dual-fuel consumption from degree-day totals."""

    heating_days = _non_negative(hdd, "hdd")
    cooling_days = _non_negative(cdd, "cdd")
    therms = max(GAS_MIN_THERMS, GAS_USAGE_INTERCEPT + GAS_THERMS_PER_HDD * heating_days)
    kwh = max(
        ELECTRIC_MIN_KWH,
        ELECTRIC_USAGE_INTERCEPT
        + ELECTRIC_KWH_PER_HDD * heating_days
        + ELECTRIC_KWH_PER_CDD * cooling_days,
    )
    return Usage(therms=therms, kwh=kwh)


def gas_rate_for_gcf(gcf: float = BASELINE_GCF) -> float:
    """Translate a wholesale gas cost factor into the calibrated gas rate."""

    factor = _non_negative(gcf, "gcf")
    return GAS_RATE + (factor - BASELINE_GCF) * GCF_TO_GAS_RATE


def gas_piecewise_cost(therms: float, billing_days: float = 30.0) -> float:
    """Return the optional SC-3 piecewise gas representation from the brief."""

    amount = _non_negative(therms, "therms")
    day_count = _positive(billing_days, "billing_days")
    return 38.84 * day_count / 30.0 + GAS_RATE * max(0.0, amount - 3.0)


def calculate_bill(
    therms: float,
    kwh: float,
    billing_days: float = 30.0,
    *,
    gas_rate: float = GAS_RATE,
    electric_tax_rate: float = ELECTRIC_TAX_RATE,
) -> Bill:
    """Calculate itemized pre-tax and post-tax charges.

    The supplied regression rates are all-in rates. For presentation, the
    variable portions are backed out using the stated gas tax overlays and the
    configurable electric tax assumption, while fixed intercepts remain as
    calibrated. ``gas_post_tax`` and ``electric_post_tax`` are the model's
    primary outputs.
    """

    gas_usage = _non_negative(therms, "therms")
    electric_usage = _non_negative(kwh, "kwh")
    day_count = _positive(billing_days, "billing_days")
    marginal_gas_rate = _non_negative(gas_rate, "gas_rate")
    electric_tax = _non_negative(electric_tax_rate, "electric_tax_rate")

    gas_fixed = GAS_INTERCEPT * day_count / 30.0
    electric_fixed = ELECTRIC_INTERCEPT * day_count / 30.0
    gas_variable = marginal_gas_rate * gas_usage
    electric_variable = ELECTRIC_RATE * electric_usage

    gas_tax_multiplier = (1.0 + WESTCHESTER_GRT_RATE) * (1.0 + WHITE_PLAINS_SALES_TAX_RATE)
    gas_variable_pre_tax = gas_variable / gas_tax_multiplier
    electric_variable_pre_tax = electric_variable / (1.0 + electric_tax)
    gas_pre_tax = gas_fixed + gas_variable_pre_tax
    electric_pre_tax = electric_fixed + electric_variable_pre_tax
    gas_post_tax = gas_fixed + gas_variable
    electric_post_tax = electric_fixed + electric_variable
    total_pre_tax = gas_pre_tax + electric_pre_tax
    total_post_tax = gas_post_tax + electric_post_tax

    return Bill(
        billing_days=day_count,
        gas_fixed=gas_fixed,
        gas_variable=gas_variable,
        gas_pre_tax=gas_pre_tax,
        gas_post_tax=gas_post_tax,
        electric_fixed=electric_fixed,
        electric_variable=electric_variable,
        electric_pre_tax=electric_pre_tax,
        electric_post_tax=electric_post_tax,
        total_pre_tax=total_pre_tax,
        total_post_tax=total_post_tax,
        effective_gas_rate=gas_post_tax / gas_usage if gas_usage else None,
        effective_electric_rate=electric_post_tax / electric_usage if electric_usage else None,
    )


def forecast_weather(
    *,
    month: str | None = None,
    mean_temperature_f: float | None = None,
    billing_days: float = 30.0,
) -> WeatherForecast:
    """Forecast usage and bill from a normal month or a custom mean temperature."""

    day_count = _positive(billing_days, "billing_days")
    if month is not None and mean_temperature_f is not None:
        raise ValueError("Provide either month or mean_temperature_f, not both")
    if month is None and mean_temperature_f is None:
        raise ValueError("Provide a month or mean_temperature_f")

    if month is not None:
        normalized_month = _month_name(month)
        normal = MONTHLY_NORMALS[normalized_month]
        hdd, cdd = normal["hdd"], normal["cdd"]
        temperature = None
    else:
        normalized_month = None
        temperature = float(mean_temperature_f)
        hdd, cdd = degree_days(temperature, day_count)

    usage = predict_usage(hdd, cdd)
    bill = calculate_bill(usage.therms, usage.kwh, day_count)
    return WeatherForecast(normalized_month, day_count, temperature, hdd, cdd, usage, bill)


def generate_scenarios(
    *,
    billing_days: float = 30.0,
    baseline_gcf: float = BASELINE_GCF,
    months: Iterable[str] = HEATING_SEASON,
) -> ScenarioResult:
    """Generate baseline, mild, and severe heating-season scenarios."""

    day_count = _positive(billing_days, "billing_days")
    starting_gcf = _non_negative(baseline_gcf, "baseline_gcf")
    selected_months = tuple(_month_name(month) for month in months)
    if not selected_months:
        raise ValueError("months must contain at least one month")

    definitions = (
        ("Baseline", 1.00, 0.00),
        ("Mild Winter", 0.88, -0.04),
        ("Severe Winter", 1.12, 0.06),
    )
    baseline_rate = gas_rate_for_gcf(starting_gcf)
    baseline_rows: dict[str, tuple[float, float, float]] = {}
    for month in selected_months:
        normal = MONTHLY_NORMALS[month]
        baseline_usage = predict_usage(normal["hdd"], normal["cdd"])
        baseline_bill = calculate_bill(
            baseline_usage.therms,
            baseline_usage.kwh,
            day_count,
            gas_rate=baseline_rate,
        )
        baseline_rows[month] = (
            baseline_usage.therms,
            baseline_usage.kwh,
            baseline_bill.total_post_tax,
        )

    rows: list[ScenarioMonth] = []
    for scenario, hdd_factor, gcf_adjustment in definitions:
        scenario_gcf = starting_gcf * (1.0 + gcf_adjustment)
        scenario_rate = gas_rate_for_gcf(scenario_gcf)
        for month in selected_months:
            normal = MONTHLY_NORMALS[month]
            hdd = normal["hdd"] * hdd_factor
            cdd = normal["cdd"]
            usage = predict_usage(hdd, cdd)
            bill = calculate_bill(usage.therms, usage.kwh, day_count, gas_rate=scenario_rate)
            baseline_total = baseline_rows[month][2]
            rows.append(
                ScenarioMonth(
                    scenario=scenario,
                    month=month,
                    hdd=hdd,
                    cdd=cdd,
                    therms=usage.therms,
                    kwh=usage.kwh,
                    gas_dollars=bill.gas_post_tax,
                    electric_dollars=bill.electric_post_tax,
                    total_dollars=bill.total_post_tax,
                    variance_vs_baseline=bill.total_post_tax - baseline_total,
                )
            )

    totals: list[ScenarioMonth] = []
    for scenario, _, _ in definitions:
        scenario_rows = [row for row in rows if row.scenario == scenario]
        baseline_total = sum(baseline_rows[month][2] for month in selected_months)
        totals.append(
            ScenarioMonth(
                scenario=scenario,
                month="Season total",
                hdd=sum(row.hdd for row in scenario_rows),
                cdd=sum(row.cdd for row in scenario_rows),
                therms=sum(row.therms for row in scenario_rows),
                kwh=sum(row.kwh for row in scenario_rows),
                gas_dollars=sum(row.gas_dollars for row in scenario_rows),
                electric_dollars=sum(row.electric_dollars for row in scenario_rows),
                total_dollars=sum(row.total_dollars for row in scenario_rows),
                variance_vs_baseline=sum(row.total_dollars for row in scenario_rows) - baseline_total,
            )
        )
    return ScenarioResult(tuple(rows), tuple(totals))


def calculate_setback_savings(
    delta_t: float,
    hours_per_day: float = 24.0,
    days: float = 30.0,
) -> SetbackSavings:
    """Estimate savings from a heating thermostat setback."""

    setback = _non_negative(delta_t, "delta_t")
    active_hours = _non_negative(hours_per_day, "hours_per_day")
    if active_hours > 24.0:
        raise ValueError("hours_per_day cannot exceed 24")
    day_count = _positive(days, "days")
    effective_hdd_saved = setback * (active_hours / 24.0) * day_count
    therms_saved = effective_hdd_saved * GAS_THERMS_PER_HDD
    gas_dollars_saved = therms_saved * GAS_RATE
    kwh_saved = effective_hdd_saved * ELECTRIC_KWH_PER_HDD
    electric_dollars_saved = kwh_saved * ELECTRIC_RATE
    return SetbackSavings(
        delta_t=setback,
        hours_per_day=active_hours,
        days=day_count,
        effective_hdd_saved=effective_hdd_saved,
        therms_saved=therms_saved,
        gas_dollars_saved=gas_dollars_saved,
        kwh_saved=kwh_saved,
        electric_dollars_saved=electric_dollars_saved,
        total_dollars_saved=gas_dollars_saved + electric_dollars_saved,
    )


def month_normals() -> Mapping[str, Mapping[str, float]]:
    """Return a read-only-by-convention view of the embedded normal data."""

    return MONTHLY_NORMALS
