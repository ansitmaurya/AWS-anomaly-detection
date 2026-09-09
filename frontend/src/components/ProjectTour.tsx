import { useState, useEffect, useRef } from 'react'

export interface TourStep {
  id: string
  tab: 'map' | 'simulator' | 'explorer' | 'analytics' | 'stations'
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  durationSec: number
  description: string
  highlights: string[]
  metrics?: { label: string; val: string }[]
  action?: () => void
}

interface ProjectTourProps {
  isOpen: boolean
  onClose: () => void
  onSwitchTab: (tab: 'map' | 'simulator' | 'explorer' | 'analytics' | 'stations') => void
  onApplyPreset: (type: string) => void
  onTriggerPrediction: () => void
  onFilterExplorer?: (severity: string) => void
  statsData?: {
    totalRecords: number
    anomalies: number
    stations: number
  }
}

// Sound Synthesizer via Web Audio API for tech chime cues
const playTourSound = (type: 'step' | 'complete' | 'alert') => {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'step') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'alert') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.setValueAtTime(880, now + 0.08)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      osc.start(now)
      osc.stop(now + 0.28)
    } else if (type === 'complete') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2) // G5
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc.start(now)
      osc.stop(now + 0.45)
    }
  } catch {
    // Audio context may be restricted by browser policy before user interaction
  }
}

export function ProjectTour({
  isOpen,
  onClose,
  onSwitchTab,
  onApplyPreset,
  onTriggerPrediction,
  onFilterExplorer,
  statsData
}: ProjectTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [timeRemaining, setTimeRemaining] = useState<number>(6)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const steps: TourStep[] = [
    {
      id: 'step-map',
      tab: 'map',
      title: 'Geospatial AWS Station Network',
      subtitle: 'Nationwide Telemetry Nodes & Coverage',
      badge: '🗺️ STEP 1 OF 6',
      badgeColor: '#10b981',
      durationSec: 7,
      description:
        'Interactive geospatial mapping of 406 Automatic Weather Stations (AWS) spanning across India (7.98°N–34.08°N, 68.85°E–95.38°E). Stations continuously stream sensor readings with color-coded operational health markers.',
      highlights: [
        '406 Synoptic Nodes across 32 States & Union Territories',
        'Real-time coordinates, elevation telemetry, and sensor status',
        'Interactive station cards with one-click simulator inspection'
      ],
      metrics: [
        { label: 'Network Nodes', val: `${statsData?.stations || 406} AWS` },
        { label: 'Geographic Span', val: 'Pan-India' },
        { label: 'Data Quality', val: 'ISO 9001 Met Specs' }
      ],
      action: () => {
        onSwitchTab('map')
      }
    },
    {
      id: 'step-simulator-normal',
      tab: 'simulator',
      title: 'Real-Time ML Anomaly Inference Engine',
      subtitle: 'Nominal Baseline Weather Simulation',
      badge: '⚡ STEP 2 OF 6',
      badgeColor: '#0284c7',
      durationSec: 7,
      description:
        'The Live ML Simulator allows meteorological engineers to test live sensor feeds against trained Isolation Forest models and physical meteorological sanity bounds.',
      highlights: [
        'Multi-variate input: Avg/Min/Max Temp, Wind Speed, Pressure, Rainfall & Elevation',
        'External Open-Meteo API live synoptic reference comparison',
        'Instant multi-parameter validation and nominal confidence scoring'
      ],
      metrics: [
        { label: 'Model Architecture', val: 'Isolation Forest' },
        { label: 'Latency', val: '< 12 ms' },
        { label: 'Nominal Status', val: 'PASSED' }
      ],
      action: () => {
        onSwitchTab('simulator')
        onApplyPreset('normal')
        setTimeout(() => {
          onTriggerPrediction()
        }, 300)
      }
    },
    {
      id: 'step-simulator-anomaly',
      tab: 'simulator',
      title: 'Extreme Fault & Sensor Anomaly Injection',
      subtitle: 'Live Sensor Spike (87°C) & Anomaly Breakdown',
      badge: '🚨 STEP 3 OF 6',
      badgeColor: '#dc2626',
      durationSec: 8,
      description:
        'Watch the ML engine instantaneously catch a severe sensor malfunction (Max Temp 87°C heat spike). The system flags the observation as CRITICAL, calculates anomaly confidence, and isolates the faulty parameter.',
      highlights: [
        'Real-time physical bounds violation detection',
        'Parameter-level explainability breakdown (Deviation: +55.0°C above expected)',
        'Automated alert generation for calibration and field maintenance crews'
      ],
      metrics: [
        { label: 'Anomaly Status', val: 'CRITICAL (Score: 0.94)' },
        { label: 'Triggered Rule', val: 'Physical Bound Breach' },
        { label: 'Action', val: 'Flagged for Calibration' }
      ],
      action: () => {
        onSwitchTab('simulator')
        onApplyPreset('spike87')
        setTimeout(() => {
          onTriggerPrediction()
        }, 300)
      }
    },
    {
      id: 'step-explorer',
      tab: 'explorer',
      title: 'Historical Anomaly Explorer & Multi-Filter',
      subtitle: 'Query Archive of 19,400+ Flagged Observations',
      badge: '🔍 STEP 4 OF 6',
      badgeColor: '#f59e0b',
      durationSec: 7,
      description:
        'Deep-dive exploration table with multi-dimensional filtering across 970,000+ total historical telemetry records. Filter by state, severity level (Critical/Moderate/Minor), date range, and anomaly score ranking.',
      highlights: [
        'Instant search by Station Name, District, and State',
        'Granular severity categorization (Critical, Warning, Minor)',
        'Full historical telemetry inspection with parameter deviation highlights'
      ],
      metrics: [
        { label: 'Total Records', val: `${statsData?.totalRecords?.toLocaleString() || '970,339'}` },
        { label: 'Detected Anomalies', val: `${statsData?.anomalies?.toLocaleString() || '19,407'}` },
        { label: 'Anomaly Rate', val: '2.00%' }
      ],
      action: () => {
        onSwitchTab('explorer')
        if (onFilterExplorer) {
          onFilterExplorer('Critical')
        }
      }
    },
    {
      id: 'step-analytics',
      tab: 'analytics',
      title: 'Telemetry Analytics & Synoptic Correlations',
      subtitle: 'Multi-Axis Time-Series & Drift Analysis',
      badge: '📊 STEP 5 OF 6',
      badgeColor: '#8b5cf6',
      durationSec: 7,
      description:
        'Visual analytics hub charting multi-station meteorological trends. Explore temperature distributions, pressure-rainfall correlations, cyclone signatures, and seasonal sensor drift patterns.',
      highlights: [
        'Interactive Chart.js multi-series telemetry graphs',
        'Correlation heatmaps between barometric pressure and wind anomalies',
        'Seasonal anomaly density clustering across monsoon and summer cycles'
      ],
      metrics: [
        { label: 'Archive Span', val: '2015 – 2025' },
        { label: 'Metrics Tracked', val: '6 Environmental Channels' },
        { label: 'Visualization', val: 'Synoptic Time-Series' }
      ],
      action: () => {
        onSwitchTab('analytics')
      }
    },
    {
      id: 'step-stations',
      tab: 'stations',
      title: 'Station Fleet Health & Diagnostics',
      subtitle: 'Fleet-Wide Quality Control & Attention Index',
      badge: '📍 STEP 6 OF 6',
      badgeColor: '#059669',
      durationSec: 7,
      description:
        'Fleet-level management dashboard monitoring all 406 AWS stations. Quickly identify stations requiring attention (anomaly rate > 5%), inspect uptime percentages, and schedule field recalibrations.',
      highlights: [
        'Health status ranking: Healthy (Normal), Attention Required, Under Maintenance',
        'Station-by-station anomaly rate metrics and historic alert logs',
        'Direct link to launch targeted live simulation for any AWS node'
      ],
      metrics: [
        { label: 'Monitored AWS Nodes', val: `${statsData?.stations || 406}` },
        { label: 'Review Threshold', val: '> 5.0% Anomaly Rate' },
        { label: 'Fleet Quality', val: '98.0% Operational' }
      ],
      action: () => {
        onSwitchTab('stations')
      }
    }
  ]

  // Reset or run step action when currentStepIndex changes
  useEffect(() => {
    if (!isOpen) return
    const curStep = steps[currentStepIndex]
    if (curStep && curStep.action) {
      curStep.action()
    }
    if (soundEnabled) {
      if (curStep.id === 'step-simulator-anomaly') {
        playTourSound('alert')
      } else {
        playTourSound('step')
      }
    }
    const initialDuration = Math.round(curStep.durationSec / playbackSpeed)
    setTimeRemaining(initialDuration)
  }, [currentStepIndex, isOpen, playbackSpeed])

  // Handle countdown timer & auto step advance
  useEffect(() => {
    if (!isOpen || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const interval = 100 // update every 100ms
    const stepDuration = steps[currentStepIndex].durationSec / playbackSpeed

    const startTime = Date.now()
    const targetEnd = startTime + stepDuration * 1000

    progressIntervalRef.current = setInterval(() => {
      const msLeft = Math.max(0, targetEnd - Date.now())
      const secLeft = Math.ceil(msLeft / 1000)
      setTimeRemaining(secLeft)

      if (msLeft <= 0) {
        clearInterval(progressIntervalRef.current!)
        // Advance to next step
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1)
        } else {
          // Completed
          if (soundEnabled) playTourSound('complete')
          setIsPlaying(false)
        }
      }
    }, interval)

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [currentStepIndex, isOpen, isPlaying, playbackSpeed, steps.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(prev => !prev)
      } else if (e.key === 'ArrowRight') {
        goToNext()
      } else if (e.key === 'ArrowLeft') {
        goToPrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentStepIndex])

  const goToNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      setCurrentStepIndex(0)
    }
  }

  const goToPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  const jumpToStep = (index: number) => {
    setCurrentStepIndex(index)
  }

  const [isMinimized, setIsMinimized] = useState<boolean>(false)

  if (!isOpen) return null

  const currentStep = steps[currentStepIndex]
  const currentStepDuration = currentStep.durationSec / playbackSpeed
  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentStepDuration - timeRemaining) / currentStepDuration) * 100)
  )

  const isLastStep = currentStepIndex === steps.length - 1

  return (
    <div className="tour-overlay-container">
      {/* Floating HUD Tour Controller Box (Zero background blur on dashboard) */}
      <div className={`tour-hud-box ${isMinimized ? 'minimized' : ''}`}>
        
        {/* Top Header Bar */}
        <div className="tour-hud-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="tour-live-indicator">
              <span className="tour-pulse-core" />
              {isMinimized ? currentStep.title : 'PROJECT DEMO WALKTHROUGH'}
            </span>
            <span
              className="tour-step-badge"
              style={{
                backgroundColor: `${currentStep.badgeColor}22`,
                color: currentStep.badgeColor,
                borderColor: `${currentStep.badgeColor}55`
              }}
            >
              {currentStep.badge}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* Minimize / Expand Toggle */}
            <button
              onClick={() => setIsMinimized(m => !m)}
              title={isMinimized ? 'Expand Tour Info' : 'Minimize Tour HUD'}
              className="tour-icon-btn"
            >
              {isMinimized ? '🔼 Expand' : '🔽 Compact'}
            </button>

            {/* Sound FX Toggle */}
            <button
              onClick={() => setSoundEnabled(s => !s)}
              title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
              className="tour-icon-btn"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>

            {/* Speed Multiplier */}
            <div className="tour-speed-selector">
              {[1, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`tour-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Exit Project Demo (Esc)"
              className="tour-close-btn"
            >
              ✕ Exit
            </button>
          </div>
        </div>

        {/* Step Progress Visualizer Bar */}
        <div className="tour-progress-track">
          <div
            className="tour-progress-fill"
            style={{
              width: `${((currentStepIndex + progressPercent / 100) / steps.length) * 100}%`
            }}
          />
        </div>

        {/* Main Content Body (hidden if minimized) */}
        {!isMinimized && (
          <div className="tour-body-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h2 className="tour-step-title">{currentStep.title}</h2>
                <div className="tour-step-subtitle">{currentStep.subtitle}</div>
              </div>
              
              {/* Countdown Badge */}
              <div className="tour-countdown-badge">
                {isPlaying ? (
                  <span>Next in {timeRemaining}s</span>
                ) : (
                  <span style={{ color: '#fbbf24' }}>⏸ Paused</span>
                )}
              </div>
            </div>

            <p className="tour-step-desc">{currentStep.description}</p>

            {/* Highlights & Features List */}
            <div className="tour-highlights-grid">
              <div className="tour-highlights-box">
                <div className="tour-highlights-heading">Key Capabilities Demonstrated:</div>
                <ul className="tour-highlights-list">
                  {currentStep.highlights.map((h, i) => (
                    <li key={i}>
                      <span className="tour-check-mark">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Metrics Mini-Pills */}
              {currentStep.metrics && (
                <div className="tour-metrics-column">
                  <div className="tour-highlights-heading">Live Telemetry Metrics:</div>
                  <div className="tour-metrics-grid">
                    {currentStep.metrics.map((m, i) => (
                      <div key={i} className="tour-metric-pill">
                        <span className="tour-metric-label">{m.label}</span>
                        <span className="tour-metric-val">{m.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Interactive Playback Controls */}
        <div className="tour-hud-footer">
          {/* Step Selector Breadcrumbs */}
          <div className="tour-steps-nav">
            {steps.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => jumpToStep(idx)}
                className={`tour-step-dot ${idx === currentStepIndex ? 'active' : ''} ${idx < currentStepIndex ? 'completed' : ''}`}
                title={`Jump to ${st.title}`}
              >
                <span className="dot-num">{idx + 1}</span>
                <span className="dot-label">{st.tab.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={goToPrev}
              disabled={currentStepIndex === 0}
              className="tour-nav-btn"
              title="Previous Step (Left Arrow)"
            >
              ◀ Prev
            </button>

            <button
              onClick={() => setIsPlaying(p => !p)}
              className="tour-play-btn"
              title={isPlaying ? 'Pause Demo (Space)' : 'Resume Auto Demo (Space)'}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play Auto'}
            </button>

            {isLastStep ? (
              <button
                onClick={() => {
                  setCurrentStepIndex(0)
                  setIsPlaying(true)
                }}
                className="tour-finish-btn"
              >
                🔄 Replay Tour
              </button>
            ) : (
              <button
                onClick={goToNext}
                className="tour-next-btn"
                title="Next Step (Right Arrow)"
              >
                Next ▶
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
