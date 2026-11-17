// Full names preserve already-qualified identities.
export const fullName = (namespace, name) => typeof name === 'string' && !name.includes('/') ? `${namespace}/${name}` : name

export const CODE_NAME = /^[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*$/
