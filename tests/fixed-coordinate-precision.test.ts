import { expect, test } from "bun:test"
import { runForceDirectedImprovement } from "../lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("force improvement retains exact fixed endpoints between routing nodes", (): void => {
  const route: HighDensityRoute = {
    connectionName: "signal",
    traceThickness: 0.1,
    viaDiameter: 0.35,
    route: [
      { x: 0.1234567, y: 0.2345678, z: 0 },
      { x: 0.8234567, y: 0.2345678, z: 0 },
      { x: 1.1234567, y: 0.5345678, z: 0 },
      { x: 1.8234567, y: 0.5345678, z: 0 },
    ],
    vias: [],
  }
  const original = structuredClone(route)
  const { routes } = runForceDirectedImprovement(
    { minX: -1, maxX: 3, minY: -1, maxY: 2 },
    [route],
    20,
    { fixedPortPoints: [route.route[0]!, route.route.at(-1)!] },
  )
  expect(routes[0]!.route[0]).toEqual(original.route[0])
  expect(routes[0]!.route.at(-1)).toEqual(original.route.at(-1))
  expect(routes[0]!.vias).toEqual([])
  expect(route).toEqual(original)
})
