import { useState, useEffect, useRef } from 'react'

export interface TourStep {
  id: string
  tab: 'map' | 'simulator' | 'explorer' | 'analytics' | 'stations'
  title: string
  durationSec: number
  action?: () => void
}

interface ProjectTourProps {
  isOpen: boolean
  onClose: () => void
  onSwitchTab: (tab: 'map' | 'simulator' | 'explorer' | 'analytics' | 'stations') => void
  onApplyPreset: (type: string) => void
  onTriggerPrediction: () => void
  onFilterExplorer?: (severity: string) => void
  onStepChange?: (title: string, index: number, total: number) => void
}

export function ProjectTour({
  isOpen,
  onClose,
  onSwitchTab,
  onApplyPreset,
  onTriggerPrediction,
  onFilterExplorer,
  onStepChange
}: ProjectTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const steps: TourStep[] = [
    {
      id: 'step-map',
      tab: 'map',
      title: '1/6: AWS Geospatial Map',
      durationSec: 2.5,
      action: () => {
        onSwitchTab('map')
      }
    },
    {
      id: 'step-simulator-normal',
      tab: 'simulator',
      title: '2/6: ML Normal Inference',
      durationSec: 2.5,
      action: () => {
        onSwitchTab('simulator')
        onApplyPreset('normal')
        setTimeout(() => {
          onTriggerPrediction()
        }, 150)
      }
    },
    {
      id: 'step-simulator-anomaly',
      tab: 'simulator',
      title: '3/6: Anomaly 87°C Heat Spike',
      durationSec: 3.0,
      action: () => {
        onSwitchTab('simulator')
        onApplyPreset('spike87')
        setTimeout(() => {
          onTriggerPrediction()
        }, 150)
      }
    },
    {
      id: 'step-explorer',
      tab: 'explorer',
      title: '4/6: Critical Anomaly Archive',
      durationSec: 2.5,
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
      title: '5/6: Telemetry Analytics',
      durationSec: 2.5,
      action: () => {
        onSwitchTab('analytics')
      }
    },
    {
      id: 'step-stations',
      tab: 'stations',
      title: '6/6: AWS Fleet Health',
      durationSec: 2.5,
      action: () => {
        onSwitchTab('stations')
      }
    }
  ]

  // Reset index when demo is started
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isOpen])

  // Execute step action and schedule next step
  useEffect(() => {
    if (!isOpen) return

    const curStep = steps[currentStepIndex]
    if (curStep && curStep.action) {
      curStep.action()
    }

    if (onStepChange && curStep) {
      onStepChange(curStep.title, currentStepIndex, steps.length)
    }

    const durationMs = (curStep ? curStep.durationSec : 2.5) * 1000

    timerRef.current = setTimeout(() => {
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1)
      } else {
        // Complete tour and close
        onClose()
      }
    }, durationMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentStepIndex, isOpen, steps.length])

  // Listen for Escape key to stop demo
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Completely invisible — does not render ANY popup or overlay on screen
  return null
}
