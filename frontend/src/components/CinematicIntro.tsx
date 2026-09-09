import { useState, useEffect } from 'react'

interface CinematicIntroProps {
  onEnter: () => void
}

export function CinematicIntro({ onEnter }: CinematicIntroProps) {
  const [stage, setStage] = useState<number>(0)
  const [isExiting, setIsExiting] = useState<boolean>(false)

  useEffect(() => {
    // Timed reveals for cinematic activation flow
    const t1 = setTimeout(() => setStage(1), 300)   // Radar & ambient nodes reveal
    const t2 = setTimeout(() => setStage(2), 1200)  // Status badge & branding reveal
    const t3 = setTimeout(() => setStage(3), 2200)  // Enter button reveal

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  const handleEnterClick = () => {
    setIsExiting(true)
    setTimeout(() => {
      onEnter()
    }, 650)
  }

  return (
    <div
      className={`cinematic-intro-root ${isExiting ? 'intro-exiting' : ''}`}
      role="region"
      aria-label="System Activation Introduction"
    >
      {/* BACKGROUND SCIENTIFIC RADAR & ATMOSPHERIC GRID */}
      <div className="intro-backdrop" aria-hidden="true">
        <div className="intro-vignette" />
        <div className="intro-grid" />
        <div className="intro-aurora-glow" />

        {/* Central Tactical Radar Reticle */}
        <div className={`intro-radar-container ${stage >= 1 ? 'revealed' : ''}`}>
          <div className="intro-radar-ring ring-3" />
          <div className="intro-radar-ring ring-2" />
          <div className="intro-radar-ring ring-1" />
          <div className="intro-radar-crosshair-h" />
          <div className="intro-radar-crosshair-v" />
          <div className="intro-radar-sweep-beam" />

          {/* Meteorological Network Station Nodes */}
          <div className="intro-node node-nw" title="AWS Node NW" />
          <div className="intro-node node-ne" title="AWS Node NE" />
          <div className="intro-node node-sw" title="AWS Node SW" />
          <div className="intro-node node-se" title="AWS Node SE" />
          <div className="intro-node node-center" title="Central Hub" />
        </div>

        {/* Floating Minimal Micro-Particles */}
        <div className="intro-particles">
          <span className="intro-particle ip1" />
          <span className="intro-particle ip2" />
          <span className="intro-particle ip3" />
          <span className="intro-particle ip4" />
          <span className="intro-particle ip5" />
          <span className="intro-particle ip6" />
          <span className="intro-particle ip7" />
          <span className="intro-particle ip8" />
        </div>
      </div>

      {/* FOREGROUND HERO CONTENT */}
      <div className="intro-content-container">
        
        {/* Concept Badge */}
        <div className={`intro-badge-wrapper ${stage >= 1 ? 'visible' : ''}`}>
          <div className="intro-system-badge">
            <span className="intro-pulse-dot" />
            <span>WEATHER INTELLIGENCE SYSTEM ACTIVATION</span>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className={`intro-typography ${stage >= 2 ? 'visible' : ''}`}>
          <h1 className="intro-main-title">
            AWS ANOMALY DETECTION SYSTEM
          </h1>
          <p className="intro-subtitle">
            Intelligent Monitoring of Automatic Weather Stations
          </p>
          <div className="intro-meta-tags">
            <span className="intro-meta-item">406 Geospatial AWS Nodes</span>
            <span className="intro-meta-divider">•</span>
            <span className="intro-meta-item">Isolation Forest ML</span>
            <span className="intro-meta-divider">•</span>
            <span className="intro-meta-item">Real-Time Telemetry Analytics</span>
          </div>
        </div>

        {/* Prominent Enter Button */}
        <div className={`intro-action-wrapper ${stage >= 3 ? 'visible' : ''}`}>
          <button
            type="button"
            className="intro-enter-btn"
            onClick={handleEnterClick}
            id="enter-monitoring-system-btn"
          >
            <span>ENTER MONITORING SYSTEM</span>
            <span className="intro-btn-arrow">→</span>
          </button>
          <div className="intro-hint-text">
            Click to initialize operations center & live telemetry feeds
          </div>
        </div>

      </div>
    </div>
  )
}
