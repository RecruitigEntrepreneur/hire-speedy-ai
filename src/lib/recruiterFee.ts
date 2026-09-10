export function recruiterFeeRange(fee: number | null, minimum: number | null, maximum: number | null) {
  if (fee == null || !Number.isFinite(fee) || fee < 0 || fee > 100) return null;
  const valid = (value: number | null) => value != null && Number.isFinite(value) && value > 0;
  if (valid(minimum) && valid(maximum) && minimum! > maximum!) return null;
  const min = valid(minimum) ? Math.round(minimum! * fee / 100) : null;
  const max = valid(maximum) ? Math.round(maximum! * fee / 100) : null;
  if (min == null && max == null) return null;
  return { min, max, fee };
}
