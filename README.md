# YeastFit | Jhuang Lab

**YeastFit** is a browser-based workbench from the **Jhuang Lab** for flexible analysis of yeast growth, fitness, plate-reader experiments, screens, endpoint assays, and related quantitative phenotypes.

The guiding design principle is simple. Experimental data formats vary, biological designs vary, and the software should expose its assumptions rather than silently force one template.

## What it does

- Reads CSV, TSV, TXT, XLS/XLSX, JSON, pasted tables, and multiple files.
- Recognizes common wide plate-reader and long tidy formats.
- Accepts a separate plate map or sample sheet.
- Preserves arbitrary experimental metadata and user-defined factors.
- Allows flexible definitions of curve identity, biological and technical replicates, batches, controls, and normalization strata.
- Performs optional blank subtraction, baseline subtraction, smoothing, time-window filtering, and QC.
- Calculates AUC, maximum signal, endpoint signal, maximum specific growth rate, doubling time, lag estimate, and threshold-crossing time.
- Normalizes phenotypes to controls within user-selected strata.
- Provides default Welch control comparisons, Hedges' g, and Benjamini-Hochberg multiple-testing adjustment.
- Exports analysis-ready CSV files and a JSON analysis recipe.
- Shows an equivalent code sketch on demand and keeps exact method code in the repository.

## Privacy

YeastFit is designed as a static GitHub Pages application. Uploaded experimental data are processed in the browser and are not sent to a Jhuang Lab server or written to this repository by the application.

## Quick start

1. Open the GitHub Pages site.
2. Drop one or more data files into **Import**.
3. Optionally add a plate map or sample sheet.
4. Confirm the inferred data structure and experimental design.
5. Set corrections and QC thresholds.
6. Run the analysis and inspect curves and QC flags.
7. Define the control comparison and export results.

A small demonstration dataset is included under `examples/`.

## Methods overview

Detailed method notes are in [`docs/methods.md`](docs/methods.md). Core implementations are intentionally dependency-light and readable:

- `js/data.js` handles format inference and canonicalization.
- `js/analysis.js` handles corrections, curve metrics, normalization, and comparisons.
- `js/stats.js` contains descriptive statistics, Welch tests, effect sizes, and FDR adjustment.
- `js/app.js` coordinates the browser interface and reproducibility recipe.

## Local development

A local web server is recommended because browser module imports and demo-data loading are restricted under `file://` URLs.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Run the built-in checks with Node.js 20 or later.

```bash
npm test
npm run check
```

## Scope and interpretation

YeastFit is intended for exploratory and routine research analysis. Automated QC flags are warnings, not automatic exclusions. Default statistical tests are not substitutes for identifying the correct experimental unit. Complex repeated-measures, hierarchical, competition, or longitudinal designs can require models beyond the current browser implementation.

## Jhuang Lab

YeastFit is developed for the **Jhuang Lab** and its trainees, with an emphasis on yeast genetics, physiology, mitochondrial biology, and experimental evolution.
