const VERCEL_API = 'https://api.vercel.com'

function teamQuery(): string {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export function sanitizeProjectName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export async function createProject(
  repoFullName: string,
  name: string,
): Promise<{ projectId: string; productionBranch: string }> {
  const res = await fetch(`${VERCEL_API}/v11/projects${teamQuery()}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      gitRepository: { type: 'github', repo: repoFullName },
      buildCommand: 'npm run build-storybook',
      outputDirectory: 'storybook-static',
      framework: null,
    }),
  })

  const data = (await res.json()) as {
    id?: string
    link?: { productionBranch?: string }
    error?: { message?: string }
  }
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'Vercel project creation failed')

  return { projectId: data.id, productionBranch: data.link?.productionBranch ?? 'main' }
}

export async function triggerProductionDeploy(
  name: string,
  org: string,
  repo: string,
  ref: string,
): Promise<void> {
  const res = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      gitSource: { type: 'github', org, repo, ref },
      target: 'production',
    }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(data.error?.message ?? 'Vercel deployment trigger failed')
  }
}
