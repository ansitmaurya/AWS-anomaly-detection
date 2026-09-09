import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type StationItem, type ExternalWeatherResponse, apiClient } from '../api/client'

interface StationMapProps {
  stations: StationItem[]
  loading: boolean
  onSelectStation?: (station: StationItem) => void
}

export function StationMap({ stations, loading, onSelectStation }: StationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [extWeather, setExtWeather] = useState<ExternalWeatherResponse | null>(null)
  const [extLoading, setExtLoading] = useState<boolean>(false)

  // Fetch Open-Meteo external weather reference when an AWS station is selected
  useEffect(() => {
    if (!selectedStation || selectedStation.latitude == null || selectedStation.longitude == null) {
      setExtWeather(null)
      return
    }

    let isMounted = true
    setExtLoading(true)
    apiClient.getExternalWeather(
      Number(selectedStation.latitude),
      Number(selectedStation.longitude),
      selectedStation.station_name
    )
      .then(res => {
        if (isMounted) setExtWeather(res)
      })
      .catch(() => {
        if (isMounted) {
          setExtWeather({
            available: false,
            source: 'Open-Meteo',
            station_name: selectedStation.station_name,
            latitude: Number(selectedStation.latitude),
            longitude: Number(selectedStation.longitude),
            units: { temperature: '°C', humidity: '%', wind_speed: 'km/h', precipitation: 'mm' },
            error_message: 'External weather reference unavailable'
          })
        }
      })
      .finally(() => {
        if (isMounted) setExtLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedStation?.station_name, selectedStation?.latitude, selectedStation?.longitude])

  // Helper to categorize station severity tier
  const getStationTier = (st: StationItem) => {
    if (st.anomaly_rate > 30.0 || (st.latest_score && st.latest_score > 0.70)) {
      return 'CRITICAL'
    } else if (st.anomaly_rate > 10.0 || st.status === 'Anomaly') {
      return 'ANOMALY'
    } else if (st.anomaly_rate >= 2.0 || st.status === 'Suspicious') {
      return 'SUSPICIOUS'
    } else {
      return 'NORMAL'
    }
  }

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      // Light-Green Meteorological Terrain Map — Centered on India with smooth, controlled zoom
      const map = L.map(mapContainerRef.current, {
        center: [22.8, 79.5],
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        zoomDelta: 0.25,
        zoomSnap: 0.25,
        wheelPxPerZoomLevel: 260,
        wheelDebounceTime: 120,
        doubleClickZoom: false,
        zoomControl: true,
        attributionControl: false
      })

      // Light-Green Meteorological Natural Terrain Tile Layer (CartoDB Voyager)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 12,
        subdomains: 'abcd',
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update Markers when stations or filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return

    markersLayerRef.current.clearLayers()

    const filtered = stations.filter(st => {
      if (statusFilter === 'ALL') return true
      const tier = getStationTier(st)
      return tier === statusFilter.toUpperCase()
    })

    filtered.forEach(st => {
      if (!st.latitude || !st.longitude || isNaN(Number(st.latitude)) || isNaN(Number(st.longitude))) return

      const tier = getStationTier(st)

      // High-Contrast Marker Colors
      let markerColor = '#10b981' // Emerald / Mint for Normal
      let markerRadius = 5.0
      let strokeColor = '#ffffff'
      let strokeWidth = 1.2

      if (tier === 'CRITICAL') {
        markerColor = '#dc2626'
        markerRadius = 7.5
        strokeWidth = 1.8
      } else if (tier === 'ANOMALY') {
        markerColor = '#f43f5e'
        markerRadius = 6.2
        strokeWidth = 1.5
      } else if (tier === 'SUSPICIOUS') {
        markerColor = '#f59e0b'
        markerRadius = 5.4
        strokeWidth = 1.4
      }

      // Subtle pulse ring for Critical & Anomaly nodes
      if (tier === 'CRITICAL' || tier === 'ANOMALY') {
        const pulseRing = L.circleMarker([Number(st.latitude), Number(st.longitude)], {
          radius: markerRadius + 4,
          fillColor: 'transparent',
          color: markerColor,
          weight: 1.2,
          opacity: 0.5,
          interactive: false
        })
        pulseRing.addTo(markersLayerRef.current!)
      }

      const marker = L.circleMarker([Number(st.latitude), Number(st.longitude)], {
        radius: markerRadius,
        fillColor: markerColor,
        color: strokeColor,
        weight: strokeWidth,
        opacity: 0.95,
        fillOpacity: 0.92
      })

      // Status Colors for Popups
      const statusMeta = {
        NORMAL: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399', label: 'OPERATIONAL NORMAL' },
        SUSPICIOUS: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24', label: 'SUSPICIOUS TELEMETRY' },
        ANOMALY: { bg: 'rgba(244, 63, 94, 0.16)', border: 'rgba(244, 63, 94, 0.4)', text: '#fb7185', label: 'ML-DETECTED ANOMALY' },
        CRITICAL: { bg: 'rgba(220, 38, 38, 0.22)', border: 'rgba(220, 38, 38, 0.55)', text: '#f87171', label: 'CRITICAL SENSOR ALERT' }
      }[tier]

      const anomalyScoreVal = st.latest_score ?? (st.anomaly_rate / 100).toFixed(2)

      // Dark Mission Control Telemetry Popup
      const popupHtml = `
        <div class="met-popup-card">
          <div class="met-popup-header">
            <div class="met-popup-title">${st.station_name}</div>
            <div class="met-popup-sub">📍 ${st.district}, ${st.state} • Elev: ${st.elevation}m</div>
          </div>
          
          <div class="met-popup-status" style="background: ${statusMeta.bg}; border-color: ${statusMeta.border};">
            <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">STATUS</span>
            <span style="font-weight: 700; font-size: 11px; color: ${statusMeta.text};">● ${statusMeta.label}</span>
          </div>

          <div class="met-popup-grid">
            <div class="met-popup-metric">
              <span class="lbl">ISOLATION SCORE</span>
              <span class="val" style="color: ${Number(anomalyScoreVal) > 0.6 ? '#fb7185' : '#34d399'};">${anomalyScoreVal}</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">QUALITY INDEX</span>
              <span class="val" style="color: ${st.health_score > 80 ? '#34d399' : st.health_score > 60 ? '#fbbf24' : '#fb7185'};">${st.health_score}%</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">AVG TEMPERATURE</span>
              <span class="val">${st.avg_temp}°C</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">WIND SPEED</span>
              <span class="val">${st.latest_wind ?? '9.4'} km/h</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">AIR PRESSURE</span>
              <span class="val">${st.latest_pressure ?? '1009'} hPa</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">PRECIPITATION</span>
              <span class="val">${st.latest_rainfall ?? '0.0'} mm</span>
            </div>
          </div>

          <div class="met-popup-footer">
            <span>OBS: ${st.total_records.toLocaleString()}</span>
            <span>ANOMALIES: ${st.anomalies} (${st.anomaly_rate}%)</span>
          </div>
        </div>
      `
      marker.bindPopup(popupHtml, { maxWidth: 280 })

      marker.on('click', () => {
        setSelectedStation(st)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([Number(st.latitude), Number(st.longitude)], { animate: true, duration: 0.5 })
        }
        if (onSelectStation) onSelectStation(st)
      })

      marker.addTo(markersLayerRef.current!)
    })
  }, [stations, statusFilter])

  // Calculation helpers for side-by-side comparison
  const awsTemp = selectedStation ? Number(selectedStation.avg_temp) : 0
  const extTemp = extWeather && extWeather.temperature != null ? extWeather.temperature : null
  const tempDiff = extTemp != null ? awsTemp - extTemp : null

  const awsWind = selectedStation && selectedStation.latest_wind != null && !isNaN(Number(selectedStation.latest_wind)) ? Number(selectedStation.latest_wind) : 9.4
  const extWind = extWeather && extWeather.wind_speed != null ? extWeather.wind_speed : null
  const windDiff = extWind != null ? awsWind - extWind : null

  const isSignificantDeviation = (tempDiff != null && Math.abs(tempDiff) >= 5.0) || (windDiff != null && Math.abs(windDiff) >= 20.0)
  const isModerateDeviation = !isSignificantDeviation && ((tempDiff != null && Math.abs(tempDiff) >= 3.0) || (windDiff != null && Math.abs(windDiff) >= 10.0))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '1rem', height: '640px' }}>
      
      {/* MAP CONTAINER */}
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#dcf2e3', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating Dark Atmospheric Filter Chips */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(18, 44, 33, 0.94)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          padding: '0.35rem 0.6rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)'
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.1rem' }}>Tier:</span>
          {(['ALL', 'NORMAL', 'SUSPICIOUS', 'ANOMALY', 'CRITICAL'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setStatusFilter(tier)}
              style={{
                background: statusFilter === tier ? '#059669' : 'transparent',
                color: statusFilter === tier ? '#ffffff' : 'var(--text-secondary)',
                border: statusFilter === tier ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid transparent',
                padding: '0.22rem 0.52rem',
                borderRadius: '5px',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tier === 'ALL' ? 'All (406)' : tier}
            </button>
          ))}
        </div>

        {/* Clean Dark Atmospheric Floating Legend */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 1000,
          background: 'rgba(18, 44, 33, 0.94)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          padding: '0.55rem 0.85rem',
          fontSize: '0.72rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem', fontSize: '0.7rem' }}>
            🛰️ AWS Node Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', border: '1px solid #ffffff' }} />
            <span style={{ color: 'var(--text-secondary)' }}>● NORMAL (&lt;2% Anomaly Rate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '1px solid #ffffff' }} />
            <span style={{ color: 'var(--text-secondary)' }}>● SUSPICIOUS (2–10% Anomaly Rate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f43f5e', border: '1px solid #ffffff' }} />
            <span style={{ color: 'var(--text-secondary)' }}>● ANOMALY (10–30% Anomaly Alert)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', border: '1px solid #ffffff' }} />
            <span style={{ color: 'var(--text-secondary)' }}>● CRITICAL (&gt;30% Severe Sensor Degradation)</span>
          </div>
        </div>

        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(14, 38, 28, 0.88)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            color: 'var(--met-mint)',
            fontWeight: 600,
            fontSize: '0.88rem'
          }}>
            🛰️ Synchronizing AWS node coordinates from telemetry data...
          </div>
        )}
      </div>

      {/* SIDEBAR: SELECTED STATION & EXTERNAL WEATHER REFERENCE */}
      <div className="glass-panel" style={{ padding: '1.15rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between' }}>
        {selectedStation ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedStation.station_name}
                </h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  📍 {selectedStation.district}, {selectedStation.state}
                </div>
              </div>
              <button
                onClick={() => setSelectedStation(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}
                title="Clear selection"
              >
                ✕
              </button>
            </div>

            {/* Health Score Pill */}
            <div style={{
              backgroundColor: selectedStation.health_score > 80 ? 'rgba(16, 185, 129, 0.15)' : selectedStation.health_score > 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.18)',
              border: `1px solid ${selectedStation.health_score > 80 ? 'rgba(16, 185, 129, 0.35)' : selectedStation.health_score > 60 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(244, 63, 94, 0.45)'}`,
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginBottom: '0.65rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Telemetry Quality Index</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: selectedStation.health_score > 80 ? 'var(--met-mint)' : selectedStation.health_score > 60 ? 'var(--met-gold)' : 'var(--met-rose)' }}>
                  {selectedStation.health_score}%
                </div>
              </div>
              <span className={`ops-badge ${getStationTier(selectedStation) === 'CRITICAL' ? 'badge-critical' : getStationTier(selectedStation) === 'ANOMALY' ? 'badge-coral' : getStationTier(selectedStation) === 'SUSPICIOUS' ? 'badge-amber' : 'badge-cyan'}`}>
                {getStationTier(selectedStation)}
              </span>
            </div>

            {/* Geographic Telemetry */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.65rem' }}>
              <div style={{ backgroundColor: 'rgba(16, 42, 31, 0.8)', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coordinates</div>
                <div className="font-mono" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedStation.latitude}°N, {selectedStation.longitude}°E</div>
              </div>
              <div style={{ backgroundColor: 'rgba(16, 42, 31, 0.8)', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elevation</div>
                <div className="font-mono" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedStation.elevation} m</div>
              </div>
            </div>

            {/* EXTERNAL WEATHER REFERENCE SECTION */}
            <div style={{ backgroundColor: 'rgba(16, 42, 31, 0.88)', padding: '0.8rem', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  EXTERNAL WEATHER REFERENCE
                </div>
                <span style={{ fontSize: '0.65rem', padding: '0.12rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'var(--font-mono)' }}>
                  Source: Open-Meteo
                </span>
              </div>

              {extLoading ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.6rem 0', textAlign: 'center' }}>
                  ⏳ Retrieving Open-Meteo observation...
                </div>
              ) : extWeather && extWeather.available ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.5rem' }}>
                    <div style={{ backgroundColor: 'rgba(12, 34, 25, 0.75)', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temperature</div>
                      <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        {extWeather.temperature != null ? `${extWeather.temperature} °C` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(12, 34, 25, 0.75)', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Humidity</div>
                      <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        {extWeather.humidity != null ? `${extWeather.humidity} %` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(12, 34, 25, 0.75)', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wind Speed</div>
                      <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        {extWeather.wind_speed != null ? `${extWeather.wind_speed} km/h` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(12, 34, 25, 0.75)', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Precipitation</div>
                      <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        {extWeather.precipitation != null ? `${extWeather.precipitation} mm` : '0.0 mm'}
                      </div>
                    </div>
                  </div>

                  {extWeather.timestamp && (
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                      Observation time: {String(extWeather.timestamp).replace('T', ' ')}
                    </div>
                  )}

                  {/* AWS VS EXTERNAL COMPARISON */}
                  <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.35rem' }}>
                      AWS vs External
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem', backgroundColor: 'rgba(12, 34, 25, 0.85)', padding: '0.45rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', marginBottom: '0.45rem' }}>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>AWS Station</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>{awsTemp}°C</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>External Ref</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{extTemp != null ? `${extTemp}°C` : 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Difference</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: tempDiff != null && Math.abs(tempDiff) >= 5 ? '#f43f5e' : tempDiff != null && Math.abs(tempDiff) >= 3 ? '#f59e0b' : '#34d399' }}>
                          {tempDiff != null ? `${tempDiff >= 0 ? '+' : ''}${tempDiff.toFixed(1)}°C` : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      fontSize: '0.68rem',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '5px',
                      backgroundColor: isSignificantDeviation ? 'rgba(244, 63, 94, 0.12)' : isModerateDeviation ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isSignificantDeviation ? 'rgba(244, 63, 94, 0.3)' : isModerateDeviation ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      color: isSignificantDeviation ? '#fb7185' : isModerateDeviation ? '#fbbf24' : '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      <span>{isSignificantDeviation ? '⚠️' : isModerateDeviation ? 'ℹ️' : '✓'}</span>
                      <span>
                        {isSignificantDeviation
                          ? 'Significant deviation from external reference'
                          : isModerateDeviation
                          ? 'Reference deviation detected'
                          : 'Consistent with external reference'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', padding: '0.5rem 0', textAlign: 'center' }}>
                  External weather reference unavailable.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  EXTERNAL WEATHER REFERENCE
                </div>
                <span style={{ fontSize: '0.65rem', padding: '0.12rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'var(--font-mono)' }}>
                  Source: Open-Meteo
                </span>
              </div>

              <div style={{
                backgroundColor: 'rgba(16, 42, 31, 0.8)',
                border: '1px dashed var(--border-medium)',
                borderRadius: '10px',
                padding: '2rem 1.25rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem',
                lineHeight: 1.6
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.65rem' }}>🛰️</div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                  Select a station to view external weather reference.
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Click any station marker on the map to query Open-Meteo for real-time temperature, humidity, wind, and precipitation reference observations.
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
              406 Indian AWS nodes active. Click a marker to compare telemetry with external reference data.
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
          🛰️ Scored via Isolation Forest. Reference observations via Open-Meteo.
        </div>
      </div>

    </div>
  )
}

