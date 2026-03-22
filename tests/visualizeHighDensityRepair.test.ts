import { expect, test } from "bun:test"
import { sample0004 } from "dataset-hd08"
import { HighDensityRepair01 } from "lib/HighDensityRepair01"

test("visualizeHighDensityRepair renders node, routes, and obstacles", () => {
  const solver = new HighDensityRepair01(sample0004)
  const graphics = solver.visualize()

  expect(graphics.coordinateSystem).toBe("cartesian")
  expect(graphics.title).toBe("HighDensityRepair01")
  expect(graphics.rects?.length).toBeGreaterThan(0)
  expect(graphics.polygons?.length).toBeGreaterThan(0)
  expect(graphics.lines?.length).toBeGreaterThan(0)
  expect(graphics.points?.length).toBeGreaterThan(0)
  expect(graphics.circles?.length).toBeGreaterThan(0)

  expect(graphics.rects?.[0]?.label).toBe(
    sample0004.nodeWithPortPoints.capacityMeshNodeId,
  )
  expect(
    graphics.points?.some((point) =>
      point.label?.includes(
        sample0004.nodeWithPortPoints.portPoints[0]?.connectionName,
      ),
    ),
  ).toBe(true)
  expect(
    graphics.lines?.some((line) =>
      line.label?.includes(sample0004.nodeHdRoutes[0]?.connectionName),
    ),
  ).toBe(true)
})
