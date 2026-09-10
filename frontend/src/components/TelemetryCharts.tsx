import { useState, useEffect } from 'react'
import { apiClient, type TimeSeriesPoint } from '../api/client'

interface TelemetryChartsProps {
  initialStation?: string
  availableStations?: string[]
}

export function TelemetryCharts({ initialStation = 'Poona', availableStations = [] }: TelemetryChartsProps) {
  const [selectedStation, setSelectedStation] = useState<string>(initialStation)
  const [timeseriesData, setTimeseriesData] = useState<TimeSeriesPoint[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeMetric, setActiveMetric] = useState<'temp' | 'rain' | 'wind' | 'pressure'>('temp')
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null)
  const [stationCache, setStationCache] = useState<Record<string, TimeSeriesPoint[]>>({})

  // Sync station when initialStation prop updates from map/simulator
  useEffect(() => {
    if (initialStation && initialStation !== selectedStation) {
      setSelectedStation(initialStation)
    }
  }, [initialStation])

  useEffect(() => {
    fetchStationTimeseries(selectedStation)
  }, [selectedStation])

  const fetchStationTimeseries = async (station: string) => {
    if (stationCache[station] && stationCache[station].length > 0) {
      setTimeseriesData(stationCache[station])
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.getTimeSeries({ station, limit: 45 })
      const pts = res.data || []
      setTimeseriesData(pts)
      if (pts.length > 0) {
        setStationCache(prev => ({ ...prev, [station]: pts }))
      }
    } catch {
      setTimeseriesData([])
    } finally {
      setLoading(false)
    }
  }

  // Deduplicate and ensure selectedStation is always selectable
  const stationOptions = Array.from(new Set([
    selectedStation,
    ...availableStations,
    'Poona', 'Srinagar', 'Gulmarg', 'Akola', 'Madurai', 'Mount Abu', 'Visakhapatnam', 'Udaipur', 'Agra', 'Shimla', 'Dharmsala', 'Mahabaleshwar', 'Cherrapunji'
  ])).filter(Boolean)

  // Calculate chart geometry
  const width = 800
  const height = 260
  const padding = { top: 20, right: 30, bottom: 40, left: 50 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  // Extract metric values
  const getMetricValue = (p: TimeSeriesPoint) => {
    switch (activeMetric) {
      case 'temp': return p.avg_temp
      case 'rain': return p.rainfall
      case 'wind': return p.wind_speed
      case 'pressure': return p.air_pressure
    }
  }

  const values = timeseriesData.map(getMetricValue)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 100
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal

  // Scale functions
  const getX = (index: number) => {
    if (timeseriesData.length <= 1) return padding.left
    return padding.left + (index / (timeseriesData.length - 1)) * plotWidth
  }

  const getY = (val: number) => {
    return padding.top + plotHeight - ((val - minVal) / valRange) * plotHeight
  }

  // Generate SVG path
  const linePath = timeseriesData.length > 0
    ? timeseriesData.reduce((acc, point, i) => {
        const x = getX(i)
        const y = getY(getMetricValue(point))
        return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
      }, '')
    : ''

  const areaPath = timeseriesData.length > 0
    ? `${linePath} L ${getX(timeseriesData.length - 1)} ${padding.top + plotHeight} L ${getX(0)} ${padding.top + plotHeight} Z`
    : ''

  const metricColors = {
    temp: { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.12)', label: 'Avg Temperature (°C)' },
    rain: { stroke: '#0284c7', fill: 'rgba(2, 132, 199, 0.12)', label: 'Precipitation / Rainfall (mm)' },
    wind: { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.12)', label: 'Wind Velocity (km/h)' },
    pressure: { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.12)', label: 'Barometric Pressure (hPa)' }
  }

  const currentTheme = metricColors[activeMetric]

  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)',
      borderRadius: '16px',
      border: '1.5px solid rgba(34, 197, 94, 0.45)',
      padding: '1.6rem',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
    }}>
      
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Sensor Telemetry Stream & Anomaly Markers
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.25rem', margin: 0 }}>
            Sequential observations for <strong style={{ color: '#000000' }}>{selectedStation}</strong> station with Isolation Forest flagged readings.
          </p>
        </div>

        {/* Station Select & Metric Toggle */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            style={{
              background: '#f8fafc',
              color: '#0f172a',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font-mono)'
            }}
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
          >
            {stationOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Metric Buttons */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.22rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
            {(['temp', 'rain', 'wind', 'pressure'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                style={{
                  background: activeMetric === m ? '#059669' : 'transparent',
                  color: activeMetric === m ? '#ffffff' : '#334155',
                  border: 'none',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: activeMetric === m ? 800 : 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease',
                  boxShadow: activeMetric === m ? '0 2px 6px rgba(5, 150, 105, 0.35)' : 'none'
                }}
              >
                {m === 'temp' ? 'Temperature' : m === 'rain' ? 'Rainfall' : m === 'wind' ? 'Wind Speed' : 'Pressure'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG CHART CONTAINER */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#059669', fontSize: '0.9rem', fontWeight: 700 }}>
          🛰️ Retrieving historical sensor telemetry stream...
        </div>
      ) : timeseriesData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', fontSize: '0.88rem' }}>
          No telemetry points available for the selected station.
        </div>
      ) : (
        <div style={{
          position: 'relative',
          width: '100%',
          overflowX: 'auto',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1.5px solid #e2e8f0',
          padding: '0.5rem 0.25rem'
        }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + plotHeight * pct
              const val = (maxVal - pct * valRange).toFixed(1)
              return (
                <g key={i}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1.2" />
                  <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#475569" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Area Fill */}
            <path d={areaPath} fill={currentTheme.fill} />

            {/* Main Metric Line */}
            <path d={linePath} fill="none" stroke={currentTheme.stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points & Anomaly Dots */}
            {timeseriesData.map((point, idx) => {
              const x = getX(idx)
              const y = getY(getMetricValue(point))
              const isAnomaly = point.anomaly === 1

              return (
                <g key={idx} onMouseEnter={() => setHoveredPoint(point)} onMouseLeave={() => setHoveredPoint(null)} style={{ cursor: 'pointer' }}>
                  {isAnomaly ? (
                    <g>
                      <circle cx={x} cy={y} r="7.5" fill="rgba(225, 29, 72, 0.2)" stroke="#e11d48" strokeWidth="2" />
                      <circle cx={x} cy={y} r="4" fill="#e11d48" />
                    </g>
                  ) : (
                    <circle cx={x} cy={y} r="3.2" fill={currentTheme.stroke} stroke="#ffffff" strokeWidth="1.2" />
                  )}
                </g>
              )
            })}

            {/* Date Labels on X Axis */}
            {timeseriesData.filter((_, idx) => idx % Math.max(1, Math.floor(timeseriesData.length / 6)) === 0).map((point, idx) => {
              const originalIdx = timeseriesData.indexOf(point)
              const x = getX(originalIdx)
              return (
                <text key={idx} x={x} y={height - 10} textAnchor="middle" fill="#475569" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                  {point.date_of_record.slice(5)}
                </text>
              )
            })}
          </svg>

          {/* Hover Tooltip Card */}
          {hoveredPoint && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '65px',
              background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 50%, #dcfce7 100%)',
              border: '1.5px solid rgba(34, 197, 94, 0.45)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              fontSize: '0.76rem',
              zIndex: 10,
              boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
              lineHeight: 1.5,
              color: '#0f172a'
            }}>
              <div style={{ fontWeight: 800, color: '#000000', fontSize: '0.82rem' }}>
                📅 {hoveredPoint.date_of_record} • 📍 {hoveredPoint.station_name}
              </div>
              <div style={{ color: currentTheme.stroke, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.86rem', marginTop: '0.15rem' }}>
                {currentTheme.label}: <strong>{getMetricValue(hoveredPoint)}</strong>
              </div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.15rem' }}>
                Temp: {hoveredPoint.min_temp}° / {hoveredPoint.max_temp}°C | Wind: {hoveredPoint.wind_speed} km/h | Press: {hoveredPoint.air_pressure} hPa | Rain: {hoveredPoint.rainfall} mm
              </div>
              {hoveredPoint.anomaly === 1 ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#be123c',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '5px',
                  fontWeight: 800,
                  marginTop: '0.35rem',
                  fontSize: '0.7rem'
                }}>
                  ⚠️ ML-Detected Anomaly (Score: {hoveredPoint.anomaly_score})
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#15803d',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '5px',
                  fontWeight: 700,
                  marginTop: '0.35rem',
                  fontSize: '0.7rem'
                }}>
                  ✅ Normal Synoptic Observation
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chart Footer Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1.5px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: currentTheme.stroke }} />
            {currentTheme.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: '#be123c' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#e11d48' }} />
            ML-Detected Anomaly Reading
          </span>
        </div>
        <span className="font-mono" style={{ fontWeight: 700, color: '#0f172a' }}>
          Total Observations: {timeseriesData.length}
        </span>
      </div>

    </div>
  )
}
