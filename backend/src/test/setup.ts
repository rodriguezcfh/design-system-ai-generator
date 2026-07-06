process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes as hex — test only
process.env.GITHUB_CLIENT_ID = 'test-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret'
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3001/api/auth/github/callback'
process.env.FRONTEND_URL = 'http://localhost:5173'
