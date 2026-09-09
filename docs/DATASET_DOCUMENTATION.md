# Kaggle Weather & Rainfall Dataset Documentation

---

## 📂 Dataset Overview

- **Dataset File**: `data/india_weather_rainfall_data.xlsx`
- **Processed Scored Export**: `data/processed/aws_anomaly_predictions.csv` ($101.8\text{ MB}$)
- **Source**: Kaggle Indian Meteorological & Automatic Weather Station (AWS) Archive
- **Date Range**: January 1, 2015 to February 10, 2025 ($10\text{ Years}$)
- **Total Record Count**: **970,339 Observations**
- **Feature Count**: 15 Columns

---

## 📊 Feature Column Schema

| Column Name | Data Type | Missing Count | Description & Physical Meaning |
|---|---|---|---|
| `date_of_record` | Date (YYYY-MM-DD) | 0 | Observation timestamp of daily telemetry |
| `season` | String | 0 | Meteorological season (`Winter`, `Summer`, `Monsoon`, `Post-Monsoon`) |
| `state` | String (2-letter) | 0 | Indian State/UT code (32 unique codes across India) |
| `district` | String | 0 | District administrative region (314 unique districts) |
| `station_name` | String | 0 | Automatic Weather Station name (406 unique stations) |
| `latitude` | Float | 0 | Geographic latitude ($7.9833^\circ\text{N} - 34.0833^\circ\text{N}$) |
| `longitude` | Float | 0 | Geographic longitude ($68.8500^\circ\text{E} - 95.3833^\circ\text{E}$) |
| `elevation` | Integer | 0 | Station altitude in meters above sea level (0m to 2,652m) |
| `avg_temp` | Float | 0 | Daily mean surface temperature in °C (Mean: 25.7°C) |
| `min_temp` | Float | 0 | Daily minimum temperature in °C (Min: -18.5°C) |
| `max_temp` | Float | 0 | Daily maximum temperature in °C (Max: 48.0°C) |
| `temp_range` | Float | 0 | Diurnal delta ($max\_temp - min\_temp$) in °C |
| `wind_speed` | Float | 0 | Mean surface wind velocity in km/h (Mean: 9.4 km/h) |
| `air_pressure` | Float | 0 | Barometric surface pressure in hPa (Mean: 1009.4 hPa) |
| `rainfall` | Float | 0 | Daily accumulated precipitation in mm (Max 24h: 485.9 mm) |

---

## 🗺️ Geographic Distribution

- **Coverage**: All major climate zones in India (Himalayan, Indo-Gangetic Plain, Deccan Plateau, Thar Desert, Western Ghats, Coastal/Island Regions).
- **Coordinate Integrity**: Every single station possesses authentic geographic coordinates from the real dataset. Zero synthetic or hardcoded coordinates are used.
- **Top Station Observational Density**:
  - `Srinagar AWS` (Jammu & Kashmir): 7,388 transmissions
  - `Banihal AWS` (Jammu & Kashmir): 7,388 transmissions
  - `Qazi Gund AWS` (Jammu & Kashmir): 7,388 transmissions
  - `Dharmsala AWS` (Himachal Pradesh): 5,900 transmissions
  - `Pathankot AWS` (Punjab): 5,900 transmissions

---

## ⚠️ Data Considerations & Limitations

1. **Temporal Resolution**: Telemetry data is recorded as daily aggregated observations rather than sub-hourly raw sensor pulse streams.
2. **Unsupervised Formulation**: The dataset does not include historical ground-truth manual maintenance log labels; all anomaly labels are derived via the trained Isolation Forest ($2.00\%$ prior contamination) and physical domain rule checks.
