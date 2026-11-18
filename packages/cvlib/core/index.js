export { blob, blobAt, decode, DECODER_START, encode, encodeBlobCentre, ENCODER_START } from './blob-autoencoder.js'
export * from './features.js'
export * from './image-geometry.js'
export { features } from './image-embedding.js'
export { conv3, convRgb, residualConv } from './image-layers.js'
export * from './match.js'
export * from './optics.js'
export { patchAttention } from './patch-attention.js'
export * from './stereo.js'

/** Generate seeded line scenes and match the strongest Hough peaks to the reference lines. */
export { houghScene, houghBench } from './hough-trials.js'
/** Evaluate seeded consensus trials and compute the round budget from inlier probability. */
export { ransacBench, ransacRounds } from './ransac-trials.js'

export function register() {}
