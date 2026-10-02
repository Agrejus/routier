// Runs in each Jest worker before the test modules load.
//
// The chaos suite's default sweep (25 seeds) costs ~12s, and Stryker re-runs the covering
// tests once per mutant — that alone would put a full run into the hours. Three seeds keep
// the chaos driver in the mutation-killing set at a fraction of the cost; the full sweep is
// what `npx jest chaos` and CI run.
process.env.CHAOS_SEEDS = process.env.CHAOS_SEEDS ?? '3';

// Plugin logging at `debug` (the repo's test.setup.js sets NODE_ENV=development) makes each
// mutant run slower and floods Stryker's progress output.
process.env.ROUTIER_LOG_LEVEL = process.env.ROUTIER_LOG_LEVEL ?? 'silent';
