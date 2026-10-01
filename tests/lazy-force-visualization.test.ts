import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"

const node: NodeWithPortPoints = {
  capacityMeshNodeId: "cmn1",
  center: { x: 0, y: 0 },
  width: 4,
  height: 4,
  portPoints: [
    { x: -2, y: 0, z: 0, connectionName: "trace1" },
    { x: 2, y: 0, z: 0, connectionName: "trace1" },
  ],
}

const route: HighDensityRoute = {
  connectionName: "trace1",
  regionId: "cmn1",
  traceThickness: 0.15,
  viaDiameter: 0.3,
  route: [
    { x: -2, y: 0, z: 0 },
    { x: -1, y: 0.5, z: 0 },
    { x: 1, y: -0.5, z: 0 },
    { x: 2, y: 0, z: 0 },
  ],
  vias: [],
}

test("collects force vectors only when incremental visualization requests them", () => {
  const defaultSolver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [node],
    hdRoutes: [route],
    totalStepsPerNode: 20,
  })
  const visualSolver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [node],
    hdRoutes: [route],
    totalStepsPerNode: 20,
    includeForceVectorsInVisualization: true,
  })

  defaultSolver.solve()
  visualSolver.solve()

  expect(defaultSolver.latestResult?.forceVectors).toEqual([])
  expect(visualSolver.latestResult?.forceVectors.length).toBeGreaterThan(0)
  expect(defaultSolver.getOutput()).toEqual(visualSolver.getOutput())
})
