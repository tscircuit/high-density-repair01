#!/usr/bin/env bash
set -euo pipefail

SCENARIO_LIMIT=""
DATASET=""
ASSET=""
FORCE_IMPROVEMENT_PASSES=""
TARGET_SEGMENTS=""
PROGRESS_INTERVAL=""
OUT="benchmark-result.json"
JSON=false

print_help() {
  cat <<'EOH'
Usage:
  ./benchmark.sh [scenario-limit|all] [--dataset hd08v2] [--asset PATH] [--force-improvement-passes N] [--target-segments N] [--progress-interval N] [--out PATH] [--json]
  ./benchmark.sh [--scenario-limit N|all] [--dataset hd08v2] [--asset PATH] [--force-improvement-passes N] [--target-segments N] [--progress-interval N] [--out PATH] [--json]

Options:
  --scenario-limit N|all       Run first N dataset samples, or all samples
  --dataset NAME               Dataset benchmark to run: hd08v2 (default)
  --asset PATH                 Benchmark a different hd08v2-style asset JSON
  --force-improvement-passes N Force-directed improvement passes (default from TS script: 100)
  --target-segments N          Simplification target segment count (default from TS script: 10)
  --progress-interval N        Progress interval in samples (default from TS script: 100, 0 disables)
  --out PATH                   Write JSON benchmark report (default: benchmark-result.json)
  --no-out                     Do not write a JSON benchmark report
  --json                       Print the JSON summary to stdout
  -h, --help                   Show this help

Defaults:
  Running ./benchmark.sh with no parameters benchmarks hd08v2 from assets/hd08v2.json.
  The report includes repair rate, issue reduction, selected stages, and DRC error counts.

Examples:
  ./benchmark.sh
  ./benchmark.sh 200
  ./benchmark.sh --dataset hd08v2
  ./benchmark.sh --scenario-limit all
  ./benchmark.sh --force-improvement-passes 200 --target-segments 12
  ./benchmark.sh 100 --progress-interval 25
  ./benchmark.sh --json --out tmp/benchmark-result.json
EOH
}

if [ "${1:-}" != "" ] && [[ "${1}" != --* ]]; then
  SCENARIO_LIMIT="$1"
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      print_help
      exit 0
      ;;
    --scenario-limit)
      SCENARIO_LIMIT="${2:-}"
      shift 2
      ;;
    --dataset)
      DATASET="${2:-}"
      shift 2
      ;;
    --asset)
      ASSET="${2:-}"
      shift 2
      ;;
    --force-improvement-passes)
      FORCE_IMPROVEMENT_PASSES="${2:-}"
      shift 2
      ;;
    --target-segments)
      TARGET_SEGMENTS="${2:-}"
      shift 2
      ;;
    --progress|--progress-interval)
      PROGRESS_INTERVAL="${2:-}"
      shift 2
      ;;
    --out)
      OUT="${2:-}"
      shift 2
      ;;
    --no-out)
      OUT=""
      shift
      ;;
    --json)
      JSON=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Run ./benchmark.sh --help for usage"
      exit 1
      ;;
  esac
done

CMD=(bun "scripts/benchmark.ts")

if [ -n "${SCENARIO_LIMIT}" ]; then
  CMD+=("--scenario-limit" "${SCENARIO_LIMIT}")
fi

if [ -n "${ASSET}" ]; then
  CMD+=("--asset" "${ASSET}")
fi

if [ -n "${FORCE_IMPROVEMENT_PASSES}" ]; then
  CMD+=("--force-improvement-passes" "${FORCE_IMPROVEMENT_PASSES}")
fi

if [ -n "${TARGET_SEGMENTS}" ]; then
  CMD+=("--target-segments" "${TARGET_SEGMENTS}")
fi

if [ -n "${DATASET}" ]; then
  CMD+=("--dataset" "${DATASET}")
fi

if [ -n "${PROGRESS_INTERVAL}" ]; then
  CMD+=("--progress-interval" "${PROGRESS_INTERVAL}")
fi

if [ -n "${OUT}" ]; then
  CMD+=("--out" "${OUT}")
fi

if [ "${JSON}" = true ]; then
  CMD+=("--json")
fi

"${CMD[@]}"
