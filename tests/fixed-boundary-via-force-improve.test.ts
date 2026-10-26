import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"

test("fixed boundary vias retain exact copper coordinates for every layer and pad diameter", () => {
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "fixed-boundary-via",
    center: { x: 12.3456789, y: 23.4567891 },
    width: 4,
    height: 5,
    portPoints: [],
    availableZ: Array.from({ length: 8 }, (_, layer) => layer),
  }
  const positions = [
    { x: node.center.x - node.width / 2, y: node.center.y + 0.1234567 },
    { x: node.center.x + node.width / 2, y: node.center.y + 0.1234567 },
    { x: node.center.x + 0.1234567, y: node.center.y - node.height / 2 },
    { x: node.center.x + 0.1234567, y: node.center.y + node.height / 2 },
  ]
  for (const viaDiameter of [0.2, 0.3, 0.7]) {
    for (let layer = 0; layer < 8; layer++) {
      for (const position of positions) {
        const route: HighDensityRoute = {
          connectionName: "anchored-barrel",
          rootConnectionName: "declared-owner",
          regionId: node.capacityMeshNodeId,
          traceThickness: 0.1,
          viaDiameter,
          route: [
            { ...position, z: layer },
            { ...position, z: (layer + 1) % 8 },
          ],
          vias: [{ ...position }],
        }
        const input = structuredClone(route)
        const solver = new HighDensityForceImproveSolver({
          nodeWithPortPoints: [
            {
              ...node,
              portPoints: route.route.map((point) => ({
                ...point,
                connectionName: route.connectionName,
              })),
            },
          ],
          hdRoutes: [route],
          totalStepsPerNode: 12,
        })
        solver.solve()
        expect(solver.solved).toBe(true)
        expect(solver.failed).toBe(false)
        expect(solver.getOutput()).toEqual([input])
        expect(route).toEqual(input)
      }
    }
  }
  const nearby: HighDensityRoute = {
    connectionName: "nearby-fixed-anchors",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: node.center.x, y: node.center.y, z: 3 },
      { x: node.center.x + 0.00001, y: node.center.y + 0.00002, z: 3 },
    ],
    vias: [],
  }
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [node],
    hdRoutes: [structuredClone(nearby)],
    totalStepsPerNode: 1,
  })
  solver.solve()
  expect(solver.getOutput()).toEqual([nearby])
})
