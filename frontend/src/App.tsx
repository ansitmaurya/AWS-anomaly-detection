import { useState, useEffect } from 'react'
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
import { CinematicIntro } from './components/CinematicIntro'
import { ProjectTour } from './components/ProjectTour'

export function App() {
  const [hasEntered, setHasEntered] = useState<boolean>(false)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'map' | 'simulator' | 'explorer' | 'analytics' | 'stations'>('map')
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null)
  const [stats, setStats] = useState<DatasetStatsResponse | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryAnalyticsResponse | null>(null)
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false)

  // External Reference Weather State (Open-Meteo)
  const [simExtWeather, setSimExtWeather] = useState<ExternalWeatherResponse | null>(null)
  const [loadingSimExtWeather, setLoadingSimExtWeather] = useState<boolean>(false)

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

  // Fetch Health, Stats, Map Nodes & Preview Data on Mount
  useEffect(() => {
    fetchHealthAndStats()
    fetchAllStationsForMap()
    fetchTelemetryData()
    fetchAnomalies()
    fetchStations()
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

  const fetchAllStationsForMap = async () => {
    setLoadingAllStations(true)
    try {
      const res = await apiClient.getStations({ limit: 500 })
      setAllStations(res.items || [])
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

  if (!hasEntered) {
    return <CinematicIntro onEnter={() => setHasEntered(true)} />
  }

  return (
    <div className="dashboard-root-wrapper">
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
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
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
          <button
            onClick={() => setIsTourOpen(true)}
            className="sidebar-tour-btn"
            title="Launch Interactive Automated Project Demo"
          >
            <span className="sidebar-icon">✨</span>
            <span className="sidebar-label">Auto Demo</span>
          </button>
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

          {/* Status Indicators & Demo Tour Trigger */}
          <div className="standalone-status-block">
            <button
              onClick={() => setIsTourOpen(true)}
              className="header-demo-btn"
              title="Launch Interactive Automated Project Demo"
            >
              <span className="header-demo-sparkle">✨</span>
              <span>Auto Project Demo</span>
            </button>

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
          
          {/* TAB CONTENT 1: AWS STATION MAP */}
          {activeTab === 'map' && (
            <div>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                Geospatial Automatic Weather Station (AWS) Network
              </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Real telemetry coordinates across India (`7.98°N–34.08°N, 68.85°E–95.38°E`). Nodes color-coded by operational status and anomaly rate.
            </p>
          </div>

          <StationMap
            stations={allStations}
            loading={loadingAllStations}
            onSelectStation={(st) => {
              setFormData(prev => ({
                ...prev,
                station_name: st.station_name,
                elevation: st.elevation,
                latitude: st.latitude,
                longitude: st.longitude
              }))
            }}
          />
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
                    {formData.latitude}°N, {formData.longitude}°E • Elev: {formData.elevation}m
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: '0.5rem 0' }}>
                  <div className="hero-temp">
                    {formData.avg_temp}
                    <span className="hero-temp-deg">°C</span>
                  </div>

                  <div>
                    {renderWeatherIcon()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>Low: <strong style={{ color: 'var(--met-sky)' }}>{formData.min_temp}°C</strong></span>
                  <span>High: <strong style={{ color: 'var(--met-rose)' }}>{formData.max_temp}°C</strong></span>
                  <span>Diurnal Range: <strong>{(formData.max_temp - formData.min_temp).toFixed(1)}°C</strong></span>
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
                      Isolation Score: <strong style={{ color: predictResult.is_anomaly ? 'var(--met-rose)' : 'var(--met-mint)' }}>{(predictResult.anomaly_score * 100).toFixed(1)}%</strong>
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
                  {formData.rainfall} mm
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>24h Accumulation</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">💨 Wind Speed</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {formData.wind_speed} km/h
                </div>
                <div className="sub" style={{ marginTop: '0.15rem' }}>Surface Velocity</div>
              </div>

              <div className="white-mint-mini">
                <div className="lbl">⏱️ Barometer</div>
                <div className="val" style={{ marginTop: '0.2rem' }}>
                  {formData.air_pressure} hPa
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
                  {formData.latitude}°, {formData.longitude}°
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
                      type="number"
                      step="0.0001"
                      className="input-pill mono"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <button type="submit" className="btn-weather-primary" style={{ width: '100%' }} disabled={predicting}>
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
                          {(predictResult.anomaly_score * 100).toFixed(1)}% ({predictResult.anomaly_score})
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
                <span>Decision Value: {predictResult?.decision_value ?? 'N/A'}</span>
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
                    Live ground truth reference for {formData.station_name} ({formData.latitude}°N, {formData.longitude}°E)
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
                      {simExtWeather.temperature != null ? `${simExtWeather.temperature} °C` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Humidity</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.humidity != null ? `${simExtWeather.humidity} %` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Wind Speed</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.wind_speed != null ? `${simExtWeather.wind_speed} km/h` : 'N/A'}
                    </div>
                  </div>

                  <div className="white-mint-mini" style={{ padding: '0.65rem 0.85rem' }}>
                    <div className="lbl">Precipitation</div>
                    <div className="val" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {simExtWeather.precipitation != null ? `${simExtWeather.precipitation} mm` : '0.0 mm'}
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
                        <span className="font-mono">Diff: {simExtWeather.temperature != null ? `${(formData.avg_temp - simExtWeather.temperature) >= 0 ? '+' : ''}${(formData.avg_temp - simExtWeather.temperature).toFixed(1)}°C` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{formData.avg_temp}°C</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{simExtWeather.temperature}°C</strong></span>
                      </div>
                    </div>

                    {/* Wind comparison */}
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem', fontWeight: 600 }}>
                        <span>Wind Velocity</span>
                        <span className="font-mono">Diff: {simExtWeather.wind_speed != null ? `${(formData.wind_speed - simExtWeather.wind_speed) >= 0 ? '+' : ''}${(formData.wind_speed - simExtWeather.wind_speed).toFixed(1)} km/h` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{formData.wind_speed} km/h</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{simExtWeather.wind_speed} km/h</strong></span>
                      </div>
                    </div>

                    {/* Precipitation comparison */}
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem', fontWeight: 600 }}>
                        <span>Precipitation</span>
                        <span className="font-mono">Diff: {simExtWeather.precipitation != null ? `${(formData.rainfall - simExtWeather.precipitation) >= 0 ? '+' : ''}${(formData.rainfall - simExtWeather.precipitation).toFixed(1)} mm` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span className="font-mono">AWS: <strong style={{ color: '#000000' }}>{formData.rainfall} mm</strong></span>
                        <span className="font-mono">Ref: <strong style={{ color: '#0284c7' }}>{simExtWeather.precipitation} mm</strong></span>
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
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                Anomaly Explorer
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Browsing {totalAnomaliesCount.toLocaleString()} ML-detected anomalies from the 970,339 Kaggle weather records.
              </p>
            </div>

            {/* Dark Technical Search & Filter Controls */}
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Station search..."
                className="search-pill"
                style={{ width: '160px' }}
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchAnomalies(); } }}
              />

              <input
                type="date"
                className="search-pill mono"
                style={{ width: '135px' }}
                value={startDateFilter}
                onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                title="Filter by start date"
              />

              <input
                type="date"
                className="search-pill mono"
                style={{ width: '135px' }}
                value={endDateFilter}
                onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                title="Filter by end date"
              />

              <select
                className="search-pill"
                style={{ width: '130px' }}
                value={stateFilter}
                onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
              >
                <option value="">All States ({stats?.unique_states ?? 32})</option>
                {stats?.available_states?.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <select
                className="search-pill"
                style={{ width: '130px' }}
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Severities</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>

              <select
                className="search-pill"
                style={{ width: '150px' }}
                value={sortByFilter}
                onChange={(e) => { setSortByFilter(e.target.value); setPage(1); }}
              >
                <option value="anomaly_score_desc">Score: High to Low</option>
                <option value="anomaly_score_asc">Score: Low to High</option>
                <option value="date_desc">Date: Newest First</option>
                <option value="date_asc">Date: Oldest First</option>
              </select>

              <button className="btn-weather-secondary" onClick={() => { setPage(1); fetchAnomalies(); }}>
                Filter
              </button>
            </div>
          </div>

          {/* Table */}
          {loadingAnomalies ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--met-sky)', fontSize: '0.9rem' }}>
              <div className="skeleton-shimmer" style={{ width: '80%', height: '40px', margin: '0 auto 1rem auto' }} />
              <div className="skeleton-shimmer" style={{ width: '90%', height: '40px', margin: '0 auto 1rem auto' }} />
              <div className="skeleton-shimmer" style={{ width: '85%', height: '40px', margin: '0 auto' }} />
            </div>
          ) : anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              No anomaly records matching the selected filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th>State</th>
                    <th>Avg Temp</th>
                    <th>Min / Max</th>
                    <th>Wind</th>
                    <th>Pressure</th>
                    <th>Rain (mm)</th>
                    <th>Severity & Score</th>
                    <th>ML Diagnostic</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((item, idx) => {
                    return (
                      <tr key={idx}>
                        <td className="font-mono" style={{ whiteSpace: 'nowrap' }}>
                          {item.date_of_record ? String(item.date_of_record).slice(0, 10) : 'N/A'}
                        </td>
                        <td style={{ fontWeight: 700, color: '#ffffff' }}>
                          {item.station_name}
                        </td>
                        <td>
                          <span style={{ backgroundColor: 'rgba(12, 28, 20, 0.8)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-subtle)' }}>
                            {item.state}
                          </span>
                        </td>
                        <td className="font-mono">{item.avg_temp}°C</td>
                        <td className="font-mono" style={{ color: Number(item.max_temp) > 50 ? 'var(--met-rose)' : 'inherit', fontWeight: Number(item.max_temp) > 50 ? 700 : 'normal' }}>
                          {item.min_temp}° / {item.max_temp}°C
                        </td>
                        <td className="font-mono">{item.wind_speed} km/h</td>
                        <td className="font-mono">{item.air_pressure} hPa</td>
                        <td className="font-mono" style={{ color: Number(item.rainfall) > 200 ? 'var(--met-sky)' : 'inherit' }}>
                          {item.rainfall}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={`ops-badge ${item.severity === 'HIGH' ? 'badge-coral' : item.severity === 'MEDIUM' ? 'badge-amber' : 'badge-cyan'}`}>
                              {item.severity} ({Number(item.anomaly_score).toFixed(4)})
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>ML-detected anomaly</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.35 }}>
                          {item.explanation || 'Multivariate statistical isolation'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages} ({totalAnomaliesCount.toLocaleString()} Total Anomalies)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-weather-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn-weather-secondary"
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
            initialStation="Poona"
            availableStations={['Poona', 'Srinagar', 'Gulmarg', 'Akola', 'Madurai', 'Mount Abu', 'Visakhapatnam', 'Udaipur', 'Agra', 'Shimla', 'Dharmsala', 'Mahabaleshwar', 'Cherrapunji']}
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
                      {telemetry?.ranges.avg_temp.mean ?? 25.7}°C
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Range: <strong style={{ color: '#000000' }}>{telemetry?.ranges.avg_temp.min ?? -10.4}°</strong> to <strong style={{ color: '#000000' }}>{telemetry?.ranges.avg_temp.max ?? 43.4}°C</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Avg Wind Velocity</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.wind_speed.mean ?? 9.4} km/h
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Max: <strong style={{ color: '#000000' }}>{telemetry?.ranges.wind_speed.max ?? 66.6} km/h</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Barometric Pressure</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.air_pressure.mean ?? 1009.4} hPa
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Range: <strong style={{ color: '#000000' }}>{telemetry?.ranges.air_pressure.min ?? 922.6}</strong> to <strong style={{ color: '#000000' }}>{telemetry?.ranges.air_pressure.max ?? 1036.5}</strong>
                    </div>
                  </div>

                  <div className="white-mint-mini">
                    <div className="lbl">Daily Precipitation</div>
                    <div className="val" style={{ marginTop: '0.2rem' }}>
                      {telemetry?.ranges.rainfall.mean ?? 5.3} mm
                    </div>
                    <div className="sub font-mono" style={{ marginTop: '0.25rem' }}>
                      Max 24h: <strong style={{ color: '#000000' }}>{telemetry?.ranges.rainfall.max ?? 485.9} mm</strong>
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
                          {s.count.toLocaleString()} ({s.pct}%)
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
                          {st.health_score}% ({st.status})
                        </strong>
                      </div>

                      <div className="font-mono st-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Obs: <strong style={{ color: '#000000', fontWeight: 800 }}>{st.total_records.toLocaleString()}</strong></span>
                        <span style={{ color: st.anomalies > 50 ? '#be123c' : '#b45309', fontWeight: 800 }}>
                          Anomalies: {st.anomalies} ({st.anomaly_rate}%)
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

      </div>

      {/* AUTOMATED PROJECT DEMO WALKTHROUGH CONTROLLER */}
      <ProjectTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onSwitchTab={(t) => setActiveTab(t)}
        onApplyPreset={(p) => applyPreset(p)}
        onTriggerPrediction={() => handlePredict()}
        onFilterExplorer={(sev) => setSeverityFilter(sev)}
        statsData={{
          totalRecords: stats?.total_records || 970339,
          anomalies: stats?.anomaly_records || 19407,
          stations: stats?.unique_stations || 406
        }}
      />

    </div>
    </div>
  )
}

export default App
