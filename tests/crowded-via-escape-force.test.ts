import { expect, test } from "bun:test"
import {
  HighDensityForceImproveSolver,
  runForceDirectedImprovement,
} from "../lib/HighDensityForceImproveSolver"
import fixture from "./fixtures/crowded-via-escape-force-input.json"
import { collectProjectionSegments } from "../lib/utils/force-improve-segment-helpers"
import type { HighDensityRoute } from "../lib/types/high-density-types"

const cross = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const countCrossings = (routes: HighDensityRoute[]): number => {
  const segments = collectProjectionSegments(routes)
  let crossings = 0
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!
      if (a.z !== b.z || a.rootConnectionName === b.rootConnectionName) continue
      if (
        cross(a.start, a.end, b.start) * cross(a.start, a.end, b.end) < 0 &&
        cross(b.start, b.end, a.start) * cross(b.start, b.end, a.end) < 0
      )
        crossings++
    }
  }
  return crossings
}

test("force and projection preserve crowded via escape ordering", () => {
  const { node, routes } = fixture
  const bounds = {
    minX: node.center.x - node.width / 2,
    maxX: node.center.x + node.width / 2,
    minY: node.center.y - node.height / 2,
    maxY: node.center.y + node.height / 2,
  }
  expect(countCrossings(routes)).toBe(0)
  const forced = runForceDirectedImprovement(bounds, routes, 20)
  expect(countCrossings(forced.routes)).toBe(0)
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [node],
    hdRoutes: routes,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(countCrossings(solver.getOutput())).toBe(0)
  for (let i = 0; i < routes.length; i++) {
    for (const endpoint of [0, routes[i]!.route.length - 1]) {
      const expected = routes[i]!.route[endpoint]!
      const actual = solver.getOutput()[i]!.route[endpoint]!
      expect(actual.z).toBe(expected.z)
      expect(actual.x).toBeCloseTo(expected.x, 12)
      expect(actual.y).toBeCloseTo(expected.y, 12)
    }
  }
})
