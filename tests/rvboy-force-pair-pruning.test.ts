import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { HighDensityForceImproveSolver } from "../lib/HighDensityForceImproveSolver"

test("RVboy spatial pair pruning preserves the exhaustive force-improvement output", (): void => {
  const input = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL(
            "./fixtures/rvboy-force-pair-pruning/input.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ).toString(),
  ) as ConstructorParameters<typeof HighDensityForceImproveSolver>[0]
  const expected = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL(
            "./fixtures/rvboy-force-pair-pruning/expected.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ).toString(),
  )
  const original = JSON.stringify(input)
  expect(input.hdRoutes).toHaveLength(22)
  expect(
    input.hdRoutes.reduce((count, route) => count + route.route.length, 0),
  ).toBe(2189)
  const solver = new HighDensityForceImproveSolver(input)
  solver.solve()
  expect(solver.solved).toBeTrue()
  expect(solver.getOutput()).toEqual(expected)
  expect(JSON.stringify(input)).toBe(original)
})
