import type { BaseSolver } from "@tscircuit/solver-utils"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import type { HighDensityRepair01Input } from "lib/types/types"

const createSolver = (sample: HighDensityRepair01Input): BaseSolver =>
  new HighDensityForceImproveSolver({
    nodeWithPortPoints: [sample.nodeWithPortPoints],
    hdRoutes: sample.nodeHdRoutes,
  }) as unknown as BaseSolver

export const Debugger = ({ sample }: { sample: HighDensityRepair01Input }) => (
  <GenericSolverDebugger createSolver={() => createSolver(sample)} />
)
