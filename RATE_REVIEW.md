# Winter 2026–27 pricing review

Checked October 16, 2026, for White Plains, NY. The homeowner confirmed that
Con Edison supplies both fuels and that the model uses bills from 2024–2026.

## Assessment

The electricity baseline is reasonable against published benchmarks. Gas is
plausible as a planning estimate but has not been validated against a recent
itemized household bill. The existing coefficients are retained: applying an
increase to a calibration spanning multiple years could double count it.
The model should be treated as provisional for this winter, particularly after
January 1, 2027. No numerical rate or usage coefficients were changed in this review.

## Upcoming winter outlook

The current marginal rates ($2.4216/therm gas and $0.3555/kWh electric,
plus the existing fixed charges) remain reasonable budgeting assumptions.
The [EIA October 6 winter outlook](https://www.eia.gov/outlooks/steo/report/perspectives/2026/10-winterfuels/article.php)
expects lower residential natural-gas prices and lower gas-heating spending in
the Northeast than last winter, while national residential electricity prices
are forecast to rise about 3%. Regional and national forecasts are directional
evidence; they do not specify Con Edison's monthly delivered prices.

[NOAA's October 15 seasonal outlook](https://cpc.ncep.noaa.gov/products/predictions/90day/fxus05.html)
favors above-normal temperatures across much of the Northeast into winter.
That suggests potential relief in heating usage. It does not establish a
specific reduction in White Plains heating degree days, so the baseline
retains normal-weather usage and the mild/severe cases remain sensitivities.

Use **about $2,800 for October–April as a working budget**, compared with the
$2,682.97 calculated baseline at reference settings. This rounded allowance
accounts for the January delivery increase sensitivity described below and
some uncertainty; it is not a price forecast or a guaranteed spending ceiling.
Lower gas supply prices or milder weather could offset part of the delivery
increase. The website's monthly summary shows the calculated baseline for each
utility and the total, with the planning budget identified separately.

## Electricity check

The model estimates $221.82 for 600 kWh over 30 days. Con Edison's
[historical electric bill chart](https://www.coned.com/-/media/files/coned/documents/rates/electric/average-monthly-electric-bills.pdf)
reports a 2025 Westchester annual monthly average of $208.70 at 600 kWh.
The PSC's [approved electric rate summary](https://dps.ny.gov/system/files/documents/2026/01/con-edison-electric-rate-case-summary.pdf)
adds $6.81 in 2026 and $6.57 in 2027 at that usage. Holding supply and other
adjustments constant gives comparison amounts of $215.51 and $222.08.
These are illustrative annual-average comparisons, not winter price quotes;
local sales tax treatment and monthly supply charges can differ.

## Gas check

The model estimates $273.73 for 100 therms over 30 days. Con Edison's
[October 2026 gas rate summary](https://www.coned.com/-/media/files/coned/documents/rates/gas/allrates.pdf)
lists SC-3 Rate I for homes with 1–4 dwelling units: $34 for the first
3 therms, $1.6383/therm for the next 87, and $1.3831/therm for the next 90.
Those delivery blocks alone total $190.36 at 100 therms, before supply,
adjustments and taxes. A linear household regression cannot reproduce every
delivery block or monthly rider. Confirm SC-3 Rate I on the household bill.

The [October GCF statement](https://www.coned.com/-/media/files/coned/documents/rates/gas/gas-cost-factor/gcf-202610.pdf)
sets SC-3 non-air-conditioning supply at $0.444553/therm (column B).
GCF is a dollar charge per therm, not a unitless index. The model's
$0.80/therm reference is a higher supply assumption than October's posted
charge; October pricing does not establish the winter supply price.
Do not lower the entire winter baseline to October's supply price.

The [approved gas rate summary](https://dps.ny.gov/system/files/documents/2026/01/con-edison-gas-rate-case-summary.pdf)
shows a 2027 increase of $19.32/month, or 7.8%, at the representative
100-therm residential usage. This is a bill impact at that usage, not a
universal 7.8% marginal-rate increase. The corresponding electric impact
at 425 kWh is $4.94/month, or 3.3%. Use the approved summaries rather than
the original proposed increases or utility-wide revenue percentages.

## Budget sensitivity

The current normal-weather model produces these combined bills, assuming a
30-day cycle each month and unchanged reference prices:

| Month | Baseline |
| --- | ---: |
| October | $256.53 |
| November | $336.48 |
| December | $443.22 |
| January | $498.20 |
| February | $456.16 |
| March | $404.41 |
| April | $287.97 |
| October–April | $2,682.97 |

As an illustrative allowance for the approved January change, adding the
representative $19.32 gas + $4.94 electric impact gives about $24/month extra
for January–April, or $97 for the season. That would bring January to about
$522 and the season to about $2,780. This is a budgeting sensitivity only:
usage differs from those representative bills, the calibration is mixed-year,
and future supply and riders can move either way. It is not applied in the
calculator. The existing mild/severe cases are stress tests, not statistical
confidence intervals or a seasonal weather forecast.

## What remains to validate

Compare a recent itemized bill's service class, billing days, therms, kWh,
gas/electric subtotals, supply, delivery, riders and taxes against the model.
Use charges for that service period, excluding balances and payments. Check
the January 2027 tariff and each winter month's supply statements when issued.
Con Edison's [bill outlook](https://www.coned.com/en/accounts-billing/your-bill/about-con-edisons-rates)
explains that supply is passed through and that separate reconciliations can
affect final bills. Household usage coefficients and embedded weather normals
were not independently recalibrated in this pricing review.
