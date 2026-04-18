import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PLAN_CONFIG, TOPUP_CREDITS, TOPUP_PRICE_INR, TOPUP_PRICE_USD } from '@/types'
import type { Plan } from '@/generated/prisma/enums'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap } from 'lucide-react'
import BillingActions from './BillingActions'

const PLAN_ORDER: Plan[] = ['free', 'pro']

function modelLabel(model: string) {
  switch (model) {
    case 'llama_3_1_8b': return 'Llama 3.1 8B'
    case 'llama_3_3_70b': return 'Llama 3.3 70B'
    case 'claude_sonnet': return 'Claude Sonnet'
    default: return model
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string; topup?: string; error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const params = await searchParams
  const currentPlan = session.user.plan as Plan
  const currency = session.user.currency
  const userName = session.user.name ?? undefined
  const userEmail = session.user.email ?? undefined

  // Fetch fresh credits from DB — JWT is stale after worker deducts credits
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiCreditsUsed: true, aiCreditsTotal: true, lifetimeFree: true },
  })
  const lifetimeFree = dbUser?.lifetimeFree ?? false
  const creditsUsed = lifetimeFree ? 0 : (dbUser?.aiCreditsUsed ?? session.user.aiCreditsUsed)
  const creditsTotal = lifetimeFree ? Infinity : (dbUser?.aiCreditsTotal ?? session.user.aiCreditsTotal)
  const creditsPct = lifetimeFree ? 0 : (creditsTotal > 0 ? Math.min(100, (creditsUsed / (creditsTotal as number)) * 100) : 0)
  const currentConfig = PLAN_CONFIG[currentPlan]

  const topupPrice = currency === 'INR' ? `₹${TOPUP_PRICE_INR}` : `$${(TOPUP_PRICE_USD / 100).toFixed(2)}`

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your plan, credits, and billing</p>
      </div>

      {lifetimeFree && (
        <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 flex items-center gap-3">
          <span className="text-2xl">∞</span>
          <div>
            <p className="text-sm font-semibold text-indigo-800">Lifetime Free</p>
            <p className="text-xs text-indigo-600">You have unlimited credits. Enjoy!</p>
          </div>
        </div>
      )}

      {currentPlan === 'on_hold' && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Payment failed.</strong> Your subscription is on hold. Please update your payment
          method with Dodo Payments to restore Pro access.
        </div>
      )}

      {params.success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          Your subscription was updated successfully.
        </div>
      )}
      {params.topup && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          Credits added successfully. Your balance has been updated.
        </div>
      )}
      {params.error === 'max_accounts' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          You&apos;ve reached your plan&apos;s account limit. Upgrade to add more LinkedIn accounts.
        </div>
      )}

      {/* Lifetime free: single wide card */}
      {lifetimeFree && (
        <Card className="border-2 border-indigo-500 bg-gradient-to-b from-indigo-50/60 to-purple-50/40 mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Lifetime Free</CardTitle>
              <Badge className="bg-indigo-100 text-indigo-700 border-0 hover:bg-indigo-100">Current Plan</Badge>
            </div>
            <p className="text-5xl font-bold text-gray-900 mt-2">∞</p>
            <p className="text-sm text-gray-500 mt-1">Unlimited everything, forever</p>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Unlimited credits', 'All LinkedIn accounts', 'Claude Sonnet AI model', 'Auto-scheduling', 'Image generation', 'Priority support'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Non-lifetime: two-column layout — left: current plan + top-up, right: plan cards */}
      {!lifetimeFree && (
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          {/* Left column */}
          <div className="flex flex-col gap-6 lg:w-2/5">
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Current Plan</CardTitle>
                  <Badge className="bg-indigo-100 text-indigo-700 border-0 capitalize hover:bg-indigo-100">
                    {currentConfig.name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Credits used this period</span>
                    <span className="font-semibold text-gray-900">{creditsUsed} / {creditsTotal}</span>
                  </div>
                  <Progress value={creditsPct} className="h-2" />
                  <p className="text-xs text-gray-400 mt-1.5">
                    {(creditsTotal as number) - creditsUsed} credits remaining · 1 credit = 50 words
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <p className="text-lg font-bold text-gray-900">{currentConfig.maxAccounts}</p>
                    <p className="text-xs text-gray-400 mt-0.5">LinkedIn accounts</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <p className="text-lg font-bold text-gray-900">{currentConfig.creditsPerMonth}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Credits / month</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <p className="text-xs font-semibold text-gray-700 mt-1">{modelLabel(currentConfig.model)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">AI model</p>
                  </div>
                </div>
                <BillingActions currentPlan={currentPlan} userName={userName} userEmail={userEmail} />
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Top Up Credits
                </CardTitle>
                <CardDescription>Need more credits before your cycle resets?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
                  <p className="text-2xl font-bold text-gray-900">{TOPUP_CREDITS}</p>
                  <p className="text-sm text-gray-500">credits</p>
                  <p className="text-lg font-semibold text-amber-600 mt-1">{topupPrice}</p>
                </div>
                <p className="text-xs text-gray-400 text-center">≈ {TOPUP_CREDITS * 50} words · never expire</p>
                <BillingActions currentPlan={currentPlan} mode="topup" userName={userName} userEmail={userEmail} />
              </CardContent>
            </Card>
          </div>

          {/* Right column: plan cards filling full height */}
          <div className="flex flex-col lg:w-3/5 flex-1">
            <h3 className="text-base font-semibold text-gray-900 mb-4">All Plans</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 auto-rows-fr">
              {PLAN_ORDER.map((planKey) => {
                const config = PLAN_CONFIG[planKey]
                const isCurrent = planKey === currentPlan
                const isPro = planKey === 'pro'
                const price = currency === 'INR'
                  ? (config.priceINR === 0 ? 'Free' : `₹${config.priceINR}/mo`)
                  : (config.priceUSD === 0 ? 'Free' : `$${config.priceUSD}/mo`)

                const features = planKey === 'free'
                  ? [
                      `${config.creditsPerMonth.toLocaleString()} credits/month`,
                      `≈ ${(config.creditsPerMonth * 50).toLocaleString()} words generated`,
                      `${config.maxAccounts} LinkedIn account`,
                      `${modelLabel(config.model)} AI model`,
                      'Auto-scheduling',
                      'Image generation (5 credits)',
                    ]
                  : [
                      `${config.creditsPerMonth.toLocaleString()} credits/month`,
                      `≈ ${(config.creditsPerMonth * 50).toLocaleString()} words generated`,
                      `Up to ${config.maxAccounts} LinkedIn accounts`,
                      `${modelLabel(config.model)} AI model`,
                      'Auto-scheduling',
                      'Image generation (5 credits)',
                      'Stock photo integration',
                      'Carousel posts',
                      'Priority support',
                    ]

                return (
                  <Card
                    key={planKey}
                    className={`border-2 transition-colors relative flex flex-col h-full ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-50/20'
                        : isPro
                        ? 'border-indigo-300 hover:border-indigo-400'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {isPro && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-indigo-600 text-white border-0 hover:bg-indigo-600 px-3">Recommended</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-4 pt-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold">{config.name}</CardTitle>
                        {isCurrent && (
                          <Badge className="bg-indigo-100 text-indigo-700 border-0 hover:bg-indigo-100">Current</Badge>
                        )}
                      </div>
                      <p className={`text-4xl font-bold mt-3 ${isPro ? 'text-indigo-700' : 'text-gray-900'}`}>{price}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {planKey === 'free' ? 'No credit card required' : 'Billed monthly · cancel anytime'}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 space-y-5">
                      <ul className="space-y-3 flex-1">
                        {features.map((f) => (
                          <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                            <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isPro ? 'text-indigo-500' : 'text-green-500'}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!isCurrent && planKey !== 'free' && (
                        <div className="pt-2">
                          <BillingActions currentPlan={currentPlan} mode="upgrade" targetPlan={planKey} userName={userName} userEmail={userEmail} />
                        </div>
                      )}
                      {isCurrent && (
                        <p className="text-sm text-indigo-600 font-medium text-center py-2 bg-indigo-50 rounded-lg">
                          Your current plan
                        </p>
                      )}
                      {!isCurrent && planKey === 'free' && currentPlan !== 'free' && (
                        <p className="text-xs text-gray-400 text-center py-2">Downgrade by cancelling your subscription</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {currentPlan !== 'free' && !lifetimeFree && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Cancel Subscription</h3>
          <p className="text-xs text-gray-500 mb-3">
            Your subscription will be cancelled immediately and your plan will revert to Free.
          </p>
          <BillingActions currentPlan={currentPlan} mode="cancel" />
        </div>
      )}
    </div>
  )
}
