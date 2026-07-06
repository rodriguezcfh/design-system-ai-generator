import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../lib/crypto'

describe('encrypt / decrypt', () => {
  it('round-trips a string', () => {
    const original = 'ghs_supersecretgithubtoken1234'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('produces a non-empty ciphertext', () => {
    expect(encrypt('hello')).not.toBe('')
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encrypt('same text')
    const b = encrypt('same text')
    expect(a).not.toBe(b)
  })

  it('ciphertext has three colon-separated segments (iv:tag:data)', () => {
    const parts = encrypt('test').split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0].length).toBe(32) // 16-byte IV as hex
    expect(parts[1].length).toBe(32) // 16-byte GCM tag as hex
  })

  it('throws when decrypting tampered ciphertext', () => {
    const enc = encrypt('sensitive')
    const [iv, tag, data] = enc.split(':')
    const tampered = [iv, tag, data.slice(0, -2) + 'ff'].join(':')
    expect(() => decrypt(tampered)).toThrow()
  })
})
