import { performance } from "node:perf_hooks"
import { join } from "node:path"
import { parseArgs } from "node:util"
import {
  DEFAULT_FORCE_IMPROVEMENT_PASSES,
  DEFAULT_REPAIR_TARGET_SEGMENTS,
  repairSample,
  type RepairStage,
} from "../lib/repair"
import type { HighDensityRepair01Input } from "../lib/types/types"

type SampleMeasurement = {
  finalIssueCount: number
  issueCountDelta: number
  repaired: boolean
  sampleName: string
  selectedStage: RepairStage
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    asset: { type: "string" },
    "force-improvement-passes": { type: "string" },
    json: { type: "boolean" },
    limit: { type: "string" },
    progress: { type: "string" },
    "target-segments": { type: "string" },
    "top-k": { type: "string" },
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

const assetPath =
  values.asset ?? join(import.meta.dir, "..", "assets", "hd08v2.json")
const limit = parseIntegerOption(values.limit, "limit")
const progressInterval = parseIntegerOption(values.progress, "progress") ?? 100
const topK = parseIntegerOption(values["top-k"], "top-k") ?? 10
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
let totalOriginalIssueCount = 0
let totalFinalIssueCount = 0
const startedAt = performance.now()

for (const [sampleIndex, [sampleName, sample]] of selectedEntries.entries()) {
  const repairResult = repairSample(sample, {
    forceImprovementPasses: resolvedForceImprovementPasses,
    includeForceVectors: false,
    targetSegments: resolvedTargetSegments,
  })

  repairedCount += repairResult.repaired ? 1 : 0
  totalOriginalIssueCount += repairResult.originalDrc.issues.length
  totalFinalIssueCount += repairResult.finalDrc.issues.length
  selectedStageCounts[repairResult.selectedStage] += 1

  measurements.push({
    finalIssueCount: repairResult.finalDrc.issues.length,
    issueCountDelta: repairResult.issueCountDelta,
    repaired: repairResult.repaired,
    sampleName,
    selectedStage: repairResult.selectedStage,
  })

  if (
    progressInterval > 0 &&
    (sampleIndex + 1) % progressInterval === 0 &&
    sampleIndex + 1 < selectedEntries.length
  ) {
    console.error(
      `Processed ${sampleIndex + 1}/${selectedEntries.length} failing samples...`,
    )
  }
}

const repairedSamples = measurements.filter(
  (measurement) => measurement.repaired,
)
const unresolvedSamples = measurements.filter(
  (measurement) => !measurement.repaired,
)
const topRepaired = [...repairedSamples]
  .sort(
    (left, right) =>
      right.issueCountDelta - left.issueCountDelta ||
      left.sampleName.localeCompare(right.sampleName),
  )
  .slice(0, topK)
const topUnresolved = [...unresolvedSamples]
  .sort(
    (left, right) =>
      right.finalIssueCount - left.finalIssueCount ||
      left.sampleName.localeCompare(right.sampleName),
  )
  .slice(0, topK)

const summary = {
  analyzedSamples: selectedEntries.length,
  assetPath,
  elapsedMs: performance.now() - startedAt,
  forceImprovementPasses: resolvedForceImprovementPasses,
  repairedCount,
  repairRate: repairedCount / selectedEntries.length,
  selectedStageCounts,
  targetSegments: resolvedTargetSegments,
  topRepaired,
  topUnresolved,
  totalFinalIssueCount,
  totalIssueReduction: totalOriginalIssueCount - totalFinalIssueCount,
  totalOriginalIssueCount,
  unresolvedCount: selectedEntries.length - repairedCount,
}

if (values.json) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `Repaired ${summary.repairedCount}/${summary.analyzedSamples} failing hd08v2 samples in ${(
      summary.elapsedMs / 1000
    ).toFixed(2)}s.`,
  )
  console.log(`Repair rate: ${(summary.repairRate * 100).toFixed(2)}%`)
  console.log(
    `Issue reduction: ${summary.totalOriginalIssueCount} -> ${summary.totalFinalIssueCount} (${summary.totalIssueReduction} fewer issues)`,
  )
  console.log(
    `Selected stages: original=${summary.selectedStageCounts.original}, normalized=${summary.selectedStageCounts.normalized}, simplified=${summary.selectedStageCounts.simplified}, force-improved=${summary.selectedStageCounts["force-improved"]}`,
  )

  if (topRepaired.length > 0) {
    console.log("")
    console.log(`Top ${topRepaired.length} repaired samples:`)
    for (const repairedSample of topRepaired) {
      console.log(
        `- ${repairedSample.sampleName}: fixed (${repairedSample.issueCountDelta} issues removed, stage=${repairedSample.selectedStage})`,
      )
    }
  }

  if (topUnresolved.length > 0) {
    console.log("")
    console.log(`Top ${topUnresolved.length} unresolved samples:`)
    for (const unresolvedSample of topUnresolved) {
      console.log(
        `- ${unresolvedSample.sampleName}: ${unresolvedSample.finalIssueCount} issues remain (stage=${unresolvedSample.selectedStage})`,
      )
    }
  }
}
