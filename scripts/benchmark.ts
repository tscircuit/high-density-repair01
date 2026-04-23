import { runHd08v2Benchmark } from "./benchmark/hd08v2"

type DatasetName = "hd08v2"

const DEFAULT_DATASET: DatasetName = "hd08v2"
const DATASETS: DatasetName[] = ["hd08v2"]

const printHelp = () => {
  console.log(`Usage:
  bun scripts/benchmark.ts [--dataset hd08v2] [--scenario-limit N|all] [--asset PATH] [--force-improvement-passes N] [--target-segments N] [--progress-interval N] [--out PATH] [--json]

Options:
  --dataset NAME               Dataset benchmark to run: hd08v2 (default)
  --scenario-limit N|all       Run first N dataset samples, or all samples
  --asset PATH                 Benchmark a different hd08v2-style asset JSON
  --force-improvement-passes N Force-directed improvement passes
  --target-segments N          Simplification target segment count
  --progress-interval N        Progress interval in samples
  --out PATH                   Write JSON benchmark report
  --json                       Print the JSON summary to stdout
  -h, --help                   Show this help`)
}

const parseDatasetArgs = (args: string[]) => {
  let dataset: DatasetName = DEFAULT_DATASET
  const restArgs: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--dataset") {
      const rawDataset = args[index + 1]
      if (!rawDataset) {
        throw new Error("Missing value for --dataset")
      }
      dataset = parseDatasetName(rawDataset)
      index += 1
      continue
    }

    if (arg.startsWith("--dataset=")) {
      dataset = parseDatasetName(arg.slice("--dataset=".length))
      continue
    }

    restArgs.push(arg)
  }

  return { dataset, restArgs }
}

const parseDatasetName = (value: string): DatasetName => {
  if ((DATASETS as string[]).includes(value)) {
    return value as DatasetName
  }

  throw new Error(
    `Unknown dataset: ${value}. Available datasets: ${DATASETS.join(", ")}`,
  )
}

export const runBenchmark = async (args: string[] = Bun.argv.slice(2)) => {
  if (args.includes("-h") || args.includes("--help")) {
    printHelp()
    return
  }

  const { dataset, restArgs } = parseDatasetArgs(args)

  switch (dataset) {
    case "hd08v2":
      return runHd08v2Benchmark(restArgs)
  }
}

if (import.meta.main) {
  await runBenchmark()
}
