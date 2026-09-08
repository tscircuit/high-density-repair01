import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"
import fixture from "./fixtures/via-annulus-force-input.json"
import {
  collectProjectionSegments,
  pointToProjectionSegment,
} from "../lib/utils/force-improve-segment-helpers"

test("native force and projection do not trade a via contact for new foreign clearance violations", () => {
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [fixture.node],
    hdRoutes: fixture.routes,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  const originalSegments = collectProjectionSegments(fixture.routes)
  const segments = collectProjectionSegments(output)
  for (let i = 0; i < output.length; i++) {
    const before = fixture.routes[i]!,
      after = output[i]!
    expect(after.vias.length).toBe(before.vias.length)
    for (const index of [0, before.route.length - 1]) {
      expect(after.route[index]!.z).toBe(before.route[index]!.z)
      expect(after.route[index]!.x).toBeCloseTo(before.route[index]!.x, 12)
      expect(after.route[index]!.y).toBeCloseTo(before.route[index]!.y, 12)
    }
    for (let vi = 0; vi < after.vias.length; vi++) {
      for (let j = 0; j < output.length; j++) {
        if (i === j) continue
        const gap = (
          via: { x: number; y: number },
          list: typeof segments,
        ): number =>
          Math.min(
            ...list
              .filter((segment) => segment.routeIndex === j)
              .map((segment) => {
                const closest = pointToProjectionSegment(via, segment)
                return (
                  Math.hypot(via.x - closest.x, via.y - closest.y) -
                  after.viaDiameter / 2 -
                  segment.traceRadius
                )
              }),
          )
        expect(gap(after.vias[vi]!, segments)).toBeGreaterThanOrEqual(
          Math.min(0.1, gap(before.vias[vi]!, originalSegments)) - 1e-5,
        )
      }
    }
  }
})
