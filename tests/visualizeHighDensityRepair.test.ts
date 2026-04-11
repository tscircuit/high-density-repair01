import { expect, test } from "bun:test"
import { visualizeHighDensityRepair } from "../lib/visualizeHighDensityRepair"
import type { HighDensityRepair01Input } from "lib/types/types"

const sample: HighDensityRepair01Input = {
  adjacentObstacles: [
    {
      center: { x: -0.5, y: 0.5 },
      connectedTo: [],
      height: 0.8,
      layers: ["top"],
      type: "oval",
      width: 1.2,
    },
  ],
  connMap: {
    idToNetMap: {},
    netMap: {},
  },
  nodeHdRoutes: [
    {
      capacityMeshNodeId: "visualize-sample",
      connectionName: "conn00",
      rootConnectionName: "conn00",
      route: [
        { x: -1.5, y: -1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 1.5, y: 1, z: 1 },
      ],
      traceThickness: 0.1,
      viaDiameter: 0.3,
      viaRegions: [
        {
          center: { x: 0, y: 0 },
          connectedTo: ["conn00"],
          diameter: 0.6,
          viaRegionId: "vr0",
        },
      ],
      vias: [{ x: 0, y: 0 }],
    },
  ],
  nodeWithPortPoints: {
    availableZ: [0, 1],
    capacityMeshNodeId: "visualize-sample",
    center: { x: 0, y: 0 },
    height: 4,
    portPoints: [
      {
        connectionName: "conn00",
        portPointId: "pp0",
        rootConnectionName: "conn00",
        x: -1.5,
        y: -1,
        z: 0,
      },
      {
        connectionName: "conn00",
        portPointId: "pp1",
        rootConnectionName: "conn00",
        x: 1.5,
        y: 1,
        z: 1,
      },
    ],
    width: 4,
  },
}

test("visualizeHighDensityRepair renders node, routes, and obstacles", () => {
  const graphics = visualizeHighDensityRepair(sample)

  expect(graphics.coordinateSystem).toBe("cartesian")
  expect(graphics.title).toBe("HighDensityRepair01")
  expect(graphics.rects?.length).toBeGreaterThan(0)
  expect(graphics.polygons?.length).toBeGreaterThan(0)
  expect(graphics.lines?.length).toBeGreaterThan(0)
  expect(graphics.points?.length).toBeGreaterThan(0)
  expect(graphics.circles?.length).toBeGreaterThan(0)

  expect(graphics.rects?.[0]?.label).toBe(
    sample.nodeWithPortPoints.capacityMeshNodeId,
  )
  expect(
    graphics.points?.some((point) =>
      point.label?.includes(
        sample.nodeWithPortPoints.portPoints[0]?.connectionName,
      ),
    ),
  ).toBe(true)
  expect(
    graphics.lines?.some((line) =>
      line.label?.includes(sample.nodeHdRoutes[0]?.connectionName),
    ),
  ).toBe(true)
})
