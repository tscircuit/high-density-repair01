import { expect, test } from "bun:test"
import {
  HighDensityForceImproveSolver,
  runForceDirectedImprovement,
} from "../lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../lib/types/high-density-types"

test("force improvement retains exact plated-hole boundary coordinates", (): void => {
  // Actual SRJ18/16 edge: rounding -8.336115 to -8.336 leaves the pad.
  const barrel: HighDensityRoute = {
    connectionName: "source_trace_0__source_net_0_mst17",
    rootConnectionName: "source_trace_0",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      {
        x: -8.861115,
        y: 20.80968,
        z: 0,
        toNextSegmentType: "through_obstacle",
      },
      { x: -8.336115, y: 20.623179999999998, z: 3 },
    ],
    vias: [],
  }
  const original = structuredClone(barrel)
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "pad-edge",
    center: { x: -8.6, y: 20.5 },
    width: 4,
    height: 4,
    availableZ: [0, 1, 2, 3],
    portPoints: [],
  }
  const result = runForceDirectedImprovement(
    { minX: -10.6, maxX: -6.6, minY: 18.5, maxY: 22.5 },
    [barrel],
    4,
  )
  expect(result.routes[0]!.route).toEqual(original.route)
  expect(result.routes[0]!.vias).toEqual([])

  for (const totalStepsPerNode of [0, 4]) {
    const solver = new HighDensityForceImproveSolver({
      nodeWithPortPoints: [node],
      hdRoutes: [barrel],
      totalStepsPerNode,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.getOutput()[0]!.route).toEqual(original.route)
    expect(solver.getOutput()[0]!.vias).toEqual([])
  }
  expect(barrel).toEqual(original)
})
