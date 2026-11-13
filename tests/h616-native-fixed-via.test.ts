import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { type GraphicsObject, mergeGraphics } from "graphics-debug"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"

test("H616 native DDR cleanup beside completed data vias", async (): Promise<void> => {
  const fixture = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL("./fixtures/h616-native-fixed-via.json.gz", import.meta.url),
        ),
      ),
    ).toString("utf8"),
  ) as {
    params: ConstructorParameters<typeof HighDensityForceImproveSolver>[0]
    context: GraphicsObject
  }
  const solver = new HighDensityForceImproveSolver({
    ...fixture.params,
    colorMap: {},
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()).toHaveLength(fixture.params.hdRoutes.length)
  await expect(
    mergeGraphics(fixture.context, solver.visualize()),
  ).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
