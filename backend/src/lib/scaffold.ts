export function buildColorsJson(colors: Record<string, string>): string {
  return JSON.stringify(colors, null, 2)
}

export function buildTypographyJson(typography: Record<string, unknown>): string {
  return JSON.stringify(typography, null, 2)
}

export function buildTailwindConfig(colors: Record<string, string>): string {
  const colorEntries = Object.entries(colors)
    .map(([key]) => {
      const tailwindKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `        '${tailwindKey}': colors['${key}'],`
    })
    .join('\n')

  return `const colors = require('./src/tokens/colors.json')
const typography = require('./src/tokens/typography.json')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './.storybook/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
${colorEntries}
      },
      fontFamily: {
        sans: typography.fontFamily
          ? typography.fontFamily.split(',').map(f => f.trim())
          : ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
`
}

export function buildPostcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

export function buildVercelConfig(): string {
  return JSON.stringify(
    {
      buildCommand: 'npm run build-storybook',
      outputDirectory: 'storybook-static',
    },
    null,
    2,
  ) + '\n'
}

export function buildPackageJson(repoName: string): string {
  return JSON.stringify(
    {
      name: repoName,
      private: true,
      version: '0.0.1',
      scripts: {
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build',
      },
      dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
      devDependencies: {
        '@storybook/addon-essentials': '^8.0.0',
        '@storybook/react-vite': '^8.0.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0',
        storybook: '^8.0.0',
        tailwindcss: '^3.4.0',
        vite: '^5.0.0',
      },
    },
    null,
    2,
  )
}

export function buildStorybookMain(): string {
  return `/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
}
export default config
`
}

export function buildStorybookPreview(): string {
  return `import '../src/index.css'

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
}
export default preview
`
}

export function buildIndexCss(): string {
  return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
}

export function buildButtonStories(): string {
  return `import { Button } from './Button'

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
}

export const Primary = { args: { children: 'Click me', variant: 'primary', size: 'md' } }
export const Secondary = { args: { children: 'Click me', variant: 'secondary', size: 'md' } }
export const Ghost = { args: { children: 'Click me', variant: 'ghost', size: 'md' } }
export const Small = { args: { children: 'Click me', variant: 'primary', size: 'sm' } }
export const Large = { args: { children: 'Click me', variant: 'primary', size: 'lg' } }
export const Disabled = { args: { children: 'Click me', disabled: true } }
`
}
