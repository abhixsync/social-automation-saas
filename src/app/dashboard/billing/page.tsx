import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PLAN_CONFIG, TOPUP_CREDITS, TOPUP_PRICE_INR, TOPUP_PRICE_USD } from '@/types'
import type { Plan } from '@/generated/prisma/enums'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap } from 'lucide-react'
import BillingActions from './BillingActions'

const PLAN_ORDER: Plan[] = ['free', 'starter', 'growth', 'pro']

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
  const creditsUsed = session.user.aiCreditsUsed
  const creditsTotal = session.user.aiCreditsTotal
  const creditsPct = creditsTotal > 0 ? Math.min(100, (creditsUsed / creditsTotal) * 100) : 0
  const currentConfig = PLAN_CONFIG[currentPlan]

  const topupPrice = currency === 'INR' ? `₹${TOPUP_PRICE_INR}` : `$${(TOPUP_PRICE_USD / 100).toFixed(2)}`

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your plan, credits, and billing</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Current plan summary */}
        <Card className="border-indigo-200 bg-indigo-50/40 lg:col-span-2">
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
                <span className="font-semibold text-gray-900">
                  {creditsUsed} / {creditsTotal}
                </span>
              </div>
              <Progress value={creditsPct} className="h-2" />
              <p className="text-xs text-gray-400 mt-1.5">
                {creditsTotal - creditsUsed} credits remaining · 1 credit = 50 words
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

            <BillingActions currentPlan={currentPlan} />
          </CardContent>
        </Card>

        {/* Credit top-up */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Top Up Credits
            </CardTitle>
            <CardDescription>
              Need more credits before your cycle resets?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
              <p className="text-2xl font-bold text-gray-900">{TOPUP_CREDITS}</p>
              <p className="text-sm text-gray-500">credits</p>
              <p className="text-lg font-semibold text-amber-600 mt-1">{topupPrice}</p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              ≈ {TOPUP_CREDITS * 50} words · never expire
            </p>
            <BillingActions currentPlan={currentPlan} mode="topup" />
          </CardContent>
        </Card>
      </div>

      {/* Plan cards */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">All Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLAN_ORDER.map((planKey) => {
            const config = PLAN_CONFIG[planKey]
            const isCurrent = planKey === currentPlan
            const priceINR = config.priceINR
            const priceUSD = config.priceUSD
            const price = currency === 'INR'
              ? (priceINR === 0 ? 'Free' : `₹${priceINR}/mo`)
              : (priceUSD === 0 ? 'Free' : `$${priceUSD}/mo`)

            const features = [
              `${config.creditsPerMonth} credits/mo`,
              `${config.maxAccounts} LinkedIn account${config.maxAccounts > 1 ? 's' : ''}`,
              modelLabel(config.model),
            ]

            return (
              <Card
                key={planKey}
                className={`border-2 transition-colors ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-50/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{config.name}</CardTitle>
                    {isCurrent && (
                      <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs hover:bg-indigo-100">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{price}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {!isCurrent && planKey !== 'free' && (
                    <BillingActions currentPlan={currentPlan} mode="upgrade" targetPlan={planKey} />
                  )}
                  {isCurrent && (
                    <p className="text-xs text-indigo-600 font-medium text-center py-1">
                      Your current plan
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
