"""Optional Streamlit front end for the dual-fuel utility bill forecaster."""

from __future__ import annotations

import pandas as pd
import streamlit as st

from engine import (
    HEATING_SEASON,
    SETBACK_SEASON,
    calculate_bill,
    calculate_setback_savings,
    forecast_weather,
    generate_scenarios,
    month_normals,
)


st.set_page_config(page_title="Dual-Fuel Bill Forecaster", page_icon="🏠", layout="wide")
st.title("White Plains Dual-Fuel Utility Bill Forecaster")
st.caption("Con Edison residential gas and electric model calibrated to the supplied OLS coefficients.")

tab_usage, tab_weather, tab_scenario, tab_setback = st.tabs(
    ["Direct usage", "Weather forecast", "Winter scenarios", "Thermostat setback"]
)

with tab_usage:
    st.subheader("Manual consumption")
    usage_col1, usage_col2, usage_col3 = st.columns(3)
    with usage_col1:
        therms = st.number_input("Natural gas (therms)", min_value=0.0, value=110.0, step=1.0)
    with usage_col2:
        kwh = st.number_input("Electricity (kWh)", min_value=0.0, value=420.0, step=5.0)
    with usage_col3:
        billing_days = st.number_input("Billing days", min_value=1.0, value=30.0, step=1.0)
    bill = calculate_bill(therms, kwh, billing_days)
    cards = st.columns(4)
    cards[0].metric("Gas", f"${bill.gas_post_tax:,.2f}")
    cards[1].metric("Electric", f"${bill.electric_post_tax:,.2f}")
    cards[2].metric("Total", f"${bill.total_post_tax:,.2f}")
    cards[3].metric("Pre-tax total", f"${bill.total_pre_tax:,.2f}")
    st.dataframe(
        pd.DataFrame(
            [
                ["Fixed", bill.gas_fixed, bill.electric_fixed],
                ["Variable", bill.gas_variable, bill.electric_variable],
                ["Post-tax", bill.gas_post_tax, bill.electric_post_tax],
            ],
            columns=["Charge", "Natural gas", "Electricity"],
        ).style.format({"Natural gas": "${:,.2f}", "Electricity": "${:,.2f}"}),
        hide_index=True,
        width="stretch",
    )

with tab_weather:
    st.subheader("Weather-driven monthly forecast")
    forecast_mode = st.radio("Input", ["NOAA normal month", "Custom average temperature"], horizontal=True)
    if forecast_mode == "NOAA normal month":
        selected_month = st.selectbox("Month", list(month_normals()))
        forecast = forecast_weather(month=selected_month, billing_days=billing_days)
    else:
        custom_temp = st.slider("Average outdoor temperature (F)", -10.0, 100.0, 45.0, 0.5)
        custom_days = st.number_input("Custom billing days", min_value=1.0, value=30.0, step=1.0, key="custom_days")
        forecast = forecast_weather(mean_temperature_f=custom_temp, billing_days=custom_days)
    forecast_cards = st.columns(4)
    forecast_cards[0].metric("HDD", f"{forecast.hdd:,.1f}")
    forecast_cards[1].metric("CDD", f"{forecast.cdd:,.1f}")
    forecast_cards[2].metric("Therms", f"{forecast.usage.therms:,.1f}")
    forecast_cards[3].metric("Total bill", f"${forecast.bill.total_post_tax:,.2f}")
    st.write(f"Gas: **${forecast.bill.gas_post_tax:,.2f}** · Electricity: **${forecast.bill.electric_post_tax:,.2f}**")

with tab_scenario:
    st.subheader("October–April winter scenarios")
    scenario_days = st.number_input("Days per billing cycle", min_value=1.0, value=30.0, step=1.0, key="scenario_days")
    scenario_gcf = st.number_input("Baseline wholesale gas factor", min_value=0.0, value=0.80, step=0.01, format="%.2f")
    scenario_result = generate_scenarios(billing_days=scenario_days, baseline_gcf=scenario_gcf)
    scenario_frame = pd.DataFrame(scenario_result.rows_as_dicts())
    st.dataframe(
        scenario_frame.style.format(
            {"hdd": "{:,.1f}", "cdd": "{:,.1f}", "therms": "{:,.1f}", "kwh": "{:,.1f}", "gas_dollars": "${:,.2f}", "electric_dollars": "${:,.2f}", "total_dollars": "${:,.2f}", "variance_vs_baseline": "${:,.2f}"}
        ),
        hide_index=True,
        width="stretch",
    )
    st.markdown("**Seasonal totals**")
    totals_frame = pd.DataFrame(scenario_result.totals_as_dicts())
    st.dataframe(
        totals_frame.style.format(
            {"hdd": "{:,.1f}", "cdd": "{:,.1f}", "therms": "{:,.1f}", "kwh": "{:,.1f}", "gas_dollars": "${:,.2f}", "electric_dollars": "${:,.2f}", "total_dollars": "${:,.2f}", "variance_vs_baseline": "${:,.2f}"}
        ),
        hide_index=True,
        width="stretch",
    )

with tab_setback:
    st.subheader("Heating thermostat setback")
    setback_col1, setback_col2 = st.columns(2)
    with setback_col1:
        delta_t = st.slider("Setback (F)", 0.0, 15.0, 5.0, 0.5)
    with setback_col2:
        hours = st.slider("Hours active per day", 0.0, 24.0, 8.0, 0.5)
    monthly = calculate_setback_savings(delta_t, hours, days=30.0)
    season = calculate_setback_savings(delta_t, hours, days=30.0 * len(SETBACK_SEASON))
    savings_cards = st.columns(2)
    savings_cards[0].metric("Monthly savings", f"${monthly.total_dollars_saved:,.2f}")
    savings_cards[1].metric("Nov–Mar savings", f"${season.total_dollars_saved:,.2f}")
    st.dataframe(
        pd.DataFrame(
            [
                ["Monthly", monthly.therms_saved, monthly.kwh_saved, monthly.gas_dollars_saved, monthly.electric_dollars_saved, monthly.total_dollars_saved],
                ["Nov–Mar", season.therms_saved, season.kwh_saved, season.gas_dollars_saved, season.electric_dollars_saved, season.total_dollars_saved],
            ],
            columns=["Period", "Therms saved", "kWh saved", "Gas saved", "Electric saved", "Total saved"],
        ).style.format({"Therms saved": "{:,.2f}", "kWh saved": "{:,.2f}", "Gas saved": "${:,.2f}", "Electric saved": "${:,.2f}", "Total saved": "${:,.2f}"}),
        hide_index=True,
        width="stretch",
    )
