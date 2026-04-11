import { mkdir, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { performance } from "node:perf_hooks"
import { parseArgs } from "node:util"
import { runDrcCheck } from "../lib/drc-check"
import type { HighDensityRepair01Input } from "../lib/types/types"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    json: { type: "boolean" },
    limit: { type: "string" },
    out: { type: "string" },
    pretty: { type: "boolean" },
    progress: { type: "string" },
  },
  strict: true,
  allowPositionals: false,
})

const parseIntegerOption = (value: string | undefined, optionName: string) => {
  if (value == null) return undefined

  const parsedValue = Number.parseInt(value, 10)
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`Expected --${optionName} to be a non-negative integer.`)
  }

  return parsedValue
}

const limit = parseIntegerOption(values.limit, "limit")
const progressInterval = parseIntegerOption(values.progress, "progress") ?? 500
const samplesDir = join(
  import.meta.dir,
  "..",
  "node_modules",
  "dataset-hd08",
  "samples",
)
const outputPath =
  values.out ?? join(import.meta.dir, "..", "assets", "hd08v2.json")

const sampleFileNames = (await readdir(samplesDir))
  .filter((fileName) => /^sample\d{4}\.json$/.test(fileName))
  .sort()
const selectedFileNames =
  limit == null ? sampleFileNames : sampleFileNames.slice(0, limit)

const startedAt = performance.now()
const failingSamples: Record<string, HighDensityRepair01Input> = {}
let failingCount = 0
let totalIssueCount = 0

for (const [sampleIndex, fileName] of selectedFileNames.entries()) {
  const sampleName = fileName.replace(/\.json$/, "")
  const sample = (await Bun.file(
    join(samplesDir, fileName),
  ).json()) as HighDensityRepair01Input
  const drc = runDrcCheck(sample.nodeWithPortPoints, sample.nodeHdRoutes)

  totalIssueCount += drc.issues.length
  if (!drc.ok) {
    failingSamples[sampleName] = sample
    failingCount += 1
  }

  if (
    progressInterval > 0 &&
    (sampleIndex + 1) % progressInterval === 0 &&
    sampleIndex + 1 < selectedFileNames.length
  ) {
    console.error(
      `Scanned ${sampleIndex + 1}/${selectedFileNames.length} samples...`,
    )
  }
}

await mkdir(dirname(outputPath), { recursive: true })
await Bun.write(
  outputPath,
  values.pretty
    ? `${JSON.stringify(failingSamples, null, 2)}\n`
    : JSON.stringify(failingSamples),
)

const summary = {
  analyzedSamples: selectedFileNames.length,
  elapsedMs: performance.now() - startedAt,
  failingSamples: failingCount,
  outputPath,
  totalIssueCount,
}

if (values.json) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `Wrote ${summary.failingSamples} failing samples to ${summary.outputPath} in ${(
      summary.elapsedMs / 1000
    ).toFixed(2)}s.`,
  )
  console.log(`Analyzed samples: ${summary.analyzedSamples}`)
  console.log(
    `Total issues across analyzed samples: ${summary.totalIssueCount}`,
  )
}
