import "bun-match-svg"
import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("force improvement preserves exact fixed endpoint coordinates", (): void => {
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
  const solver = new HighDensityForceImproveSolver({
    hdRoutes: [route],
    nodeWithPortPoints: [
      {
        capacityMeshNodeId: "fixed-endpoints",
        center: { x: 1, y: 0.5 },
        width: 4,
        height: 3,
        portPoints: [
          { ...route.route[0]!, connectionName: "signal" },
          { ...route.route.at(-1)!, connectionName: "signal" },
        ],
      },
    ],
    preserveTopologyPortAnchors: true,
    totalStepsPerNode: 20,
  })
  solver.solve()
  const output = solver.getOutput()[0]!
  const movement = Math.max(
    Math.hypot(
      output.route[0]!.x - route.route[0]!.x,
      output.route[0]!.y - route.route[0]!.y,
    ),
    Math.hypot(
      output.route.at(-1)!.x - route.route.at(-1)!.x,
      output.route.at(-1)!.y - route.route.at(-1)!.y,
    ),
  )
  expect(movement).toBe(0)
  expect(output.route[0]).toEqual(route.route[0])
  const graphics = solver.visualize()
  graphics.texts = [
    {
      x: 0,
      y: 0.95,
      fontSize: 0.08,
      text: `Fixed endpoint movement: ${movement.toFixed(9)} mm`,
      color: "#334155",
    },
  ]
  expect(
    getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
