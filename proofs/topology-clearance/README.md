# Clearance pruning proof and implementation boundary

`ClearancePruning.lean` proves the real geometric rule behind the conservative
bounding-box guard in `lib/utils/high-density-force-improve-topology.ts`.
The implementation base is upstream commit
`27b3392c38ed4474b0557c73640b261155e28c27` plus the proposed guard.
This is a checked geometric and conditional arithmetic proof, **not a complete
IEEE-754 or TypeScript program-equivalence proof**.

## Reproduce

With elan installed, from this directory:

```sh
lake update
lake exe cache get Mathlib/Data/Real/Sqrt.lean Mathlib/Tactic/Linarith.lean Mathlib/Tactic/NormNum.lean Mathlib/Tactic/Ring.lean
lake env lean ClearancePruning.lean
```

Lean is pinned to 4.28.0 and mathlib to
`8f9d9cff6bd728b17a24e163c9402775d9e6a365` (mathlib v4.28.0).
Each theorem prints its axiom dependencies. Only Lean/mathlib's standard
`propext`, `Classical.choice`, and `Quot.sound` appear; there are no custom
axioms or unfinished proofs.

## Proved statements

* Euclidean distance is at least signed separation on either coordinate.
  `distance_symm` and `distance_swap_axes` permit all four guard orientations.
* For `0 ≤ t ≤ 1`, `a + (b-a)t` lies between endpoints `a` and `b`.
* A computed coordinate whose absolute interpolation error is at most `e`
  lies inside the endpoint interval enlarged by `e`.
* Three primitive arithmetic errors imply interpolation error at most `8uM`,
  where both endpoint magnitudes are at most `M`, `0 ≤ u ≤ 1/16`, and
  `0 ≤ t ≤ 1`. The model is:

  ```text
  computed subtraction = (b-a) + es
  computed product     = ((b-a) + es)t + em
  computed result      = a + (((b-a) + es)t + em) + ea
  |es| ≤ u|b-a|
  |em| ≤ u|((b-a) + es)t|
  |ea| ≤ u|a + (((b-a) + es)t + em)|
  ```

  The proof derives bounds for each intermediate operation and uses convex
  containment; it does not assume the desired final error bound.
* Separation of enlarged boxes rules out a clearance violation, allowing an
  explicitly bounded underestimate of Euclidean distance.
* `rounded_guard_excludes_rounded_violation` also models rounding of the gap,
  threshold, distance, and final predicate addition. Their total error must
  fit `2 * epsilon`: one epsilon from the guard and one from the existing
  strict violation predicate. The theorem derives nonviolation from these
  individual arithmetic bounds and the actual strict guard comparison.

## Correspondence and limits

The TypeScript guard uses each segment's endpoint maximum magnitude `M` and
`8 * Number.EPSILON * M`; `Number.EPSILON = 2^-52` fits the theorem's bound on
`u`. It retains the original loop order, layer/net filtering, distance
calculation, and strict predicate, and bypasses pruning for nonfinite endpoint
coordinates or trace radii.

The interpolation theorem explains the chosen constant **conditional on**
the primitive relative-error model and on the candidate parameter remaining
in `[0,1]`. Neither condition is proved for every execution of the existing
closest-point routine. Its general closest-point parameters are not explicitly
clamped. Finite inputs alone do not exclude intermediate overflow, subnormal
underflow, or ill-conditioned parameter arithmetic.

Latest main uses `getVectorLength`, implemented with `Math.sqrt(x*x + y*y)`,
instead of the historical `Math.hypot`. The real norm theorem applies to the
mathematical expression, but the required bounds for JavaScript multiplication,
addition, subtraction, square root, guard accumulation, and predicate rounding
are **not established here**. The final rounded-guard theorem states that
remaining obligation explicitly; it does not assume pruning correctness.
It also does not establish that TypeScript's computed `8*u*M` is an outward
rounded enclosure. Thus this artifact does not certify every finite binary64
input or prove whole-program equivalence.

The focused differential test complements this boundary with actual JavaScript
execution, including the extreme endpoint-cancellation example
`(1e16,0) → (1,0)` against `(0,-1) → (0,1)`. Real case replay and end-to-end
quality comparisons remain necessary. Empirical parity is not substituted
for a missing arithmetic proof.
