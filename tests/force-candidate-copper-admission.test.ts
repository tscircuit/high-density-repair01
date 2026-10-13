import { expect, test } from "bun:test"
import {
  HighDensityForceImproveSolver,
  type ForceImproveCandidateSolutionValidator,
} from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"
import {
  collectProjectionSegments,
  getProjectionSegmentDistanceCandidates,
  pointToProjectionSegment,
} from "lib/utils/force-improve-segment-helpers"
import fixtureJson from "./fixtures/bugreport94-foreign-copper-force-input.json"

type RecordedFixture = {
  nodeWithPortPoints: NodeWithPortPoints[]
  hdRoutes: HighDensityRoute[]
  totalStepsPerNode: number
  nodeAssignmentMargin: number
  recordedCandidateRoutes: HighDensityRoute[]
}

// This fixture has two-layer through vias, so each barrel reaches both layers.
const getMinimumCopperGap = (
  left: HighDensityRoute,
  right: HighDensityRoute,
): number => {
  const leftSegments = collectProjectionSegments([left])
  const rightSegments = collectProjectionSegments([right])
  let gap = Number.POSITIVE_INFINITY
  for (const leftSegment of leftSegments) {
    for (const rightSegment of rightSegments) {
      if (leftSegment.z !== rightSegment.z) continue
      const [distance] = getProjectionSegmentDistanceCandidates(
        leftSegment,
        rightSegment,
        1e-12,
      )
      if (!distance) throw new Error("Missing segment distance")
      gap = Math.min(
        gap,
        Math.hypot(
          distance.leftPoint.x - distance.rightPoint.x,
          distance.leftPoint.y - distance.rightPoint.y,
        ) -
          leftSegment.traceRadius -
          rightSegment.traceRadius,
      )
    }
    for (const via of right.vias) {
      const projection = pointToProjectionSegment(via, leftSegment, 1e-12)
      gap = Math.min(
        gap,
        Math.hypot(via.x - projection.x, via.y - projection.y) -
          right.viaDiameter / 2 -
          leftSegment.traceRadius,
      )
    }
  }
  for (const rightSegment of rightSegments) {
    for (const via of left.vias) {
      const projection = pointToProjectionSegment(via, rightSegment, 1e-12)
      gap = Math.min(
        gap,
        Math.hypot(via.x - projection.x, via.y - projection.y) -
          left.viaDiameter / 2 -
          rightSegment.traceRadius,
      )
    }
  }
  for (const leftVia of left.vias) {
    for (const rightVia of right.vias) {
      gap = Math.min(
        gap,
        Math.hypot(leftVia.x - rightVia.x, leftVia.y - rightVia.y) -
          left.viaDiameter / 2 -
          right.viaDiameter / 2,
      )
    }
  }
  return gap
}

test(
  "force admission rejects a recorded copper overlap before publication",
  (): void => {
    const fixture = structuredClone(fixtureJson) as RecordedFixture
    const inputBefore = structuredClone(fixture.hdRoutes)
    const expectedOutput = [
      fixture.hdRoutes[0],
      ...fixture.recordedCandidateRoutes,
    ]
    const defaultSolver = new HighDensityForceImproveSolver(fixture)
    defaultSolver.solve()
    expect(defaultSolver.solved).toBe(true)
    expect(defaultSolver.sampleEntries.length).toBe(1)
    expect(defaultSolver.sampleEntries[0]?.routeIndexes).toEqual([1, 2])
    expect(defaultSolver.getOutput()).toEqual(expectedOutput)
    expect(
      getMinimumCopperGap(inputBefore[1]!, inputBefore[2]!),
    ).toBeGreaterThan(0)
    expect(
      getMinimumCopperGap(expectedOutput[1]!, expectedOutput[2]!),
    ).toBeLessThan(0)

    const disabledSolver = new HighDensityForceImproveSolver({
      ...fixture,
      candidateSolutionValidator: false,
    })
    disabledSolver.solve()
    expect(disabledSolver.getOutput()).toEqual(defaultSolver.getOutput())
    expect(disabledSolver.getConstructorParams()).toEqual(
      defaultSolver.getConstructorParams(),
    )

    let callbackCount = 0
    const rejectNewOrWorseOverlap: ForceImproveCandidateSolutionValidator = (
      candidate,
    ): boolean => {
      callbackCount += 1
      expect(candidate.node).toBe(fixture.nodeWithPortPoints[0])
      expect(candidate.routeIndexes).toEqual([1, 2])
      expect(candidate.originalRoutes).toEqual(inputBefore.slice(1))
      expect(candidate.candidateRoutes).toEqual(fixture.recordedCandidateRoutes)
      expect(candidate.currentHdRoutes).toEqual(inputBefore)
      expect(guardedSolver.improvedRoutesByIndex.size).toBe(0)
      return (
        getMinimumCopperGap(
          candidate.candidateRoutes[0]!,
          candidate.candidateRoutes[1]!,
        ) >=
        Math.min(
          0,
          getMinimumCopperGap(
            candidate.originalRoutes[0]!,
            candidate.originalRoutes[1]!,
          ),
        )
      )
    }
    const guardedSolver = new HighDensityForceImproveSolver({
      ...fixture,
      candidateSolutionValidator: rejectNewOrWorseOverlap,
    })
    guardedSolver.solve()
    expect(callbackCount).toBe(1)
    expect(guardedSolver.solved).toBe(true)
    expect(guardedSolver.failed).toBe(false)
    expect(guardedSolver.improvedRoutesByIndex.size).toBe(0)
    expect(guardedSolver.getOutput()).toEqual(inputBefore)
    expect(guardedSolver.stats.rejectedCandidateCount).toBe(1)
    expect(guardedSolver.stats.improvedRouteCount).toBe(0)

    const acceptedSolver = new HighDensityForceImproveSolver({
      ...fixture,
      candidateSolutionValidator: (): boolean => true,
    })
    acceptedSolver.solve()
    expect(acceptedSolver.getOutput()).toEqual(defaultSolver.getOutput())
    expect(acceptedSolver.stats.rejectedCandidateCount).toBe(0)

    const throwingSolver = new HighDensityForceImproveSolver({
      ...fixture,
      candidateSolutionValidator: (): boolean => {
        throw new Error("Recorded caller invariant failed")
      },
    })
    expect((): void => throwingSolver.step()).toThrow(
      "Recorded caller invariant failed",
    )
    expect(throwingSolver.solved).toBe(false)
    expect(throwingSolver.improvedRoutesByIndex.size).toBe(0)
    expect(throwingSolver.getOutput()).toEqual(inputBefore)
    expect(fixture.hdRoutes).toEqual(inputBefore)
  },
)
