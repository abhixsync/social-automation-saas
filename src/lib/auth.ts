import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { PLAN_CONFIG } from '@/types'
import type { Plan, Currency } from '@/generated/prisma/enums'

// Extend NextAuth types
declare module 'next-auth' {
  interface User {
    plan: Plan
    currency: Currency
    aiCreditsTotal: number
    aiCreditsUsed: number
    lifetimeFree: boolean
  }
  interface Session {
    user: {
      id: string
      plan: Plan
      currency: Currency
      aiCreditsTotal: number
      aiCreditsUsed: number
      lifetimeFree: boolean
    } & { name?: string | null; email?: string | null; image?: string | null }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            plan: true,
            currency: true,
            aiCreditsTotal: true,
            aiCreditsUsed: true,
            lifetimeFree: true,
          },
        })

        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          plan: user.plan,
          currency: user.currency,
          aiCreditsTotal: user.aiCreditsTotal,
          aiCreditsUsed: user.aiCreditsUsed,
          lifetimeFree: user.lifetimeFree,
        }
      },
    }),
  ],

  callbacks: {
    // Detect country for Google OAuth users — signIn fires after adapter creates the user,
    // so the row exists and we can update it. Uses updateMany + currency guard so manual
    // changes made later in Settings are never overwritten.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn({ user, account, request }: any) {
      if (account?.provider === 'google' && user?.id && request) {
        const country = request.headers?.get?.('x-vercel-ip-country') ?? 'IN'
        const detectedCurrency = country === 'IN' ? 'INR' : 'USD'
        if (detectedCurrency !== 'INR') {
          // Only auto-set on first sign-in (user created within the last 30s).
          // After that, currency is the user's own choice — never overwrite it.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { createdAt: true },
          })
          const isNewUser = dbUser && Date.now() - dbUser.createdAt.getTime() < 30_000
          if (isNewUser) {
            await prisma.user.update({
              where: { id: user.id },
              data: { currency: detectedCurrency },
            })
          }
        }
      }
      return true
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger }: any) {
      if (user) {
        token.id = user.id as string
        token.plan = user.plan as Plan
        token.currency = user.currency as Currency
        token.aiCreditsTotal = user.aiCreditsTotal as number
        token.aiCreditsUsed = user.aiCreditsUsed as number
        token.lifetimeFree = user.lifetimeFree as boolean
      }

      // Refresh on explicit update (e.g. after billing change)
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            plan: true,
            currency: true,
            aiCreditsTotal: true,
            aiCreditsUsed: true,
            lifetimeFree: true,
          },
        })
        if (fresh) {
          token.plan = fresh.plan
          token.currency = fresh.currency
          token.aiCreditsTotal = fresh.aiCreditsTotal
          token.aiCreditsUsed = fresh.aiCreditsUsed
          token.lifetimeFree = fresh.lifetimeFree
        }
      }

      return token
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id as string
        session.user.plan = token.plan as Plan
        session.user.currency = token.currency as Currency
        session.user.aiCreditsTotal = token.aiCreditsTotal as number
        session.user.aiCreditsUsed = token.aiCreditsUsed as number
        session.user.lifetimeFree = token.lifetimeFree as boolean
      }
      return session
    },
  },

  events: {
    // New Google OAuth users: set defaults
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id! },
        data: {
          plan: 'free',
          currency: 'INR',
          aiCreditsTotal: PLAN_CONFIG.free.creditsPerMonth,
          aiCreditsUsed: 0,
          creditsResetAt: new Date(),
        },
      })
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
})
