import { Debugger } from "./components/Debugger"
import { cmn632Fixture } from "./fixtures/cmn632"

export default function Cmn632Fixture() {
  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-300 bg-white p-3">
        <div className="text-sm text-slate-700">
          cmn_632 focus fixture •{" "}
          {cmn632Fixture.nodeWithPortPoints.portPoints.length} port points •{" "}
          {cmn632Fixture.nodeHdRoutes.length} reference route
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Debugger sample={cmn632Fixture} />
      </div>
    </div>
  )
}
