import type { HighDensityRoute } from "../types/high-density-types"
import {
  areSameXY,
  getRouteRootConnectionName,
} from "./force-improve-route-helpers"

type Vector = {
  x: number
  y: number
}

type SegmentGeometry = {
  start: Vector
  end: Vector
}

export type ProjectionSegment = SegmentGeometry & {
  routeIndex: number
  rootConnectionName: string
  startIndex: number
  endIndex: number
  z: number
  traceRadius: number
}

type SegmentDistanceCandidate = {
  leftT: number
  rightT: number
  leftPoint: Vector
  rightPoint: Vector
}

const clampUnitInterval = (value: number) => Math.max(0, Math.min(value, 1))

const subtractVector = (left: Vector, right: Vector): Vector => ({
  x: left.x - right.x,
  y: left.y - right.y,
})

const dotVector = (left: Vector, right: Vector) =>
  left.x * right.x + left.y * right.y

const lerpVector = (start: Vector, end: Vector, t: number): Vector => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
})

export const collectProjectionSegments = (
  routes: HighDensityRoute[],
): ProjectionSegment[] => {
  const segments: ProjectionSegment[] = []

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex]
    if (!route) continue

    for (let index = 0; index < route.route.length - 1; index += 1) {
      const start = route.route[index]
      const end = route.route[index + 1]
      if (!start || !end) continue
      if (start.z !== end.z || areSameXY(start, end)) continue

      segments.push({
        routeIndex,
        rootConnectionName: getRouteRootConnectionName(route),
        startIndex: index,
        endIndex: index + 1,
        start,
        end,
        z: start.z,
        traceRadius: (route.traceThickness ?? 0.1) / 2,
      })
    }
  }

  return segments
}

export const pointToProjectionSegment = (
  point: Vector,
  segment: SegmentGeometry,
  positionEpsilon = 1e-6,
) => {
  const segmentX = segment.end.x - segment.start.x
  const segmentY = segment.end.y - segment.start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY

  if (lengthSquared <= positionEpsilon) {
    return { x: segment.start.x, y: segment.start.y, t: 0 }
  }

  const rawT =
    ((point.x - segment.start.x) * segmentX +
      (point.y - segment.start.y) * segmentY) /
    lengthSquared
  const t = clampUnitInterval(rawT)

  return {
    x: segment.start.x + segmentX * t,
    y: segment.start.y + segmentY * t,
    t,
  }
}

export const getProjectionSegmentDistanceCandidates = (
  left: SegmentGeometry,
  right: SegmentGeometry,
  positionEpsilon = 1e-6,
): SegmentDistanceCandidate[] => {
  const leftVector = subtractVector(left.end, left.start)
  const rightVector = subtractVector(right.end, right.start)
  const startOffset = subtractVector(left.start, right.start)

  const a = dotVector(leftVector, leftVector)
  const b = dotVector(leftVector, rightVector)
  const c = dotVector(rightVector, rightVector)
  const d = dotVector(leftVector, startOffset)
  const e = dotVector(rightVector, startOffset)
  const denominator = a * c - b * b
  const tiny = positionEpsilon

  let leftNumerator: number
  let leftDenominator = denominator
  let rightNumerator: number
  let rightDenominator = denominator

  if (denominator <= tiny) {
    leftNumerator = 0
    leftDenominator = 1
    rightNumerator = e
    rightDenominator = c
  } else {
    leftNumerator = b * e - c * d
    rightNumerator = a * e - b * d

    if (leftNumerator < 0) {
      leftNumerator = 0
      rightNumerator = e
      rightDenominator = c
    } else if (leftNumerator > leftDenominator) {
      leftNumerator = leftDenominator
      rightNumerator = e + b
      rightDenominator = c
    }
  }

  if (rightNumerator < 0) {
    rightNumerator = 0
    if (-d < 0) {
      leftNumerator = 0
    } else if (-d > a) {
      leftNumerator = leftDenominator
    } else {
      leftNumerator = -d
      leftDenominator = a
    }
  } else if (rightNumerator > rightDenominator) {
    rightNumerator = rightDenominator
    if (-d + b < 0) {
      leftNumerator = 0
    } else if (-d + b > a) {
      leftNumerator = leftDenominator
    } else {
      leftNumerator = -d + b
      leftDenominator = a
    }
  }

  const closestLeftT =
    Math.abs(leftNumerator) <= tiny ? 0 : leftNumerator / leftDenominator
  const closestRightT =
    Math.abs(rightNumerator) <= tiny ? 0 : rightNumerator / rightDenominator
  const closestLeftPoint = lerpVector(left.start, left.end, closestLeftT)
  const closestRightPoint = lerpVector(right.start, right.end, closestRightT)

  const leftStartProjection = pointToProjectionSegment(
    left.start,
    right,
    positionEpsilon,
  )
  const leftEndProjection = pointToProjectionSegment(
    left.end,
    right,
    positionEpsilon,
  )
  const rightStartProjection = pointToProjectionSegment(
    right.start,
    left,
    positionEpsilon,
  )
  const rightEndProjection = pointToProjectionSegment(
    right.end,
    left,
    positionEpsilon,
  )

  return [
    {
      leftT: closestLeftT,
      rightT: closestRightT,
      leftPoint: closestLeftPoint,
      rightPoint: closestRightPoint,
    },
    {
      leftT: 0,
      rightT: leftStartProjection.t,
      leftPoint: left.start,
      rightPoint: leftStartProjection,
    },
    {
      leftT: 1,
      rightT: leftEndProjection.t,
      leftPoint: left.end,
      rightPoint: leftEndProjection,
    },
    {
      leftT: rightStartProjection.t,
      rightT: 0,
      leftPoint: rightStartProjection,
      rightPoint: right.start,
    },
    {
      leftT: rightEndProjection.t,
      rightT: 1,
      leftPoint: rightEndProjection,
      rightPoint: right.end,
    },
  ].sort((a, b) => {
    const aDistance = Math.hypot(
      a.leftPoint.x - a.rightPoint.x,
      a.leftPoint.y - a.rightPoint.y,
    )
    const bDistance = Math.hypot(
      b.leftPoint.x - b.rightPoint.x,
      b.leftPoint.y - b.rightPoint.y,
    )
    return aDistance - bDistance
  })
}
