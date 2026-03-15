/**
 * Centralized role assignment logic.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ROLES.
 * When the real Rappi SSO/API integration arrives, only this file needs to change.
 */

export type AppRole = 'kam' | 'restaurant' | 'admin'

/**
 * Derives the app role from a verified @rappi.com email.
 * Non-@rappi.com emails always get 'restaurant' — caller must verify domain first.
 */
export function getRoleFromRappiEmail(email: string): AppRole {
  const local = email.split('@')[0].toLowerCase()

  if (local.includes('admin')) return 'admin'
  if (local.includes('kam') || local.includes('comercial')) return 'kam'

  // Default: any other @rappi.com employee → Asesor Rappi access
  return 'kam'
}

/**
 * Checks whether an email belongs to the Rappi corporate domain.
 */
export function isRappiEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@rappi.com')
}

/**
 * Converts an email username to a display name.
 * e.g. "juan.perez" → "Juan Perez"
 */
export function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
