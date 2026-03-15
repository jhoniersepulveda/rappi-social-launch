/**
 * TEMPORARY dev auth — see lib/auth/providers.ts for the production roadmap.
 *
 * Rules:
 *  · @rappi.com  → any password accepted; role derived from email (lib/auth/roles.ts)
 *  · other email → role = 'restaurant'; must match a Restaurant.email in the DB
 */
import type { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { query } from '@/lib/db'
import { isRappiEmail, getRoleFromRappiEmail, nameFromEmail } from '@/lib/auth/roles'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email    = (credentials?.email ?? '').trim().toLowerCase()
        const password = credentials?.password ?? ''

        if (!email || !password) return null

        // ── Rappi corporate email ─────────────────────────────────────────────
        if (isRappiEmail(email)) {
          // DEV: accept any password — remove this block when SSO is live
          const role = getRoleFromRappiEmail(email)
          const name = nameFromEmail(email)
          return { id: email, email, name, role }
        }

        // ── Restaurant email (non @rappi.com) ─────────────────────────────────
        try {
          const { rows } = await query(
            'SELECT id, name, email FROM "Restaurant" WHERE LOWER(email) = $1',
            [email]
          )
          if (rows.length) {
            const r = rows[0] as { id: string; name: string; email: string }
            return {
              id:             r.id,
              email:          r.email,
              name:           r.name,
              role:           'restaurant' as const,
              restaurantId:   r.id,
              restaurantName: r.name,
            }
          }
        } catch (e) {
          console.error('[Auth] DB lookup failed:', (e as Error).message)
        }

        return null
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          role: 'kam' | 'restaurant' | 'admin'
          restaurantId?: string
          restaurantName?: string
        }
        token.role           = u.role
        token.restaurantId   = u.restaurantId
        token.restaurantName = u.restaurantName
      }
      return token
    },
    async session({ session, token }) {
      session.user.role           = token.role
      session.user.restaurantId   = token.restaurantId
      session.user.restaurantName = token.restaurantName
      return session
    },
  },

  pages:  { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
