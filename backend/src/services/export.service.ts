import prisma from '../lib/prisma'
import * as githubService from './github.service'
import * as vercelService from './vercel.service'
import {
  NotFoundError,
  TokensNotReadyError,
  WcagFailedError,
  GithubNotConnectedError,
  RepoConflictError,
} from '../lib/errors'

export { NotFoundError, TokensNotReadyError, WcagFailedError, GithubNotConnectedError, RepoConflictError }

type ExportOptions = {
  repoName?: string
  visibility?: 'PUBLIC' | 'PRIVATE'
}

export async function exportDesignSystem(
  userId: string,
  designSystemId: string,
  opts: ExportOptions = {},
) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const tokens = await prisma.designTokens.findUnique({ where: { designSystemId } })
  if (!tokens) throw new TokensNotReadyError()
  if (!tokens.wcagValid) throw new WcagFailedError()

  const githubAuth = await githubService.getDecryptedToken(userId)
  if (!githubAuth) throw new GithubNotConnectedError()

  const existingRepo = await prisma.repository.findUnique({ where: { designSystemId } })
  const colors = tokens.colors as Record<string, string>
  const typography = tokens.typography as Record<string, unknown>
  const componentCode = tokens.componentCode ?? ''

  if (!existingRepo) {
    const repoName = opts.repoName ?? `${ds.name.toLowerCase().replace(/\s+/g, '-')}-design-system`
    const isPrivate = opts.visibility !== 'PUBLIC'

    const { fullName } = await githubService.createRepository(githubAuth.token, repoName, isPrivate)

    await githubService.scaffoldRepository(
      githubAuth.token, fullName, colors, typography, componentCode, repoName,
    )

    let deploymentUrl: string | null = null
    let vercelProjectId: string | null = null
    try {
      const projectName = vercelService.sanitizeProjectName(repoName)
      const [owner, repo] = fullName.split('/')
      const { projectId, productionBranch } = await vercelService.createProject(fullName, projectName)
      await vercelService.triggerProductionDeploy(projectName, owner, repo, productionBranch)
      deploymentUrl = `https://${projectName}.vercel.app`
      vercelProjectId = projectId
    } catch (err) {
      console.error('Error creating Vercel deployment:', err)
    }

    const [repo, exportRecord] = await Promise.all([
      prisma.repository.create({
        data: {
          designSystemId,
          repoFullName: fullName,
          visibility: opts.visibility ?? 'PRIVATE',
          deploymentUrl,
          vercelProjectId,
        },
      }),
      prisma.export.create({ data: { designSystemId, type: 'INITIAL' } }),
    ])

    await prisma.designSystem.update({ where: { id: designSystemId }, data: { status: 'EXPORTED' } })

    return {
      type: 'initial' as const,
      repoFullName: repo.repoFullName,
      repoUrl: `https://github.com/${repo.repoFullName}`,
      deploymentUrl: repo.deploymentUrl,
      exportId: exportRecord.id,
    }
  }

  const { prNumber, prUrl, branchName, prTitle, prBody } = await githubService.createUpdatePR(
    githubAuth.token, existingRepo.repoFullName, colors, typography, componentCode, ds.name,
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
