export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class BriefNotReadyError extends Error {
  constructor() {
    super('Brand brief not ready — complete the chat first')
    this.name = 'BriefNotReadyError'
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email already in use')
    this.name = 'EmailTakenError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
    this.name = 'InvalidCredentialsError'
  }
}
