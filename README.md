# high-density-repair01

Bootstrap repo for a tscircuit solver with Cosmos-based debugging.

## Scripts

- `bun run start` to open the Cosmos debugger
- `bun run build:site` to export the Cosmos site
- `bun run analyze:dataset-hd08:drc` to sweep all `dataset-hd08` samples with the local DRC checker
- `./benchmark.sh`, `bun run benchmark`, or `bun scripts/benchmark.ts --dataset hd08v2` to benchmark `hd08v2` repair performance and write `benchmark-result.json`
- `bun run build:hd08v2` to generate `assets/hd08v2.json` with only failing `dataset-hd08` samples
- `bun run measure:hd08v2:repair` to benchmark `hd08v2` through the dataset-aware benchmark runner
- `bun run typecheck` to run TypeScript
- `bun test` to run the smoke test
- `bun run format:check` to check formatting
