import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type { HighDensityRepair01Input } from "lib/types/types"
import bugreport52Sample from "./assets/HighDensityInput01.json"

const sample = bugreport52Sample as HighDensityRepair01Input

test("force improvement preserves same-layer duplicate terminal points", () => {
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [sample.nodeWithPortPoints],
    hdRoutes: sample.nodeHdRoutes,
    totalStepsPerNode: 40,
  })

  solver.solve()

  const [route] = solver.getOutput()
  expect(route).toBeDefined()
  expect(route!.vias).toHaveLength(0)
  expect(route!.route[0]).toMatchObject({ x: 18.825, y: 10, z: 0 })
  expect(route!.route[1]).toMatchObject({ x: 18.825, y: 10, z: 0 })
})

test("force improvement still preserves different-layer duplicate points as vias", () => {
  const solver = new HighDensityForceImproveSolver({
    nodeWithPortPoints: [
      {
        ...sample.nodeWithPortPoints,
        availableZ: [0, 1],
      },
    ],
    hdRoutes: [
      {
        ...sample.nodeHdRoutes[0]!,
        route: [
          { x: 18.825, y: 10, z: 0 },
          { x: 18.825, y: 10, z: 1 },
          { x: 19, y: 10.475, z: 1 },
        ],
      },
    ],
    totalStepsPerNode: 40,
  })

  solver.solve()

  const [route] = solver.getOutput()
  expect(route).toBeDefined()
  expect(route!.vias).toEqual([{ x: 18.825, y: 10 }])
  expect(route!.route[0]).toMatchObject({ x: 18.825, y: 10, z: 0 })
  expect(route!.route[1]).toMatchObject({ x: 18.825, y: 10, z: 1 })
})
