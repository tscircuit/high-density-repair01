import { expect, test } from "bun:test"
import {
  HighDensityForceImproveSolver,
  runForceDirectedImprovement,
} from "../lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../lib/types/high-density-types"

test("force and projection keep interior barrel endpoints fixed under repulsion", (): void => {
  const barrel: HighDensityRoute = {
    connectionName: "barrel",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: -4, y: 0, z: 0 },
      { x: -3.5, y: 0, z: 0 },
      { x: -2, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      {
        x: 0.000115,
        y: 0.00068,
        z: 0,
        toNextSegmentType: "through_obstacle",
      },
      { x: 0.525115, y: -0.18632, z: 3 },
      { x: 1, y: 0, z: 3 },
      { x: 2, y: 0, z: 3 },
      { x: 3.5, y: 0, z: 3 },
      { x: 4, y: 0, z: 3 },
    ],
    vias: [],
  }
  const neighbor: HighDensityRoute = {
    connectionName: "neighbor",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [-4, -3.5, -2, -1, 0, 1, 2, 3.5, 4].map(
      (x): HighDensityRoute["route"][number] => ({ x, y: 0.05, z: 0 }),
    ),
    vias: [],
  }
  const original = structuredClone([barrel, neighbor])
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "interior-barrel",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    availableZ: [0, 1, 2, 3],
    portPoints: [],
  }
  const forced = runForceDirectedImprovement(
    { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    [barrel, neighbor],
    4,
  )
  expect(forced.routes[0]!.route.slice(4, 6)).toEqual(barrel.route.slice(4, 6))
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [node],
    hdRoutes: [barrel, neighbor],
    totalStepsPerNode: 4,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput()[0]!.route.slice(4, 6)).toEqual(
    barrel.route.slice(4, 6),
  )
  expect(solver.getOutput()[0]!.vias).toEqual([])
  expect([barrel, neighbor]).toEqual(original)
})
