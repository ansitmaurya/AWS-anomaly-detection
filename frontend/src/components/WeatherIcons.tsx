
export function SunIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={{ overflow: 'visible' }}>
      <circle cx="32" cy="32" r="14" fill="url(#sunGrad)" filter="drop-shadow(0 0 8px rgba(251, 191, 36, 0.75))" />
      <g className="anim-sun-rays" style={{ transformOrigin: '32px 32px' }}>
        <line x1="32" y1="6" x2="32" y2="12" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="32" y1="52" x2="32" y2="58" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="6" y1="32" x2="12" y2="32" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="52" y1="32" x2="58" y2="32" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="13.6" y1="13.6" x2="17.8" y2="17.8" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="46.2" y1="46.2" x2="50.4" y2="50.4" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="13.6" y1="50.4" x2="17.8" y2="46.2" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="46.2" y1="17.8" x2="50.4" y2="13.6" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      </g>
      <defs>
        <radialGradient id="sunGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="65%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export function RainIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <path
        className="anim-cloud"
        d="M46 38C49.3137 38 52 35.3137 52 32C52 28.6863 49.3137 26 46 26C45.8 26 45.6 26.02 45.4 26.05C44.4 20.9 39.9 17 34.5 17C28.4 17 23.4 21.6 22.8 27.5C22.2 27.2 21.6 27 21 27C17.134 27 14 30.134 14 34C14 37.866 17.134 41 21 41H46"
        fill="url(#cloudGrad)"
      />
      <line className="anim-rain-drop-1" x1="22" y1="44" x2="19" y2="52" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      <line className="anim-rain-drop-2" x1="32" y1="44" x2="29" y2="54" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      <line className="anim-rain-drop-3" x1="42" y1="44" x2="39" y2="52" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="cloudGrad" x1="14" y1="17" x2="52" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function CloudSunIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="24" cy="24" r="10" fill="#f59e0b" />
      <path
        className="anim-cloud"
        d="M48 42C50.7614 42 53 39.7614 53 37C53 34.2386 50.7614 32 48 32C47.8 32 47.6 32.02 47.4 32.05C46.5 27.5 42.6 24 37.8 24C32.4 24 28 28 27.3 33.3C26.8 33.1 26.3 33 25.8 33C22.5 33 19.8 35.7 19.8 39C19.8 42.3 22.5 45 25.8 45H48"
        fill="url(#cloudSoftGrad)"
      />
      <defs>
        <linearGradient id="cloudSoftGrad" x1="20" y1="24" x2="53" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function StormIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <path
        d="M46 34C49.3 34 52 31.3 52 28C52 24.7 49.3 22 46 22C45.8 22 45.6 22.02 45.4 22.05C44.4 16.9 39.9 13 34.5 13C28.4 13 23.4 17.6 22.8 23.5C22.2 23.2 21.6 23 21 23C17.1 23 14 26.1 14 30C14 33.9 17.1 37 21 37H46"
        fill="#334155"
      />
      <polygon points="30,36 24,46 31,46 27,56 38,44 31,44" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
    </svg>
  )
}
