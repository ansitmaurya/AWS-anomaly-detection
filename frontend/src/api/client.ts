/**
 * Centralized Typed API Client for AWS Anomaly Detection System Backend
 */

const rawBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://aws-anomaly-detection.onrender.com'
const API_BASE = rawBaseUrl.replace(/\/+$/, '')

export interface HealthResponse {
  status: string
  service: string
  version: string
  ml_model_loaded: boolean
  timestamp: string
}

export interface DatasetStatsResponse {
  total_records: number
  normal_records: number
  anomaly_records: number
  anomaly_percentage: number
  unique_stations: number
  unique_states: number
  unique_districts: number
  stations_requiring_attention: number
  available_states?: string[]
  date_range: {
    start: string
    end: string
  }
  averages: {
    avg_temp: number
    wind_speed: number
    air_pressure: number
    rainfall: number
  }
}

export interface SeasonTelemetryItem {
  name: string
  season: string
  count: string
  raw_count: number
  pct: number
  color: string
}

export interface ParameterRange {
  mean: number
  min: number
  max: number
  std: number
}

export interface TelemetryAnalyticsResponse {
  total_records: number
  seasons: SeasonTelemetryItem[]
  ranges: {
    avg_temp: ParameterRange
    wind_speed: ParameterRange
    air_pressure: ParameterRange
    rainfall: ParameterRange
  }
}

export interface TimeSeriesPoint {
  date_of_record: string
  station_name: string
  avg_temp: number
  min_temp: number
  max_temp: number
  wind_speed: number
  air_pressure: number
  rainfall: number
  anomaly: number
  anomaly_score: number
}

export interface TimeSeriesResponse {
  station: string
  total_points: number
  data: TimeSeriesPoint[]
}

export interface WeatherTelemetryInput {
  station_name?: string
  date_of_record?: string
  avg_temp: number
  min_temp: number
  max_temp: number
  wind_speed: number
  air_pressure: number
  rainfall: number
  elevation?: number
  latitude?: number
  longitude?: number
}

export interface PredictionResponse {
  anomaly: number
  is_anomaly: boolean
  anomaly_score: number
  severity: string
  decision_value: number
  station_name: string
  date_of_record: string
  ml_explanation: string
  physical_diagnostics: string[]
}

export interface AnomalyItem {
  date_of_record: string
  station_name: string
  state: string
  district: string
  avg_temp: number
  min_temp: number | string
  max_temp: number | string
  wind_speed: number | string
  air_pressure: number | string
  rainfall: number | string
  elevation: number
  latitude: number
  longitude: number
  anomaly: number
  anomaly_score: number
  severity?: string
  explanation?: string
}

export interface AnomaliesResponse {
  total: number
  page: number
  limit: number
  total_pages: number
  items: AnomalyItem[]
}

export interface StationItem {
  station_name: string
  state: string
  district: string
  total_records: number
  anomalies: number
  anomaly_rate: number
  health_score: number
  status: 'Normal' | 'Suspicious' | 'Anomaly'
  elevation: number
  latitude: number
  longitude: number
  avg_temp: number
  latest_max_temp?: number | string
  latest_min_temp?: number | string
  latest_wind?: number | string
  latest_pressure?: number | string
  latest_rainfall?: number | string
  latest_score?: number
}

export interface StationsResponse {
  total: number
  page: number
  limit: number
  total_pages: number
  items: StationItem[]
}

export interface ExternalWeatherResponse {
  available: boolean
  source: string
  station_name?: string
  latitude: number
  longitude: number
  timestamp?: string
  temperature?: number | null
  humidity?: number | null
  wind_speed?: number | null
  precipitation?: number | null
  units: {
    temperature: string
    humidity: string
    wind_speed: string
    precipitation: string
  }
  error_message?: string | null
}

export const apiClient = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/api/health`)
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`)
    return res.json()
  },

  async getExternalWeather(latitude: number, longitude: number, station_name?: string): Promise<ExternalWeatherResponse> {
    const query = new URLSearchParams()
    query.append('latitude', latitude.toString())
    query.append('longitude', longitude.toString())
    if (station_name) query.append('station_name', station_name)

    const res = await fetch(`${API_BASE}/api/external-weather?${query.toString()}`)
    if (!res.ok) {
      return {
        available: false,
        source: 'Open-Meteo',
        station_name,
        latitude,
        longitude,
        units: { temperature: '°C', humidity: '%', wind_speed: 'km/h', precipitation: 'mm' },
        error_message: 'External weather reference unavailable'
      }
    }
    return res.json()
  },

  async getStats(): Promise<DatasetStatsResponse> {
    const res = await fetch(`${API_BASE}/api/stats`)
    if (!res.ok) throw new Error(`Stats fetch failed: ${res.statusText}`)
    return res.json()
  },

  async getTelemetry(): Promise<TelemetryAnalyticsResponse> {
    const res = await fetch(`${API_BASE}/api/telemetry`)
    if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.statusText}`)
    return res.json()
  },

  async getTimeSeries(params?: {
    station?: string
    start_date?: string
    end_date?: string
    limit?: number
  }): Promise<TimeSeriesResponse> {
    const query = new URLSearchParams()
    if (params?.station) query.append('station', params.station)
    if (params?.start_date) query.append('start_date', params.start_date)
    if (params?.end_date) query.append('end_date', params.end_date)
    if (params?.limit) query.append('limit', params.limit.toString())

    const res = await fetch(`${API_BASE}/api/timeseries?${query.toString()}`)
    if (!res.ok) throw new Error(`Timeseries fetch failed: ${res.statusText}`)
    return res.json()
  },

  async predict(data: WeatherTelemetryInput): Promise<PredictionResponse> {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`Prediction API failed: ${res.statusText}`)
    return res.json()
  },

  async getAnomalies(params: {
    page?: number
    limit?: number
    state?: string
    station?: string
    start_date?: string
    end_date?: string
    severity?: string
    sort_by?: string
  }): Promise<AnomaliesResponse> {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page.toString())
    if (params.limit) query.append('limit', params.limit.toString())
    if (params.state) query.append('state', params.state)
    if (params.station) query.append('station', params.station)
    if (params.start_date) query.append('start_date', params.start_date)
    if (params.end_date) query.append('end_date', params.end_date)
    if (params.severity) query.append('severity', params.severity)
    if (params.sort_by) query.append('sort_by', params.sort_by)

    const res = await fetch(`${API_BASE}/api/anomalies?${query.toString()}`)
    if (!res.ok) throw new Error(`Anomalies fetch failed: ${res.statusText}`)
    return res.json()
  },

  async getStations(params?: {
    page?: number
    limit?: number
    search?: string
    state?: string
    status?: string
  }): Promise<StationsResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.append('page', params.page.toString())
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.state) query.append('state', params.state)
    if (params?.status) query.append('status', params.status)

    const res = await fetch(`${API_BASE}/api/stations?${query.toString()}`)
    if (!res.ok) throw new Error(`Stations fetch failed: ${res.statusText}`)
    return res.json()
  }
}

