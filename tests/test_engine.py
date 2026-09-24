import math

import pytest

from engine import (
    BASELINE_GCF,
    GAS_INTERCEPT,
    GAS_RATE,
    HEATING_SEASON,
    calculate_bill,
    calculate_setback_savings,
    forecast_weather,
    gas_rate_for_gcf,
    generate_scenarios,
    predict_usage,
)


def test_direct_usage_matches_master_bill():
    bill = calculate_bill(110, 420)
    assert bill.gas_post_tax == pytest.approx(31.57 + 2.4216 * 110)
    assert bill.electric_post_tax == pytest.approx(8.52 + 0.3555 * 420)
    assert bill.total_post_tax == pytest.approx(40.09 + 2.4216 * 110 + 0.3555 * 420)


def test_billing_days_prorates_fixed_intercepts_only():
    bill = calculate_bill(110, 420, billing_days=15)
    assert bill.gas_fixed == pytest.approx(31.57 / 2)
    assert bill.electric_fixed == pytest.approx(8.52 / 2)
    assert bill.gas_variable == pytest.approx(2.4216 * 110)


def test_january_normal_forecast():
    forecast = forecast_weather(month="January")
    assert forecast.hdd == 1080
    assert forecast.cdd == 0
    assert forecast.usage.therms == pytest.approx(127.822)
    assert forecast.usage.kwh == pytest.approx(417.948)
    assert forecast.bill.total_post_tax == pytest.approx(498.2043, abs=0.01)


def test_custom_temperature_uses_billing_days():
    forecast = forecast_weather(mean_temperature_f=35, billing_days=31)
    assert forecast.hdd == pytest.approx(930)
    assert forecast.cdd == 0


def test_gcf_adjustment():
    assert gas_rate_for_gcf(BASELINE_GCF) == pytest.approx(GAS_RATE)
    assert gas_rate_for_gcf(0.84) == pytest.approx(GAS_RATE + 0.04 * 1.08809)


def test_scenarios_scale_the_gas_rate_directly():
    baseline_rate = gas_rate_for_gcf(BASELINE_GCF)
    result = generate_scenarios(billing_days=30)
    severe = next(row for row in result.seasonal_totals if row.scenario == "Severe Winter")
    mild = next(row for row in result.seasonal_totals if row.scenario == "Mild Winter")

    # The +6% label applies to the gas rate itself: the seasonal gas dollars
    # equal the severe rate times severe usage plus the fixed intercepts across
    # the seven months. A GCF shift would have moved the rate by only ~1.2%.
    assert severe.gas_dollars == pytest.approx(
        baseline_rate * 1.06 * severe.therms + GAS_INTERCEPT * len(HEATING_SEASON)
    )

    mild_rate = baseline_rate * 0.96
    assert mild.gas_dollars == pytest.approx(
        mild_rate * mild.therms + GAS_INTERCEPT * len(HEATING_SEASON)
    )


def test_mild_scenario_keeps_baseline_gas_rate_when_rate_adjustment_is_zero():
    result = generate_scenarios(billing_days=30)
    baseline = next(row for row in result.seasonal_totals if row.scenario == "Baseline")

    assert baseline.gas_dollars == pytest.approx(
        gas_rate_for_gcf(BASELINE_GCF) * baseline.therms
        + GAS_INTERCEPT * len(HEATING_SEASON)
    )


def test_scenarios_have_monthly_and_season_totals():
    result = generate_scenarios()
    assert len(result.rows) == 21
    assert len(result.seasonal_totals) == 3
    baseline = next(row for row in result.seasonal_totals if row.scenario == "Baseline")
    assert baseline.variance_vs_baseline == pytest.approx(0)


def test_setback_savings_scales_with_days():
    monthly = calculate_setback_savings(5, 8, days=30)
    season = calculate_setback_savings(5, 8, days=150)
    assert season.total_dollars_saved == pytest.approx(monthly.total_dollars_saved * 5)
    assert season.effective_hdd_saved == pytest.approx(250)


@pytest.mark.parametrize("bad_input", [-1, -0.1])
def test_negative_consumption_is_rejected(bad_input):
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_bill(bad_input, 100)


def test_usage_floor_is_applied():
    usage = predict_usage(0, 0)
    assert usage.therms == 4.0
    assert usage.kwh == 290.94
