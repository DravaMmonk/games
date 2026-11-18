export const sigmoid = value => 1 / (1 + Math.exp(-value))
export const relu = value => Math.max(0, value)
export const affine = (value, weight, bias) => weight * value + bias
