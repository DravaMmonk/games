/** A failed operation, with a message for the player ({ zh, en } or a string). */
export class OperationError extends Error {
  constructor(message) {
    super(typeof message === 'string' ? message : message?.en ?? message?.zh ?? 'part error')
    this.label = message
  }
}
