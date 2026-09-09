import { useState, useEffect, useRef } from 'react'

interface VirtualCursorDemoProps {
  isOpen: boolean
  onClose: () => void
  onSwitchTab: (tab: 'map' | 'simulator' | 'explorer' | 'analytics' | 'stations') => void
  onUpdateFormData: (updates: Record<string, any>) => void
  onTriggerPrediction: () => void
  onFilterExplorer?: (severity: string) => void
  onStepChange?: (title: string) => void
}

export function VirtualCursorDemo({
  isOpen,
  onClose,
  onSwitchTab,
  onUpdateFormData,
  onTriggerPrediction,
  onFilterExplorer,
  onStepChange
}: VirtualCursorDemoProps) {
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 200, y: 200 })
  const [isClicking, setIsClicking] = useState<boolean>(false)
  const [actionLabel, setActionLabel] = useState<string>('')
  const [isMoving, setIsMoving] = useState<boolean>(true)
  const isCancelledRef = useRef<boolean>(false)

  // Delay helper
  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        if (!isCancelledRef.current) resolve()
      }, ms)
      return () => clearTimeout(t)
    })

  // Smooth cursor move to element
  const moveTo = async (selector: string, label: string, offsetX = 0, offsetY = 0) => {
    if (isCancelledRef.current) return
    setActionLabel(label)
    if (onStepChange) onStepChange(label)

    const el = document.querySelector(selector)
    if (el) {
      const rect = el.getBoundingClientRect()
      // If element is off-screen, gently scroll into view
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await delay(350)
      }
      const updatedRect = el.getBoundingClientRect()
      const targetX = updatedRect.left + updatedRect.width / 2 + offsetX
      const targetY = updatedRect.top + updatedRect.height / 2 + offsetY
      setIsMoving(true)
      setCursorPos({ x: targetX, y: targetY })
      await delay(700)
    } else {
      await delay(500)
    }
  }

  // Click animation helper
  const click = async (action?: () => void) => {
    if (isCancelledRef.current) return
    setIsClicking(true)
    if (action) {
      action()
    }
    await delay(200)
    setIsClicking(false)
    await delay(300)
  }

  // Realistic character-by-character typing animation
  const typeIntoField = async (
    selector: string,
    fieldKey: string,
    targetVal: number | string,
    label: string
  ) => {
    if (isCancelledRef.current) return
    await moveTo(selector, label)
    await click(() => {
      const el = document.querySelector(selector) as HTMLInputElement
      if (el) el.focus()
    })

    const strVal = String(targetVal)
    let currentStr = ''
    for (let i = 0; i < strVal.length; i++) {
      if (isCancelledRef.current) return
      currentStr += strVal[i]
      onUpdateFormData({ [fieldKey]: isNaN(Number(currentStr)) ? currentStr : Number(currentStr) })
      await delay(80)
    }
    await delay(200)
  }

  // Run the full demo workflow with virtual cursor
  useEffect(() => {
    if (!isOpen) {
      isCancelledRef.current = true
      return
    }

    isCancelledRef.current = false

    const runSequence = async () => {
      // Start cursor near top left
      setCursorPos({ x: 120, y: 180 })
      await delay(400)

      // 1. Navigate to Simulator
      await moveTo('#tab-btn-simulator', 'Navigating to Live ML Simulator ⚡')
      await click(() => onSwitchTab('simulator'))
      await delay(500)

      // 2. Type Nominal Values
      await typeIntoField('#input-max-temp', 'max_temp', 31.5, 'Typing Max Temp: 31.5°C')
      await typeIntoField('#input-avg-temp', 'avg_temp', 26.5, 'Typing Avg Temp: 26.5°C')
      await typeIntoField('#input-rainfall', 'rainfall', 3.2, 'Typing Rainfall: 3.2mm')

      // Click Execute ML Prediction for Nominal Weather
      await moveTo('#btn-run-prediction', 'Running Baseline ML Inference 🚀')
      await click(() => onTriggerPrediction())
      await delay(1200)

      // 3. Inject Sensor Heat Spike Anomaly (87°C)
      await typeIntoField('#input-max-temp', 'max_temp', 87.0, '🔥 Injecting 87.0°C Heat Spike Fault')
      await typeIntoField('#input-avg-temp', 'avg_temp', 62.0, 'Updating Avg Temp: 62.0°C')

      // Click Execute ML Prediction for Anomaly Detection
      await moveTo('#btn-run-prediction', 'Executing ML Anomaly Analysis 🚨')
      await click(() => onTriggerPrediction())
      await delay(1600)

      // 4. Navigate to Historical Explorer
      await moveTo('#tab-btn-explorer', 'Opening Anomaly Explorer 🔍')
      await click(() => onSwitchTab('explorer'))
      await delay(600)

      // Apply Severity Filter
      await moveTo('#select-severity-filter', 'Filtering to High Severity Anomalies')
      await click(() => {
        if (onFilterExplorer) onFilterExplorer('HIGH')
      })
      await delay(1400)

      // 5. Navigate to Geospatial AWS Map
      await moveTo('#tab-btn-map', 'Viewing Pan-India AWS Station Network 🗺️')
      await click(() => onSwitchTab('map'))
      await delay(1500)

      // 6. Navigate to Telemetry Analytics
      await moveTo('#tab-btn-analytics', 'Inspecting Multi-Series Analytics 📊')
      await click(() => onSwitchTab('analytics'))
      await delay(1500)

      // 7. Navigate to Station Fleet Network
      await moveTo('#tab-btn-stations', 'Checking AWS Fleet Health Diagnostics 📍')
      await click(() => onSwitchTab('stations'))
      await delay(1500)

      // Completed
      if (!isCancelledRef.current) {
        setActionLabel('Demo Complete ✨')
        await delay(800)
        onClose()
      }
    }

    runSequence()

    return () => {
      isCancelledRef.current = true
    }
  }, [isOpen])

  // Escape key to stop demo
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        isCancelledRef.current = true
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="virtual-cursor-layer" aria-hidden="true">
      <div
        className={`virtual-cursor-agent ${isClicking ? 'clicking' : ''}`}
        style={{
          transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          transition: isMoving ? 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
        }}
      >
        {/* Animated Custom Pointer Arrow */}
        <svg
          className="virtual-cursor-arrow"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 2L20 11L12.5 13.5L9.5 21L3 2Z"
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>

        {/* Click wave ripple */}
        {isClicking && <span className="virtual-cursor-ripple" />}

        {/* Dynamic Action Badge Tooltip */}
        {actionLabel && (
          <div className="virtual-cursor-label">
            <span className="virtual-cursor-dot" />
            <span>{actionLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
