import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"
import { collectProjectionSegments } from "../lib/utils/force-improve-segment-helpers"
import { getCoincidentPointIndexes } from "../lib/utils/force-improve-route-helpers"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("a short wire beside a via remains distinct from the layer transition", () => {
  const route: HighDensityRoute = {
    connectionName: "signal",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 0.2, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 1.0005, y: 0, z: 1 },
      { x: 1.5, y: 0.3, z: 1 },
      { x: 2, y: 0.3, z: 1 },
    ],
    vias: [{ x: 1, y: 0 }],
  }
  expect(collectProjectionSegments([route])).toHaveLength(5)
  expect(getCoincidentPointIndexes(route.route, 3).sort()).toEqual([2, 3])
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [
      {
        capacityMeshNodeId: "node",
        center: { x: 1, y: 0 },
        width: 3,
        height: 2,
        portPoints: [],
      },
    ],
    hdRoutes: [route],
  })
  solver.solve()
  const output = solver.getOutput()[0]!
  expect(output.route[2]!.x).toBe(output.route[3]!.x)
  expect(output.route[2]!.y).toBe(output.route[3]!.y)
  expect(output.route[4]!).not.toEqual(output.route[3]!)
})
