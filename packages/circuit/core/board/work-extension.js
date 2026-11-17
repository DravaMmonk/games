const extensionKey = Symbol('board extension')

export const withWorkExtension = (board, extension) => ({ ...board, [extensionKey]: extension })
export const workExtension = board => board?.[extensionKey]
export const workView = (board, view) => workExtension(board)?.project(view) ?? view
export const workNodes = (board, resolve = workExtension(board)?.resolve) =>
  resolve?.nodes(board) ?? board.nodes.map(node => ({ node, path: [] }))
