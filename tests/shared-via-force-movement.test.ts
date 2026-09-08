import { expect, test } from "bun:test"
import {
  HighDensityForceImproveSolver,
  runForceDirectedImprovement,
} from "../lib/HighDensityForceImproveSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../lib/types/high-density-types"

test("force improvement moves shared vias together and preserves fixed attachments", () => {
  for (const fixedVia of [false, true]) {
    const routes: HighDensityRoute[] = [
      {
        connectionName: "branch-left",
        rootConnectionName: "net",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: -3, y: 0, z: 0 },
          ...(fixedVia
            ? []
            : [
                { x: -2, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
              ]),
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
          { x: 2, y: 0, z: 1 },
          { x: 3, y: 0, z: 1 },
        ],
        vias: [{ x: 0, y: 0 }],
      },
      {
        connectionName: "branch-right",
        rootConnectionName: "net",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: -3, y: -2, z: 0 },
          { x: -2, y: -2, z: 0 },
          { x: 0, y: -1, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0.5, z: 1 },
          { x: 2, y: 2, z: 1 },
          { x: 3, y: 2, z: 1 },
        ],
        vias: [{ x: 0, y: 0 }],
      },
    ]
    const originalRoutes = structuredClone(routes)
    const node: NodeWithPortPoints = {
      capacityMeshNodeId: "shared-junction",
      center: { x: 0, y: 0 },
      width: 6,
      height: 6,
      portPoints: routes.flatMap((route) =>
        [route.route[0]!, route.route.at(-1)!].map((point) => ({
          ...point,
          connectionName: route.connectionName,
          rootConnectionName: "net",
        })),
      ),
    }
    const solver = new HighDensityForceImproveSolver({
      nodeWithPortPoints: [node],
      hdRoutes: routes,
      totalStepsPerNode: 20,
    })
    solver.solve()
    expect(solver.solved).toBeTrue()
    expect(solver.failed).toBeFalse()
    for (const output of [
      runForceDirectedImprovement(
        { minX: -3, maxX: 3, minY: -3, maxY: 3 },
        routes,
        20,
      ).routes,
      solver.getOutput(),
    ]) {
      const sharedVia = output[0]!.vias[0]!
      expect(output).toHaveLength(routes.length)
      expect(output.map((route) => route.connectionName)).toEqual(
        routes.map((route) => route.connectionName),
      )
      expect(output[0]!.vias).toHaveLength(1)
      expect(output[1]!.vias).toEqual([sharedVia])
      if (fixedVia) expect(sharedVia).toEqual({ x: 0, y: 0 })
      else expect(Math.hypot(sharedVia.x, sharedVia.y)).toBeGreaterThan(0)
      for (let routeIndex = 0; routeIndex < output.length; routeIndex++) {
        const route = output[routeIndex]!
        for (const [pointIndex, point] of route.route.entries()) {
          expect(point.x).toBeGreaterThanOrEqual(-3)
          expect(point.x).toBeLessThanOrEqual(3)
          expect(point.y).toBeGreaterThanOrEqual(-3)
          expect(point.y).toBeLessThanOrEqual(3)
          const previous = route.route[pointIndex - 1]
          if (previous && previous.z !== point.z) {
            expect(point.x).toBe(previous.x)
            expect(point.y).toBe(previous.y)
          }
        }
        expect(
          Math.abs(sharedVia.x) + route.viaDiameter / 2,
        ).toBeLessThanOrEqual(3)
        expect(
          Math.abs(sharedVia.y) + route.viaDiameter / 2,
        ).toBeLessThanOrEqual(3)
        expect(output[routeIndex]!.route[0]).toEqual(
          routes[routeIndex]!.route[0],
        )
        expect(output[routeIndex]!.route.at(-1)).toEqual(
          routes[routeIndex]!.route.at(-1),
        )
      }
    }
    expect(routes).toEqual(originalRoutes)

    const barrier: HighDensityRoute = {
      connectionName: "barrier",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [],
      route: [
        { x: 0.1, y: -2, z: 1 },
        { x: 0.1, y: 2, z: 1 },
      ],
    }
    const crowdedSolver = new HighDensityForceImproveSolver({
      nodeWithPortPoints: [node],
      hdRoutes: [...routes, barrier],
      totalStepsPerNode: 0,
    })
    crowdedSolver.solve()
    expect(crowdedSolver.solved).toBeTrue()
    expect(crowdedSolver.failed).toBeFalse()
    const crowdedOutput = crowdedSolver.getOutput()
    expect(crowdedOutput[1]!.vias).toEqual(crowdedOutput[0]!.vias)
    if (fixedVia) expect(crowdedOutput[0]!.vias).toEqual([{ x: 0, y: 0 }])
    expect(routes).toEqual(originalRoutes)
  }
})
