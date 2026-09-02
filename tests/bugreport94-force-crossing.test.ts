import { expect, test } from "bun:test"
import { stackGraphicsHorizontally, type GraphicsObject } from "graphics-debug"
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
const REPRO_TRACE_COLORS: Record<string, string> = {
  source_trace_108: "#ef4444",
  source_trace_138: "#2563eb",
  source_trace_99: "#16a34a",
}

const createReproVisualization = (
  routes: HighDensityRoute[],
  node: NodeWithPortPoints,
): GraphicsObject => {
  const lines: NonNullable<GraphicsObject["lines"]> = []
  const circles: NonNullable<GraphicsObject["circles"]> = []

  for (const route of routes) {
    const rootConnectionName = route.rootConnectionName ?? route.connectionName
    const color = REPRO_TRACE_COLORS[rootConnectionName]
    if (!color) continue

    for (let index = 0; index < route.route.length - 1; index += 1) {
      const start = route.route[index]
      const end = route.route[index + 1]
      if (!start || !end || start.z !== end.z) continue
      lines.push({
        points: [start, end],
        strokeColor: color,
        strokeWidth: route.traceThickness,
        strokeDash: start.z === 0 ? undefined : [0.08, 0.08],
        label: rootConnectionName,
      })
    }

    for (const via of route.vias) {
      circles.push({
        center: via,
        radius: route.viaDiameter / 2,
        stroke: color,
        fill: "rgba(255,255,255,0.7)",
        label: rootConnectionName,
      })
    }
  }

  return {
    coordinateSystem: "cartesian",
    rects: [
      {
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "#94a3b8",
      },
    ],
    lines,
    circles,
  }
}

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

const getNeighborRoute = (routes: HighDensityRoute[]) => {
  const route = routes.find(
    (candidate) => candidate.connectionName === "source_trace_99",
  )
  if (!route) throw new Error("Missing Bug 94 neighboring route")
  return route
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
  const guardedNeighbor = getNeighborRoute(solver.getOutput())
  const requiredDistance =
    (guardedTarget.left.traceThickness + guardedTarget.right.traceThickness) / 2
  expect(
    getMinimumRouteDistance(guardedTarget.left, guardedTarget.right),
  ).toBeGreaterThanOrEqual(requiredDistance)
  expect(
    getMinimumRouteDistance(guardedTarget.left, guardedNeighbor),
  ).toBeGreaterThanOrEqual(
    (guardedTarget.left.traceThickness + guardedNeighbor.traceThickness) / 2,
  )

  const graphics = stackGraphicsHorizontally([
    createReproVisualization(baseline.routes, node),
    createReproVisualization(solver.getOutput(), node),
  ])
  const snapshotPath = fileURLToPath(
    new URL(
      "./__snapshots__/bugreport94-force-crossing.snap.svg",
      import.meta.url,
    ),
  )
  const snapshotSvg = await Bun.file(snapshotPath).text()
  const snapshotLineCount = snapshotSvg.match(/data-type="line"/g)?.length ?? 0

  // Force coordinates vary slightly across operating systems, so the numeric
  // assertions above own correctness while this verifies the visual artifact.
  expect(snapshotSvg).toContain("<svg")
  expect(snapshotLineCount).toBe(graphics.lines?.length ?? 0)
  expect(snapshotSvg.match(/data-type="rect"/g)?.length).toBe(2)
  for (const color of Object.values(REPRO_TRACE_COLORS)) {
    expect(snapshotSvg).toContain(`stroke="${color}"`)
  }
}, 30_000)
