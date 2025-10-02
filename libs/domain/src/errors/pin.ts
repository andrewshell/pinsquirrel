export class PinError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinError'
  }
}

export class PinNotFoundError extends PinError {
  constructor(pinId: string) {
    super(`Pin with ID "${pinId}" not found`)
    this.name = 'PinNotFoundError'
  }
}

export class UnauthorizedPinAccessError extends PinError {
  constructor(pinId: string) {
    super(`Unauthorized access to pin with ID "${pinId}"`)
    this.name = 'UnauthorizedPinAccessError'
  }
}

export class DuplicatePinError extends PinError {
  public readonly existingPin?: { id: string; createdAt: Date }

  constructor(url: string, existingPin?: { id: string; createdAt: Date }) {
    super(`Pin with URL "${url}" already exists`)
    this.name = 'DuplicatePinError'
    this.existingPin = existingPin
  }
}

export class TagError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TagError'
  }
}

export class TagNotFoundError extends TagError {
  constructor(tagId: string) {
    super(`Tag with ID "${tagId}" not found`)
    this.name = 'TagNotFoundError'
  }
}

export class UnauthorizedTagAccessError extends TagError {
  constructor(tagId: string) {
    super(`Unauthorized access to tag with ID "${tagId}"`)
    this.name = 'UnauthorizedTagAccessError'
  }
}

export class DuplicateTagError extends TagError {
  constructor(name: string) {
    super(`Tag with name "${name}" already exists`)
    this.name = 'DuplicateTagError'
  }
}
