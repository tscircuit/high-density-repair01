import { performance } from "node:perf_hooks"
import { join } from "node:path"
import { parseArgs } from "node:util"
import {
  DEFAULT_FORCE_IMPROVEMENT_PASSES,
  DEFAULT_REPAIR_TARGET_SEGMENTS,
  repairSample,
  type RepairStage,
} from "../../lib/repair"
import type { DrcIssue } from "../../lib/drc-check"
import type { HighDensityRepair01Input } from "../../lib/types/types"

type IssueKindCounts = Record<DrcIssue["kind"], number>

type SampleMeasurement = {
  error?: string
  finalIssueCount: number
  finalIssueKindCounts: IssueKindCounts
  forceImprovementSteps: number
  issueCountDelta: number
  originalIssueCount: number
  originalIssueKindCounts: IssueKindCounts
  repaired: boolean
  sampleName: string
  selectedStage: RepairStage
  traceCount: number
}

const ISSUE_KINDS: DrcIssue["kind"][] = [
  "invalid-route",
  "out-of-bounds",
  "trace-trace",
  "via-trace",
  "via-via",
]

const createIssueKindCounts = (): IssueKindCounts => ({
  "invalid-route": 0,
  "out-of-bounds": 0,
  "trace-trace": 0,
  "via-trace": 0,
  "via-via": 0,
})

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const formatMs = (ms: number) => `${ms.toFixed(2)}ms`
const formatPercent = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(2)}%` : "0.00%"
const formatCountPercent = (part: number, total: number) =>
  `${part}/${total} (${formatPercent(part, total)})`
const shouldColorProgress =
  Boolean(process.stderr.isTTY) && process.env.NO_COLOR == null
const formatProgressLine = ({
  completed,
  elapsedMs,
  failed,
  repaired,
  total,
}: {
  completed: number
  elapsedMs: number
  failed: number
  repaired: number
  total: number
}) => {
  const remaining = total - completed
  const unresolved = completed - repaired - failed
  const message = `Benchmark progress: ${completed}/${total} hd08v2 repair samples analyzed (${formatPercent(completed, total)} complete, ${remaining} remaining; repaired=${repaired}, unresolved=${unresolved}, failed=${failed}; elapsed=${formatMs(elapsedMs)}).`

  return shouldColorProgress ? `\x1b[34m${message}\x1b[0m` : message
}

const countIssueKinds = (issues: DrcIssue[]) => {
  const counts = createIssueKindCounts()

  for (const issue of issues) {
    counts[issue.kind] += 1
  }

  return counts
}

const addIssueKindCounts = (
  target: IssueKindCounts,
  source: IssueKindCounts,
) => {
  for (const kind of ISSUE_KINDS) {
    target[kind] += source[kind]
  }
}

const logDataTable = (
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) => {
  const normalizedRows = rows.map((row) => row.map(String))
  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      ...normalizedRows.map((row) => row[columnIndex]?.length ?? 0),
    ),
  )
  const horizontal = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`
  const renderRow = (row: string[]) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`

  console.log("")
  console.log(title)
  console.log(horizontal)
  console.log(renderRow(headers))
  console.log(horizontal)
  for (const row of normalizedRows) {
    console.log(renderRow(row))
  }
  console.log(horizontal)
}

const logTable = (title: string, rows: Array<[string, string | number]>) => {
  logDataTable(title, ["Metric", "Value"], rows)
}

export const runHd08v2Benchmark = async (
  args: string[] = Bun.argv.slice(2),
) => {
  const { values } = parseArgs({
    args,
    options: {
      asset: { type: "string" },
      "force-improvement-passes": { type: "string" },
      json: { type: "boolean" },
      limit: { type: "string" },
      out: { type: "string" },
      progress: { type: "string" },
      "progress-interval": { type: "string" },
      "scenario-limit": { type: "string" },
      "target-segments": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  })

  const parseIntegerOption = (
    value: string | undefined,
    optionName: string,
  ) => {
    if (value == null) return undefined

    const parsedValue = Number.parseInt(value, 10)
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      throw new Error(`Expected --${optionName} to be a non-negative integer.`)
    }

    return parsedValue
  }

  const parseLimitOption = (value: string | undefined) => {
    if (value == null || value.toLowerCase() === "all") return undefined

    return parseIntegerOption(value, "scenario-limit")
  }

  const assetPath =
    values.asset ?? join(import.meta.dir, "..", "..", "assets", "hd08v2.json")
  const outputPath = values.out
  const limit = parseLimitOption(values.limit ?? values["scenario-limit"])
  const progressInterval =
    parseIntegerOption(
      values["progress-interval"] ?? values.progress,
      "progress-interval",
    ) ?? 100
  const resolvedForceImprovementPasses =
    parseIntegerOption(
      values["force-improvement-passes"],
      "force-improvement-passes",
    ) ?? DEFAULT_FORCE_IMPROVEMENT_PASSES
  const resolvedTargetSegments =
    parseIntegerOption(values["target-segments"], "target-segments") ??
    DEFAULT_REPAIR_TARGET_SEGMENTS

  const failingSamples = (await Bun.file(assetPath).json()) as Record<
    string,
    HighDensityRepair01Input
  >
  const sampleEntries = Object.entries(failingSamples).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const selectedEntries =
    limit == null ? sampleEntries : sampleEntries.slice(0, limit)

  if (selectedEntries.length === 0) {
    throw new Error(`No samples found in ${assetPath}.`)
  }

  const measurements: SampleMeasurement[] = []
  const selectedStageCounts: Record<RepairStage, number> = {
    "force-improved": 0,
    normalized: 0,
    original: 0,
    simplified: 0,
  }
  let repairedCount = 0
  let succeededCount = 0
  let failedCount = 0
  let totalOriginalIssueCount = 0
  let totalFinalIssueCount = 0
  let totalForceImprovementSteps = 0
  let totalTraceCount = 0
  const totalOriginalIssueKindCounts = createIssueKindCounts()
  const totalFinalIssueKindCounts = createIssueKindCounts()
  const startedAt = performance.now()

  for (const [sampleIndex, [sampleName, sample]] of selectedEntries.entries()) {
    try {
      const repairResult = repairSample(sample, {
        forceImprovementPasses: resolvedForceImprovementPasses,
        includeForceVectors: false,
        targetSegments: resolvedTargetSegments,
      })
      const originalIssueKindCounts = countIssueKinds(
        repairResult.originalDrc.issues,
      )
      const finalIssueKindCounts = countIssueKinds(repairResult.finalDrc.issues)
      const forceImprovementSteps =
        repairResult.forceImproveResult.stepsCompleted
      const traceCount = sample.nodeHdRoutes.length

      succeededCount += 1
      repairedCount += repairResult.repaired ? 1 : 0
      totalOriginalIssueCount += repairResult.originalDrc.issues.length
      totalFinalIssueCount += repairResult.finalDrc.issues.length
      totalForceImprovementSteps += forceImprovementSteps
      totalTraceCount += traceCount
      selectedStageCounts[repairResult.selectedStage] += 1
      addIssueKindCounts(totalOriginalIssueKindCounts, originalIssueKindCounts)
      addIssueKindCounts(totalFinalIssueKindCounts, finalIssueKindCounts)

      measurements.push({
        finalIssueCount: repairResult.finalDrc.issues.length,
        finalIssueKindCounts,
        forceImprovementSteps,
        issueCountDelta: repairResult.issueCountDelta,
        originalIssueCount: repairResult.originalDrc.issues.length,
        originalIssueKindCounts,
        repaired: repairResult.repaired,
        sampleName,
        selectedStage: repairResult.selectedStage,
        traceCount,
      })
    } catch (error) {
      failedCount += 1
      measurements.push({
        error: getErrorMessage(error),
        finalIssueCount: 0,
        finalIssueKindCounts: createIssueKindCounts(),
        forceImprovementSteps: 0,
        issueCountDelta: 0,
        originalIssueCount: 0,
        originalIssueKindCounts: createIssueKindCounts(),
        repaired: false,
        sampleName,
        selectedStage: "original",
        traceCount: sample.nodeHdRoutes.length,
      })
    }

    if (
      progressInterval > 0 &&
      (sampleIndex + 1) % progressInterval === 0 &&
      sampleIndex + 1 < selectedEntries.length
    ) {
      console.error(
        formatProgressLine({
          completed: sampleIndex + 1,
          elapsedMs: performance.now() - startedAt,
          failed: failedCount,
          repaired: repairedCount,
          total: selectedEntries.length,
        }),
      )
    }
  }

  const failedSamples = measurements.filter(
    (measurement) => measurement.error != null,
  )
  const firstFailedSamples = [...failedSamples]
    .sort((left, right) => left.sampleName.localeCompare(right.sampleName))
    .slice(0, 10)
  const elapsedMs = performance.now() - startedAt
  const totalIssueReduction = totalOriginalIssueCount - totalFinalIssueCount

  const summary = {
    analyzedSamples: selectedEntries.length,
    assetPath,
    averageSolveTimeMs: succeededCount > 0 ? elapsedMs / succeededCount : 0,
    elapsedMs,
    failedCount,
    forceImprovementPasses: resolvedForceImprovementPasses,
    originalIssueKindCounts: totalOriginalIssueKindCounts,
    finalIssueKindCounts: totalFinalIssueKindCounts,
    issueReductionRate:
      totalOriginalIssueCount > 0
        ? totalIssueReduction / totalOriginalIssueCount
        : 0,
    repairedCount,
    repairRate: succeededCount > 0 ? repairedCount / succeededCount : 0,
    selectedStageCounts,
    succeededCount,
    targetSegments: resolvedTargetSegments,
    failedSamples: firstFailedSamples,
    totalFinalIssueCount,
    totalForceImprovementSteps,
    totalIssueReduction,
    totalOriginalIssueCount,
    totalTraceCount,
    unresolvedCount: succeededCount - repairedCount,
  }

  if (values.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    logTable("Benchmark summary table", [
      ["Samples", summary.analyzedSamples],
      ["Succeeded", summary.succeededCount],
      ["Failed", summary.failedCount],
      ["Total traces", summary.totalTraceCount],
      ["Total iterations", summary.totalForceImprovementSteps],
      ["Total solve time", formatMs(summary.elapsedMs)],
      ["Average solve time", formatMs(summary.averageSolveTimeMs)],
      [
        "No-DRC samples",
        formatCountPercent(summary.repairedCount, summary.succeededCount),
      ],
      [
        "DRC issues removed",
        formatCountPercent(
          summary.totalIssueReduction,
          summary.totalOriginalIssueCount,
        ),
      ],
      ["DRC issues after repair", summary.totalFinalIssueCount],
    ])

    logDataTable(
      "DRC issues by type",
      ["Issue kind", "Before repair", "After repair", "Removed"],
      ISSUE_KINDS.map((kind) => {
        const originalCount = summary.originalIssueKindCounts[kind]
        const finalCount = summary.finalIssueKindCounts[kind]
        return [kind, originalCount, finalCount, originalCount - finalCount]
      }),
    )

    console.log("")
    console.log("Benchmark result")
    console.log(
      `  No-DRC samples: ${formatCountPercent(summary.repairedCount, summary.analyzedSamples)}`,
    )
    console.log(
      `  DRC fixed: ${summary.totalIssueReduction}/${summary.totalOriginalIssueCount} (${formatPercent(summary.totalIssueReduction, summary.totalOriginalIssueCount)}), ${summary.totalFinalIssueCount} remaining`,
    )
    console.log(
      `  Runtime: ${(summary.elapsedMs / 1000).toFixed(2)}s total, ${formatMs(summary.averageSolveTimeMs)} per sample`,
    )

    if (firstFailedSamples.length > 0) {
      console.log("")
      console.log(`First ${firstFailedSamples.length} failed samples:`)
      for (const failedSample of firstFailedSamples) {
        console.log(`- ${failedSample.sampleName}: ${failedSample.error}`)
      }
    }
  }

  if (outputPath != null) {
    await Bun.write(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

    if (!values.json) {
      console.log("")
      console.log(`Wrote benchmark report to ${outputPath}`)
    }
  }

  if (failedCount > 0) {
    process.exitCode = 1
  }
  return summary
}

if (import.meta.main) {
  await runHd08v2Benchmark()
}
