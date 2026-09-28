import Mathlib.Data.Real.Sqrt
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring

/-!
Real geometry and conditional floating-arithmetic correspondence for the
conservative axis-aligned bounding-box guard. Theorems do not assert that
JavaScript operations, the closest-point parameter calculation, or Math.hypot
satisfy the stated arithmetic hypotheses. See README.md for that boundary.
-/

namespace ClearancePruning

noncomputable def distance (ax ay bx by_ : ℝ) : ℝ :=
  Real.sqrt ((bx - ax) ^ 2 + (by_ - ay) ^ 2)

theorem axis_le_distance (ax ay bx by_ : ℝ) :
    bx - ax ≤ distance ax ay bx by_ := by
  have hn : 0 ≤ (bx - ax) ^ 2 + (by_ - ay) ^ 2 :=
    add_nonneg (sq_nonneg _) (sq_nonneg _)
  have hs := Real.sq_sqrt hn
  have hp := Real.sqrt_nonneg ((bx - ax) ^ 2 + (by_ - ay) ^ 2)
  unfold distance
  nlinarith [sq_nonneg (by_ - ay)]

theorem distance_symm (ax ay bx by_ : ℝ) :
    distance ax ay bx by_ = distance bx by_ ax ay := by
  unfold distance
  congr 1
  ring

theorem distance_swap_axes (ax ay bx by_ : ℝ) :
    distance ax ay bx by_ = distance ay ax by_ bx := by
  unfold distance
  congr 1
  ring

theorem convex_coordinate_in_endpoint_box
    (a b t : ℝ) (ht0 : 0 ≤ t) (ht1 : t ≤ 1) :
    min a b ≤ a + (b - a) * t ∧
    a + (b - a) * t ≤ max a b := by
  have h0 : 0 ≤ 1 - t := by linarith
  have h1 := mul_le_mul_of_nonneg_right (min_le_left a b) h0
  have h2 := mul_le_mul_of_nonneg_right (min_le_right a b) ht0
  have h3 := mul_le_mul_of_nonneg_right (le_max_left a b) h0
  have h4 := mul_le_mul_of_nonneg_right (le_max_right a b) ht0
  constructor <;> nlinarith

theorem perturbed_coordinate_in_expanded_box
    (a b t computed errorBound : ℝ)
    (ht0 : 0 ≤ t) (ht1 : t ≤ 1)
    (herror : |computed - (a + (b - a) * t)| ≤ errorBound) :
    min a b - errorBound ≤ computed ∧
    computed ≤ max a b + errorBound := by
  have hc := convex_coordinate_in_endpoint_box a b t ht0 ht1
  have he := abs_le.mp herror
  constructor <;> linarith

/- Three primitive arithmetic errors, each bounded relative to its exact
   input operation, imply a composed interpolation error bound. This proves
   the constant 8 under this model, not IEEE conformance of JavaScript.
   Underflow/overflow and parameter computation are outside the model.
-/
theorem interpolation_rounding_bound
    (a b t u M es em ea : ℝ)
    (hu : 0 ≤ u) (huSmall : u ≤ 1 / 16) (hM : 0 ≤ M)
    (hta : |a| ≤ M) (htb : |b| ≤ M)
    (ht0 : 0 ≤ t) (ht1 : t ≤ 1)
    (hSub : |es| ≤ u * |b - a|)
    (hMul : |em| ≤ u * |(b - a + es) * t|)
    (hAdd : |ea| ≤ u * |a + ((b - a + es) * t + em)|) :
    |(a + ((b - a + es) * t + em) + ea) -
      (a + (b - a) * t)| ≤ 8 * u * M := by
  have hdiff : |b - a| ≤ 2 * M := by
    have hd := abs_sub b a
    linarith
  have hes : |es| ≤ 2 * u * M := by
    calc
      |es| ≤ u * |b - a| := hSub
      _ ≤ u * (2 * M) := mul_le_mul_of_nonneg_left hdiff hu
      _ = 2 * u * M := by ring
  have hesM : |es| ≤ M := by
    have hh : 0 ≤ 1 - 2 * u := by linarith
    nlinarith [mul_nonneg hh hM]
  have hdiffRounded : |b - a + es| ≤ 3 * M := by
    have hh := abs_add_le (b - a) es
    linarith
  have hmulInput : |(b - a + es) * t| ≤ 3 * M := by
    rw [abs_mul, abs_of_nonneg ht0]
    have hh := mul_le_mul_of_nonneg_left ht1 (abs_nonneg (b - a + es))
    linarith
  have hem : |em| ≤ 3 * u * M := by
    calc
      |em| ≤ u * |(b - a + es) * t| := hMul
      _ ≤ u * (3 * M) := mul_le_mul_of_nonneg_left hmulInput hu
      _ = 3 * u * M := by ring
  have hexact : |a + (b - a) * t| ≤ M := by
    have hc := convex_coordinate_in_endpoint_box a b t ht0 ht1
    have ha := abs_le.mp hta
    have hb := abs_le.mp htb
    have hl : -M ≤ min a b := le_min ha.1 hb.1
    have hr : max a b ≤ M := max_le ha.2 hb.2
    apply abs_le.mpr
    constructor <;> linarith
  have hest : |es * t| ≤ 2 * u * M := by
    rw [abs_mul, abs_of_nonneg ht0]
    have hh := mul_le_mul_of_nonneg_left ht1 (abs_nonneg es)
    linarith
  have hAddInput : |a + ((b - a + es) * t + em)| ≤ 2 * M := by
    have hi : a + ((b - a + es) * t + em) =
        (a + (b - a) * t) + es * t + em := by ring
    rw [hi]
    have h1 := abs_add_le (a + (b - a) * t) (es * t)
    have h2 := abs_add_le ((a + (b - a) * t) + es * t) em
    have hh : 0 ≤ 1 - 5 * u := by linarith
    nlinarith [mul_nonneg hh hM]
  have hea : |ea| ≤ 2 * u * M := by
    calc
      |ea| ≤ u * |a + ((b - a + es) * t + em)| := hAdd
      _ ≤ u * (2 * M) := mul_le_mul_of_nonneg_left hAddInput hu
      _ = 2 * u * M := by ring
  have hi : (a + ((b - a + es) * t + em) + ea) -
      (a + (b - a) * t) = es * t + em + ea := by ring
  rw [hi]
  have h1 := abs_add_le (es * t) em
  have h2 := abs_add_le (es * t + em) ea
  nlinarith [mul_nonneg hu hM]

theorem rounded_interpolation_in_expanded_box
    (a b t u M es em ea : ℝ)
    (hu : 0 ≤ u) (huSmall : u ≤ 1 / 16) (hM : 0 ≤ M)
    (hta : |a| ≤ M) (htb : |b| ≤ M)
    (ht0 : 0 ≤ t) (ht1 : t ≤ 1)
    (hSub : |es| ≤ u * |b - a|)
    (hMul : |em| ≤ u * |(b - a + es) * t|)
    (hAdd : |ea| ≤ u * |a + ((b - a + es) * t + em)|) :
    min a b - 8 * u * M ≤ a + ((b - a + es) * t + em) + ea ∧
    a + ((b - a + es) * t + em) + ea ≤ max a b + 8 * u * M := by
  exact perturbed_coordinate_in_expanded_box a b t
    (a + ((b - a + es) * t + em) + ea) (8 * u * M) ht0 ht1
    (interpolation_rounding_bound a b t u M es em ea
      hu huSmall hM hta htb ht0 ht1 hSub hMul hAdd)

/- The selected coordinate of each computed point may deviate from its
   endpoint interval. A separate bound permits downward distance error.
   The strict guard is stronger than needed; it gives computedDistance > r+eps.
-/
theorem separated_expanded_boxes_exclude_clearance_violation
    (ax ay bx by_ leftMax rightMin leftError rightError distanceError
      radii epsilon computedDistance : ℝ)
    (ha : ax ≤ leftMax + leftError)
    (hb : rightMin - rightError ≤ bx)
    (hgap : radii + epsilon + leftError + rightError + distanceError <
      rightMin - leftMax)
    (hd : distance ax ay bx by_ - distanceError ≤ computedDistance)
    (hepsilon : 0 ≤ epsilon) :
    ¬ (computedDistance + epsilon < radii) := by
  have haxis := axis_le_distance ax ay bx by_
  linarith

/- This theorem also accounts for the guard subtraction/sum and the final
   distance/check arithmetic. The total additional downward error must fit
   the guard's +epsilon and the existing predicate's +epsilon allowance.
   These are operation-level numeric hypotheses, not a pruning assumption.
-/
theorem rounded_guard_excludes_rounded_violation
    (ax ay bx by_ leftMax rightMin leftError rightError radii epsilon
      computedGap computedThreshold computedDistance computedCheck
      gapError thresholdError distanceError checkError : ℝ)
    (ha : ax ≤ leftMax + leftError)
    (hb : rightMin - rightError ≤ bx)
    (hgapError : |computedGap - (rightMin - leftMax)| ≤ gapError)
    (hthresholdError : |computedThreshold -
      (radii + epsilon + leftError + rightError)| ≤ thresholdError)
    (hdistanceError : distance ax ay bx by_ - computedDistance ≤ distanceError)
    (hcheckError : computedDistance + epsilon - computedCheck ≤ checkError)
    (hbudget : gapError + thresholdError + distanceError + checkError ≤ 2 * epsilon)
    (hguard : computedThreshold < computedGap) :
    ¬ (computedCheck < radii) := by
  have hg := abs_le.mp hgapError
  have ht := abs_le.mp hthresholdError
  have haxis := axis_le_distance ax ay bx by_
  linarith

/- No point-error hypotheses are required for exact real segment coordinates:
   their containment follows from convexity. This is the geometric AABB rule.
-/
theorem segment_axis_separation_excludes_clearance_violation
    (a0 a1 b0 b1 ta tb ay by_ radii epsilon : ℝ)
    (hta0 : 0 ≤ ta) (hta1 : ta ≤ 1)
    (htb0 : 0 ≤ tb) (htb1 : tb ≤ 1)
    (hepsilon : 0 ≤ epsilon)
    (hgap : radii + epsilon < min b0 b1 - max a0 a1) :
    ¬ (distance (a0 + (a1 - a0) * ta) ay
      (b0 + (b1 - b0) * tb) by_ + epsilon < radii) := by
  have ha := convex_coordinate_in_endpoint_box a0 a1 ta hta0 hta1
  have hb := convex_coordinate_in_endpoint_box b0 b1 tb htb0 htb1
  have haxis := axis_le_distance
    (a0 + (a1 - a0) * ta) ay (b0 + (b1 - b0) * tb) by_
  linarith

end ClearancePruning

#print axioms ClearancePruning.axis_le_distance
#print axioms ClearancePruning.distance_symm
#print axioms ClearancePruning.distance_swap_axes
#print axioms ClearancePruning.convex_coordinate_in_endpoint_box
#print axioms ClearancePruning.perturbed_coordinate_in_expanded_box
#print axioms ClearancePruning.interpolation_rounding_bound
#print axioms ClearancePruning.rounded_interpolation_in_expanded_box
#print axioms ClearancePruning.separated_expanded_boxes_exclude_clearance_violation
#print axioms ClearancePruning.rounded_guard_excludes_rounded_violation
#print axioms ClearancePruning.segment_axis_separation_excludes_clearance_violation
