import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type StationItem } from '../api/client'

interface StationMapProps {
  stations: StationItem[]
  loading: boolean
  selectedCoord?: { lat: number; lng: number; name?: string } | null
  onSelectStation?: (station: StationItem) => void
  onMapClick?: (lat: number, lng: number, station?: StationItem) => void
}

export function StationMap({ stations, loading, selectedCoord, onSelectStation, onMapClick }: StationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const selectionLayerRef = useRef<L.LayerGroup | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick

  const onSelectStationRef = useRef(onSelectStation)
  onSelectStationRef.current = onSelectStation

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

  // Initialize Leaflet Map (Once on mount)
  useEffect(() => {
    if (!mapContainerRef.current) return

    let resizeObserver: ResizeObserver | null = null

    if (!mapInstanceRef.current) {
      // Light-Green Meteorological Terrain Map — Centered on India with smooth, controlled zoom
      const map = L.map(mapContainerRef.current, {
        center: [22.8, 79.5],
        zoom: 4.75,
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
      const selectionLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      selectionLayerRef.current = selectionLayer
      mapInstanceRef.current = map

      // Map click handler — allows clicking anywhere on the map to query external weather
      map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = Number(e.latlng.lat.toFixed(4))
        const lng = Number(e.latlng.lng.toFixed(4))
        map.panTo([lat, lng], { animate: true, duration: 0.35 })
        if (onMapClickRef.current) {
          onMapClickRef.current(lat, lng, undefined)
        }
      })

      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      })
      resizeObserver.observe(mapContainerRef.current)

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      }, 100)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
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
      const lat = typeof st.latitude === 'number' ? st.latitude : parseFloat(String(st.latitude))
      const lng = typeof st.longitude === 'number' ? st.longitude : parseFloat(String(st.longitude))
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return

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
        const pulseRing = L.circleMarker([lat, lng], {
          radius: markerRadius + 4,
          fillColor: 'transparent',
          color: markerColor,
          weight: 1.2,
          opacity: 0.5,
          interactive: false
        })
        pulseRing.addTo(markersLayerRef.current!)
      }

      const marker = L.circleMarker([lat, lng], {
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

      const anomalyScoreVal = st.latest_score != null 
        ? Number(st.latest_score).toFixed(2) 
        : (Number(st.anomaly_rate) / 100).toFixed(2)

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
              <span class="val" style="color: ${st.health_score > 80 ? '#34d399' : st.health_score > 60 ? '#fbbf24' : '#fb7185'};">${st.health_score != null && !isNaN(Number(st.health_score)) ? Number(st.health_score).toFixed(2) : st.health_score}%</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">AVG TEMPERATURE</span>
              <span class="val">${st.avg_temp != null && !isNaN(Number(st.avg_temp)) ? Number(st.avg_temp).toFixed(2) : 'N/A'}°C</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">WIND SPEED</span>
              <span class="val">${st.latest_wind != null && !isNaN(Number(st.latest_wind)) ? Number(st.latest_wind).toFixed(2) : '9.40'} km/h</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">AIR PRESSURE</span>
              <span class="val">${st.latest_pressure != null && !isNaN(Number(st.latest_pressure)) ? Number(st.latest_pressure).toFixed(2) : '1009.00'} hPa</span>
            </div>
            <div class="met-popup-metric">
              <span class="lbl">PRECIPITATION</span>
              <span class="val">${st.latest_rainfall != null && !isNaN(Number(st.latest_rainfall)) ? Number(st.latest_rainfall).toFixed(2) : '0.00'} mm</span>
            </div>
          </div>

          <div class="met-popup-footer">
            <span>OBS: ${st.total_records.toLocaleString()}</span>
            <span>ANOMALIES: ${st.anomalies} (${st.anomaly_rate != null && !isNaN(Number(st.anomaly_rate)) ? Number(st.anomaly_rate).toFixed(2) : '0.00'}%)</span>
          </div>
        </div>
      `
      marker.bindPopup(popupHtml, { maxWidth: 280 })

      marker.on('click', () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.5 })
        }
        if (onSelectStationRef.current) onSelectStationRef.current(st)
        if (onMapClickRef.current) onMapClickRef.current(lat, lng, st)
      })

      marker.addTo(markersLayerRef.current!)
    })

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }, 50)
  }, [stations, statusFilter])

  // Update Selected Coordinate Reticle Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !selectionLayerRef.current) return

    selectionLayerRef.current.clearLayers()

    if (selectedCoord && !isNaN(selectedCoord.lat) && !isNaN(selectedCoord.lng)) {
      const pulseRing = L.circleMarker([selectedCoord.lat, selectedCoord.lng], {
        radius: 14,
        color: '#34d399',
        weight: 2,
        dashArray: '3, 4',
        fillColor: 'rgba(52, 211, 153, 0.15)',
        fillOpacity: 0.8,
        interactive: false
      })

      const centerDot = L.circleMarker([selectedCoord.lat, selectedCoord.lng], {
        radius: 5,
        color: '#ffffff',
        weight: 2,
        fillColor: '#059669',
        fillOpacity: 1,
        interactive: false
      })

      pulseRing.addTo(selectionLayerRef.current)
      centerDot.addTo(selectionLayerRef.current)
    }
  }, [selectedCoord])

  return (
    <div style={{ position: 'relative', width: '100%', height: '620px', minHeight: '520px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#dcf2e3', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
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
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        flexWrap: 'wrap'
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
  )
}
