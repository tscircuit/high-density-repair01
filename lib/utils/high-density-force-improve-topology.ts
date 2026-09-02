import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../types/high-density-types"
import { deriveVias, getInsetNodeBounds } from "./force-improve-route-helpers"
import {
  collectProjectionSegments,
  getProjectionSegmentDistanceCandidates,
  type ProjectionSegment,
} from "./force-improve-segment-helpers"

type SegmentPairSelector = {
  leftRouteIndex: number
  leftStartPointIndex: number
  rightRouteIndex: number
  rightStartPointIndex: number
}

type ProjectionSegmentIndex = Array<
  Array<ProjectionSegment | undefined> | undefined
>

type RoutePair = readonly [number, number]

type DistributeProjectionSegmentMove = (params: {
  routes: HighDensityRoute[]
  segment: ProjectionSegment
  dx: number
  dy: number
  node: NodeWithPortPoints
  t: number
}) => boolean

type ApplySelectedRouteSegmentClearance = (
  node: NodeWithPortPoints,
  routes: HighDensityRoute[],
  movableRouteIndexes: ReadonlySet<number>,
) => HighDensityRoute[]

const POSITION_EPSILON = 1e-6
const CLEARANCE_SLACK = 0.015
const MAX_TRACE_MOVE_PER_PASS = 0.025

const indexProjectionSegments = (
  segments: ProjectionSegment[],
): ProjectionSegmentIndex => {
  const index: ProjectionSegmentIndex = []
  for (const segment of segments) {
    const routeSegments = index[segment.routeIndex] ?? []
    routeSegments[segment.startIndex] = segment
    index[segment.routeIndex] = routeSegments
  }
  return index
}

const getRoutePair = (
  leftRouteIndex: number,
  rightRouteIndex: number,
): RoutePair =>
  leftRouteIndex < rightRouteIndex
    ? [leftRouteIndex, rightRouteIndex]
    : [rightRouteIndex, leftRouteIndex]

const includesRoutePair = (pairs: RoutePair[], candidate: RoutePair) =>
  pairs.some(
    ([leftRouteIndex, rightRouteIndex]) =>
      leftRouteIndex === candidate[0] && rightRouteIndex === candidate[1],
  )

const findClosestAdjacentProjectionSegment = (
  segments: ProjectionSegment[],
  segment: ProjectionSegment,
  otherSegment: ProjectionSegment,
): ProjectionSegment | undefined => {
  let closestSegment: ProjectionSegment | undefined
  let closestDistance = Number.POSITIVE_INFINITY

  for (const candidate of segments) {
    if (
      candidate.routeIndex !== segment.routeIndex ||
      candidate.z !== segment.z ||
      (candidate.endIndex !== segment.startIndex &&
        candidate.startIndex !== segment.endIndex)
    ) {
      continue
    }

    const [distanceCandidate] = getProjectionSegmentDistanceCandidates(
      candidate,
      otherSegment,
    )
    if (!distanceCandidate) continue
    const distance = Math.hypot(
      distanceCandidate.leftPoint.x - distanceCandidate.rightPoint.x,
      distanceCandidate.leftPoint.y - distanceCandidate.rightPoint.y,
    )
    if (distance >= closestDistance) continue
    closestDistance = distance
    closestSegment = candidate
  }

  return closestSegment
}

export const findNewProperSegmentCrossings = (
  originalRoutes: HighDensityRoute[],
  candidateRoutes: HighDensityRoute[],
): SegmentPairSelector[] => {
  const candidateSegments = collectProjectionSegments(candidateRoutes)
  const originalSegments = collectProjectionSegments(originalRoutes)
  const originalSegmentIndex = indexProjectionSegments(originalSegments)
  const selectors: SegmentPairSelector[] = []

  for (
    let leftIndex = 0;
    leftIndex < candidateSegments.length;
    leftIndex += 1
  ) {
    const left = candidateSegments[leftIndex]
    if (!left) continue

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidateSegments.length;
      rightIndex += 1
    ) {
      const right = candidateSegments[rightIndex]
      if (
        !right ||
        left.z !== right.z ||
        left.rootConnectionName === right.rootConnectionName ||
        Math.max(left.start.x, left.end.x) <
          Math.min(right.start.x, right.end.x) ||
        Math.max(right.start.x, right.end.x) <
          Math.min(left.start.x, left.end.x) ||
        Math.max(left.start.y, left.end.y) <
          Math.min(right.start.y, right.end.y) ||
        Math.max(right.start.y, right.end.y) <
          Math.min(left.start.y, left.end.y)
      ) {
        continue
      }

      const [candidate] = getProjectionSegmentDistanceCandidates(left, right)
      if (
        !candidate ||
        Math.hypot(
          candidate.leftPoint.x - candidate.rightPoint.x,
          candidate.leftPoint.y - candidate.rightPoint.y,
        ) > POSITION_EPSILON ||
        candidate.leftT <= POSITION_EPSILON ||
        candidate.leftT >= 1 - POSITION_EPSILON ||
        candidate.rightT <= POSITION_EPSILON ||
        candidate.rightT >= 1 - POSITION_EPSILON
      ) {
        continue
      }

      const originalLeft =
        originalSegmentIndex[left.routeIndex]?.[left.startIndex]
      const originalRight =
        originalSegmentIndex[right.routeIndex]?.[right.startIndex]
      if (!originalLeft || !originalRight) continue
      const [originalCandidate] = getProjectionSegmentDistanceCandidates(
        originalLeft,
        originalRight,
      )
      if (
        !originalCandidate ||
        Math.hypot(
          originalCandidate.leftPoint.x - originalCandidate.rightPoint.x,
          originalCandidate.leftPoint.y - originalCandidate.rightPoint.y,
        ) <= POSITION_EPSILON
      ) {
        continue
      }

      const leftAdjacent = findClosestAdjacentProjectionSegment(
        originalSegments,
        originalLeft,
        originalRight,
      )
      const rightAdjacent = findClosestAdjacentProjectionSegment(
        originalSegments,
        originalRight,
        originalLeft,
      )
      const leftCorridor = leftAdjacent
        ? [originalLeft, leftAdjacent]
        : [originalLeft]
      const rightCorridor = rightAdjacent
        ? [originalRight, rightAdjacent]
        : [originalRight]

      for (const leftSegment of leftCorridor) {
        for (const rightSegment of rightCorridor) {
          const selector = {
            leftRouteIndex: left.routeIndex,
            leftStartPointIndex: leftSegment.startIndex,
            rightRouteIndex: right.routeIndex,
            rightStartPointIndex: rightSegment.startIndex,
          }
          if (
            selectors.some(
              (existing) =>
                existing.leftRouteIndex === selector.leftRouteIndex &&
                existing.leftStartPointIndex === selector.leftStartPointIndex &&
                existing.rightRouteIndex === selector.rightRouteIndex &&
                existing.rightStartPointIndex === selector.rightStartPointIndex,
            )
          ) {
            continue
          }
          selectors.push(selector)
        }
      }
    }
  }

  return selectors
}

const getRoutePairClearanceViolations = (routes: HighDensityRoute[]) => {
  const segments = collectProjectionSegments(routes)
  const violatingRoutePairs: RoutePair[] = []
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]
    if (!left) continue
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const right = segments[rightIndex]
      if (
        !right ||
        left.z !== right.z ||
        left.rootConnectionName === right.rootConnectionName
      ) {
        continue
      }
      const [candidate] = getProjectionSegmentDistanceCandidates(left, right)
      if (!candidate) continue
      const distance = Math.hypot(
        candidate.leftPoint.x - candidate.rightPoint.x,
        candidate.leftPoint.y - candidate.rightPoint.y,
      )
      if (distance + POSITION_EPSILON < left.traceRadius + right.traceRadius) {
        const pair = getRoutePair(left.routeIndex, right.routeIndex)
        if (!includesRoutePair(violatingRoutePairs, pair)) {
          violatingRoutePairs.push(pair)
        }
      }
    }
  }
  return violatingRoutePairs
}

export const findAlignedTopologyCandidate = (
  params: {
    originalRoutes: HighDensityRoute[]
    guardedRoutes: HighDensityRoute[]
    node: NodeWithPortPoints
    crossingSelectors: SegmentPairSelector[]
    protectedSelectors: SegmentPairSelector[]
  },
  applySelectedRouteSegmentClearance: ApplySelectedRouteSegmentClearance,
) => {
  const {
    originalRoutes,
    guardedRoutes,
    node,
    crossingSelectors,
    protectedSelectors,
  } = params
  const originalSegmentIndex = indexProjectionSegments(
    collectProjectionSegments(originalRoutes),
  )
  const guardedSegmentIndex = indexProjectionSegments(
    collectProjectionSegments(guardedRoutes),
  )
  const baselineViolationPairs = getRoutePairClearanceViolations(guardedRoutes)
  const protectedRoutePairs = protectedSelectors.map(
    ({ leftRouteIndex, rightRouteIndex }) =>
      getRoutePair(leftRouteIndex, rightRouteIndex),
  )
  const bounds = getInsetNodeBounds(node, POSITION_EPSILON)

  for (const selector of crossingSelectors) {
    const guardedLeft =
      guardedSegmentIndex[selector.leftRouteIndex]?.[
        selector.leftStartPointIndex
      ]
    const guardedRight =
      guardedSegmentIndex[selector.rightRouteIndex]?.[
        selector.rightStartPointIndex
      ]
    if (!guardedLeft || !guardedRight) continue
    const [guardedCrossing] = getProjectionSegmentDistanceCandidates(
      guardedLeft,
      guardedRight,
    )
    if (
      !guardedCrossing ||
      Math.hypot(
        guardedCrossing.leftPoint.x - guardedCrossing.rightPoint.x,
        guardedCrossing.leftPoint.y - guardedCrossing.rightPoint.y,
      ) > POSITION_EPSILON ||
      guardedCrossing.leftT <= POSITION_EPSILON ||
      guardedCrossing.leftT >= 1 - POSITION_EPSILON ||
      guardedCrossing.rightT <= POSITION_EPSILON ||
      guardedCrossing.rightT >= 1 - POSITION_EPSILON
    ) {
      continue
    }

    for (const movableSide of ["right", "left"] as const) {
      const movableRouteIndex =
        movableSide === "left"
          ? selector.leftRouteIndex
          : selector.rightRouteIndex
      const movableStartIndex =
        movableSide === "left"
          ? selector.leftStartPointIndex
          : selector.rightStartPointIndex
      const fixedRouteIndex =
        movableSide === "left"
          ? selector.rightRouteIndex
          : selector.leftRouteIndex
      const fixedStartIndex =
        movableSide === "left"
          ? selector.rightStartPointIndex
          : selector.leftStartPointIndex
      const originalMovableRoute = originalRoutes[movableRouteIndex]
      const guardedMovableRoute = guardedRoutes[movableRouteIndex]
      const originalFixedSegment =
        originalSegmentIndex[fixedRouteIndex]?.[fixedStartIndex]
      const guardedFixedSegment =
        guardedSegmentIndex[fixedRouteIndex]?.[fixedStartIndex]
      if (
        !originalMovableRoute ||
        !guardedMovableRoute ||
        !originalFixedSegment ||
        !guardedFixedSegment
      ) {
        continue
      }
      const corridorLayer = originalMovableRoute.route[movableStartIndex]?.z

      const corridorPointIndexes: number[] = []
      for (
        let pointIndex = movableStartIndex - 2;
        pointIndex <= movableStartIndex + 3;
        pointIndex += 1
      ) {
        const point = originalMovableRoute.route[pointIndex]
        if (
          !point ||
          pointIndex <= 0 ||
          pointIndex >= originalMovableRoute.route.length - 1 ||
          point.z !== corridorLayer ||
          [
            originalMovableRoute.route[pointIndex - 1],
            originalMovableRoute.route[pointIndex + 1],
          ].some(
            (adjacentPoint) => adjacentPoint && adjacentPoint.z !== point.z,
          )
        ) {
          continue
        }
        corridorPointIndexes.push(pointIndex)
      }
      if (corridorPointIndexes.length === 0) continue

      for (const [originalAnchor, guardedAnchor] of [
        [originalFixedSegment.start, guardedFixedSegment.start],
        [originalFixedSegment.end, guardedFixedSegment.end],
      ] as const) {
        for (const scale of [1.51, 1.25, 1.75, 2]) {
          const candidateRoutes = [...guardedRoutes]
          const candidateRoute = structuredClone(guardedMovableRoute)
          candidateRoutes[movableRouteIndex] = candidateRoute
          let insideBounds = true
          for (const pointIndex of corridorPointIndexes) {
            const originalPoint = originalMovableRoute.route[pointIndex]
            const candidatePoint = candidateRoute.route[pointIndex]
            if (!originalPoint || !candidatePoint) continue
            const x =
              guardedAnchor.x + (originalPoint.x - originalAnchor.x) * scale
            const y =
              guardedAnchor.y + (originalPoint.y - originalAnchor.y) * scale
            if (
              x <= bounds.minX ||
              x >= bounds.maxX ||
              y <= bounds.minY ||
              y >= bounds.maxY
            ) {
              insideBounds = false
              break
            }
            candidatePoint.x = x
            candidatePoint.y = y
          }
          if (!insideBounds) continue
          candidateRoute.vias = deriveVias(candidateRoute)
          let evaluatedRoutes = candidateRoutes
          let candidateViolationPairs =
            getRoutePairClearanceViolations(evaluatedRoutes)
          const closureRouteIndexes = new Set<number>()
          for (const [
            leftRouteIndex,
            rightRouteIndex,
          ] of candidateViolationPairs) {
            if (
              includesRoutePair(baselineViolationPairs, [
                leftRouteIndex,
                rightRouteIndex,
              ])
            ) {
              continue
            }
            if (
              leftRouteIndex === movableRouteIndex &&
              rightRouteIndex !== movableRouteIndex
            ) {
              closureRouteIndexes.add(rightRouteIndex)
            } else if (
              rightRouteIndex === movableRouteIndex &&
              leftRouteIndex !== movableRouteIndex
            ) {
              closureRouteIndexes.add(leftRouteIndex)
            }
          }
          if (closureRouteIndexes.size > 0) {
            const projectedRoutes = applySelectedRouteSegmentClearance(
              node,
              structuredClone(candidateRoutes),
              closureRouteIndexes,
            )
            const projectedViolationPairs =
              getRoutePairClearanceViolations(projectedRoutes)
            const projectedPreservesProtectedClearance =
              protectedRoutePairs.every(
                (pair) => !includesRoutePair(projectedViolationPairs, pair),
              )
            if (
              projectedPreservesProtectedClearance &&
              projectedViolationPairs.length < candidateViolationPairs.length
            ) {
              evaluatedRoutes = projectedRoutes
              candidateViolationPairs = projectedViolationPairs
            }
          }
          const preservesProtectedClearance = protectedRoutePairs.every(
            (pair) => !includesRoutePair(candidateViolationPairs, pair),
          )
          if (
            preservesProtectedClearance &&
            candidateViolationPairs.length < baselineViolationPairs.length
          ) {
            return evaluatedRoutes
          }
        }
      }
    }
  }

  return undefined
}

export const preconditionRoutesForNewCrossings = (
  params: {
    routes: HighDensityRoute[]
    node: NodeWithPortPoints
    selectors: SegmentPairSelector[]
  },
  distributeProjectionSegmentMove: DistributeProjectionSegmentMove,
) => {
  const { routes, node, selectors } = params
  const preconditionedRoutes = structuredClone(routes)
  const originalSegments = collectProjectionSegments(routes)
  const originalSegmentIndex = indexProjectionSegments(originalSegments)
  const barriers = selectors.flatMap((selector) => {
    const left =
      originalSegmentIndex[selector.leftRouteIndex]?.[
        selector.leftStartPointIndex
      ]
    const right =
      originalSegmentIndex[selector.rightRouteIndex]?.[
        selector.rightStartPointIndex
      ]
    if (!left || !right) return []
    const [candidate] = getProjectionSegmentDistanceCandidates(left, right)
    if (!candidate) return []
    const separationX = candidate.leftPoint.x - candidate.rightPoint.x
    const separationY = candidate.leftPoint.y - candidate.rightPoint.y
    const distance = Math.hypot(separationX, separationY)
    if (distance <= POSITION_EPSILON) return []
    return [
      {
        selector,
        directionX: separationX / distance,
        directionY: separationY / distance,
        requiredDistance:
          left.traceRadius + right.traceRadius + CLEARANCE_SLACK,
      },
    ]
  })

  for (let pass = 0; pass < 3; pass += 1) {
    const currentSegments = collectProjectionSegments(preconditionedRoutes)
    const currentSegmentIndex = indexProjectionSegments(currentSegments)
    for (const barrier of barriers) {
      const left =
        currentSegmentIndex[barrier.selector.leftRouteIndex]?.[
          barrier.selector.leftStartPointIndex
        ]
      const right =
        currentSegmentIndex[barrier.selector.rightRouteIndex]?.[
          barrier.selector.rightStartPointIndex
        ]
      if (!left || !right) continue
      const [candidate] = getProjectionSegmentDistanceCandidates(left, right)
      if (!candidate) continue
      const signedDistance =
        (candidate.leftPoint.x - candidate.rightPoint.x) * barrier.directionX +
        (candidate.leftPoint.y - candidate.rightPoint.y) * barrier.directionY
      const penetration = barrier.requiredDistance - signedDistance
      if (penetration <= 0) continue
      const move = Math.min(MAX_TRACE_MOVE_PER_PASS, penetration / 2)
      distributeProjectionSegmentMove({
        routes: preconditionedRoutes,
        segment: left,
        dx: barrier.directionX * move,
        dy: barrier.directionY * move,
        node,
        t: candidate.leftT,
      })
      distributeProjectionSegmentMove({
        routes: preconditionedRoutes,
        segment: right,
        dx: -barrier.directionX * move,
        dy: -barrier.directionY * move,
        node,
        t: candidate.rightT,
      })
    }
  }

  for (const route of preconditionedRoutes) route.vias = deriveVias(route)
  return preconditionedRoutes
}
