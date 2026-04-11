import { mkdir, rename } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
  stackGraphicsVertically,
} from "graphics-debug"
import { runDrcCheck } from "../lib/drc-check"
import {
  DEFAULT_FORCE_IMPROVEMENT_PASSES,
  DEFAULT_REPAIR_TARGET_SEGMENTS,
  repairSample,
} from "../lib/repair"
import { simplifyRoutes } from "../lib/utils/simplify"
import { visualizeHighDensityRepair } from "../lib/visualizeHighDensityRepair"
import type { HighDensityRepair01Input, NodeHdRoute } from "../lib/types/types"

type StageSample = {
  label: string
  sample: HighDensityRepair01Input
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    asset: { type: "string" },
    "force-improvement-passes": { type: "string" },
    limit: { type: "string" },
    "out-dir": { type: "string" },
    sample: { type: "string", multiple: true },
    "target-segments": { type: "string" },
  },
  strict: true,
  allowPositionals: false,
})

const parseIntegerOption = (value: string | undefined, optionName: string) => {
  if (value == null) return undefined

  const parsedValue = Number.parseInt(value, 10)
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`Expected --${optionName} to be a non-negative integer.`)
  }

  return parsedValue
}

const summarizeIssues = (sample: HighDensityRepair01Input) => {
  const drc = runDrcCheck(sample.nodeWithPortPoints, sample.nodeHdRoutes)
  if (drc.issues.length === 0) {
    return "clean"
  }

  return Object.entries(
    drc.issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.kind] = (acc[issue.kind] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}:${count}`)
    .join(", ")
}

const cloneRoutes = (routes: NodeHdRoute[]) =>
  routes.map((route) => ({
    ...route,
    route: route.route.map((point) => ({ ...point })),
    vias: route.vias.map((via) => ({ ...via })),
    viaRegions: route.viaRegions?.map((viaRegion) => ({
      ...viaRegion,
      center: { ...viaRegion.center },
      connectedTo: [...viaRegion.connectedTo],
    })),
  }))

const renderStage = ({ label, sample }: StageSample) => {
  const graphics = visualizeHighDensityRepair(sample)
  const issueSummary = summarizeIssues(sample)
  return {
    graphics,
    title: `${label}\n${issueSummary}`,
  }
}

const convertSvgToPng = async (svgPath: string, pngPath: string) => {
  const process = Bun.spawn(
    ["qlmanage", "-t", "-s", "2400", "-o", outDir, svgPath],
    {
      stdout: "ignore",
      stderr: "pipe",
    },
  )
  const exitCode = await process.exited

  if (exitCode === 0) {
    await rename(`${svgPath}.png`, pngPath)
    return
  }

  const stderr = await new Response(process.stderr).text()
  throw new Error(
    `Failed converting ${svgPath} to PNG with qlmanage (exit ${exitCode}): ${stderr.trim()}`,
  )
}

const assetPath =
  values.asset ?? join(import.meta.dir, "..", "assets", "hd08v2.json")
const outDir = resolve(
  values["out-dir"] ?? join(import.meta.dir, "..", "tmp", "repair-renders"),
)
const forceImprovementPasses =
  parseIntegerOption(
    values["force-improvement-passes"],
    "force-improvement-passes",
  ) ?? DEFAULT_FORCE_IMPROVEMENT_PASSES
const targetSegments =
  parseIntegerOption(values["target-segments"], "target-segments") ??
  DEFAULT_REPAIR_TARGET_SEGMENTS
const limit = parseIntegerOption(values.limit, "limit")

const failingSamples = (await Bun.file(assetPath).json()) as Record<
  string,
  HighDensityRepair01Input
>
const selectedKeys =
  values.sample && values.sample.length > 0
    ? values.sample
    : Object.keys(failingSamples)
        .sort()
        .slice(0, limit ?? 4)

if (selectedKeys.length === 0) {
  throw new Error("No samples selected.")
}

await mkdir(outDir, { recursive: true })

for (const sampleKey of selectedKeys) {
  const sample = failingSamples[sampleKey]

  if (!sample) {
    throw new Error(`Sample ${sampleKey} was not found in ${assetPath}.`)
  }

  const simplifiedSample: HighDensityRepair01Input = {
    ...sample,
    nodeHdRoutes: simplifyRoutes(
      cloneRoutes(sample.nodeHdRoutes),
      targetSegments,
    ),
  }
  const repairResult = repairSample(sample, {
    forceImprovementPasses,
    includeForceVectors: false,
    targetSegments,
  })
  const forceImprovedSample: HighDensityRepair01Input = {
    ...sample,
    nodeHdRoutes: cloneRoutes(repairResult.forceImproveResult.routes),
  }

  const renderedStages = [
    renderStage({ label: "original", sample }),
    renderStage({ label: "simplified", sample: simplifiedSample }),
    renderStage({ label: "force-improved", sample: forceImprovedSample }),
    renderStage({
      label: `selected (${repairResult.selectedStage})`,
      sample: repairResult.sample,
    }),
  ]

  const topRow = stackGraphicsHorizontally(
    renderedStages.slice(0, 2).map((stage) => stage.graphics),
    {
      titles: renderedStages.slice(0, 2).map((stage) => stage.title),
    },
  )
  const bottomRow = stackGraphicsHorizontally(
    renderedStages.slice(2).map((stage) => stage.graphics),
    {
      titles: renderedStages.slice(2).map((stage) => stage.title),
    },
  )
  const combinedGraphics = stackGraphicsVertically([topRow, bottomRow])

  combinedGraphics.title = sampleKey

  const svg = getSvgFromGraphicsObject(combinedGraphics, {
    backgroundColor: "#ffffff",
    svgWidth: 1800,
    svgHeight: 1400,
  })

  const svgPath = join(outDir, `${sampleKey}.svg`)
  const pngPath = join(outDir, `${sampleKey}.png`)

  await Bun.write(svgPath, svg)
  await convertSvgToPng(svgPath, pngPath)

  console.log(`${sampleKey}: ${pngPath}`)
}
