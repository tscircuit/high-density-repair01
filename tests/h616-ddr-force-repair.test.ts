import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import fixture from "./fixtures/h616-ddr-force-input.json"

test("H616 native DDR force repair", async (): Promise<void> => {
  const solver = new HighDensityForceImproveSolver(structuredClone(fixture))
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()).toHaveLength(fixture.hdRoutes.length)
  await expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path, {
    backgroundColor: "white",
  })
})
