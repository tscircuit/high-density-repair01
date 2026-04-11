import { type DrcCheckResult, runDrcCheck } from "./drc-check"
import {
  type ForceImproveOptions,
  type ForceImproveResult,
  runForceDirectedImprovement,
} from "./HighDensityForceImproveSolver"
import { normalizeRoutesToPortAttachments } from "./utils/normalize-routes"
import { simplifyRoutes } from "./utils/simplify"
import type { HighDensityRepair01Input, NodeHdRoute } from "./types/types"

export const DEFAULT_REPAIR_TARGET_SEGMENTS = 10
export const DEFAULT_FORCE_IMPROVEMENT_PASSES = 100

export type RepairStage =
  | "original"
  | "normalized"
  | "simplified"
  | "force-improved"

export type RepairSampleOptions = ForceImproveOptions & {
  forceImprovementPasses?: number
  simplifyBeforeImprove?: boolean
  targetSegments?: number
}

export type RepairForceImproveResult = Omit<ForceImproveResult, "routes"> & {
  routes: NodeHdRoute[]
}

export type RepairSampleResult = {
  finalDrc: DrcCheckResult
  forceImprovementPasses: number
  forceImproveResult: RepairForceImproveResult
  improved: boolean
  issueCountDelta: number
  normalizedDrc: DrcCheckResult
  normalizedRoutes: NodeHdRoute[]
  originalDrc: DrcCheckResult
  repaired: boolean
  sample: HighDensityRepair01Input
  selectedStage: RepairStage
  simplifiedDrc: DrcCheckResult
  simplifiedRoutes: NodeHdRoute[]
}

const cloneRoutes = (routes: NodeHdRoute[]): NodeHdRoute[] =>
  routes.map((route) => ({
    ...route,
    route: route.route.map((point) => ({ ...point })),
    vias: route.vias.map((via) => ({ ...via })),
    viaRegions: route.viaRegions?.map((viaRegion) => ({
      ...viaRegion,
      center: { ...viaRegion.center },
      connectedTo: [...viaRegion.connectedTo],
    })),
  }))

const getNodeBounds = (sample: HighDensityRepair01Input) => {
  const { center, width, height } = sample.nodeWithPortPoints

  return {
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  }
}

const restoreNodeRouteMetadata = (
  sourceRoutes: NodeHdRoute[],
  improvedResult: ForceImproveResult,
): RepairForceImproveResult => ({
  ...improvedResult,
  routes: improvedResult.routes.map((improvedRoute, routeIndex) => {
    const sourceRoute = sourceRoutes[routeIndex]

    return {
      ...sourceRoute,
      ...improvedRoute,
      capacityMeshNodeId: sourceRoute?.capacityMeshNodeId ?? "",
      rootConnectionName:
        improvedRoute.rootConnectionName ??
        sourceRoute?.rootConnectionName ??
        improvedRoute.connectionName,
      route: improvedRoute.route.map((point) => ({
        ...point,
        z: point.z as NodeHdRoute["route"][number]["z"],
      })),
      vias: improvedRoute.vias.map((via) => ({ ...via })),
    }
  }),
})

const isBetterDrcResult = (
  candidate: DrcCheckResult,
  bestSoFar: DrcCheckResult,
) => {
  if (candidate.ok !== bestSoFar.ok) {
    return candidate.ok
  }

  return candidate.issues.length < bestSoFar.issues.length
}

export const repairSample = (
  sample: HighDensityRepair01Input,
  options: RepairSampleOptions = {},
): RepairSampleResult => {
  const originalRoutes = cloneRoutes(sample.nodeHdRoutes)
  const originalDrc = runDrcCheck(sample.nodeWithPortPoints, originalRoutes)
  const normalizedRoutes = normalizeRoutesToPortAttachments(
    sample.nodeWithPortPoints,
    originalRoutes,
  )
  const normalizedDrc = runDrcCheck(sample.nodeWithPortPoints, normalizedRoutes)

  const simplifiedRoutes =
    options.simplifyBeforeImprove === false
      ? cloneRoutes(normalizedRoutes)
      : simplifyRoutes(
          normalizedRoutes,
          options.targetSegments ?? DEFAULT_REPAIR_TARGET_SEGMENTS,
        )
  const simplifiedDrc = runDrcCheck(sample.nodeWithPortPoints, simplifiedRoutes)

  const forceImprovementPasses =
    options.forceImprovementPasses ?? DEFAULT_FORCE_IMPROVEMENT_PASSES
  const forceImproveResult =
    forceImprovementPasses > 0
      ? restoreNodeRouteMetadata(
          simplifiedRoutes,
          runForceDirectedImprovement(
            getNodeBounds(sample),
            simplifiedRoutes,
            forceImprovementPasses,
            {
              includeForceVectors: options.includeForceVectors,
            },
          ),
        )
      : {
          routes: cloneRoutes(simplifiedRoutes),
          forceVectors: [],
          stepsCompleted: 0,
        }
  const improvedDrc = runDrcCheck(
    sample.nodeWithPortPoints,
    forceImproveResult.routes,
  )

  let selectedStage: RepairStage = "original"
  let selectedRoutes = originalRoutes
  let finalDrc = originalDrc

  if (isBetterDrcResult(normalizedDrc, finalDrc)) {
    selectedStage = "normalized"
    selectedRoutes = normalizedRoutes
    finalDrc = normalizedDrc
  }

  if (isBetterDrcResult(simplifiedDrc, finalDrc)) {
    selectedStage = "simplified"
    selectedRoutes = simplifiedRoutes
    finalDrc = simplifiedDrc
  }

  if (isBetterDrcResult(improvedDrc, finalDrc)) {
    selectedStage = "force-improved"
    selectedRoutes = forceImproveResult.routes
    finalDrc = improvedDrc
  }

  return {
    finalDrc,
    forceImprovementPasses,
    forceImproveResult,
    improved: finalDrc.issues.length < originalDrc.issues.length,
    issueCountDelta: originalDrc.issues.length - finalDrc.issues.length,
    normalizedDrc,
    normalizedRoutes,
    originalDrc,
    repaired: !originalDrc.ok && finalDrc.ok,
    sample: {
      ...sample,
      nodeHdRoutes: cloneRoutes(selectedRoutes),
    },
    selectedStage,
    simplifiedDrc,
    simplifiedRoutes,
  }
}
