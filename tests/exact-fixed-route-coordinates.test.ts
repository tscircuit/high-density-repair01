import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../lib/types/high-density-types"

test("force improvement preserves exact protected points and terminal vias", (): void => {
  const inputRoute: HighDensityRoute = {
    connectionName: "signal",
    traceThickness: 0.15,
    viaDiameter: 0.3,
    route: [
      { x: -2.0003, y: 0.123456, z: 0 },
      { x: -2.0003, y: 0.123456, z: 1 },
      { x: -1.75, y: 0.123456, z: 1 },
      { x: 0, y: 0.8, z: 1 },
      { x: 1.7503, y: -0.123456, z: 1 },
      { x: 2.0003, y: -0.123456, z: 1 },
    ],
    vias: [{ x: -2.0003, y: 0.123456 }],
  }
  const originalRoute: HighDensityRoute = structuredClone(inputRoute)
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "exact-fixed-coordinates",
    center: { x: 0, y: 0 },
    width: 6,
    height: 4,
    availableZ: [0, 1],
    portPoints: [inputRoute.route[0]!, inputRoute.route.at(-1)!].map(
      (point) => ({ ...point, connectionName: "signal" }),
    ),
  }
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [nodeWithPortPoints],
    hdRoutes: [inputRoute],
  })
  solver.solve()
  expect(solver.solved).toBeTrue()
  expect(solver.failed).toBeFalse()
  const output: HighDensityRoute = solver.getOutput()[0]!
  for (const index of [0, 1, 4, 5]) {
    expect(output.route[index]).toEqual(originalRoute.route[index])
  }
  expect(output.vias).toEqual(originalRoute.vias)
  expect(inputRoute).toEqual(originalRoute)
})
