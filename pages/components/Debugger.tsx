import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { HighDensityRepair01 } from "lib/HighDensityRepair01"
import type { HighDensityRepair01Input } from "lib/types"

export const Debugger = ({ sample }: { sample: HighDensityRepair01Input }) => (
  <GenericSolverDebugger createSolver={() => new HighDensityRepair01(sample)} />
)
