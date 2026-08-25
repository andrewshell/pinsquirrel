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
  /**
   * @param pinId the pin being accessed, or `''` when the refusal is about the
   *   caller rather than one pin ("must be signed in to list pins").
   * @param message overrides the default, which templates `pinId` in. Callers
   *   used to pass a whole sentence as `pinId` and get it nested inside that
   *   template.
   */
  constructor(
    public readonly pinId: string,
    message: string = `Unauthorized access to pin with ID "${pinId}"`
  ) {
    super(message)
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
  /** @param message overrides the default, which templates `tagId` in. */
  constructor(
    public readonly tagId: string,
    message: string = `Tag with ID "${tagId}" not found`
  ) {
    super(message)
    this.name = 'TagNotFoundError'
  }
}

export class UnauthorizedTagAccessError extends TagError {
  /**
   * @param tagId the tag being accessed, or `''` when the refusal is about the
   *   caller rather than one tag.
   * @param message overrides the default, which templates `tagId` in.
   */
  constructor(
    public readonly tagId: string,
    message: string = `Unauthorized access to tag with ID "${tagId}"`
  ) {
    super(message)
    this.name = 'UnauthorizedTagAccessError'
  }
}
