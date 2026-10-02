import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"

test("improves multiple routing regions per solver step", () => {
  const nodeWithPortPoints: NodeWithPortPoints[] = Array.from(
    { length: 12 },
    (_, nodeIndex) => ({
      capacityMeshNodeId: `node${nodeIndex}`,
      center: { x: nodeIndex * 5, y: 0 },
      width: 4,
      height: 4,
      portPoints: [
        {
          x: nodeIndex * 5 - 2,
          y: 0,
          z: 0,
          connectionName: `trace${nodeIndex}`,
        },
        {
          x: nodeIndex * 5 + 2,
          y: 0,
          z: 0,
          connectionName: `trace${nodeIndex}`,
        },
      ],
    }),
  )
  const hdRoutes: HighDensityRoute[] = nodeWithPortPoints.map(
    (node, nodeIndex) => ({
      connectionName: `trace${nodeIndex}`,
      regionId: node.capacityMeshNodeId,
      traceThickness: 0.15,
      viaDiameter: 0.3,
      route: [
        { x: node.center.x - 2, y: 0, z: 0 },
        { x: node.center.x, y: 0.5, z: 0 },
        { x: node.center.x, y: -0.5, z: 0 },
        { x: node.center.x + 2, y: 0, z: 0 },
      ],
      vias: [],
    }),
  )
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints,
    hdRoutes,
    totalStepsPerNode: 1,
  })

  solver.step()
  expect(solver.activeSampleIndex).toBe(10)
  expect(solver.solved).toBeFalse()

  solver.step()
  expect(solver.solved).toBeTrue()
  expect(solver.getOutput()).toHaveLength(12)
})
