# White Plains Dual-Fuel Utility Bill Forecaster

An interactive, static GitHub Pages app for estimating natural-gas and electricity bills for a White Plains, NY residence served by Con Edison.

The calculator runs entirely in the browser. It includes:

- Direct usage bill breakdowns with interactive cost composition charts
- Weather-driven monthly forecasts using HDD/CDD
- October–April mild, baseline, and severe winter scenario trajectories and comparisons
- Thermostat setback savings estimates

## Run locally

Because this is a static site, serve the project directory with any simple web server:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages** in the repository.
3. Set **Source** to **GitHub Actions**.
4. Push to the `main` or `master` branch, or run **Deploy static app to GitHub Pages** manually from the **Actions** tab.

The workflow in `.github/workflows/pages.yml` publishes the repository as a static site. The application entry point is `index.html`.

## Project files

- `index.html` — static application shell and accessible form controls.
- `styles.css` — responsive visual design.
- `model.js` — browser-safe implementation of the forecasting formulas.
- `app.js` — UI state, calculations, interactive Chart.js visualizations, and table rendering.
- `chart.umd.min.js` — vendored Chart.js library for self-contained, offline-ready chart visuals.
- `engine.py`, `cli.py`, `app.py` — original Python model, CLI, and Streamlit implementation retained for reference and command-line use.
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow.

## Model notes

The primary post-tax outputs use the calibrated equations:

- Gas: `31.57 + 2.4216 × therms`
- Electricity: `8.52 + 0.3555 × kWh`
- Combined: `40.09 + 2.4216 × therms + 0.3555 × kWh`

Billing days prorate the fixed intercepts while leaving measured usage and its marginal charge unchanged. Weather estimates use a 65°F base temperature. The gas model identifies a 2.65% Westchester Gross Receipts Tax and 6% White Plains sales tax; the electric pre-tax display uses an explicit 6% presentation assumption.

### The wholesale gas cost factor (GCF)

The winter-scenario input labelled "wholesale gas cost factor" is a **unitless market gauge of how expensive gas supply is at that moment**, not a price in dollars. `0.80` is the calibrated normal, so the factor only moves the marginal gas rate by its distance from 0.80:

```text
gas_rate = 2.4216 + (gcf - 0.80) * 1.08809
```

Reading it in round numbers: `0.80` is an ordinary gas year, `0.90` is a high one (about 12% dearer per therm), and `1.00` is a spike (about 25% dearer). The mild and severe scenarios are separate: they scale the resulting gas rate directly by −4% and +6% on top of whatever baseline you enter. Fixed charges and electricity are unaffected, so a higher GCF only changes the variable gas line.
