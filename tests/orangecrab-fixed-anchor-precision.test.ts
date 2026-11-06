import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "lib/types/high-density-types"

test("preserves exact OrangeCrab topology anchors without grid rounding", (): void => {
  // Actual RAS# boundary points from topology_merge_11762. Rounding the right
  // anchor's y to 1.080 reduces its A11 pad clearance from .089000 to .088793.
  const route: HighDensityRoute = {
    connectionName: "source_trace_44",
    rootConnectionName: "source_trace_44",
    regionId: "topology_merge_11762",
    traceThickness: 0.0889,
    viaDiameter: 0.28,
    route: [
      { x: 5.154999999999991, y: 1.0499989999999926, z: 0 },
      { x: 5.424999999999991, y: 1.0797663787355591, z: 0 },
    ],
    vias: [],
  }
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [
      {
        capacityMeshNodeId: "topology_merge_11762",
        center: { x: 5.289999999999991, y: 1.0499989999999926 },
        width: 0.2699999999999996,
        height: 0.2699999999999838,
        availableZ: [0],
        portPoints: route.route.map((point) => ({
          ...point,
          connectionName: route.connectionName,
          rootConnectionName: route.rootConnectionName,
        })),
      },
    ],
    hdRoutes: [route],
    totalStepsPerNode: 20,
    nodeAssignmentMargin: 0.2,
    preserveTopologyPortAnchors: true,
  })
  const original = structuredClone(route)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()[0]!.route).toEqual(original.route)
  expect(route).toEqual(original)
})
