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

  useEffect(() => {
    fetchStationTimeseries(selectedStation)
  }, [selectedStation])

  const fetchStationTimeseries = async (station: string) => {
    setLoading(true)
    try {
      const res = await apiClient.getTimeSeries({ station, limit: 45 })
      setTimeseriesData(res.data || [])
    } catch {
      setTimeseriesData([])
    } finally {
      setLoading(false)
    }
  }

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
    temp: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.12)', label: 'Avg Temperature (°C)' },
    rain: { stroke: '#6ee7b7', fill: 'rgba(110, 231, 183, 0.12)', label: 'Precipitation / Rainfall (mm)' },
    wind: { stroke: '#fbbf24', fill: 'rgba(245, 158, 11, 0.12)', label: 'Wind Velocity (km/h)' },
    pressure: { stroke: '#a78bfa', fill: 'rgba(139, 92, 246, 0.12)', label: 'Barometric Pressure (hPa)' }
  }

  const currentTheme = metricColors[activeMetric]

  return (
    <div className="glass-panel" style={{ padding: '1.6rem' }}>
      
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Sensor Telemetry Stream & Anomaly Markers
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Sequential observations for <strong>{selectedStation}</strong> station with Isolation Forest flagged readings.
          </p>
        </div>

        {/* Station Select & Metric Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="input-pill mono"
            style={{ width: '180px', padding: '0.45rem 0.7rem', fontSize: '0.8rem' }}
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
          >
            {availableStations.length > 0 ? (
              availableStations.map(s => <option key={s} value={s}>{s}</option>)
            ) : (
              <>
                <option value="Poona">Poona AWS</option>
                <option value="Srinagar">Srinagar AWS</option>
                <option value="Thiruvananthapuram">Thiruvananthapuram AWS</option>
                <option value="Akola">Akola AWS</option>
                <option value="Madurai">Madurai AWS</option>
                <option value="Agra">Agra AWS</option>
                <option value="Gulmarg">Gulmarg AWS</option>
                <option value="Mount Abu">Mount Abu AWS</option>
                <option value="Siliguri">Siliguri AWS</option>
              </>
            )}
          </select>

          {/* Metric Buttons */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(18, 44, 33, 0.9)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            {(['temp', 'rain', 'wind', 'pressure'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                style={{
                  background: activeMetric === m ? '#059669' : 'transparent',
                  color: activeMetric === m ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '5px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease'
                }}
              >
                {m === 'temp' ? 'Temperature' : m === 'rain' ? 'Rainfall' : m === 'wind' ? 'Wind Speed' : 'Pressure'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG CHART */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--met-mint)', fontSize: '0.88rem', fontWeight: 600 }}>
          🛰️ Retrieving historical sensor telemetry stream...
        </div>
      ) : timeseriesData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          No telemetry points available for the selected station.
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + plotHeight * pct
              const val = (maxVal - pct * valRange).toFixed(1)
              return (
                <g key={i}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(52, 211, 153, 0.08)" strokeDasharray="3 3" />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Area Fill */}
            <path d={areaPath} fill={currentTheme.fill} />

            {/* Main Metric Line */}
            <path d={linePath} fill="none" stroke={currentTheme.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points & Anomaly Dots */}
            {timeseriesData.map((point, idx) => {
              const x = getX(idx)
              const y = getY(getMetricValue(point))
              const isAnomaly = point.anomaly === 1

              return (
                <g key={idx} onMouseEnter={() => setHoveredPoint(point)} onMouseLeave={() => setHoveredPoint(null)} style={{ cursor: 'pointer' }}>
                  {isAnomaly ? (
                    <g>
                      <circle cx={x} cy={y} r="6.5" fill="none" stroke="#f43f5e" strokeWidth="1.8" opacity="0.9" />
                      <circle cx={x} cy={y} r="3.5" fill="#f43f5e" />
                    </g>
                  ) : (
                    <circle cx={x} cy={y} r="2.8" fill={currentTheme.stroke} opacity="0.85" />
                  )}
                </g>
              )
            })}

            {/* Date Labels on X Axis */}
            {timeseriesData.filter((_, idx) => idx % Math.max(1, Math.floor(timeseriesData.length / 6)) === 0).map((point, idx) => {
              const originalIdx = timeseriesData.indexOf(point)
              const x = getX(originalIdx)
              return (
                <text key={idx} x={x} y={height - 10} textAnchor="middle" fill="var(--text-dim)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  {point.date_of_record.slice(5)}
                </text>
              )
            })}
          </svg>

          {/* Hover Tooltip Card */}
          {hoveredPoint && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '60px',
              backgroundColor: 'rgba(18, 44, 33, 0.96)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.74rem',
              zIndex: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              lineHeight: 1.45
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{hoveredPoint.date_of_record} • {hoveredPoint.station_name}</div>
              <div style={{ color: currentTheme.stroke, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {currentTheme.label}: <strong>{getMetricValue(hoveredPoint)}</strong>
              </div>
              <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Temp: {hoveredPoint.min_temp}°/{hoveredPoint.max_temp}°C | Wind: {hoveredPoint.wind_speed} km/h | Press: {hoveredPoint.air_pressure} hPa
              </div>
              {hoveredPoint.anomaly === 1 ? (
                <div style={{ color: 'var(--met-rose)', fontWeight: 700, marginTop: '3px' }}>
                  ⚠️ ML-Detected Anomaly (Score: {hoveredPoint.anomaly_score})
                </div>
              ) : (
                <div style={{ color: 'var(--met-mint)', fontWeight: 600, marginTop: '3px' }}>
                  ✅ Normal Observation
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chart Footer Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentTheme.stroke }} />
            {currentTheme.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f43f5e' }} />
            ML-Detected Anomaly Reading
          </span>
        </div>
        <span className="font-mono">Points: {timeseriesData.length} Observations</span>
      </div>

    </div>
  )
}
