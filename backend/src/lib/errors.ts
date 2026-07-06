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

export class TokensNotReadyError extends Error {
  constructor() {
    super('Design system not generated yet — run /generate first')
    this.name = 'TokensNotReadyError'
  }
}

export class WcagFailedError extends Error {
  constructor() {
    super('Palette does not pass WCAG AA — adjust colors before exporting')
    this.name = 'WcagFailedError'
  }
}

export class GithubNotConnectedError extends Error {
  constructor() {
    super('GitHub account not connected')
    this.name = 'GithubNotConnectedError'
  }
}

export class RepoConflictError extends Error {
  suggestedName: string
  constructor(suggestedName: string) {
    super('Repository name already exists in your GitHub account')
    this.name = 'RepoConflictError'
    this.suggestedName = suggestedName
  }
}
