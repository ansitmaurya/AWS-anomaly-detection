# Automatic Weather Station (AWS) Dataset Documentation

## 1. Dataset Overview
- **Filename:** `india_weather_rainfall_data.xlsx`
- **Source:** Kaggle (Indian Meteorological / AWS Daily Weather & Rainfall Telemetry)
- **File Size:** ~61.59 MB
- **Total Records (Rows):** 970,339
- **Total Features (Columns):** 15
- **Time Period Covered:** January 1, 2015 to February 10, 2025 (~10 years of daily records)
- **Geographical Scope:** 406 Automatic Weather Stations across 32 Indian States/UTs and 314 Districts

---

## 2. Column Schema & Data Types

| Column Name | Data Type | Non-Null Count | Null Count | Null % | Description / Physical Meaning |
|---|---|---|---|---|---|
| `date_of_record` | `datetime64[us]` | 970,339 | 0 | 0.00% | Date on which weather measurements were captured |
| `month` | `str` | 970,339 | 0 | 0.00% | Month of the record (January to December) |
| `season` | `str` | 970,339 | 0 | 0.00% | Season (Winter, Summer, Monsoon, Post-monsoon) |
| `station_name` | `str` | 970,339 | 0 | 0.00% | Name of the Automatic Weather Station (AWS) |
| `state` | `str` | 970,339 | 0 | 0.00% | State / Union Territory abbreviation (e.g., MH, MP, AP, TN) |
| `district` | `str` | 970,339 | 0 | 0.00% | Administrative district of the weather station |
| `avg_temp` | `float64` | 970,339 | 0 | 0.00% | Daily average surface temperature (°C) |
| `min_temp` | `float64` | 926,441 | 43,898 | 4.52% | Daily minimum recorded temperature (°C) |
| `max_temp` | `float64` | 859,741 | 110,598 | 11.40% | Daily maximum recorded temperature (°C) |
| `wind_speed` | `float64` | 695,895 | 274,444 | 28.28% | Wind speed at standard anemometer height (km/h) |
| `air_pressure` | `float64` | 665,675 | 304,664 | 31.40% | Atmospheric air pressure at station level (hPa) |
| `elevation` | `int64` | 970,339 | 0 | 0.00% | Station height above mean sea level (meters) |
| `latitude` | `float64` | 970,339 | 0 | 0.00% | Geographic latitude coordinate (Decimal degrees) |
| `longitude` | `float64` | 970,339 | 0 | 0.00% | Geographic longitude coordinate (Decimal degrees) |
| `rainfall` | `float64` | 712,785 | 257,554 | 26.54% | Total 24-hour precipitation / rainfall (mm) |

---

## 3. Data Quality & Profiling Summary

### Missing Values
- **Complete Columns (0% missing):** `date_of_record`, `month`, `season`, `station_name`, `state`, `district`, `avg_temp`, `elevation`, `latitude`, `longitude`.
- **Sensors with Missing Telemetry:**
  - `min_temp`: 4.52% missing
  - `max_temp`: 11.40% missing
  - `rainfall`: 26.54% missing (common in AWS stations when rain gauges have dry/unreported intervals)
  - `wind_speed`: 28.28% missing
  - `air_pressure`: 31.40% missing

### Duplicate Records
- **Total Duplicate Rows:** `0` (0.00%) — the dataset contains unique telemetry records per station and date.

### Descriptive Statistics of Weather Attributes

| Feature | Min | 25% | Median (50%) | Mean | 75% | Max | Std Dev |
|---|---|---|---|---|---|---|---|
| `avg_temp` (°C) | -10.40 | 23.10 | 26.70 | 25.66 | 29.10 | 43.40 | 5.44 |
| `min_temp` (°C) | -18.50 | 17.10 | 22.40 | 20.65 | 25.00 | 36.60 | 6.01 |
| `max_temp` (°C) | -5.60 | 28.50 | 31.60 | 31.20 | 34.40 | 87.00 | 5.46 |
| `wind_speed` (km/h) | 0.00 | 6.10 | 8.40 | 9.43 | 11.60 | 66.60 | 4.98 |
| `air_pressure` (hPa) | 922.60 | 1005.80 | 1009.80 | 1009.44 | 1013.30 | 1036.50 | 5.29 |
| `rainfall` (mm) | 0.00 | 0.00 | 0.00 | 5.27 | 4.00 | 485.90 | 14.44 |
| `elevation` (m) | 0.00 | 16.00 | 139.00 | 298.18 | 436.00 | 2652.00 | 415.27 |

---

## 4. Physical Domain & Range Checks (Suspicious Value Profiling)

- **Extreme Outlier / Sensor Malfunction:**
  - `max_temp`: Contains 1 instance of `87.0°C` (far above physical meteorological ambient records, indicating transient hardware/ADC sensor fault).
- **Physical Consistency:**
  - Contains 1 instance where `min_temp > max_temp` (inverted readings or sensor recording order fault).
  - Rainfall has **0** negative readings (all values $\ge 0$ mm, max 485.9 mm which is physically consistent with extreme monsoon deluge).
  - Pressure readings (922.6 hPa to 1036.5 hPa) align with station elevations (0 to 2652m).

---

## 5. Potential Features for Machine Learning Anomaly Detection

1. **Physical Range & Boundary Violations:**
   - Single-sensor out-of-bound spikes (e.g. Temperature > 55°C, Negative wind speed/rainfall).
2. **Internal Consistency Check:**
   - `min_temp` vs `avg_temp` vs `max_temp` condition (`min_temp <= avg_temp <= max_temp`).
   - Diurnal Temperature Range ($DTR = max\_temp - min\_temp$).
3. **Multivariate Meteorological Correlation:**
   - Cross-sensor anomaly detection: Heavy rainfall with abnormally low air pressure vs high pressure spikes.
   - Temperature vs elevation regression residuals.
4. **Temporal / Step-Change Anomalies:**
   - Sudden unphysical delta changes ($\Delta Temp$, $\Delta Pressure$) between consecutive days for the same station.
   - Sensor "stuck/frozen" readings (flatlines over consecutive days).
5. **Spatial Neighbor Inconsistency:**
   - Comparing a station's reading against neighbouring stations within the same district/state.
