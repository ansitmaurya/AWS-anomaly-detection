# REST API Specification & Endpoint Catalog

The backend service is powered by **FastAPI** running on `http://127.0.0.1:8000`. Interactive OpenAPI documentation is accessible at `/docs`.

---

## 📡 Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and ML model loaded verification |
| `POST` | `/api/predict` | Real-time single telemetry observation scoring & physical diagnostics |
| `GET` | `/api/stats` | Aggregated dataset KPIs (total records, anomaly count, stations) |
| `GET` | `/api/stations` | Paginated station directory with real coordinates & health scores |
| `GET` | `/api/timeseries` | Sequential daily multi-sensor telemetry stream for time-series charts |
| `GET` | `/api/anomalies` | Multi-parameter filterable anomaly explorer with explanations |
| `GET` | `/api/telemetry` | Statistical distributions and seasonal observation breakdown |

---

## 1. Health Status
- **Endpoint**: `GET /api/health`
- **Description**: Verifies backend availability and confirms that Scikit-Learn Isolation Forest artifacts are active in memory.
- **Example Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "service": "Atmospheric Intelligence Engine",
  "version": "2.1.0",
  "ml_model_loaded": true,
  "timestamp": "2026-09-06T07:57:06.541161+00:00"
}
```

---

## 2. Real-Time Packet Inference
- **Endpoint**: `POST /api/predict`
- **Description**: Evaluates a single incoming weather observation using the trained Isolation Forest and physical sanity domain rules.
- **Request Body (`application/json`)**:
```json
{
  "station_name": "Sensor Spike #104",
  "avg_temp": 45.0,
  "min_temp": 28.0,
  "max_temp": 87.0,
  "wind_speed": 8.5,
  "air_pressure": 1006.0,
  "rainfall": 0.0,
  "elevation": 210.0,
  "latitude": 22.57,
  "longitude": 88.36
}
```
- **Example Response (`200 OK`)**:
```json
{
  "anomaly": 1,
  "is_anomaly": true,
  "anomaly_score": 0.6672,
  "severity": "HIGH",
  "decision_value": -0.1391,
  "station_name": "Sensor Spike #104",
  "date_of_record": "2026-09-06",
  "ml_explanation": "Isolation Forest flagged this telemetry as ML-detected anomaly (Score: 0.6672, Decision Value: -0.1391). In multidimensional feature space, this point is isolated near tree roots.",
  "physical_diagnostics": [
    "Temperature Sensor Bounds: Ambient reading exceeds standard meteorological sensor threshold (> 55°C or < -35°C)."
  ]
}
```

---

## 3. Dataset Summary Metrics
- **Endpoint**: `GET /api/stats`
- **Description**: Returns live aggregated figures computed over the 970,339 records.
- **Example Response (`200 OK`)**:
```json
{
  "total_records": 970339,
  "normal_records": 950932,
  "anomaly_records": 19407,
  "anomaly_percentage": 2.0,
  "unique_stations": 406,
  "unique_states": 32,
  "unique_districts": 314,
  "stations_requiring_attention": 30,
  "available_states": ["AN", "AP", "AR", "AS", "BR", "CH", "CT", "DD", "DL", "GA", "GJ", "HP", "HR", "JK", "KA", "KL", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OR", "PB", "PY", "RJ", "SK", "TN", "TR", "UP", "WB"],
  "date_range": { "start": "2015-01-01", "end": "2025-02-10" },
  "averages": { "avg_temp": 25.7, "wind_speed": 9.4, "air_pressure": 1009.4, "rainfall": 5.3 }
}
```

---

## 4. Weather Station Directory & Health Network
- **Endpoint**: `GET /api/stations`
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 24, max: 500)
  - `search` (string, optional: station/district query)
  - `state` (string, optional: 2-letter state code)
  - `status` (string, optional: `Normal`, `Suspicious`, `Anomaly`)
- **Example Response (`200 OK`)**:
```json
{
  "total": 406,
  "page": 1,
  "limit": 1,
  "total_pages": 406,
  "items": [
    {
      "station_name": "Srinagar",
      "state": "JK",
      "district": "Srinagar",
      "total_records": 7388,
      "anomalies": 2161,
      "latitude": 34.08,
      "longitude": 74.83,
      "elevation": 1585,
      "avg_temp": 13.64,
      "latest_max_temp": 10.1,
      "latest_min_temp": 1.2,
      "latest_wind": 8.7,
      "latest_pressure": 1021.8,
      "latest_rainfall": 19.9,
      "latest_score": 0.54,
      "anomaly_rate": 29.25,
      "health_score": 26.9,
      "status": "Anomaly"
    }
  ]
}
```

---

## 5. Multi-Sensor Time-Series Stream
- **Endpoint**: `GET /api/timeseries`
- **Query Parameters**:
  - `station` (string, default: `Srinagar`)
  - `limit` (int, default: 45, range: 10–365)
  - `start_date` (string, optional: `YYYY-MM-DD`)
  - `end_date` (string, optional: `YYYY-MM-DD`)
- **Example Response (`200 OK`)**:
```json
{
  "station": "Srinagar",
  "total_points": 2,
  "data": [
    {
      "date_of_record": "2025-02-09",
      "station_name": "Srinagar",
      "avg_temp": 6.6,
      "min_temp": 0.2,
      "max_temp": 13.4,
      "wind_speed": 8.7,
      "air_pressure": 1021.5,
      "rainfall": 0.0,
      "anomaly": 0,
      "anomaly_score": 0.4777
    },
    {
      "date_of_record": "2025-02-10",
      "station_name": "Srinagar",
      "avg_temp": 5.6,
      "min_temp": 1.2,
      "max_temp": 10.1,
      "wind_speed": 8.7,
      "air_pressure": 1021.8,
      "rainfall": 19.9,
      "anomaly": 1,
      "anomaly_score": 0.5396
    }
  ]
}
```

---

## 6. Anomaly Records Explorer
- **Endpoint**: `GET /api/anomalies`
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 15, max: 100)
  - `state` (string, optional)
  - `station` (string, optional)
  - `start_date` / `end_date` (string, optional)
  - `severity` (string, optional: `LOW`, `MEDIUM`, `HIGH`)
  - `sort_by` (string, default: `anomaly_score_desc`, options: `anomaly_score_asc`, `date_desc`, `date_asc`)
- **Example Response (`200 OK`)**:
```json
{
  "total": 125,
  "page": 1,
  "limit": 1,
  "total_pages": 125,
  "items": [
    {
      "date_of_record": "2024-02-02",
      "season": "Winter",
      "station_name": "Gulmarg",
      "state": "JK",
      "district": "Baramulla",
      "avg_temp": -10.4,
      "min_temp": -18.5,
      "max_temp": -4.3,
      "wind_speed": 7.8,
      "air_pressure": 1022.0,
      "elevation": 2652,
      "latitude": 34.05,
      "longitude": 74.4,
      "rainfall": 0.0,
      "anomaly": 1,
      "anomaly_score": 0.7658,
      "severity": "HIGH",
      "explanation": "ML-detected anomaly: Multivariate pattern deviates from learned seasonal telemetry norms (Isolation Score: 0.7658)"
    }
  ]
}
```
