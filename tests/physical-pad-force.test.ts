import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("coupled force preserves an incoming small wire-to-pad gap and terminals", (): void => {
  const routes: HighDensityRoute[] = [-0.895, -0.71].map(
    (y, index): HighDensityRoute => ({
      connectionName: `wire_${index}`,
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [-0.8, -0.5, -0.2, 0.2, 0.5, 0.8].map(
        (x): HighDensityRoute["route"][number] => ({ x, y, z: 0 }),
      ),
    }),
  )
  const original = structuredClone(routes)
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [
      {
        capacityMeshNodeId: "region",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        portPoints: [],
      },
    ],
    hdRoutes: routes,
    obstacleContext: {
      traceClearance: 0.1,
      obstacles: [
        {
          type: "rect",
          center: { x: 0, y: -1.5 },
          width: 2,
          height: 1,
          zLayers: [0],
          connectedTo: ["pad"],
        },
      ],
    },
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const result = solver.getOutput()
  for (const [routeIndex, route] of result.entries()) {
    for (const point of route.route) {
      expect(point.y + 1 - route.traceThickness / 2).toBeGreaterThanOrEqual(
        0.03 - 1e-9,
      )
    }
    for (const pointIndex of [0, 1, 4, 5]) {
      expect(route.route[pointIndex]).toEqual(
        original[routeIndex]!.route[pointIndex],
      )
    }
  }
  expect(routes).toEqual(original)
})
