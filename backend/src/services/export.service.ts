import prisma from '../lib/prisma'
import * as githubService from './github.service'
import type { AdditionalComponents } from './gemini.service'
import {
  NotFoundError,
  TokensNotReadyError,
  WcagFailedError,
  GithubNotConnectedError,
  RepoConflictError,
  UnresolvableComponentExportError,
  GithubRepoNotFoundError,
  GithubRepoAccessDeniedError,
  MissingTargetRepoError,
} from '../lib/errors'

export {
  NotFoundError,
  TokensNotReadyError,
  WcagFailedError,
  GithubNotConnectedError,
  RepoConflictError,
  UnresolvableComponentExportError,
  GithubRepoNotFoundError,
  GithubRepoAccessDeniedError,
  MissingTargetRepoError,
}

// Design systems generated before additionalComponents existed have it as null in the DB — fall
// back to an empty-but-valid component so an export never ships a broken import. Regenerating
// the design system replaces these with real AI-authored components.
function fallbackComponent(name: string): string {
  return `export function ${name}() {\n  return null\n}\n`
}

function withFallbacks(additionalComponents: AdditionalComponents | null): AdditionalComponents {
  return additionalComponents ?? {
    input: fallbackComponent('Input'),
    alert: fallbackComponent('Alert'),
    textarea: fallbackComponent('Textarea'),
    chip: fallbackComponent('Badge'),
  }
}

type ExportOptions = {
  mode?: 'STANDALONE' | 'EMBEDDED'
  repoName?: string
  visibility?: 'PUBLIC' | 'PRIVATE'
  targetRepoFullName?: string
  targetPath?: string
}

export async function exportDesignSystem(
  userId: string,
  designSystemId: string,
  opts: ExportOptions = {},
) {
  if (opts.mode === 'EMBEDDED') return embedDesignSystem(userId, designSystemId, opts)
  return exportStandalone(userId, designSystemId, opts)
}

// EMBEDDED — writes tokens + the 5 components into a folder of the user's OWN repo (no
// Storybook, no package.json, no dist/*). See github.service.ts's embedIntoRepository.
async function embedDesignSystem(
  userId: string,
  designSystemId: string,
  opts: ExportOptions,
) {
  if (!opts.targetRepoFullName) throw new MissingTargetRepoError()

  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const tokens = await prisma.designTokens.findUnique({ where: { designSystemId } })
  if (!tokens) throw new TokensNotReadyError()
  if (!tokens.wcagValid) throw new WcagFailedError()

  const githubAuth = await githubService.getDecryptedToken(userId)
  if (!githubAuth) throw new GithubNotConnectedError()

  const colors = tokens.colors as Record<string, string>
  const typography = tokens.typography as Record<string, unknown>
  const colorScales = tokens.colorScales as Record<string, unknown> | null
  const typographyScale = tokens.typographyScale as unknown[] | null
  const componentCode = tokens.componentCode ?? ''
  const additionalComponents = withFallbacks(tokens.additionalComponents as AdditionalComponents | null)
  const targetPath = opts.targetPath?.trim() || 'design-system'
  const targetRepoFullName = opts.targetRepoFullName

  const result = await githubService.embedIntoRepository(
    githubAuth.token, targetRepoFullName, targetPath, colors, typography, colorScales,
    typographyScale, componentCode, additionalComponents, ds.name,
  )

  const existingEmbed = await prisma.repository.findFirst({
    where: { designSystemId, repoFullName: targetRepoFullName, mode: 'EMBEDDED' },
  })
  const [, exportRecord] = await Promise.all([
    existingEmbed
      ? Promise.resolve(existingEmbed)
      : prisma.repository.create({
        data: { designSystemId, repoFullName: targetRepoFullName, mode: 'EMBEDDED', targetPath },
      }),
    prisma.export.create({
      data: {
        designSystemId,
        type: result.isInitialCommit ? 'INITIAL' : 'UPDATE',
        branchName: result.branchName,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
        prTitle: result.prTitle,
        prBody: result.prBody,
        status: result.prNumber ? 'OPEN' : null,
      },
    }),
  ])

  await prisma.designSystem.update({ where: { id: designSystemId }, data: { status: 'EXPORTED' } })

  return {
    type: result.isInitialCommit ? ('initial' as const) : ('update' as const),
    repoFullName: targetRepoFullName,
    repoUrl: `https://github.com/${targetRepoFullName}`,
    prUrl: result.prUrl ?? undefined,
    prNumber: result.prNumber ?? undefined,
    branchName: result.branchName ?? undefined,
    exportId: exportRecord.id,
  }
}

// STANDALONE — the original flow, unchanged in behavior: a repo of its own with the full
// Storybook + installable-package scaffold. At most one per design system (enforced here, since
// Repository.designSystemId is no longer @unique — see plan.md).
async function exportStandalone(
  userId: string,
  designSystemId: string,
  opts: ExportOptions,
) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const tokens = await prisma.designTokens.findUnique({ where: { designSystemId } })
  if (!tokens) throw new TokensNotReadyError()
  if (!tokens.wcagValid) throw new WcagFailedError()

  const githubAuth = await githubService.getDecryptedToken(userId)
  if (!githubAuth) throw new GithubNotConnectedError()

  const existingRepo = await prisma.repository.findFirst({ where: { designSystemId, mode: 'STANDALONE' } })
  const colors = tokens.colors as Record<string, string>
  const typography = tokens.typography as Record<string, unknown>
  const colorScales = tokens.colorScales as Record<string, unknown> | null
  const typographyScale = tokens.typographyScale as unknown[] | null
  const componentCode = tokens.componentCode ?? ''
  const additionalComponents = withFallbacks(tokens.additionalComponents as AdditionalComponents | null)

  if (!existingRepo) {
    const repoName = opts.repoName ?? `${ds.name.toLowerCase().replace(/\s+/g, '-')}-design-system`
    const isPrivate = opts.visibility !== 'PUBLIC'

    const { fullName } = await githubService.createRepository(githubAuth.token, repoName, isPrivate)

    await githubService.scaffoldRepository(
      githubAuth.token, fullName, colors, typography, colorScales, typographyScale,
      componentCode, additionalComponents, repoName,
    )

    const [repo, exportRecord] = await Promise.all([
      prisma.repository.create({
        data: { designSystemId, repoFullName: fullName, mode: 'STANDALONE', visibility: opts.visibility ?? 'PRIVATE' },
      }),
      prisma.export.create({ data: { designSystemId, type: 'INITIAL' } }),
    ])

    await prisma.designSystem.update({ where: { id: designSystemId }, data: { status: 'EXPORTED' } })

    return {
      type: 'initial' as const,
      repoFullName: repo.repoFullName,
      repoUrl: `https://github.com/${repo.repoFullName}`,
      exportId: exportRecord.id,
    }
  }

  const { prNumber, prUrl, branchName, prTitle, prBody } = await githubService.createUpdatePR(
    githubAuth.token, existingRepo.repoFullName, colors, typography, colorScales, typographyScale,
    componentCode, additionalComponents, ds.name,
  )

  const exportRecord = await prisma.export.create({
    data: { designSystemId, type: 'UPDATE', branchName, prNumber, prUrl, prTitle, prBody, status: 'OPEN' },
  })

  return {
    type: 'update' as const,
    prNumber,
    prUrl,
    branchName,
    exportId: exportRecord.id,
  }
}

export async function listExports(userId: string, designSystemId: string) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  return prisma.export.findMany({
    where: { designSystemId },
    orderBy: { createdAt: 'desc' },
  })
}
