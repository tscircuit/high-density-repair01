import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import { parseArgs } from "node:util"
import { runDrcCheck, type DrcIssue } from "../lib/drc-check"
import type { HighDensityRepair01Input } from "../lib/types"

type FailureSummary = {
  issueCount: number
  issueKinds: Record<DrcIssue["kind"], number>
  sampleName: string
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

const sortEntriesDescending = <TKey extends string>(
  entries: [TKey, number][],
) =>
  entries.sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )

const summarizeIssueKinds = (issues: DrcIssue[]) => {
  const issueKinds: Record<DrcIssue["kind"], number> = {
    "invalid-route": 0,
    "out-of-bounds": 0,
    "trace-port-point": 0,
    "trace-trace": 0,
    "via-trace": 0,
    "via-via": 0,
  }

  for (const issue of issues) {
    issueKinds[issue.kind] += 1
  }

  return issueKinds
}

const formatIssueKinds = (issueKinds: Record<DrcIssue["kind"], number>) =>
  sortEntriesDescending(
    Object.entries(issueKinds).filter(([, count]) => count > 0) as [
      DrcIssue["kind"],
      number,
    ][],
  )
    .map(([kind, count]) => `${kind}=${count}`)
    .join(", ")

const parseIntegerOption = (value: string | undefined, optionName: string) => {
  if (value == null) return undefined

  const parsedValue = Number.parseInt(value, 10)
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`Expected --${optionName} to be a non-negative integer.`)
  }

  return parsedValue
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    failures: { type: "string" },
    json: { type: "boolean" },
    limit: { type: "string" },
    progress: { type: "string" },
    strict: { type: "boolean" },
  },
  strict: true,
  allowPositionals: false,
})

const limit = parseIntegerOption(values.limit, "limit")
const failureDisplayCount =
  parseIntegerOption(values.failures, "failures") ?? 10
const progressInterval = parseIntegerOption(values.progress, "progress") ?? 500

const samplesDir = join(
  import.meta.dir,
  "..",
  "node_modules",
  "dataset-hd08",
  "samples",
)
const sampleFileNames = (await readdir(samplesDir))
  .filter((fileName) => /^sample\d{4}\.json$/.test(fileName))
  .sort()

const selectedFileNames =
  limit == null ? sampleFileNames : sampleFileNames.slice(0, limit)

if (selectedFileNames.length === 0) {
  throw new Error("No dataset-hd08 sample files were found.")
}

const issueKindCounts: Record<DrcIssue["kind"], number> = {
  "invalid-route": 0,
  "out-of-bounds": 0,
  "trace-port-point": 0,
  "trace-trace": 0,
  "via-trace": 0,
  "via-via": 0,
}

const failures: FailureSummary[] = []
let passingSamples = 0
let failingSamples = 0
let totalIssues = 0
const startedAt = performance.now()

for (const [sampleIndex, fileName] of selectedFileNames.entries()) {
  const sampleName = fileName.replace(/\.json$/, "")
  const sample = (await Bun.file(
    join(samplesDir, fileName),
  ).json()) as HighDensityRepair01Input
  const drc = runDrcCheck(sample.nodeWithPortPoints, sample.nodeHdRoutes)

  totalIssues += drc.issues.length

  if (drc.ok) {
    passingSamples += 1
  } else {
    failingSamples += 1
    const issueKinds = summarizeIssueKinds(drc.issues)
    failures.push({
      sampleName,
      issueCount: drc.issues.length,
      issueKinds,
    })
  }

  for (const issue of drc.issues) {
    issueKindCounts[issue.kind] += 1
  }

  if (
    progressInterval > 0 &&
    (sampleIndex + 1) % progressInterval === 0 &&
    sampleIndex + 1 < selectedFileNames.length
  ) {
    console.error(
      `Processed ${sampleIndex + 1}/${selectedFileNames.length} samples...`,
    )
  }
}

const elapsedMs = performance.now() - startedAt
const passRate = passingSamples / selectedFileNames.length
const topFailures = [...failures]
  .sort(
    (left, right) =>
      right.issueCount - left.issueCount ||
      left.sampleName.localeCompare(right.sampleName),
  )
  .slice(0, failureDisplayCount)

const summary = {
  analyzedSamples: selectedFileNames.length,
  elapsedMs,
  failingSamples,
  issueKindCounts,
  passingSamples,
  passRate,
  samplesDir,
  strictFailed: values.strict && failingSamples > 0,
  topFailures,
  totalIssues,
}

if (values.json) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `Analyzed ${summary.analyzedSamples} dataset-hd08 samples in ${(
      summary.elapsedMs / 1000
    ).toFixed(2)}s.`,
  )
  console.log(
    `Passing: ${summary.passingSamples} (${formatPercent(summary.passRate)})`,
  )
  console.log(`Failing: ${summary.failingSamples}`)
  console.log(`Total issues: ${summary.totalIssues}`)
  console.log(
    `Issue kinds: ${formatIssueKinds(summary.issueKindCounts) || "none"}`,
  )

  if (topFailures.length > 0) {
    console.log("")
    console.log(`Top ${topFailures.length} failing samples:`)
    for (const failure of topFailures) {
      console.log(
        `- ${failure.sampleName}: ${failure.issueCount} issues (${formatIssueKinds(failure.issueKinds)})`,
      )
    }
  }
}

if (values.strict && failingSamples > 0) {
  process.exit(1)
}
