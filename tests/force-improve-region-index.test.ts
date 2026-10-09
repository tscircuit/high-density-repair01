import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"

test("force improvement indexes route region ids once", () => {
  let capacityMeshNodeIdReadCount = 0
  const nodeWithPortPoints: NodeWithPortPoints[] = Array.from(
    { length: 50 },
    (_, nodeIndex) => ({
      get capacityMeshNodeId() {
        capacityMeshNodeIdReadCount += 1
        return `node-${nodeIndex}`
      },
      center: { x: nodeIndex, y: 0 },
      width: 1,
      height: 1,
      portPoints: [],
    }),
  )
  const hdRoutes: HighDensityRoute[] = nodeWithPortPoints.map(
    (_, nodeIndex) => ({
      connectionName: `connection-${nodeIndex}`,
      regionId: `node-${nodeIndex}`,
      traceThickness: 0.1,
      viaDiameter: 0.3,
      route: [{ x: nodeIndex, y: 0, z: 0 }],
      vias: [],
    }),
  )

  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints,
    hdRoutes,
  })

  expect(solver.sampleEntries).toHaveLength(50)
  expect(capacityMeshNodeIdReadCount).toBe(50)
})
