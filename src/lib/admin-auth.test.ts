/**
 * @jest-environment node
 */
import { isAllowedAdminEmail } from './admin-auth'

describe('isAllowedAdminEmail', () => {
  const orig = process.env.ADMIN_EMAILS
  afterEach(() => { process.env.ADMIN_EMAILS = orig })

  it('admits nobody when ADMIN_EMAILS is unset or empty', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAllowedAdminEmail('anyone@example.com')).toBe(false)
    process.env.ADMIN_EMAILS = ' , '
    expect(isAllowedAdminEmail('anyone@example.com')).toBe(false)
  })

  it('only allows listed emails when configured (case-insensitive)', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com, test-admin@perchtrail.example'
    expect(isAllowedAdminEmail('admin@example.com')).toBe(true)
    expect(isAllowedAdminEmail('Admin@Example.com')).toBe(true)
    expect(isAllowedAdminEmail('test-admin@perchtrail.example')).toBe(true)
    expect(isAllowedAdminEmail('stranger@evil.example')).toBe(false)
    expect(isAllowedAdminEmail('test-admin@other.example')).toBe(false)
    expect(isAllowedAdminEmail(null)).toBe(false)
  })
})
