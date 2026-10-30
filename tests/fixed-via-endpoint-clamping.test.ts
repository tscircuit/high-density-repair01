import { expect, test } from "bun:test"
import { runForceDirectedImprovement } from "../lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("fixed via endpoints retain their exact positions in a narrow node", (): void => {
  const route: HighDensityRoute = {
    connectionName: "signal",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: -0.04, y: 0.001, z: 0 },
      { x: -0.04, y: 0.001, z: 0 },
      { x: -0.04, y: 0.001, z: 1 },
      { x: -0.04, y: 0.001, z: 1 },
    ],
    vias: [{ x: -0.04, y: 0.001 }],
  }
  const original = structuredClone(route)
  const result = runForceDirectedImprovement(
    { minX: -0.04, maxX: 0.04, minY: -0.04, maxY: 0.04 },
    [route],
    20,
  )
  expect(result.routes[0]!.route).toEqual(original.route)
  expect(result.routes[0]!.vias).toEqual(original.vias)
  expect(route).toEqual(original)
})
