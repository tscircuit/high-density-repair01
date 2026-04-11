import { join } from "node:path"
import { parseArgs } from "node:util"
import { repairSample } from "../lib/repair"
import type {
  HighDensityRepair01Input,
  NodeHdRoute,
  NodeWithPortPoints,
  Point2D,
  Point3D,
  PortPoint,
} from "../lib/types/types"

const POSITION_EPSILON = 1e-6

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

const getDistance = (left: Point2D, right: Point2D) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const arePointsCoincident = (left: Point2D, right: Point2D) =>
  getDistance(left, right) <= POSITION_EPSILON

const isSamePoint3D = (left: Point3D, right: Point3D) =>
  arePointsCoincident(left, right) && left.z === right.z

const getFirstMovedPointIndex = (route: NodeHdRoute) => {
  const startPoint = route.route[0]
  if (!startPoint) return null

  for (let pointIndex = 1; pointIndex < route.route.length; pointIndex += 1) {
    const point = route.route[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(startPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const getLastMovedPointIndex = (route: NodeHdRoute) => {
  const endPoint = route.route.at(-1)
  if (!endPoint) return null

  for (
    let pointIndex = route.route.length - 2;
    pointIndex >= 0;
    pointIndex -= 1
  ) {
    const point = route.route[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(endPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const isEndpointAttachedOnSameLayer = (
  route: NodeHdRoute,
  portPoint: PortPoint,
  endpoint: "start" | "end",
) => {
  const endpointPoint =
    endpoint === "start" ? route.route[0] : route.route.at(-1)
  if (!endpointPoint || !isSamePoint3D(endpointPoint, portPoint)) {
    return false
  }

  const movedPointIndex =
    endpoint === "start"
      ? getFirstMovedPointIndex(route)
      : getLastMovedPointIndex(route)

  if (movedPointIndex === null) {
    return false
  }

  const colocatedSlice =
    endpoint === "start"
      ? route.route.slice(0, movedPointIndex)
      : route.route.slice(movedPointIndex + 1)

  if (colocatedSlice.some((point) => point && point.z !== portPoint.z)) {
    return false
  }

  const movedPoint = route.route[movedPointIndex]
  return movedPoint?.z === portPoint.z
}

const classifyInvalidRoute = (
  route: NodeHdRoute,
  nodeWithPortPoints: NodeWithPortPoints,
) => {
  const routePortPoints = nodeWithPortPoints.portPoints.filter(
    (portPoint) => portPoint.connectionName === route.connectionName,
  )

  if (route.route.length < 2) {
    return "route-too-short"
  }

  if (routePortPoints.length !== 2) {
    return `port-count-${routePortPoints.length}`
  }

  for (
    let segmentIndex = 0;
    segmentIndex < route.route.length - 1;
    segmentIndex += 1
  ) {
    const start = route.route[segmentIndex]
    const end = route.route[segmentIndex + 1]
    if (!start || !end) continue

    if (!arePointsCoincident(start, end) && start.z !== end.z) {
      return "z-change-without-colocated-via"
    }
  }

  const [firstPortPoint, secondPortPoint] = routePortPoints
  if (!firstPortPoint || !secondPortPoint) {
    return "port-count-mismatch"
  }

  const directStartAttached = isEndpointAttachedOnSameLayer(
    route,
    firstPortPoint,
    "start",
  )
  const directEndAttached = isEndpointAttachedOnSameLayer(
    route,
    secondPortPoint,
    "end",
  )
  if (directStartAttached && directEndAttached) {
    return "unknown-invalid-route"
  }

  const swappedStartAttached = isEndpointAttachedOnSameLayer(
    route,
    secondPortPoint,
    "start",
  )
  const swappedEndAttached = isEndpointAttachedOnSameLayer(
    route,
    firstPortPoint,
    "end",
  )
  if (swappedStartAttached && swappedEndAttached) {
    return "unknown-invalid-route"
  }

  const classifyEndpoint = (
    portPoint: PortPoint,
    endpoint: "start" | "end",
  ): "attached" | "missing-point" | "same-point-wrong-layer" | "wrong-port" => {
    const endpointPoint =
      endpoint === "start" ? route.route[0] : route.route.at(-1)
    if (!endpointPoint) {
      return "missing-point"
    }

    if (!arePointsCoincident(endpointPoint, portPoint)) {
      return "wrong-port"
    }

    if (!isSamePoint3D(endpointPoint, portPoint)) {
      return "same-point-wrong-layer"
    }

    return "attached"
  }

  const directStartClass = classifyEndpoint(firstPortPoint, "start")
  const directEndClass = classifyEndpoint(secondPortPoint, "end")
  const swappedStartClass = classifyEndpoint(secondPortPoint, "start")
  const swappedEndClass = classifyEndpoint(firstPortPoint, "end")

  const directScore =
    Number(directStartClass === "attached") +
    Number(directEndClass === "attached")
  const swappedScore =
    Number(swappedStartClass === "attached") +
    Number(swappedEndClass === "attached")

  const startClass =
    swappedScore > directScore ? swappedStartClass : directStartClass
  const endClass = swappedScore > directScore ? swappedEndClass : directEndClass

  return `start-${startClass}|end-${endClass}`
}

const assetPath =
  values.asset ?? join(import.meta.dir, "..", "assets", "hd08v2.json")
const limit = parseIntegerOption(values.limit, "limit")
const progressInterval = parseIntegerOption(values.progress, "progress") ?? 100
const topK = parseIntegerOption(values["top-k"], "top-k") ?? 10
const forceImprovementPasses =
  parseIntegerOption(
    values["force-improvement-passes"],
    "force-improvement-passes",
  ) ?? 100
const targetSegments =
  parseIntegerOption(values["target-segments"], "target-segments") ?? 10

const failingSamples = (await Bun.file(assetPath).json()) as Record<
  string,
  HighDensityRepair01Input
>
const sampleEntries = Object.entries(failingSamples).sort(([left], [right]) =>
  left.localeCompare(right),
)
const selectedEntries =
  limit == null ? sampleEntries : sampleEntries.slice(0, limit)

const issueTotals: Record<string, number> = {}
const selectedStageCounts: Record<string, number> = {}
const invalidRouteCategories: Record<string, number> = {}
const outOfBoundsPointIndexes: Record<string, number> = {}
const sampleIssueCombos: Record<string, number> = {}
const sampleDominantIssueKinds: Record<string, number> = {}
const selectedStageIssueKinds: Record<string, Record<string, number>> = {}
const representativeSamples: Array<{
  finalIssueCount: number
  invalidRouteCount: number
  issueSummary: string
  sampleName: string
  selectedStage: string
}> = []

let unresolvedCount = 0

for (const [sampleIndex, [sampleName, sample]] of selectedEntries.entries()) {
  const result = repairSample(sample, {
    forceImprovementPasses,
    includeForceVectors: false,
    targetSegments,
  })

  if (progressInterval > 0 && (sampleIndex + 1) % progressInterval === 0) {
    console.error(
      `Analyzed ${sampleIndex + 1}/${selectedEntries.length} samples...`,
    )
  }

  if (result.repaired) {
    continue
  }

  unresolvedCount += 1
  selectedStageCounts[result.selectedStage] =
    (selectedStageCounts[result.selectedStage] ?? 0) + 1
  selectedStageIssueKinds[result.selectedStage] ??= {}

  const issueKindCounts: Record<string, number> = {}

  for (const issue of result.finalDrc.issues) {
    issueTotals[issue.kind] = (issueTotals[issue.kind] ?? 0) + 1
    issueKindCounts[issue.kind] = (issueKindCounts[issue.kind] ?? 0) + 1
    selectedStageIssueKinds[result.selectedStage][issue.kind] =
      (selectedStageIssueKinds[result.selectedStage][issue.kind] ?? 0) + 1

    if (issue.kind === "invalid-route") {
      const route = result.sample.nodeHdRoutes[issue.routeIndex]
      if (route) {
        const category = classifyInvalidRoute(route, sample.nodeWithPortPoints)
        invalidRouteCategories[category] =
          (invalidRouteCategories[category] ?? 0) + 1
      }
    }

    if (issue.kind === "out-of-bounds") {
      outOfBoundsPointIndexes[String(issue.pointIndex)] =
        (outOfBoundsPointIndexes[String(issue.pointIndex)] ?? 0) + 1
    }
  }

  const issueSummary = Object.entries(issueKindCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([issueKind, count]) => `${issueKind}:${count}`)
    .join(", ")
  sampleIssueCombos[issueSummary] = (sampleIssueCombos[issueSummary] ?? 0) + 1

  const dominantIssueKind =
    Object.entries(issueKindCounts).sort(
      ([leftKind, leftCount], [rightKind, rightCount]) =>
        rightCount - leftCount || leftKind.localeCompare(rightKind),
    )[0]?.[0] ?? "none"
  sampleDominantIssueKinds[dominantIssueKind] =
    (sampleDominantIssueKinds[dominantIssueKind] ?? 0) + 1

  representativeSamples.push({
    finalIssueCount: result.finalDrc.issues.length,
    invalidRouteCount: issueKindCounts["invalid-route"] ?? 0,
    issueSummary,
    sampleName,
    selectedStage: result.selectedStage,
  })
}

const sortCounts = (counts: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(counts).sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey),
    ),
  )

const summary = {
  analyzedSamples: selectedEntries.length,
  assetPath,
  forceImprovementPasses,
  invalidRouteCategories: sortCounts(invalidRouteCategories),
  issueTotals: sortCounts(issueTotals),
  outOfBoundsPointIndexes: sortCounts(outOfBoundsPointIndexes),
  sampleDominantIssueKinds: sortCounts(sampleDominantIssueKinds),
  selectedStageCounts: sortCounts(selectedStageCounts),
  selectedStageIssueKinds: Object.fromEntries(
    Object.entries(selectedStageIssueKinds).map(([stage, counts]) => [
      stage,
      sortCounts(counts),
    ]),
  ),
  topIssueCombos: Object.entries(sampleIssueCombos)
    .sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey),
    )
    .slice(0, topK)
    .map(([issueSummary, count]) => ({ count, issueSummary })),
  topUnresolvedSamples: representativeSamples
    .sort(
      (left, right) =>
        right.finalIssueCount - left.finalIssueCount ||
        right.invalidRouteCount - left.invalidRouteCount ||
        left.sampleName.localeCompare(right.sampleName),
    )
    .slice(0, topK),
  unresolvedCount,
}

if (values.json) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `Unresolved ${summary.unresolvedCount}/${summary.analyzedSamples} hd08v2 samples after repair.`,
  )
  console.log(
    `Issue totals: ${Object.entries(summary.issueTotals)
      .map(([issueKind, count]) => `${issueKind}=${count}`)
      .join(", ")}`,
  )
  console.log(
    `Selected stages: ${Object.entries(summary.selectedStageCounts)
      .map(([stage, count]) => `${stage}=${count}`)
      .join(", ")}`,
  )
  console.log("")
  console.log("Top invalid-route categories:")
  for (const [category, count] of Object.entries(
    summary.invalidRouteCategories,
  ).slice(0, topK)) {
    console.log(`- ${category}: ${count}`)
  }
  console.log("")
  console.log("Top issue combinations:")
  for (const combo of summary.topIssueCombos) {
    console.log(`- ${combo.issueSummary}: ${combo.count}`)
  }
  console.log("")
  console.log("Top unresolved samples:")
  for (const unresolvedSample of summary.topUnresolvedSamples) {
    console.log(
      `- ${unresolvedSample.sampleName}: ${unresolvedSample.issueSummary} (stage=${unresolvedSample.selectedStage})`,
    )
  }
}
