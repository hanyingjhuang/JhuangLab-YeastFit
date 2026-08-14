# YeastFit methods and analysis logic

## 1. Canonical data model

YeastFit converts imported data into a long internal table. The required numerical field is `value`. Time-series experiments also require `time`. Identifiers such as `well`, `sample`, and `plate` are optional but strongly recommended. All additional columns are retained as metadata.

Wide plate-reader files are reshaped from one time column plus well columns such as A1 through H12 or A1 through P24. Long files can use any column names because the mapping is user-editable.

## 2. Experimental unit

The user defines one or more identity fields. These fields determine which measurements constitute an independent curve. For a plate-reader run, `plate + well` is a common definition. For already-summarized endpoint data, `sample + biological_replicate` may be more appropriate.

This distinction matters because technical repeated measurements within a curve are not independent biological replicates.

## 3. Signal adjustments

The current browser pipeline can apply the following operations in order.

1. Restrict the time interval.
2. Subtract a user-entered blank value.
3. Optionally subtract the median of the first three available points as an initial baseline.
4. Optionally clamp negative corrected values to zero.
5. Optionally apply a centered moving average over 3 or 5 points.

Every setting is included in the exported analysis recipe.

## 4. Area under the curve

AUC is calculated by trapezoidal integration over the adjusted time series.

## 5. Maximum specific growth rate

Positive signal values are log transformed. A sliding window is moved through the curve. For each window, an ordinary least-squares line is fitted to `ln(signal)` versus time. A window is eligible only when all signal values fall between the user-defined lower and upper bounds and the fit passes the minimum R-squared threshold.

The maximum positive eligible slope is reported as `mu_max`.

Doubling time is calculated as `ln(2) / mu_max` in the same time units as the input.

This method is deliberately transparent. It is less model-dependent than forcing a logistic or Gompertz fit to every curve, but the user should inspect the selected signal range and QC flags.

## 6. Lag estimate

The current lag estimate extrapolates the selected exponential fit back to the median early baseline. It is not a universal biological definition of lag and should be treated as a curve descriptor.

## 7. Threshold time

YeastFit reports the first time at which the adjusted curve crosses a user-defined signal threshold. Crossing time is linearly interpolated between the two neighboring measurements.

## 8. Quality control

Current QC warnings include:

- no numeric data
- excessive missing measurements
- unusually high starting signal
- possible signal saturation
- low dynamic range
- frequent decreases in measured signal

QC warnings are not automatic exclusions.

## 9. Control normalization

For a selected metric, the default reference is the median of observations that match the user-defined control value. Controls can be stratified within any metadata fields. For example, WT can be normalized separately within each medium and plate.

Relative phenotype is `sample value / control median`.

## 10. Default inferential comparison

The default comparison uses a two-sided Welch t test between each displayed group and the matching control group. Equal variances are not assumed. Hedges' g reports a small-sample-corrected standardized effect size. Benjamini-Hochberg adjustment is applied across the displayed P values.

This default is not suitable for every experiment. In particular, repeated measures, paired designs, nested experiments, time-course inference, and multiple biological levels can require mixed-effects or other hierarchical models. YeastFit therefore keeps replicate and batch fields explicit and labels its default statistics as a starting point.

## 11. Reproducibility

The export step provides:

- adjusted long-format observations
- per-curve metrics
- control comparisons
- a JSON recipe containing mappings and settings
- an equivalent JavaScript analysis sketch

The exact algorithms are implemented in `js/data.js`, `js/analysis.js`, and `js/stats.js`.
