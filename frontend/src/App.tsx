import { useState, useEffect, useCallback } from 'react'
import {
  apiClient,
  type HealthResponse,
  type DatasetStatsResponse,
  type AnomalyItem,
  type PredictionResponse,
  type StationItem,
  type TelemetryAnalyticsResponse,
  type ExternalWeatherResponse
} from './api/client'
import { StationMap } from './components/StationMap'
import { TelemetryCharts } from './components/TelemetryCharts'
import { SunIcon, RainIcon, CloudSunIcon, StormIcon } from './components/WeatherIcons'

export function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'simulator' | 'explorer' | 'analytics' | 'stations' | 'about' | 'future_scope'>('map')
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null)
  const [stats, setStats] = useState<DatasetStatsResponse | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryAnalyticsResponse | null>(null)
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false)

  // External Reference Weather State (Open-Meteo)
  const [simExtWeather, setSimExtWeather] = useState<ExternalWeatherResponse | null>(null)
  const [loadingSimExtWeather, setLoadingSimExtWeather] = useState<boolean>(false)

  // Map Selected Location & External Weather State (Open-Meteo)
  const [selectedMapCoord, setSelectedMapCoord] = useState<{ lat: number; lng: number; name?: string } | null>(null)
  const [selectedMapStation, setSelectedMapStation] = useState<StationItem | null>(null)
  const [selectedMapDistanceKm, setSelectedMapDistanceKm] = useState<number | null>(null)
  const [mapExtWeather, setMapExtWeather] = useState<ExternalWeatherResponse | null>(null)
  const [loadingMapExtWeather, setLoadingMapExtWeather] = useState<boolean>(false)

  // Map & All Stations State
  const [allStations, setAllStations] = useState<StationItem[]>([])
  const [loadingAllStations, setLoadingAllStations] = useState<boolean>(false)

  // Simulator Form State
  const [formData, setFormData] = useState({
    station_name: 'Pune AWS-104',
    avg_temp: 26.5,
    min_temp: 22.0,
    max_temp: 31.0,
    wind_speed: 10.5,
    air_pressure: 1009.2,
    rainfall: 8.5,
    elevation: 560,
    latitude: 18.5204,
    longitude: 73.8567
  })

  const [predictResult, setPredictResult] = useState<PredictionResponse | null>(null)
  const [predicting, setPredicting] = useState<boolean>(false)

  // Anomaly Explorer State
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [loadingAnomalies, setLoadingAnomalies] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalAnomaliesCount, setTotalAnomaliesCount] = useState<number>(0)
  
  // Filters
  const [stateFilter, setStateFilter] = useState<string>('')
  const [stationSearch, setStationSearch] = useState<string>('')
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [sortByFilter, setSortByFilter] = useState<string>('anomaly_score_desc')

  // Stations Tab State
  const [stations, setStations] = useState<StationItem[]>([])
  const [stationPage, setStationPage] = useState<number>(1)
  const [stationTotalPages, setStationTotalPages] = useState<number>(1)
  const [stationSearchQuery, setStationSearchQuery] = useState<string>('')
  const [stationStateFilter, setStationStateFilter] = useState<string>('')
  const [stationStatusFilter, setStationStatusFilter] = useState<string>('')
  const [loadingStations, setLoadingStations] = useState<boolean>(false)

  // Cinematic Intro Screen State
  const [showCinematicIntro, setShowCinematicIntro] = useState<boolean>(true)
  const [introFadeOut, setIntroFadeOut] = useState<boolean>(false)

  const closeCinematicIntro = () => {
    setIntroFadeOut(true)
    setTimeout(() => {
      setShowCinematicIntro(false)
    }, 650)
  }

  // Parallelized lightweight core telemetry & stations on mount
  useEffect(() => {
    Promise.allSettled([
      fetchHealthAndStats(),
      fetchAllStationsForMap()
    ])
  }, [])

  const fetchHealthAndStats = async () => {
    try {
      const hData = await apiClient.getHealth()
      setBackendHealth(hData)
    } catch {
      setBackendHealth(null)
    }

    try {
      const sData = await apiClient.getStats()
      setStats(sData)
    } catch {
      // Handled via state
    }
  }

  // Helper to find nearest AWS station from coordinates
  const findNearestStation = (lat: number, lng: number, stationList: StationItem[]): { station: StationItem; distanceKm: number } | null => {
    if (!stationList || stationList.length === 0) return null
    let minDistance = Infinity
    let nearest: StationItem | null = null
    for (const st of stationList) {
      if (st.latitude == null || st.longitude == null || isNaN(Number(st.latitude)) || isNaN(Number(st.longitude))) continue
      const dLat = (Number(st.latitude) - lat) * 111.0
      const dLng = (Number(st.longitude) - lng) * 111.0 * Math.cos((lat * Math.PI) / 180)
      const dist = Math.sqrt(dLat * dLat + dLng * dLng)
      if (dist < minDistance) {
        minDistance = dist
        nearest = st
      }
    }
    return nearest ? { station: nearest, distanceKm: Math.round(minDistance) } : null
  }

  const handleMapLocationSelect = useCallback((lat: number, lng: number, station?: StationItem, shouldScroll = true) => {
    let effectiveStation = station || null
    let distanceKm: number | null = 0

    if (!effectiveStation && allStations.length > 0) {
      const nearestResult = findNearestStation(lat, lng, allStations)
      if (nearestResult) {
        effectiveStation = nearestResult.station
        distanceKm = nearestResult.distanceKm
      }
    }

    const displayName = station 
      ? station.station_name 
      : effectiveStation 
      ? `Location near ${effectiveStation.station_name} (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)`
      : `Map Coordinates (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)`

    setSelectedMapCoord({ lat, lng, name: displayName })
    setSelectedMapStation(effectiveStation)
    setSelectedMapDistanceKm(station ? 0 : distanceKm)
    setLoadingMapExtWeather(true)

    // Sync simulator form defaults if a station is resolved
    if (effectiveStation) {
      setFormData(prev => ({
        ...prev,
        station_name: effectiveStation!.station_name,
        elevation: effectiveStation!.elevation,
        latitude: effectiveStation!.latitude,
        longitude: effectiveStation!.longitude,
        avg_temp: effectiveStation!.avg_temp,
        wind_speed: effectiveStation!.latest_wind ? parseFloat(String(effectiveStation!.latest_wind)) : prev.wind_speed,
        air_pressure: effectiveStation!.latest_pressure ? parseFloat(String(effectiveStation!.latest_pressure)) : prev.air_pressure,
        rainfall: effectiveStation!.latest_rainfall ? parseFloat(String(effectiveStation!.latest_rainfall)) : prev.rainfall,
      }))
    }

    // Smooth scroll directly to the external weather & comparison card
    if (shouldScroll) {
      setTimeout(() => {
        const el = document.getElementById('map-external-weather-panel')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          el.classList.remove('panel-glow-pulse')
          void el.offsetWidth // trigger reflow for animation restart
          el.classList.add('panel-glow-pulse')
        }
      }, 80)
    }

    apiClient.getExternalWeather(lat, lng, displayName)
      .then(res => {
        setMapExtWeather(res)
      })
      .catch(() => {
        setMapExtWeather({
          available: false,
          source: 'Open-Meteo',
          station_name: displayName,
          latitude: lat,
          longitude: lng,
          units: { temperature: '°C', humidity: '%', wind_speed: 'km/h', precipitation: 'mm' },
          error_message: 'External weather reference unavailable'
        })
      })
      .finally(() => {
        setLoadingMapExtWeather(false)
      })
  }, [allStations])

  const fetchAllStationsForMap = async () => {
    setLoadingAllStations(true)
    try {
      const res = await apiClient.getStations({ limit: 500 })
      const items = res.items || []
      setAllStations(items)
      setStations(items.slice(0, 12))
      setStationTotalPages(Math.ceil(items.length / 12) || 1)
      if (items.length > 0) {
        // Auto-select initial station on page load without jumping screen
        const initialStation = items.find(s => s.station_name.includes('Pune') || s.station_name.includes('Delhi') || s.station_name.includes('Poona')) || items[0]
        handleMapLocationSelect(Number(initialStation.latitude), Number(initialStation.longitude), initialStation, false)
      }
    } catch {
      setAllStations([])
    } finally {
      setLoadingAllStations(false)
    }
  }

  // Load Tab-specific data
  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchAnomalies()
    } else if (activeTab === 'analytics') {
      fetchTelemetryData()
    } else if (activeTab === 'stations') {
      fetchStations()
    }
  }, [activeTab, page, stateFilter, severityFilter, sortByFilter, stationPage, stationStateFilter, stationStatusFilter])

  const fetchTelemetryData = async () => {
    setLoadingTelemetry(true)
    try {
      const data = await apiClient.getTelemetry()
      setTelemetry(data)
    } catch {
      setTelemetry(null)
    } finally {
      setLoadingTelemetry(false)
    }
  }

  const fetchAnomalies = async () => {
    setLoadingAnomalies(true)
    try {
      const data = await apiClient.getAnomalies({
        page,
        limit: 15,
        state: stateFilter || undefined,
        station: stationSearch || undefined,
        start_date: startDateFilter || undefined,
        end_date: endDateFilter || undefined,
        severity: severityFilter || undefined,
        sort_by: sortByFilter
      })
      setAnomalies(data.items || [])
      setTotalPages(data.total_pages || 1)
      setTotalAnomaliesCount(data.total || 0)
    } catch {
      setAnomalies([])
    } finally {
      setLoadingAnomalies(false)
    }
  }

  const fetchStations = async () => {
    setLoadingStations(true)
    try {
      const data = await apiClient.getStations({
        page: stationPage,
        limit: 24,
        search: stationSearchQuery || undefined,
        state: stationStateFilter || undefined,
        status: stationStatusFilter || undefined
      })
      setStations(data.items || [])
      setStationTotalPages(data.total_pages || 1)
    } catch {
      setStations([])
    } finally {
      setLoadingStations(false)
    }
  }

  // Real ML Prediction via API
  const handlePredict = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPredicting(true)
    try {
      const result = await apiClient.predict(formData)
      setPredictResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Prediction request failed'
      alert(`Backend connection error: ${msg}`)
    } finally {
      setPredicting(false)
    }
  }

  // Initial prediction on load
  useEffect(() => {
    handlePredict()
  }, [])

  // Fetch Open-Meteo external reference for simulator coordinates
  useEffect(() => {
    if (formData.latitude != null && formData.longitude != null) {
      let isMounted = true
      setLoadingSimExtWeather(true)
      apiClient.getExternalWeather(formData.latitude, formData.longitude, formData.station_name)
        .then(res => {
          if (isMounted) setSimExtWeather(res)
        })
        .catch(() => {
          if (isMounted) {
            setSimExtWeather({
              available: false,
              source: 'Open-Meteo',
              station_name: formData.station_name,
              latitude: formData.latitude,
              longitude: formData.longitude,
              units: { temperature: '°C', humidity: '%', wind_speed: 'km/h', precipitation: 'mm' },
              error_message: 'External weather reference unavailable'
            })
          }
        })
        .finally(() => {
          if (isMounted) setLoadingSimExtWeather(false)
        })
      return () => {
        isMounted = false
      }
    }
  }, [formData.latitude, formData.longitude, formData.station_name])

  // Presets

  const applyPreset = (type: string) => {
    if (type === 'normal') {
      setFormData({
        station_name: 'Pune AWS-104',
        avg_temp: 26.5,
        min_temp: 21.0,
        max_temp: 32.0,
        wind_speed: 11.0,
        air_pressure: 1010.5,
        rainfall: 2.0,
        elevation: 560,
        latitude: 18.5204,
        longitude: 73.8567
      })
    } else if (type === 'spike87') {
      setFormData({
        station_name: 'Sensor Spike #104',
        avg_temp: 45.0,
        min_temp: 28.0,
        max_temp: 87.0,
        wind_speed: 8.5,
        air_pressure: 1006.0,
        rainfall: 0.0,
        elevation: 210,
        latitude: 22.5726,
        longitude: 88.3639
      })
    } else if (type === 'inverted') {
      setFormData({
        station_name: 'Inverted Calibrator',
        avg_temp: 18.0,
        min_temp: 34.0,
        max_temp: 14.0,
        wind_speed: 6.0,
        air_pressure: 1013.0,
        rainfall: 0.0,
        elevation: 400,
        latitude: 28.6139,
        longitude: 77.2090
      })
    } else if (type === 'cyclone') {
      setFormData({
        station_name: 'Bay of Bengal AWS',
        avg_temp: 26.0,
        min_temp: 24.0,
        max_temp: 28.5,
        wind_speed: 64.0,
        air_pressure: 935.0,
        rainfall: 380.0,
        elevation: 12,
        latitude: 19.8135,
        longitude: 85.8312
      })
    } else if (type === 'monsoon') {
      setFormData({
        station_name: 'Cherrapunji AWS',
        avg_temp: 21.0,
        min_temp: 19.0,
        max_temp: 23.5,
        wind_speed: 22.0,
        air_pressure: 980.0,
        rainfall: 440.0,
        elevation: 1430,
        latitude: 25.2986,
        longitude: 91.5822
      })
    }
  }

  // Get Weather Animated Icon
  const renderWeatherIcon = () => {
    if (formData.rainfall > 80 || (formData.wind_speed > 40 && formData.air_pressure < 980)) {
      return <StormIcon size={64} />
    }
    if (formData.rainfall > 10) {
      return <RainIcon size={64} />
    }
    if (formData.avg_temp > 30) {
      return <SunIcon size={64} />
    }
    return <CloudSunIcon size={64} />
  }

  return (
    <div className="dashboard-root-wrapper">
      {/* CINEMATIC VIEW INTRO OVERLAY */}
      {showCinematicIntro && (
        <div className={`cinematic-intro-root ${introFadeOut ? 'intro-exiting' : ''}`}>
          <div className="intro-backdrop">
            <div className="intro-vignette" />
            <div className="intro-grid" />
            <div className="intro-aurora-glow" />
            <div className="intro-radar-container revealed">
              <div className="intro-radar-ring ring-1" />
              <div className="intro-radar-ring ring-2" />
              <div className="intro-radar-ring ring-3" />
              <div className="intro-radar-crosshair-h" />
              <div className="intro-radar-crosshair-v" />
              <div className="intro-radar-sweep-beam" />
              <span className="intro-node node-nw" />
              <span className="intro-node node-ne" />
              <span className="intro-node node-sw" />
              <span className="intro-node node-se" />
              <span className="intro-node node-center" />
            </div>
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

          <div className="intro-content-container">
            {/* Meteorological System Monogram */}
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '20px',
              background: 'radial-gradient(circle at 35% 35%, #34d399 0%, #059669 45%, #064e3b 100%)',
              border: '1.5px solid rgba(110, 231, 183, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.5), inset 0 1px 3px rgba(255, 255, 255, 0.5)',
              margin: '0 auto 1.35rem auto'
            }}>
              <SunIcon size={42} />
            </div>

            {/* Main Cinematic Title & Typography */}
            <div className="intro-typography visible">
              <h1 className="intro-main-title" style={{ textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                AWS ANOMALY DETECTION SYSTEM
              </h1>
              <p className="intro-subtitle" style={{ color: '#6ee7b7', fontWeight: 600 }}>
                Intelligent Monitoring of Automatic Weather Stations
              </p>
              <p style={{
                fontSize: '0.94rem',
                color: '#cbd5e1',
                maxWidth: '640px',
                lineHeight: 1.6,
                margin: '0 auto 1.25rem auto',
                fontWeight: 500
              }}>
                Analyze historical weather-station data and detect unusual observations using machine learning.
              </p>
            </div>

            {/* Cinematic Feature Capabilities Matrix */}
            <div className="intro-features-matrix">
              <span className="intro-feature-pill">
                <span>🛰️</span>
                <span>406 Synoptic Ground Stations</span>
              </span>
              <span className="intro-feature-pill">
                <span>🧠</span>
                <span>Isolation Forest ML Surveillance</span>
              </span>
              <span className="intro-feature-pill">
                <span>⚡</span>
                <span>Real-Time Open-Meteo Feeds</span>
              </span>
            </div>

            {/* Clear Primary Action Button */}
            <div className="intro-action-wrapper visible">
              <button
                onClick={closeCinematicIntro}
                className="intro-enter-btn"
                title="Enter Monitoring System"
              >
                <span>ENTER MONITORING SYSTEM →</span>
              </button>
              <div className="intro-hint-text">
                Click to access real-time AWS analytics & map
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CINEMATIC ATMOSPHERIC BACKDROP */}
      <div className="cinematic-backdrop" aria-hidden="true">
        <div className="cinematic-aurora-beam" />
        <div className="cinematic-ion-flash" />
        <div className="cinematic-gyro-ring" />
        <div className="cinematic-glow glow-top" />
        <div className="cinematic-glow glow-middle" />
        <div className="cinematic-glow glow-bottom" />
        <div className="cinematic-glow glow-accent" />
        <div className="cinematic-radar-sweep" />

        {/* Dynamic Meteorological Isobar Waves */}
        <div className="cinematic-isobars">
          <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
            <path className="isobar-line" d="M -100 250 C 300 180, 700 380, 1100 240 C 1300 160, 1500 220, 1600 260" />
            <path className="isobar-line solid" d="M -100 480 C 250 560, 650 360, 1050 520 C 1350 640, 1550 480, 1600 500" />
            <path className="isobar-line" d="M -100 720 C 350 620, 750 820, 1150 680 C 1380 600, 1520 740, 1600 710" />
          </svg>
        </div>

        {/* Meteorological Telemetry Stream Light Beams */}
        <div className="cinematic-telemetry-rain">
          <span className="telemetry-streak streak-1" />
          <span className="telemetry-streak streak-2" />
          <span className="telemetry-streak streak-3" />
          <span className="telemetry-streak streak-4" />
          <span className="telemetry-streak streak-5" />
        </div>

        {/* Ambient Telemetry Constellation Nodes */}
        <div className="cinematic-constellation">
          <span className="constellation-node node-1" />
          <span className="constellation-node node-2" />
          <span className="constellation-node node-3" />
          <span className="constellation-node node-4" />
          <span className="constellation-node node-5" />
          <span className="constellation-node node-6" />
        </div>

        <div className="cinematic-cloud-mist" />
        <div className="cinematic-grid-overlay" />
        <div className="cinematic-bubbles">
          <span className="bubble b1" />
          <span className="bubble b2" />
          <span className="bubble b3" />
          <span className="bubble b4" />
          <span className="bubble b5" />
          <span className="bubble b6" />
          <span className="bubble b7" />
          <span className="bubble b8" />
          <span className="bubble b9" />
          <span className="bubble b10" />
          <span className="bubble b11" />
          <span className="bubble b12" />
          <span className="bubble b13" />
          <span className="bubble b14" />
          <span className="bubble b15" />
          <span className="bubble b16" />
          <span className="bubble b17" />
          <span className="bubble b18" />
          <span className="bubble b19" />
          <span className="bubble b20" />
          <span className="bubble b21" />
          <span className="bubble b22" />
          <span className="bubble b23" />
          <span className="bubble b24" />
          <span className="bubble b25" />
          <span className="bubble b26" />
          <span className="bubble b27" />
          <span className="bubble b28" />
          <span className="bubble b29" />
          <span className="bubble b30" />
          <span className="bubble b31" />
          <span className="bubble b32" />
          <span className="bubble b33" />
          <span className="bubble b34" />
          <span className="bubble b35" />
          <span className="bubble b36" />
          <span className="bubble b37" />
          <span className="bubble b38" />
          <span className="bubble b39" />
          <span className="bubble b40" />
          <span className="bubble b41" />
          <span className="bubble b42" />
          <span className="bubble b43" />
          <span className="bubble b44" />
          <span className="bubble b45" />
          <span className="bubble b46" />
          <span className="bubble b47" />
          <span className="bubble b48" />
          <span className="bubble b49" />
          <span className="bubble b50" />
          <span className="bubble b51" />
          <span className="bubble b52" />
          <span className="bubble b53" />
          <span className="bubble b54" />
          <span className="bubble b55" />
          <span className="bubble b56" />
          <span className="bubble b57" />
          <span className="bubble b58" />
          <span className="bubble b59" />
          <span className="bubble b60" />
          <span className="bubble b61" />
          <span className="bubble b62" />
          <span className="bubble b63" />
          <span className="bubble b64" />
        </div>
      </div>

      {/* VERTICAL LEFT COLLAPSED SIDEBAR (HOVER TO EXPAND) */}
      <aside className="dashboard-sidebar">
        <div>
          <div className="sidebar-brand-wrap" title="AWS Operations Control">
            <div className="sidebar-sun-mini">
              <SunIcon size={26} />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">MET-OPS AWS</span>
              <span className="sidebar-brand-sub">Synoptic ML v2.4</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {[
              { id: 'map', label: 'AWS Station Map', icon: '🗺️', badge: `${allStations.length || 406}` },
              { id: 'simulator', label: 'Live ML Simulator', icon: '⚡', badge: 'Real ML' },
              { id: 'explorer', label: 'Anomaly Explorer', icon: '🔍', badge: stats ? `${stats.anomaly_records.toLocaleString()}` : '19k' },
              { id: 'analytics', label: 'Telemetry Analytics', icon: '📊', badge: 'Series' },
              { id: 'stations', label: 'Station Health Network', icon: '📍', badge: '406' },
              { id: 'about', label: 'About', icon: 'ℹ️', badge: 'Info' },
              { id: 'future_scope', label: 'Future Scope', icon: '🚀', badge: 'Roadmap' },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  title={tab.label}
                >
                  <span className="sidebar-icon">{tab.icon}</span>
                  <span className="sidebar-label">{tab.label}</span>
                  {tab.badge && <span className="sidebar-badge">{tab.badge}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-pill">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block', flexShrink: 0 }} />
            <span className="sidebar-footer-text">MET-OPS v2.4</span>
          </div>
        </div>
      </aside>

      {/* MAIN DASHBOARD CONTENT AREA */}
      <div className="dashboard-main-content">
        
        {/* STANDALONE PROMINENT PROJECT TITLE (OUTSIDE CARD CONTAINER) */}
        <div className="standalone-project-header">
          <div className="standalone-title-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span className="header-super-badge">
                <span className="pulse-dot" />
                MET-OPS INTELLIGENCE
              </span>
              <span style={{ fontSize: '0.74rem', color: '#6ee7b7', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                v2.4 SYNOPTIC ML
              </span>
            </div>
            <h1 className="standalone-project-title">
              AWS Anomaly Detection System
            </h1>
            <div className="standalone-tagline">
              <span>Automatic Weather Station Network</span>
              <span style={{ color: 'rgba(52, 211, 153, 0.4)' }}>•</span>
              <span style={{ color: '#cbd5e1' }}>Real-time Isolation Forest Quality Control</span>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="standalone-status-block">

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', backgroundColor: 'rgba(12, 32, 22, 0.90)', padding: '0.45rem 1.05rem', borderRadius: '9999px', border: '1px solid rgba(52, 211, 153, 0.35)', boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: backendHealth?.status === 'healthy' ? '#10b981' : '#dc2626', boxShadow: backendHealth ? '0 0 12px rgba(16, 185, 129, 0.9)' : 'none', animation: 'nodePulse 2.5s infinite' }} />
              <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 800, color: backendHealth ? '#a7f3d0' : '#f87171', letterSpacing: '0.04em' }}>
                {backendHealth ? 'SYSTEM OPERATIONAL' : 'BACKEND OFFLINE'}
              </span>
            </div>

            <div style={{ fontSize: '0.74rem', color: '#a7f3d0', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '0.45rem 0.85rem', backgroundColor: 'rgba(12, 32, 22, 0.85)', borderRadius: '10px', border: '1px solid rgba(52, 211, 153, 0.28)' }}>
              406 AWS Nodes • ML Active
            </div>
          </div>
        </div>

        {/* MASTER WORKSPACE BOX ENCLOSING ACTIVE SECTION */}
        <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', borderRadius: '18px', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-panel)' }}>
          
          {/* TAB CONTENT 1: AWS STATION MAP WITH LEFT-SIDE PROJECT INTRODUCTION & BOTTOM EXTERNAL WEATHER */}
          {activeTab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.1fr) minmax(440px, 1.45fr)', gap: '1.75rem', alignItems: 'stretch' }}>
                
                {/* LEFT SIDE: PROJECT INTRODUCTION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', justifyContent: 'space-between' }}>
                  
                  {/* Main Overview Box */}
                  <div style={{
                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
                    border: '1.5px solid rgba(34, 197, 94, 0.45)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.65rem' }}>
                      <span style={{
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.04em'
                      }}>
                        ABOUT AWS SYSTEM
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                        406 Synoptic Nodes
                      </span>
                    </div>

                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                      About AWS Anomaly Detection
                    </h2>

                    <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.55, marginBottom: '0.75rem', fontWeight: 500 }}>
                      This system monitors Automatic Weather Stations and analyzes their weather observations using historical data and machine learning.
                    </p>

                    <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
                      It helps identify unusual weather-station readings by comparing them with normal historical patterns. Click any station or point on the map to stream live Open-Meteo external ground truth.
                    </p>
                  </div>

                  {/* 4 Feature Explanation Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', flex: 1 }}>
                    
                    {/* Card 1: Historical Data */}
                    <div style={{
                      background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                      border: '1.5px solid rgba(34, 197, 94, 0.35)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.05rem' }}>📊</span>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                          Historical Data
                        </h3>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
                        Historical AWS observations provide the reference patterns used for analysis.
                      </p>
                    </div>

                    {/* Card 2: ML Anomaly Detection */}
                    <div style={{
                      background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                      border: '1.5px solid rgba(34, 197, 94, 0.35)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.05rem' }}>⚡</span>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                          ML Anomaly Detection
                        </h3>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
                        The machine-learning model identifies observations that appear unusual compared with normal patterns.
                      </p>
                    </div>

                    {/* Card 3: Station Monitoring */}
                    <div style={{
                      background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                      border: '1.5px solid rgba(34, 197, 94, 0.35)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.05rem' }}>🛰️</span>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                          Station Monitoring
                        </h3>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
                        The system monitors different AWS stations and their operational/anomaly status.
                      </p>
                    </div>

                    {/* Card 4: Weather Parameters */}
                    <div style={{
                      background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                      border: '1.5px solid rgba(34, 197, 94, 0.35)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.05rem' }}>🌡️</span>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                          Weather Parameters
                        </h3>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
                        Temperature, wind speed, humidity/moisture, rainfall and other station readings can be analyzed.
                      </p>
                    </div>

                  </div>

                  {/* Bottom Quick Action / Info Bar */}
                  <div style={{
                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                    border: '1.5px solid rgba(34, 197, 94, 0.35)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.76rem',
                    color: '#334155',
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                  }}>
                    <span>📍 Pan-India Geospatial Telemetry Network</span>
                    <button
                      onClick={() => setActiveTab('simulator')}
                      style={{
                        background: '#059669',
                        border: '1px solid #047857',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
                      }}
                    >
                      Open ML Simulator →
                    </button>
                  </div>

                </div>

                {/* RIGHT SIDE: AWS STATION MAP */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ marginBottom: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                        AWS Station Map
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Interactive map of 406 synoptic nodes (`7.98°N–34.08°N, 68.85°E–95.38°E`). Click anywhere on map to query external weather.
                      </p>
                    </div>
                  </div>

                  <StationMap
                    stations={allStations}
                    loading={loadingAllStations}
                    selectedCoord={selectedMapCoord}
                    onSelectStation={(st) => {
                      handleMapLocationSelect(Number(st.latitude), Number(st.longitude), st)
                    }}
                    onMapClick={(lat, lng, st) => {
                      handleMapLocationSelect(lat, lng, st)
                    }}
                  />
                </div>

              </div>

              {/* EXTERNAL WEATHER REFERENCE & CROSS-TELEMETRY (BELOW MAP - WHITE + LIGHT GREEN) */}
              <div
                id="map-external-weather-panel"
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
                  border: '1.5px solid rgba(34, 197, 94, 0.45)',
                  borderRadius: '16px',
                  padding: '1.5rem 1.75rem',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.15rem'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1.5px solid rgba(34, 197, 94, 0.25)', paddingBottom: '0.95rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#dcfce7',
                      border: '1px solid #86efac',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem'
                    }}>
                      🌐
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', margin: 0 }}>
                          External Weather Reference
                        </h3>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.18rem 0.55rem',
                          borderRadius: '6px',
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)'
                        }}>
                          OPEN-METEO LIVE STREAM
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '0.2rem' }}>
                        {selectedMapStation && (!selectedMapDistanceKm || selectedMapDistanceKm === 0) ? (
                          <span>
                            📍 <strong style={{ color: '#0f172a' }}>{selectedMapStation.station_name}</strong> ({selectedMapStation.district}, {selectedMapStation.state}) • Lat: {Number(selectedMapStation.latitude).toFixed(2)}°N, Lon: {Number(selectedMapStation.longitude).toFixed(2)}°E • Elev: {selectedMapStation.elevation}m
                          </span>
                        ) : selectedMapStation && selectedMapDistanceKm && selectedMapDistanceKm > 0 ? (
                          <span>
                            📍 Selected Point: <strong style={{ color: '#0f172a' }}>{selectedMapCoord?.lat.toFixed(2)}°N, {selectedMapCoord?.lng.toFixed(2)}°E</strong> • Nearest Synoptic Station: <strong style={{ color: '#0f172a' }}>{selectedMapStation.station_name}</strong> (~{selectedMapDistanceKm} km away)
                          </span>
                        ) : selectedMapCoord ? (
                          <span>
                            📍 Selected Coordinate: <strong style={{ color: '#0f172a' }}>{selectedMapCoord.lat.toFixed(2)}°N, {selectedMapCoord.lng.toFixed(2)}°E</strong>
                          </span>
                        ) : (
                          <span>Click anywhere on the map or select any station marker to fetch real-time ground truth weather.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {mapExtWeather?.timestamp && (
                      <span style={{ fontSize: '0.74rem', color: '#475569', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        Obs Time: {String(mapExtWeather.timestamp).replace('T', ' ')} UTC
                      </span>
                    )}
                    {selectedMapCoord && (
                      <button
                        onClick={() => handleMapLocationSelect(selectedMapCoord.lat, selectedMapCoord.lng, selectedMapStation || undefined)}
                        disabled={loadingMapExtWeather}
                        style={{
                          background: '#059669',
                          border: '1px solid #047857',
                          color: '#ffffff',
                          borderRadius: '7px',
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: loadingMapExtWeather ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {loadingMapExtWeather ? '⏳ Updating...' : '🔄 Refresh Live Data'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                {loadingMapExtWeather ? (
                  <div style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(34, 197, 94, 0.35)',
                    color: '#059669',
                    fontSize: '0.9rem',
                    fontWeight: 700
                  }}>
                    ⏳ Fetching live meteorological observation from Open-Meteo for {selectedMapCoord?.name || 'target location'}...
                  </div>
                ) : mapExtWeather && mapExtWeather.available ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    
                    {/* 4 Metric Cards in White + Light Green */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.95rem' }}>
                      
                      {/* Temperature */}
                      <div style={{
                        background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                        border: '1.5px solid rgba(34, 197, 94, 0.35)',
                        borderRadius: '12px',
                        padding: '0.95rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Temperature</span>
                          <span style={{ fontSize: '1.1rem' }}>🌡️</span>
                        </div>
                        <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                          {mapExtWeather.temperature != null ? `${Number(mapExtWeather.temperature).toFixed(2)}°C` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>2-meter ambient air reading</div>
                      </div>

                      {/* Relative Humidity */}
                      <div style={{
                        background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                        border: '1.5px solid rgba(34, 197, 94, 0.35)',
                        borderRadius: '12px',
                        padding: '0.95rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Humidity</span>
                          <span style={{ fontSize: '1.1rem' }}>💧</span>
                        </div>
                        <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                          {mapExtWeather.humidity != null ? `${Number(mapExtWeather.humidity).toFixed(2)}%` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>Relative atmospheric moisture</div>
                      </div>

                      {/* Wind Speed */}
                      <div style={{
                        background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                        border: '1.5px solid rgba(34, 197, 94, 0.35)',
                        borderRadius: '12px',
                        padding: '0.95rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wind Speed</span>
                          <span style={{ fontSize: '1.1rem' }}>💨</span>
                        </div>
                        <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                          {mapExtWeather.wind_speed != null ? `${Number(mapExtWeather.wind_speed).toFixed(2)} km/h` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>10-meter anemometer speed</div>
                      </div>

                      {/* Precipitation */}
                      <div style={{
                        background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                        border: '1.5px solid rgba(34, 197, 94, 0.35)',
                        borderRadius: '12px',
                        padding: '0.95rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Precipitation</span>
                          <span style={{ fontSize: '1.1rem' }}>🌧️</span>
                        </div>
                        <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                          {mapExtWeather.precipitation != null ? `${Number(mapExtWeather.precipitation).toFixed(2)} mm` : '0.00 mm'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#6d28d9', fontWeight: 600 }}>Current surface rainfall rate</div>
                      </div>

                    </div>

                    {/* If a station is selected: Cross-Reference Comparison with Station Telemetry */}
                    {selectedMapStation && (
                      <div style={{
                        background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
                        border: '1.5px solid rgba(34, 197, 94, 0.45)',
                        borderRadius: '14px',
                        padding: '1.15rem 1.35rem',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            ⚖️ AWS Sensor Telemetry vs External Reference Comparison
                          </div>
                          <button
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                station_name: selectedMapStation.station_name,
                                elevation: selectedMapStation.elevation,
                                latitude: selectedMapStation.latitude,
                                longitude: selectedMapStation.longitude,
                                avg_temp: selectedMapStation.avg_temp,
                                wind_speed: selectedMapStation.latest_wind ? parseFloat(String(selectedMapStation.latest_wind)) : prev.wind_speed,
                                air_pressure: selectedMapStation.latest_pressure ? parseFloat(String(selectedMapStation.latest_pressure)) : prev.air_pressure,
                                rainfall: selectedMapStation.latest_rainfall ? parseFloat(String(selectedMapStation.latest_rainfall)) : prev.rainfall,
                              }))
                              setActiveTab('simulator')
                            }}
                            style={{
                              background: '#059669',
                              border: '1px solid #047857',
                              color: '#ffffff',
                              borderRadius: '6px',
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                            }}
                          >
                            Simulate this Station in ML Engine →
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          
                          {/* Temp diff */}
                          <div style={{ background: '#ffffff', padding: '0.75rem 0.95rem', borderRadius: '10px', border: '1.5px solid #86efac' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                              <span>Temperature</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 800 }}>
                                Diff: {mapExtWeather.temperature != null ? `${(selectedMapStation.avg_temp - mapExtWeather.temperature) >= 0 ? '+' : ''}${(selectedMapStation.avg_temp - mapExtWeather.temperature).toFixed(2)}°C` : 'N/A'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#334155' }}>AWS: <strong style={{ color: '#0f172a' }}>{Number(selectedMapStation.avg_temp).toFixed(2)}°C</strong></span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>Ref: <strong style={{ color: '#0284c7' }}>{Number(mapExtWeather.temperature).toFixed(2)}°C</strong></span>
                            </div>
                          </div>

                          {/* Wind diff */}
                          <div style={{ background: '#ffffff', padding: '0.75rem 0.95rem', borderRadius: '10px', border: '1.5px solid #86efac' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                              <span>Wind Velocity</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 800 }}>
                                Diff: {mapExtWeather.wind_speed != null ? `${(Number(selectedMapStation.latest_wind || 9.4) - mapExtWeather.wind_speed) >= 0 ? '+' : ''}${(Number(selectedMapStation.latest_wind || 9.4) - mapExtWeather.wind_speed).toFixed(2)} km/h` : 'N/A'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#334155' }}>AWS: <strong style={{ color: '#0f172a' }}>{Number(selectedMapStation.latest_wind || 9.4).toFixed(2)} km/h</strong></span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>Ref: <strong style={{ color: '#0284c7' }}>{Number(mapExtWeather.wind_speed).toFixed(2)} km/h</strong></span>
                            </div>
                          </div>

                          {/* Rainfall diff */}
                          <div style={{ background: '#ffffff', padding: '0.75rem 0.95rem', borderRadius: '10px', border: '1.5px solid #86efac' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                              <span>Precipitation</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 800 }}>
                                Diff: {mapExtWeather.precipitation != null ? `${(Number(selectedMapStation.latest_rainfall || 0) - mapExtWeather.precipitation) >= 0 ? '+' : ''}${(Number(selectedMapStation.latest_rainfall || 0) - mapExtWeather.precipitation).toFixed(2)} mm` : 'N/A'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#334155' }}>AWS: <strong style={{ color: '#0f172a' }}>{Number(selectedMapStation.latest_rainfall || 0).toFixed(2)} mm</strong></span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>Ref: <strong style={{ color: '#0284c7' }}>{Number(mapExtWeather.precipitation).toFixed(2)} mm</strong></span>
                            </div>
                          </div>

                        </div>

                        {/* Status Check Pill */}
                        {(() => {
                          const tempDiff = mapExtWeather.temperature != null ? selectedMapStation.avg_temp - mapExtWeather.temperature : 0
                          const windDiff = mapExtWeather.wind_speed != null ? Number(selectedMapStation.latest_wind || 9.4) - mapExtWeather.wind_speed : 0
                          const isSignificant = Math.abs(tempDiff) >= 5.0 || Math.abs(windDiff) >= 20.0
                          const isModerate = !isSignificant && (Math.abs(tempDiff) >= 3.0 || Math.abs(windDiff) >= 10.0)

                          return (
                            <div style={{
                              fontSize: '0.78rem',
                              padding: '0.5rem 0.85rem',
                              borderRadius: '8px',
                              backgroundColor: isSignificant ? '#fee2e2' : isModerate ? '#fef3c7' : '#ecfdf5',
                              border: `1px solid ${isSignificant ? '#fca5a5' : isModerate ? '#fcd34d' : '#86efac'}`,
                              color: isSignificant ? '#be123c' : isModerate ? '#b45309' : '#047857',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexWrap: 'wrap'
                            }}>
                              <span>{isSignificant ? '⚠️' : isModerate ? 'ℹ️' : '✓'}</span>
                              <span>
                                {isSignificant
                                  ? 'Significant deviation detected against real-time external baseline'
                                  : isModerate
                                  ? 'Moderate variance compared with external baseline'
                                  : 'Sensor telemetry closely correlates with external baseline'}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', fontWeight: 500 }}>
                                (Station Anomaly Rate: {Number(selectedMapStation.anomaly_rate).toFixed(2)}% • Quality Index: {Number(selectedMapStation.health_score).toFixed(2)}%)
                              </span>
                            </div>
                          )
                        })()}

                      </div>
                    )}

                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(34, 197, 94, 0.35)',
                    color: '#475569',
                    fontSize: '0.86rem',
                    fontWeight: 500
                  }}>
                    {mapExtWeather?.error_message || 'External weather reference unavailable for this coordinate.'}
                  </div>
                )}
              </div>

            </div>
          )}

      {/* TAB CONTENT 2: LIVE ML SIMULATOR */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HERO WEATHER DISPLAY CARD */}
          <div className="hero-weather-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              
              {/* Left Column: Focal Temperature & Location */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span className="ops-badge badge-cyan">📍 {formData.station_name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {Number(formData.latitude).toFixed(2)}°N, {Number(formData.longitude).toFixed(2)}°E • Elev: {formData.elevation}m
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: '0.5rem 0' }}>
                  <div className="hero-temp">
                    {Number(formData.avg_temp).toFixed(2)}
                    <span className="hero-temp-deg">°C</span>
                  </div>

                  <div>
                    {renderWeatherIcon()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>Low: <strong style={{ color: 'var(--met-sky)' }}>{Number(formData.min_temp).toFixed(2)}°C</strong></span>
                  <span>High: <strong style={{ color: 'var(--met-rose)' }}>{Number(formData.max_temp).toFixed(2)}°C</strong></span>
                  <span>Diurnal Range: <strong>{(formData.max_temp - formData.min_temp).toFixed(2)}°C</strong></span>
                </div>
              </div>

              {/* Right Column: Model Decision Badge */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Live Isolation Forest Decision
                </div>
                {predictResult ? (
                  <div>
                    <span className={`ops-badge ${predictResult.is_anomaly ? (predictResult.severity === 'HIGH' ? 'badge-critical' : 'badge-coral') : 'badge-emerald'}`} style={{ fontSize: '0.86rem', padding: '0.4rem 0.85rem' }}>
                      {predictResult.is_anomaly ? '⚠️ ML-DETECTED ANOMALY' : '✅ NORMAL OBSERVATION'}
                    </span>
                    <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      Isolation Score: <strong style={{ color: predictResult.is_anomaly ? 'var(--met-rose)' : 'var(--met-mint)' }}>{(predictResult.anomaly_score * 100).toFixed(2)}%</strong>
                    </div>
                  </div>
                ) : (
                  <span className="ops-badge badge-cyan">Awaiting Evaluation</span>
                )}
              </div>
            </div>

            {/* Secondary Info Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div className="white-mint-mini">
                <div className="lbl">💧 Precipitation</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {Number(formData.rainfall).toFixed(2)} mm
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>24h Accumulation</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">💨 Wind Speed</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {Number(formData.wind_speed).toFixed(2)} km/h
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>Surface Velocity</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">⏱️ Barometer</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {Number(formData.air_pressure).toFixed(2)} hPa
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>Atmospheric Pressure</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">⛰️ Elevation</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {formData.elevation} m
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>Above Sea Level</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">🧭 Coordinates</div>
                <div className="val" style={{ fontSize: '0.96rem', marginTop: '0.35rem' }}>
                  {Number(formData.latitude).toFixed(2)}°, {Number(formData.longitude).toFixed(2)}°
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>AWS GPS Fix</div>
              </div>
            </div>
          </div>

          {/* Form & Diagnostics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(320px, 1fr)', gap: '1.5rem' }}>
            
            {/* Input Form Console */}
            <div className="glass-panel white-mint-box" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#000000' }}>
                  Telemetry Input Console
                </h2>
                <span className="ops-badge badge-cyan">INPUT TELEMETRY</span>
              </div>

              {/* Presets */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                  Load Meteorological Scenarios
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button type="button" className="scenario-chip" onClick={() => applyPreset('normal')}>☀️ Normal Reading</button>
                  <button type="button" className="scenario-chip" onClick={() => applyPreset('spike87')}>🔥 87°C Sensor Spike</button>
                  <button type="button" className="scenario-chip" onClick={() => applyPreset('inverted')}>🔄 Inverted Temp</button>
                  <button type="button" className="scenario-chip" onClick={() => applyPreset('cyclone')}>🌀 Cyclone Storm</button>
                  <button type="button" className="scenario-chip" onClick={() => applyPreset('monsoon')}>🌧️ Heavy Monsoon</button>
                </div>
              </div>

              <form onSubmit={handlePredict}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Station Identifier
                    </label>
                    <input
                      id="input-station-name"
                      type="text"
                      className="input-pill"
                      value={formData.station_name}
                      onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Elevation (m)
                    </label>
                    <input
                      id="input-elevation"
                      type="number"
                      className="input-pill mono"
                      value={formData.elevation}
                      onChange={(e) => setFormData({ ...formData, elevation: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Avg Temp (°C)
                    </label>
                    <input
                      id="input-avg-temp"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.avg_temp}
                      onChange={(e) => setFormData({ ...formData, avg_temp: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Min Temp (°C)
                    </label>
                    <input
                      id="input-min-temp"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.min_temp}
                      onChange={(e) => setFormData({ ...formData, min_temp: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Max Temp (°C)
                    </label>
                    <input
                      id="input-max-temp"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.max_temp}
                      onChange={(e) => setFormData({ ...formData, max_temp: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Wind Speed (km/h)
                    </label>
                    <input
                      id="input-wind-speed"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.wind_speed}
                      onChange={(e) => setFormData({ ...formData, wind_speed: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Pressure (hPa)
                    </label>
                    <input
                      id="input-air-pressure"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.air_pressure}
                      onChange={(e) => setFormData({ ...formData, air_pressure: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Rainfall (mm)
                    </label>
                    <input
                      id="input-rainfall"
                      type="number"
                      step="0.1"
                      className="input-pill mono"
                      value={formData.rainfall}
                      onChange={(e) => setFormData({ ...formData, rainfall: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Latitude (°N)
                    </label>
                    <input
                      id="input-latitude"
                      type="number"
                      step="0.0001"
                      className="input-pill mono"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#0f172a', marginBottom: '0.35rem', fontWeight: 700 }}>
                      Longitude (°E)
                    </label>
                    <input
                      id="input-longitude"
                      type="number"
                      step="0.0001"
                      className="input-pill mono"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <button id="btn-run-prediction" type="submit" className="btn-weather-primary" style={{ width: '100%' }} disabled={predicting}>
                  {predicting ? 'Executing ML Isolation Trees...' : '🚀 Execute ML Anomaly Analysis'}
                </button>
              </form>
            </div>

            {/* Real-time Diagnostics Console */}
            <div className="glass-panel white-mint-box" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#000000' }}>
                    ML Analysis & Diagnostics
                  </h2>
                  <span className="ops-badge badge-cyan font-mono">
                    ISOLATION FOREST
                  </span>
                </div>

                {predictResult ? (
                  <div>
                    {/* Status Banner */}
                    <div style={{
                      backgroundColor: predictResult.is_anomaly ? 'rgba(244, 63, 94, 0.12)' : '#dcfce7',
                      border: `1.5px solid ${predictResult.is_anomaly ? 'rgba(244, 63, 94, 0.4)' : '#86efac'}`,
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                          Result
                        </div>
                        <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: predictResult.is_anomaly ? '#e11d48' : '#15803d' }}>
                          {predictResult.is_anomaly ? '⚠️ ML-DETECTED ANOMALY' : '✅ NORMAL OBSERVATION'}
                        </div>
                      </div>

                      <span className={`ops-badge ${predictResult.severity === 'HIGH' ? 'badge-critical' : predictResult.severity === 'MEDIUM' ? 'badge-amber' : 'badge-cyan'}`}>
                        {predictResult.severity} SEVERITY
                      </span>
                    </div>

                    {/* Anomaly Score Meter */}
                    <div style={{ marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '1.1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                        <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>Anomaly Score</span>
                        <span className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#047857' }}>
                          {(predictResult.anomaly_score * 100).toFixed(2)}% ({Number(predictResult.anomaly_score).toFixed(2)})
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, predictResult.anomaly_score * 100)}%`,
                          height: '100%',
                          background: predictResult.anomaly_score >= 0.70 ? 'var(--met-coral)' : predictResult.anomaly_score >= 0.58 ? 'var(--met-amber)' : '#16a34a',
                          borderRadius: '9999px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>

                      <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '0.35rem' }}>
                        <span>0.0 (Normal)</span>
                        <span>0.58 (Medium)</span>
                        <span>0.70 (High)</span>
                      </div>
                    </div>

                    {/* ML Explanation */}
                    <div style={{ marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                        Isolation Tree Diagnostic
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#0f172a', lineHeight: 1.45, fontWeight: 600 }}>
                        {predictResult.ml_explanation}
                      </p>
                    </div>

                    {/* Physical Domain Rule Checks */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                        Physical Domain Validation
                      </div>
                      <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {predictResult.physical_diagnostics.map((diag, idx) => (
                          <li key={idx} style={{
                            fontSize: '0.78rem',
                            color: '#0f172a',
                            fontWeight: 600,
                            backgroundColor: '#f8fafc',
                            padding: '0.5rem 0.85rem',
                            borderRadius: '8px',
                            marginBottom: '0.35rem',
                            border: '1px solid #cbd5e1',
                            borderLeft: predictResult.is_anomaly ? '3px solid #d97706' : '3px solid #16a34a'
                          }}>
                            {diag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontWeight: 600 }}>
                    Awaiting prediction from backend...
                  </div>
                )}
              </div>

              <div className="font-mono" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#334155', fontWeight: 700 }}>
                <span>Decision Value: {predictResult?.decision_value != null ? Number(predictResult.decision_value).toFixed(2) : 'N/A'}</span>
                <span>Model: IsolationForest</span>
              </div>
            </div>

          </div>

          {/* EXTERNAL WEATHER REFERENCE & COMPARISON (SIMULATOR) */}
          <div className="glass-panel white-mint-box" style={{ padding: '1.25rem 1.5rem', border: '1.5px solid rgba(34, 197, 94, 0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>🌐</span>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#000000' }}>
                    EXTERNAL WEATHER REFERENCE
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>
                    Live ground truth reference for {formData.station_name} ({Number(formData.latitude).toFixed(2)}°N, {Number(formData.longitude).toFixed(2)}°E)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.68rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  Source: Open-Meteo
                </span>
                {simExtWeather?.timestamp && (
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                    Obs Time: {String(simExtWeather.timestamp).replace('T', ' ')}
                  </span>
                )}
              </div>
            </div>

            {loadingSimExtWeather ? (
              <div style={{ textAlign: 'center', padding: '1.25rem', color: '#15803d', fontSize: '0.82rem', fontWeight: 600 }}>
                ⏳ Querying Open-Meteo meteorological observation...
              </div>
            ) : simExtWeather && simExtWeather.available ? (
              <div>
                {/* 4 Reference Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Temperature</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.temperature != null ? `${Number(simExtWeather.temperature).toFixed(2)} °C` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Humidity</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.humidity != null ? `${Number(simExtWeather.humidity).toFixed(2)} %` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Wind Speed</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.wind_speed != null ? `${Number(simExtWeather.wind_speed).toFixed(2)} km/h` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Precipitation</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.precipitation != null ? `${Number(simExtWeather.precipitation).toFixed(2)} mm` : '0.00 mm'}
                    </div>
                  </div>
                </div>

                {/* AWS vs External Side-by-Side Comparison */}
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    AWS Telemetry vs External Reference Comparison
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.65rem' }}>
                    {/* Temperature comparison */}
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem', fontWeight: 600 }}>
                        <span>Temperature</span>
                        <span className="font-mono">Diff: {simExtWeather.temperature != null ? `${(formData.avg_temp - simExtWeather.temperature) >= 0 ? '+' : ''}${(formData.avg_temp - simExtWeather.temperature).toFixed(2)}°C` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{Number(formData.avg_temp).toFixed(2)}°C</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{Number(simExtWeather.temperature).toFixed(2)}°C</strong></span>
                      </div>
                    </div>

                    {/* Wind comparison */}
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem', fontWeight: 600 }}>
                        <span>Wind Velocity</span>
                        <span className="font-mono">Diff: {simExtWeather.wind_speed != null ? `${(formData.wind_speed - simExtWeather.wind_speed) >= 0 ? '+' : ''}${(formData.wind_speed - simExtWeather.wind_speed).toFixed(2)} km/h` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{Number(formData.wind_speed).toFixed(2)} km/h</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{Number(simExtWeather.wind_speed).toFixed(2)} km/h</strong></span>
                      </div>
                    </div>

                    {/* Precipitation comparison */}
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem', fontWeight: 600 }}>
                        <span>Precipitation</span>
                        <span className="font-mono">Diff: {simExtWeather.precipitation != null ? `${(formData.rainfall - simExtWeather.precipitation) >= 0 ? '+' : ''}${(formData.rainfall - simExtWeather.precipitation).toFixed(2)} mm` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{Number(formData.rainfall).toFixed(2)} mm</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{Number(simExtWeather.precipitation).toFixed(2)} mm</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Neutral Diagnostic Status */}
                  {(() => {
                    const tempDiff = simExtWeather.temperature != null ? formData.avg_temp - simExtWeather.temperature : 0
                    const windDiff = simExtWeather.wind_speed != null ? formData.wind_speed - simExtWeather.wind_speed : 0
                    const isSignificant = Math.abs(tempDiff) >= 5.0 || Math.abs(windDiff) >= 20.0
                    const isModerate = !isSignificant && (Math.abs(tempDiff) >= 3.0 || Math.abs(windDiff) >= 10.0)

                    return (
                      <div style={{
                        fontSize: '0.74rem',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '6px',
                        backgroundColor: isSignificant ? '#fef2f2' : isModerate ? '#fffbeb' : '#f0fdf4',
                        border: `1px solid ${isSignificant ? '#fca5a5' : isModerate ? '#fcd34d' : '#86efac'}`,
                        color: isSignificant ? '#be123c' : isModerate ? '#b45309' : '#15803d',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span>{isSignificant ? '⚠️' : isModerate ? 'ℹ️' : '✓'}</span>
                        <span>
                          {isSignificant
                            ? 'Significant deviation from external reference'
                            : isModerate
                            ? 'Reference deviation detected'
                            : 'Consistent with external reference baseline'}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', fontWeight: 500 }}>
                          (Isolation Forest ML score operates independently)
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                External weather reference unavailable
              </div>
            )}
          </div>

        </div>
      )}


      {/* TAB CONTENT 3: ANOMALY EXPLORER */}
      {activeTab === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                Anomaly Explorer
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Browsing {totalAnomaliesCount.toLocaleString()} ML-detected anomalies from the 970,339 Kaggle weather records.
              </p>
            </div>

            {/* Technical Search & Filter Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Station search..."
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  width: '170px'
                }}
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchAnomalies(); } }}
              />

              <input
                type="date"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none',
                  width: '140px'
                }}
                value={startDateFilter}
                onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                title="Filter by start date"
              />

              <input
                type="date"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none',
                  width: '140px'
                }}
                value={endDateFilter}
                onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                title="Filter by end date"
              />

              <select
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  width: '135px'
                }}
                value={stateFilter}
                onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
              >
                <option value="">All States ({stats?.unique_states ?? 32})</option>
                {stats?.available_states?.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <select
                id="select-severity-filter"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  width: '135px'
                }}
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Severities</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>

              <select
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  width: '155px'
                }}
                value={sortByFilter}
                onChange={(e) => { setSortByFilter(e.target.value); setPage(1); }}
              >
                <option value="anomaly_score_desc">Score: High to Low</option>
                <option value="anomaly_score_asc">Score: Low to High</option>
                <option value="date_desc">Date: Newest First</option>
                <option value="date_asc">Date: Oldest First</option>
              </select>

              <button
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => { setPage(1); fetchAnomalies(); }}
              >
                Filter
              </button>
            </div>
          </div>

          {/* White + Light Green Anomaly Records Table */}
          {loadingAnomalies ? (
            <div style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
              borderRadius: '16px',
              border: '1.5px solid rgba(34, 197, 94, 0.45)',
              padding: '3.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
            }}>
              <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.92rem' }}>
                ⏳ Retrieving ML-detected anomaly records...
              </div>
            </div>
          ) : anomalies.length === 0 ? (
            <div style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
              borderRadius: '16px',
              border: '1.5px solid rgba(34, 197, 94, 0.45)',
              padding: '3.5rem',
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.9rem',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
            }}>
              No anomaly records matching the selected filter criteria.
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
              borderRadius: '16px',
              border: '1.5px solid rgba(34, 197, 94, 0.45)',
              padding: '1.25rem 1.4rem',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              overflowX: 'auto'
            }}>
              <table className="white-ops-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station Name</th>
                    <th>State</th>
                    <th>Avg Temp</th>
                    <th>Min / Max</th>
                    <th>Wind Speed</th>
                    <th>Pressure</th>
                    <th>Precipitation</th>
                    <th>Anomaly Severity</th>
                    <th>ML Physical Diagnostic</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((item, idx) => {
                    const isHigh = item.severity === 'HIGH'
                    const isMed = item.severity === 'MEDIUM'

                    return (
                      <tr key={idx}>
                        <td className="font-mono" style={{ whiteSpace: 'nowrap', color: '#475569', fontWeight: 600 }}>
                          {item.date_of_record ? String(item.date_of_record).slice(0, 10) : 'N/A'}
                        </td>
                        <td style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                          📍 {item.station_name}
                        </td>
                        <td>
                          <span style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700
                          }}>
                            {item.state}
                          </span>
                        </td>
                        <td className="font-mono" style={{ color: '#0f172a', fontWeight: 700 }}>
                          {Number(item.avg_temp).toFixed(2)}°C
                        </td>
                        <td className="font-mono" style={{ color: Number(item.max_temp) > 50 ? '#e11d48' : '#334155', fontWeight: Number(item.max_temp) > 50 ? 800 : 600 }}>
                          {Number(item.min_temp).toFixed(2)}° / {Number(item.max_temp).toFixed(2)}°C
                        </td>
                        <td className="font-mono" style={{ color: '#0f172a', fontWeight: 600 }}>
                          {Number(item.wind_speed).toFixed(2)} km/h
                        </td>
                        <td className="font-mono" style={{ color: '#0f172a', fontWeight: 600 }}>
                          {Number(item.air_pressure).toFixed(2)} hPa
                        </td>
                        <td className="font-mono" style={{ color: Number(item.rainfall) > 200 ? '#0284c7' : '#0f172a', fontWeight: Number(item.rainfall) > 200 ? 800 : 600 }}>
                          {Number(item.rainfall).toFixed(2)} mm
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.22rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: isHigh ? '#fee2e2' : isMed ? '#fef3c7' : '#ecfdf5',
                              color: isHigh ? '#be123c' : isMed ? '#b45309' : '#047857',
                              border: `1px solid ${isHigh ? '#fca5a5' : isMed ? '#fcd34d' : '#a7f3d0'}`
                            }}>
                              {item.severity} ({Number(item.anomaly_score).toFixed(2)})
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                              Isolation Score
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#334155', maxWidth: '300px', lineHeight: 1.4, fontWeight: 500 }}>
                          {item.explanation || 'Multivariate statistical isolation deviation'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1.5px solid #e2e8f0'
              }}>
                <span className="font-mono" style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
                  Page {page} of {totalPages} ({totalAnomaliesCount.toLocaleString()} Total Anomalies)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    style={{
                      background: '#f1f5f9',
                      color: page <= 1 ? '#94a3b8' : '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer'
                    }}
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    style={{
                      background: '#f1f5f9',
                      color: page >= totalPages ? '#94a3b8' : '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: TELEMETRY ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* REAL TIME-SERIES CHARTS */}
          <TelemetryCharts
            initialStation={selectedMapStation?.station_name || formData.station_name || 'Poona'}
            availableStations={allStations.map(s => s.station_name)}
          />

          {/* DISTRIBUTIONS & SEASONAL BREAKDOWN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel white-mint-box" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', color: '#000000' }}>
                Meteorological Distributions (Kaggle Dataset)
              </h2>
              {loadingTelemetry ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#15803d' }}>
                  <div className="skeleton-shimmer" style={{ width: '100%', height: '120px' }} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="white-mint-mini">
                    <div className="lbl">Avg Surface Temp</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.avg_temp.mean != null ? Number(telemetry.ranges.avg_temp.mean).toFixed(2) : '25.70'}°C
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Range: <strong style={{ color: '#000000' }}>{telemetry?.ranges.avg_temp.min != null ? Number(telemetry.ranges.avg_temp.min).toFixed(2) : '-10.40'}°</strong> to <strong style={{ color: '#000000' }}>{telemetry?.ranges.avg_temp.max != null ? Number(telemetry.ranges.avg_temp.max).toFixed(2) : '43.40'}°C</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Avg Wind Velocity</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.wind_speed.mean != null ? Number(telemetry.ranges.wind_speed.mean).toFixed(2) : '9.40'} km/h
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Max: <strong style={{ color: '#000000' }}>{telemetry?.ranges.wind_speed.max != null ? Number(telemetry.ranges.wind_speed.max).toFixed(2) : '66.60'} km/h</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Barometric Pressure</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.air_pressure.mean != null ? Number(telemetry.ranges.air_pressure.mean).toFixed(2) : '1009.40'} hPa
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Range: <strong style={{ color: '#000000' }}>{telemetry?.ranges.air_pressure.min != null ? Number(telemetry.ranges.air_pressure.min).toFixed(2) : '922.60'}</strong> to <strong style={{ color: '#000000' }}>{telemetry?.ranges.air_pressure.max != null ? Number(telemetry.ranges.air_pressure.max).toFixed(2) : '1036.50'}</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Daily Precipitation</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.rainfall.mean != null ? Number(telemetry.ranges.rainfall.mean).toFixed(2) : '5.30'} mm
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Max 24h: <strong style={{ color: '#000000' }}>{telemetry?.ranges.rainfall.max != null ? Number(telemetry.ranges.rainfall.max).toFixed(2) : '485.90'} mm</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel white-mint-box" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', color: '#000000' }}>
                Seasonal Observation Density
              </h2>
              {loadingTelemetry ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#15803d' }}>
                  <div className="skeleton-shimmer" style={{ width: '100%', height: '120px' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {telemetry?.seasons.map((s, idx) => (
                    <div key={idx} className="white-mint-mini" style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 800, color: '#000000' }}>{s.name}</span>
                        <span className="font-mono" style={{ color: '#15803d', fontWeight: 800 }}>
                          {s.count.toLocaleString()} ({Number(s.pct).toFixed(2)}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <div style={{ width: `${s.pct}%`, height: '100%', backgroundColor: s.color, borderRadius: '9999px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 5: STATION HEALTH NETWORK */}
      {activeTab === 'stations' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                Station Health Network
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Project-derived station health indicator: <code className="font-mono">Quality = max(0, 100 - (Anomaly Rate × 2.5))</code>. Evaluated across 406 stations.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Station / district..."
                className="search-pill"
                style={{ width: '180px' }}
                value={stationSearchQuery}
                onChange={(e) => setStationSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setStationPage(1); fetchStations(); } }}
              />

              <select
                className="search-pill"
                style={{ width: '120px' }}
                value={stationStateFilter}
                onChange={(e) => { setStationStateFilter(e.target.value); setStationPage(1); }}
              >
                <option value="">All States</option>
                {stats?.available_states?.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <select
                className="search-pill"
                style={{ width: '130px' }}
                value={stationStatusFilter}
                onChange={(e) => { setStationStatusFilter(e.target.value); setStationPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="Normal">Normal (&lt;2%)</option>
                <option value="Suspicious">Suspicious (2–10%)</option>
                <option value="Anomaly">Anomaly (&gt;10%)</option>
              </select>

              <button className="btn-weather-secondary" onClick={() => { setStationPage(1); fetchStations(); }}>
                Filter
              </button>
            </div>
          </div>

          {loadingStations ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--met-sky)', fontSize: '0.9rem' }}>
              <div className="skeleton-shimmer" style={{ width: '80%', height: '40px', margin: '0 auto 1rem auto' }} />
              <div className="skeleton-shimmer" style={{ width: '90%', height: '40px', margin: '0 auto 1rem auto' }} />
              <div className="skeleton-shimmer" style={{ width: '85%', height: '40px', margin: '0 auto' }} />
            </div>
          ) : stations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              No weather stations found matching criteria.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.95rem', marginBottom: '1.25rem' }}>
                {stations.map((st, idx) => {
                  const healthStatus = st.health_score > 80 ? 'HEALTHY' : st.health_score > 60 ? 'MONITOR' : st.health_score > 40 ? 'ATTENTION' : 'CRITICAL'
                  return (
                    <div key={idx} className="station-health-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span className="st-name">{st.station_name}</span>
                        <span className="st-state-badge" style={{ padding: '0.18rem 0.55rem', borderRadius: '9999px', fontFamily: 'var(--font-mono)' }}>
                          {st.state}
                        </span>
                      </div>

                      <div className="st-district" style={{ marginBottom: '0.65rem' }}>
                        📍 {st.district} • Elev: <span style={{ color: '#000000', fontWeight: 700 }}>{st.elevation}m</span>
                      </div>

                      {/* Health Score Pill */}
                      <div className="st-status-box" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.65rem',
                        borderLeft: `3.5px solid ${st.health_score > 80 ? '#16a34a' : st.health_score > 60 ? '#d97706' : '#e11d48'}`
                      }}>
                        <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>Status: <strong style={{ color: '#000000', fontWeight: 800 }}>{healthStatus}</strong></span>
                        <strong className="font-mono" style={{ fontSize: '0.92rem', color: st.health_score > 80 ? '#15803d' : st.health_score > 60 ? '#b45309' : '#be123c', fontWeight: 800 }}>
                          {Number(st.health_score).toFixed(2)}% ({st.status})
                        </strong>
                      </div>

                      <div className="font-mono st-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Obs: <strong style={{ color: '#000000', fontWeight: 800 }}>{st.total_records.toLocaleString()}</strong></span>
                        <span style={{ color: st.anomalies > 50 ? '#be123c' : '#b45309', fontWeight: 800 }}>
                          Anomalies: {st.anomalies} ({Number(st.anomaly_rate).toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Station Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Page {stationPage} of {stationTotalPages} (406 Total Stations)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-weather-secondary"
                    disabled={stationPage <= 1}
                    onClick={() => setStationPage(p => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn-weather-secondary"
                    disabled={stationPage >= stationTotalPages}
                    onClick={() => setStationPage(p => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT 6: ABOUT */}
      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main About Overview Box */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.75rem 2rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
              <span style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                padding: '0.22rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em'
              }}>
                SYSTEM DOCUMENTATION
              </span>
              <span style={{ fontSize: '0.76rem', color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                Automatic Weather Stations • Machine Learning
              </span>
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              About AWS Anomaly Detection System
            </h2>

            <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
              This system monitors Automatic Weather Stations and analyzes their weather observations using historical data and machine learning. Its main purpose is to identify unusual or anomalous station readings and help understand the condition of weather-station data.
            </p>
          </div>

          {/* How the System Works Card */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.5rem 2rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '1.15rem' }}>⚙️</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                How the System Works
              </h3>
            </div>
            <p style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
              Historical weather-station observations are used as a reference for normal patterns. The machine-learning anomaly detection system analyzes observations and identifies readings that appear unusual compared with those patterns.
            </p>
          </div>

          {/* Feature Explanations Section */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.75rem 2rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.15rem' }}>📋</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                System Features
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              
              {/* Feature 1 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>🗺️</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    1. AWS Station Map
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Shows the locations of AWS stations and their current monitoring/anomaly status.
                </p>
              </div>

              {/* Feature 2 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>⚡</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    2. Live ML Simulator
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Allows weather readings such as temperature, wind speed, humidity/moisture and rainfall to be analyzed by the ML anomaly-detection system.
                </p>
              </div>

              {/* Feature 3 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>🔍</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    3. Anomaly Explorer
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Shows and helps explore weather observations that have been identified as unusual by the ML system.
                </p>
              </div>

              {/* Feature 4 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📊</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    4. Telemetry Analytics
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Displays historical weather-station measurements through graphs and trends to help understand changes in the data.
                </p>
              </div>

              {/* Feature 5 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📍</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    5. Station Health Network
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Provides information about the operational condition and status of monitored weather stations.
                </p>
              </div>

              {/* Feature 6 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>🌐</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    6. External Weather Reference
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Uses Open-Meteo as an external weather reference so station observations can be viewed alongside external weather information.
                </p>
              </div>

              {/* Feature 7 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📈</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    7. Dashboard
                  </h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  Provides an overall summary of observations, active stations, detected anomalies and stations requiring attention.
                </p>
              </div>

            </div>
          </div>

          {/* Final Note Box */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.35rem 1.75rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}>
            <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>ℹ️</span>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                System Scope & Intended Purpose
              </div>
              <p style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
                This system focuses on weather-station monitoring and anomaly detection. It is not intended to be a general weather forecasting system.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 7: FUTURE SCOPE */}
      {activeTab === 'future_scope' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Future Scope Overview Box */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.75rem 2rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
              <span style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                padding: '0.22rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em'
              }}>
                FUTURE SCOPE & ROADMAP
              </span>
              <span style={{ fontSize: '0.76rem', color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                Next-Generation Meteorological Capabilities
              </span>
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              Future Scope: AWS Anomaly Detection System
            </h2>

            <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
              The following potential improvements outline how the system can be expanded in the future to enhance automation, detection accuracy, and real-time operational capability across weather station networks.
            </p>
          </div>

          {/* 8 Future Improvements Grid */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.75rem 2rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.15rem' }}>🚀</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Planned Future Improvements & Operational Benefits
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.15rem' }}>
              
              {/* Item 1 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>🛰️</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      1. Real-Time AWS Data Integration
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Connect the system directly with live AWS/weather-station sensor data for continuous monitoring.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Reduces manual data entry and enables real-time anomaly detection.
                </div>
              </div>

              {/* Item 2 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>🧠</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      2. Advanced ML Models
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Add and compare additional anomaly-detection models with the existing Isolation Forest.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Helps detect different types of unusual observations and improve detection performance.
                </div>
              </div>

              {/* Item 3 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>📍</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      3. Station-Specific Learning
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Train or adapt the anomaly detection system according to the historical pattern of individual stations.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Different locations have different normal weather patterns, so station-specific analysis can improve accuracy.
                </div>
              </div>

              {/* Item 4 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>🔔</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      4. Automatic Alerts
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Send notifications when critical or highly unusual station readings are detected.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Helps users respond quickly to important anomalies.
                </div>
              </div>

              {/* Item 5 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>📈</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      5. Historical Comparison and Trend Analysis
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Compare current observations with previous days, months and years.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Helps identify long-term trends and unusual changes.
                </div>
              </div>

              {/* Item 6 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>📄</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      6. Automated Anomaly Reports
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Generate daily or weekly reports containing detected anomalies and important station information.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Makes monitoring and reporting easier.
                </div>
              </div>

              {/* Item 7 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>🌐</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      7. Weather and Sensor Data Validation
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Cross-check AWS observations with external weather sources such as Open-Meteo.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Helps identify potentially incorrect, faulty or unreliable sensor readings.
                </div>
              </div>

              {/* Item 8 */}
              <div style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '1.2rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>📊</span>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      8. Advanced Visualization
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    Add more interactive maps, timelines and station-wise analytics.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  fontWeight: 600
                }}>
                  <strong style={{ color: '#047857' }}>Benefit:</strong> Makes large amounts of weather-station data easier to understand.
                </div>
              </div>

            </div>
          </div>

          {/* Short Closing Statement Box */}
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '1.35rem 1.75rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}>
            <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>✨</span>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                System Vision
              </div>
              <p style={{ fontSize: '0.92rem', color: '#0f172a', lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
                These improvements can help transform the current anomaly-detection prototype into a more complete real-time weather-station monitoring and decision-support system.
              </p>
            </div>
          </div>

        </div>
      )}

      </div>

    </div>
    </div>
  )
}

export default App
