import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import {
  HighDensityForceImproveSolver,
  runForceDirectedImprovement,
} from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"
import { getProjectionSegmentDistanceCandidates } from "lib/utils/force-improve-segment-helpers"

type SolverFixture = {
  nodeWithPortPoints: NodeWithPortPoints[]
  hdRoutes: HighDensityRoute[]
  totalStepsPerNode: number
  nodeAssignmentMargin: number
}

const INTERSECTION_EPSILON = 1e-6

const getMinimumRouteDistance = (
  left: HighDensityRoute,
  right: HighDensityRoute,
): number => {
  let minimumDistance = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < left.route.length - 1; leftIndex += 1) {
    const leftStart = left.route[leftIndex]
    const leftEnd = left.route[leftIndex + 1]
    if (!leftStart || !leftEnd || leftStart.z !== leftEnd.z) continue

    for (
      let rightIndex = 0;
      rightIndex < right.route.length - 1;
      rightIndex += 1
    ) {
      const rightStart = right.route[rightIndex]
      const rightEnd = right.route[rightIndex + 1]
      if (
        !rightStart ||
        !rightEnd ||
        rightStart.z !== rightEnd.z ||
        leftStart.z !== rightStart.z
      ) {
        continue
      }
      const [candidate] = getProjectionSegmentDistanceCandidates(
        { start: leftStart, end: leftEnd },
        { start: rightStart, end: rightEnd },
      )
      if (!candidate) continue
      minimumDistance = Math.min(
        minimumDistance,
        Math.hypot(
          candidate.leftPoint.x - candidate.rightPoint.x,
          candidate.leftPoint.y - candidate.rightPoint.y,
        ),
      )
    }
  }
  return minimumDistance
}

const getTargetRoutes = (routes: HighDensityRoute[]) => {
  const left = routes.find(
    (route) => route.connectionName === "source_trace_108",
  )
  const right = routes.find(
    (route) => route.connectionName === "source_trace_138",
  )
  if (!left || !right) throw new Error("Missing Bug 94 target routes")
  return { left, right }
}

test("force improvement preserves Bug 94 trace ordering", async () => {
  const fixturePath = fileURLToPath(
    new URL("./fixtures/bugreport94-force-input.json", import.meta.url),
  )
  const fixture = (await Bun.file(fixturePath).json()) as SolverFixture
  const node = fixture.nodeWithPortPoints[0]
  if (!node) throw new Error("Missing Bug 94 capacity node")
  const bounds = {
    minX: node.center.x - node.width / 2,
    maxX: node.center.x + node.width / 2,
    minY: node.center.y - node.height / 2,
    maxY: node.center.y + node.height / 2,
  }

  const baseline = runForceDirectedImprovement(
    bounds,
    fixture.hdRoutes,
    fixture.totalStepsPerNode,
    { includeForceVectors: false },
  )
  const baselineTarget = getTargetRoutes(baseline.routes)
  expect(
    getMinimumRouteDistance(baselineTarget.left, baselineTarget.right),
  ).toBeLessThanOrEqual(INTERSECTION_EPSILON)

  const solver = new HighDensityForceImproveSolver(fixture)
  solver.solve()
  const guardedTarget = getTargetRoutes(solver.getOutput())
  const requiredDistance =
    (guardedTarget.left.traceThickness + guardedTarget.right.traceThickness) / 2
  expect(
    getMinimumRouteDistance(guardedTarget.left, guardedTarget.right),
  ).toBeGreaterThanOrEqual(requiredDistance)
}, 30_000)
