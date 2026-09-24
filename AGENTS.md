# AGENTS.md

Dual-fuel (natural gas + electricity) residential bill forecaster for a White Plains, NY
home on Con Edison. Ships as a **dependency-free static website** (the primary product)
plus a retained **Python model/CLI/Streamlit** implementation for reference and
command-line use.

## Commands

```bash
# Serve the static site (picks up PORT, prints localhost + Tailscale + LAN URLs)
./start.sh                      # launch.sh is an identical copy

# Python
python3 -m pytest -q            # tests; pytest is configured with pythonpath=["."], testpaths=["tests"]
python3 cli.py --usage --therms 110 --kwh 420
python3 cli.py --forecast --month January
python3 cli.py --scenario
python3 cli.py --setback 5 --hours 8
python3 cli.py --web            # Streamlit app (optional deps)
```

Dev deps are not installed in this checkout; `python3 -m pytest` fails with
`No module named pytest` until you `pip install -e '.[test]'` (or `.[web]`).

## Architecture

Three parallel implementations of the **same** formulas. There is no build step and no
framework; JS is plain ES5-style IIFEs, not modules or bundler output.

| Layer | Entry point | Notes |
|---|---|---|
| Static site (primary) | `index.html` → `model.js` → `app.js` | `model.js` attaches `window.ForecastModel`; `app.js` owns DOM, tabs, live recalc, and `Intl` formatting. `model.js` has no DOM dependencies. |
| Python library | `engine.py` | Frozen dataclasses (`Bill`, `Usage`, `WeatherForecast`, `ScenarioMonth`, `SetbackSavings`) and module-level calibrated constants. |
| Python front ends | `cli.py`, `app.py` | `argparse` CLI and Streamlit UI. Both import only from `engine.py`. |

Deployment: `.github/workflows/pages.yml` uploads the **whole repository** (path `.`) as
the Pages artifact on push to `main`/`master`, so any new file is published by default.
`.nojekyll` prevents Jekyll processing.

### Data flow

`degree_days` / `MONTHLY_NORMALS` → `predict_usage` (HDD/CDD → therms, kWh) →
`calculate_bill` (usage → itemized post-tax bill). Scenarios layer a ±12% HDD factor and
a direct ∓4/+6% scaling of the gas rate (not of the GCF) over the October–April heating
season; setback savings are computed directly from HDD avoided.

## Gotchas

- **Keep `engine.py` and `model.js` in sync by hand.** Every constant, formula, and
  validation rule is duplicated (`GAS_INTERCEPT` etc. in both files). Changing a tax rate,
  coefficient, or usage floor in one requires the identical change in the other, plus
  `tests/test_engine.py` which hardcodes the expected numeric outputs.
- **Python names are snake_case, JS names are camelCase**, including dataclass fields
  (`gas_post_tax` / `gasPostTax`, `seasonal_totals` / `seasonalTotals`). Don't "fix" one to
  match the other.
- **Post-tax is the model's primary output.** Pre-tax values are a *presentation
  back-out*: the gas tax multiplier `(1+0.0265)(1+0.06)` and a configurable 6% electric
  assumption divide the variable portion only; fixed intercepts are never taxed. Billing
  days prorate the fixed intercepts (`intercept * days / 30`) and leave marginal charges
  untouched.
- **Both `calculate_bill` and `predict_usage` apply floors** (`GAS_MIN_THERMS = 4.0`,
  `ELECTRIC_MIN_KWH = 235.0`), but the electric floor only applies to predicted usage, not
  to manual input.
- **Validation lives in the model, not the UI.** Negative/non-finite values raise
  `ValueError` (Python) or `Error` (JS); the browser catches these and shows them in
  `#*-error` elements. `hours_per_day > 24` and supplying both `month` and temperature are
  hard errors. Keep the JS error messages close to the Python ones.
- **`tabulate` is optional** in `cli.py` and falls back to ASCII pipes; `tablefmt="grid"`
  is deliberate because `rounded_outline` breaks Windows `charmap` consoles.
- **`cli.py` infers mode**: passing only `--month` or `--temperature` with no mode flag
  implicitly selects `--forecast`.
- Month names are full English names, case-insensitive; abbreviations are rejected.
- Add a new month/season to `MONTHLY_NORMALS`, `HEATING_SEASON`, and `SETBACK_SEASON` in
  **both** `engine.py` and `model.js`; the JS renders the month `<select>` from
  `model.MONTHLY_NORMALS` at DOM ready.
- UI element IDs in `index.html` are the contract with `app.js`; `renderTable` builds DOM
  via `createElement` + `textContent` (no `innerHTML`), and multi-value cells use a
  `{ key, label, format }` column spec.
- Public model functions take positional args in JS (`calculateBill(therms, kwh, days)`)
  but keyword-only args in Python (`calculate_bill(therms, kwh, billing_days, *, gas_rate=...)`).
