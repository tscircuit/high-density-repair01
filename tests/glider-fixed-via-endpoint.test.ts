import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import fixture from "./fixtures/glider-fixed-via-endpoint.json"

test("Glider DDR ADDR6 escape via", async (): Promise<void> => {
  // Exact node input from Glider's native TSX/core remaining-signal phase.
  // Its boundary via joins top and inner1 fragments in neighboring nodes.
  const solver = new HighDensityForceImproveSolver({
    ...structuredClone(fixture),
    preserveTopologyPortAnchors: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.visualize()
  const node = fixture.nodeWithPortPoints[0]
  output.rects = [
    {
      center: node.center,
      width: node.width,
      height: node.height,
      stroke: "#94a3b8",
    },
  ]
  output.points = [
    {
      x: node.portPoints[0].x,
      y: node.portPoints[0].y,
      color: "#b91c1c",
      label: "fixed top / inner1 ports",
    },
  ]
  await expect(output).toMatchGraphicsSvg(import.meta.path)
})
