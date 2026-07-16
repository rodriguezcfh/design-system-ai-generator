import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockGetBranch = vi.fn()
const mockCreateOrUpdateFileContents = vi.fn()
const mockGetContent = vi.fn()
const mockCreateRef = vi.fn()
const mockPullsCreate = vi.fn()

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      get: mockGet,
      getBranch: mockGetBranch,
      createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      getContent: mockGetContent,
    },
    git: { createRef: mockCreateRef },
    pulls: { create: mockPullsCreate },
  })),
}))

vi.mock('../services/gemini.service', () => ({
  generatePRDescription: vi.fn().mockResolvedValue({ title: 'Update design system', body: 'What changed...' }),
}))

import { embedIntoRepository } from '../services/github.service'
import { GithubRepoNotFoundError, GithubRepoAccessDeniedError } from '../lib/errors'

const colors = { primary: '#1a56db', primaryForeground: '#ffffff' }
const typography = { fontFamily: 'Inter, sans-serif' }
const additionalComponents = {
  input: 'export function Input() { return <input /> }',
  alert: 'export function Alert() { return <div /> }',
  textarea: 'export function Textarea() { return <textarea /> }',
  chip: 'export function Badge() { return <span /> }',
}
const componentCode = 'export function Button() { return <button /> }'

describe('embedIntoRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes files under targetPath as a single initial commit when the target repo is empty', async () => {
    mockGet.mockResolvedValue({ data: { default_branch: 'main', permissions: { push: true } } })
    mockGetBranch.mockRejectedValue({ status: 404 })
    mockCreateOrUpdateFileContents.mockResolvedValue({})

    const result = await embedIntoRepository(
      'ghs_abc', 'octocat/mi-landing', 'design-system', colors, typography, null, null,
      componentCode, additionalComponents, 'Mi Brand',
    )

    expect(result.isInitialCommit).toBe(true)
    expect(result.prNumber).toBeNull()
    expect(result.prUrl).toBeNull()
    expect(mockCreateRef).not.toHaveBeenCalled()
    expect(mockPullsCreate).not.toHaveBeenCalled()

    const paths = mockCreateOrUpdateFileContents.mock.calls.map(([args]) => args.path)
    expect(paths).toEqual(expect.arrayContaining([
      'design-system/tokens/colors.json',
      'design-system/tokens/typography.json',
      'design-system/tokens/colorScales.json',
      'design-system/tokens/typographyScale.json',
      'design-system/tailwind-preset.js',
      'design-system/components/Button.jsx',
      'design-system/components/Input.jsx',
      'design-system/components/Textarea.jsx',
      'design-system/components/Alert.jsx',
      'design-system/components/Badge.jsx',
      'design-system/INSTALL.md',
    ]))
    expect(paths.every((p) => p.startsWith('design-system/'))).toBe(true)
    // initial commit writes straight to the default branch, not a feature branch
    expect(mockCreateOrUpdateFileContents.mock.calls.every(([args]) => args.branch === 'main')).toBe(true)
  })

  it('creates a branch + PR scoped to targetPath when the target repo already has content', async () => {
    mockGet.mockResolvedValue({ data: { default_branch: 'main', permissions: { push: true } } })
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha-main' } } })
    mockCreateRef.mockResolvedValue({})
    mockGetContent.mockRejectedValue({ status: 404 })
    mockCreateOrUpdateFileContents.mockResolvedValue({})
    mockPullsCreate.mockResolvedValue({
      data: { number: 7, html_url: 'https://github.com/octocat/mi-landing/pull/7' },
    })

    const result = await embedIntoRepository(
      'ghs_abc', 'octocat/mi-landing', 'ds', colors, typography, null, null,
      componentCode, additionalComponents, 'Mi Brand',
    )

    expect(result.isInitialCommit).toBe(false)
    expect(result.prNumber).toBe(7)
    expect(result.prUrl).toContain('pull/7')
    expect(mockCreateRef).toHaveBeenCalledWith(expect.objectContaining({ sha: 'sha-main' }))
    expect(mockPullsCreate).toHaveBeenCalledWith(expect.objectContaining({ base: 'main' }))

    const paths = mockCreateOrUpdateFileContents.mock.calls.map(([args]) => args.path)
    expect(paths.every((p) => p.startsWith('ds/'))).toBe(true)
  })

  it('throws GithubRepoNotFoundError (not a raw 404) when the target repo does not exist', async () => {
    mockGet.mockRejectedValue({ status: 404 })

    await expect(embedIntoRepository(
      'ghs_abc', 'octocat/does-not-exist', 'design-system', colors, typography, null, null,
      componentCode, additionalComponents, 'Mi Brand',
    )).rejects.toThrow(GithubRepoNotFoundError)

    expect(mockCreateOrUpdateFileContents).not.toHaveBeenCalled()
  })

  it('throws GithubRepoAccessDeniedError when the connected account cannot push to the target repo', async () => {
    mockGet.mockResolvedValue({ data: { default_branch: 'main', permissions: { push: false } } })

    await expect(embedIntoRepository(
      'ghs_abc', 'octocat/someone-elses-repo', 'design-system', colors, typography, null, null,
      componentCode, additionalComponents, 'Mi Brand',
    )).rejects.toThrow(GithubRepoAccessDeniedError)

    expect(mockGetBranch).not.toHaveBeenCalled()
    expect(mockCreateOrUpdateFileContents).not.toHaveBeenCalled()
  })
})
