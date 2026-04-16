interface LogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { icon: 28, text: 'text-base' },
  md: { icon: 36, text: 'text-lg' },
  lg: { icon: 48, text: 'text-2xl' },
}

export function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="crescova-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#crescova-grad)" />

      {/* Sine wave — the "crescova" mark */}
      <path
        d="M5 20 C8 20, 9 10, 12.5 10 C16 10, 17 30, 20 30 C23 30, 24 10, 27.5 10 C31 10, 32 20, 35 20"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const { icon, text } = sizes[size]

  if (variant === 'icon') return <LogoIcon size={icon} />

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={icon} />
      <span className={`font-semibold tracking-tight text-gray-900 ${text}`}>
        Crescova
      </span>
    </div>
  )
}
