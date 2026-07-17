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

export class InvalidComponentCodeError extends Error {
  constructor(reasons: string[]) {
    super(`Generated component contains TypeScript syntax, which breaks the .jsx Storybook build: ${reasons.join('; ')}`)
    this.name = 'InvalidComponentCodeError'
  }
}

export class DisallowedImportError extends Error {
  constructor(packages: string[]) {
    super(
      `Generated component imports packages that aren't installed in the exported repo, which breaks the Storybook build: ${packages.join(', ')}`,
    )
    this.name = 'DisallowedImportError'
  }
}

export class UnresolvableComponentExportError extends Error {
  constructor(componentName: string) {
    super(
      `${componentName}: saved component code doesn't export a named "${componentName}" (even after normalizing common ` +
      `"export default" patterns), so it can't be bundled for export. Regenerate the design system ` +
      `(press "Generar" again) to produce code that matches the expected export contract.`,
    )
    this.name = 'UnresolvableComponentExportError'
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

export class GithubRepoNotFoundError extends Error {
  constructor(repoFullName: string) {
    super(`Repository "${repoFullName}" not found or not accessible with your connected GitHub account.`)
    this.name = 'GithubRepoNotFoundError'
  }
}

export class GithubRepoAccessDeniedError extends Error {
  constructor(repoFullName: string) {
    super(`Your connected GitHub account doesn't have write access to "${repoFullName}".`)
    this.name = 'GithubRepoAccessDeniedError'
  }
}

export class MissingTargetRepoError extends Error {
  constructor() {
    super('targetRepoFullName is required when exporting in EMBEDDED mode')
    this.name = 'MissingTargetRepoError'
  }
}

export class PatchExportContractError extends Error {
  constructor(componentName: string) {
    super(
      `${componentName}: the edit broke this component's expected named export ("${componentName}"). ` +
      `The change was not applied — try rephrasing the request.`,
    )
    this.name = 'PatchExportContractError'
  }
}
