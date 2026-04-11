import { expect, test } from "bun:test"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"

test("exports the starter solver", () => {
  expect(typeof HighDensityForceImproveSolver).toBe("function")
})
