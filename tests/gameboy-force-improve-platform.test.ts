import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import fixture from "./fixtures/gameboy-force-improve-platform.json"

test("Game Boy force improvement produces repeatable route geometry", async () => {
  // Unmodified cmn_170 input captured from the full Game Boy Pipeline 9 run.
  // CI compares this actual solver output between Linux x64 and macOS ARM64.
  const solver = new HighDensityForceImproveSolver(structuredClone(fixture))
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()).toHaveLength(fixture.hdRoutes.length)

  const repeated = new HighDensityForceImproveSolver(structuredClone(fixture))
  repeated.solve()
  expect(repeated.getOutput()).toEqual(solver.getOutput())

  await Bun.write(
    new URL("../tmp/gameboy-force-improve-routes.json", import.meta.url),
    JSON.stringify(solver.getOutput(), null, 2),
  )
})
