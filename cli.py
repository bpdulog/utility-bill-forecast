"""Command-line interface for the dual-fuel utility bill forecaster."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import subprocess
from engine import (
    SETBACK_SEASON,
    calculate_bill,
    calculate_setback_savings,
    forecast_weather,
    generate_scenarios,
)


def money(value: float | None) -> str:
    return "N/A" if value is None else f"${value:,.2f}"


def number(value: float | None, digits: int = 2) -> str:
    return "N/A" if value is None else f"{value:,.{digits}f}"


def print_table(headers: list[str], rows: list[list[object]]) -> None:
    try:
        from tabulate import tabulate

        # ``rounded_outline`` uses Unicode box-drawing characters that fail on
        # common Windows ``charmap`` consoles. ``grid`` is portable ASCII.
        print(tabulate(rows, headers=headers, tablefmt="grid", floatfmt=",.2f"))
    except ImportError:
        print(" | ".join(headers))
        print("-+-".join("-" * len(header) for header in headers))
        for row in rows:
            print(" | ".join(str(item) for item in row))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=False)
    modes.add_argument("--usage", action="store_true", help="calculate a bill from manual consumption")
    modes.add_argument("--forecast", action="store_true", help="forecast a bill from a month or temperature")
    modes.add_argument("--scenario", action="store_true", help="compare the seven-month winter scenarios")
    modes.add_argument("--setback", type=float, metavar="DEGREES", help="estimate thermostat setback savings")
    modes.add_argument("--web", action="store_true", help="launch the optional Streamlit app")

    parser.add_argument("--therms", type=float, help="natural gas consumption in therms")
    parser.add_argument("--kwh", type=float, help="electricity consumption in kWh")
    parser.add_argument("--month", help="full month name, for example January")
    parser.add_argument("--temperature", type=float, help="custom average outdoor temperature in F")
    parser.add_argument("--billing-days", type=float, default=30.0, help="billing cycle length (default: 30)")
    parser.add_argument("--hours", type=float, default=24.0, help="setback hours active per day (default: 24)")
    parser.add_argument(
        "--gcf",
        type=float,
        default=0.80,
        help=(
            "wholesale gas cost factor: a unitless market gauge where 0.80 is normal and "
            "higher means gas is expensive (default: 0.80)"
        ),
    )
    return parser


def run_usage(args: argparse.Namespace) -> None:
    if args.therms is None or args.kwh is None:
        raise ValueError("--usage requires both --therms and --kwh")
    bill = calculate_bill(args.therms, args.kwh, args.billing_days)
    rows = [
        ["Fixed charge", money(bill.gas_fixed), money(bill.electric_fixed)],
        ["Variable charge", money(bill.gas_variable), money(bill.electric_variable)],
        ["Pre-tax charge", money(bill.gas_pre_tax), money(bill.electric_pre_tax)],
        ["Post-tax charge", money(bill.gas_post_tax), money(bill.electric_post_tax)],
    ]
    print(f"Manual usage bill ({args.billing_days:g} billing days)")
    print_table(["Item", "Natural gas", "Electricity"], rows)
    print(f"Total pre-tax:  {money(bill.total_pre_tax)}")
    print(f"Total post-tax: {money(bill.total_post_tax)}")
    print(f"Effective gas rate: {money(bill.effective_gas_rate)}/therm")
    print(f"Effective electric rate: {money(bill.effective_electric_rate)}/kWh")


def run_forecast(args: argparse.Namespace) -> None:
    if args.month is not None and args.temperature is not None:
        raise ValueError("Use either --month or --temperature, not both")
    forecast = forecast_weather(
        month=args.month,
        mean_temperature_f=args.temperature,
        billing_days=args.billing_days,
    )
    label = forecast.month or f"custom {forecast.mean_temperature_f:g} F"
    print(f"Weather forecast ({label}, {args.billing_days:g} billing days)")
    print_table(
        ["Metric", "Value"],
        [
            ["HDD (base 65 F)", number(forecast.hdd)],
            ["CDD (base 65 F)", number(forecast.cdd)],
            ["Predicted therms", number(forecast.usage.therms)],
            ["Predicted kWh", number(forecast.usage.kwh)],
            ["Gas post-tax", money(forecast.bill.gas_post_tax)],
            ["Electric post-tax", money(forecast.bill.electric_post_tax)],
            ["Total post-tax", money(forecast.bill.total_post_tax)],
        ],
    )


def run_scenario(args: argparse.Namespace) -> None:
    result = generate_scenarios(billing_days=args.billing_days, baseline_gcf=args.gcf)
    rows = []
    for row in result.rows:
        rows.append(
            [
                row.scenario,
                row.month,
                number(row.therms),
                number(row.kwh),
                money(row.gas_dollars),
                money(row.electric_dollars),
                money(row.total_dollars),
                money(row.variance_vs_baseline),
            ]
        )
    print("Heating season scenarios (October through April)")
    print_table(
        ["Scenario", "Month", "Therms", "kWh", "Gas $", "Electric $", "Total $", "Variance $"],
        rows,
    )
    totals = []
    for row in result.seasonal_totals:
        totals.append(
            [
                row.scenario,
                number(row.therms),
                number(row.kwh),
                money(row.gas_dollars),
                money(row.electric_dollars),
                money(row.total_dollars),
                money(row.variance_vs_baseline),
            ]
        )
    print("\nSeasonal totals")
    print_table(
        ["Scenario", "Therms", "kWh", "Gas $", "Electric $", "Total $", "Variance $"],
        totals,
    )


def run_setback(args: argparse.Namespace) -> None:
    monthly = calculate_setback_savings(args.setback, args.hours, days=30.0)
    season = calculate_setback_savings(args.setback, args.hours, days=30.0 * len(SETBACK_SEASON))
    print(f"Thermostat setback savings ({args.setback:g} F, {args.hours:g} hours/day)")
    print_table(
        ["Period", "HDD saved", "Therms saved", "kWh saved", "Gas saved", "Electric saved", "Total saved"],
        [
            ["Monthly", number(monthly.effective_hdd_saved), number(monthly.therms_saved), number(monthly.kwh_saved), money(monthly.gas_dollars_saved), money(monthly.electric_dollars_saved), money(monthly.total_dollars_saved)],
            ["Nov-Mar (150 days)", number(season.effective_hdd_saved), number(season.therms_saved), number(season.kwh_saved), money(season.gas_dollars_saved), money(season.electric_dollars_saved), money(season.total_dollars_saved)],
        ],
    )


def run_web() -> None:
    """Launch Streamlit using the interpreter/environment running this CLI."""

    app_path = Path(__file__).with_name("app.py")
    result = subprocess.run([sys.executable, "-m", "streamlit", "run", str(app_path)], check=False)
    if result.returncode:
        raise ValueError("Streamlit did not start successfully; install the optional web dependencies first")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        # A month or temperature alone is a convenient forecast shorthand.
        if not (args.usage or args.forecast or args.scenario or args.setback is not None or args.web):
            if args.month is not None or args.temperature is not None:
                args.forecast = True
            else:
                parser.error("choose one of --usage, --forecast, --scenario, or --setback")
        if args.usage:
            run_usage(args)
        elif args.forecast:
            run_forecast(args)
        elif args.scenario:
            run_scenario(args)
        elif args.web:
            run_web()
        else:
            run_setback(args)
    except ValueError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    sys.exit(main())
