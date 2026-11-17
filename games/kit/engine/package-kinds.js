export const PACKAGE_KINDS = ['play', 'ext', 'course', 'lib']

export function validatePackageKind(kind) {
  if (kind === undefined) throw new Error('package.json: missing kind')
  if (!PACKAGE_KINDS.includes(kind)) throw new Error(`package.json: unknown kind ${JSON.stringify(kind)}`)
}
