# Machine Learning Approach & Mathematical Methodology

---

## 🎯 Problem Statement: Why Anomaly Detection for Automatic Weather Stations?

Automatic Weather Stations (AWS) operate unattended in harsh outdoor environments, exposing sensors to:
1. **Physical Sensor Degradation**: Drifting calibration curves in thermistors and barometers.
2. **Electrical & Hardware Glitches**: Voltage spikes producing spurious readings (e.g. $87^\circ\text{C}$).
3. **Mechanical Failures**: Jammed anemometer cups or blocked tipping-bucket rain gauges.
4. **Extreme Meteorological Outliers**: Severe squalls, cloudbursts, or cyclonic depressions.

Traditional threshold alerting relies on static rule ceilings (e.g. `temp > 50°C`), failing to detect subtle multivariate sensor anomalies (e.g., $32^\circ\text{C}$ in winter with $1035\text{ hPa}$ and $0\text{ km/h}$ wind).

---

## 🌲 Algorithm Selection: Why Isolation Forest?

```
                      [ Root Node: Temperature Partition ]
                                /             \
                        temp < 15°C         temp >= 15°C
                           /                     \
                   [ Severe Anomaly ]     [ Wind Speed Partition ]
                  (Path Length = 1)                 ...
                                              (Path Length = 14)
                                             [ Normal Observation ]
```

### Key Advantages for Meteorological Telemetry:
1. **Unsupervised Formulation**: The vast majority of historical weather data lacks manual ground-truth fault labels. Isolation Forest does not require supervised labels.
2. **Multivariate Spatial Isolation**: It isolates anomalous points in $D$-dimensional space through random recursive partitioning instead of distance/density metrics (which degrade in high dimensions).
3. **Linear Time Complexity**: Training complexity is $O(t \cdot \psi \log \psi)$ where $t$ is the number of trees and $\psi$ is subsample size, enabling rapid training over 970,000+ rows.
4. **Low Memory Footprint**: Serialized model size is lightweight and computes inference in $< 10\text{ ms}$ per telemetry observation.

---

## 🔬 Feature Engineering & Preprocessing Pipeline

| Feature | Physical Unit | Description | Role in Detection |
|---|---|---|---|
| `avg_temp` | °C | Daily mean surface temperature | Thermal baseline |
| `min_temp` | °C | Daily minimum recorded temperature | Diurnal boundary & polarity check |
| `max_temp` | °C | Daily maximum recorded temperature | Diurnal boundary & spike check |
| `temp_range` | °C | Difference ($max\_temp - min\_temp$) | Detects flatline/zero-variance sensors |
| `wind_speed` | km/h | Mean surface wind velocity | Storm & mechanical freeze detection |
| `air_pressure`| hPa | Atmospheric barometric pressure | Depression & altimeter drift detection |
| `rainfall` | mm | 24-hour accumulated precipitation | Deluge & gauge clogging detection |
| `elevation` | meters | Station altitude above sea level | Elevation-adjusted lapse rate context |
| `latitude` | °N | Geographic latitude | Regional climate zone context |
| `longitude`| °E | Geographic longitude | Regional climate zone context |

### Preprocessing Strategy:
1. **Median Imputation**: Sensor packet dropouts (null values) are filled using median values per feature column.
2. **Robust Scaling**:
   $$x_{\text{scaled}} = \frac{x - Q_2(x)}{Q_3(x) - Q_1(x)}$$
   Uses the median and Interquartile Range (IQR) to scale values, preventing extreme outlier spikes from distorting mean and variance baselines.

---

## 📊 Anomaly Score Interpretation & Severity Classification

### Mathematical Anomaly Score Formula:
$$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
Where:
- $h(x)$ is the path length to isolate point $x$ in a tree.
- $E(h(x))$ is the expected path length across all 100 trees.
- $c(n) = 2\ln(n - 1) + 0.5772156649 - \frac{2(n - 1)}{n}$ is the average path length of an unsuccessful search in a Binary Search Tree of size $n$.

### Operational Severity Tiers:

| Severity Tier | Anomaly Score | Description & Action |
|---|---|---|
| **`LOW`** | $0.50 \le s < 0.58$ | Mild statistical deviation. System logs for trend monitoring. |
| **`MEDIUM`** | $0.58 \le s < 0.70$ | Significant multivariate isolation. Flagged for review by meteorological operators. |
| **`HIGH`** | $s \ge 0.70$ | Severe anomaly or direct physical violation. Immediate alert trigger. |

---

## ⚠️ Critical Distinction: ML Anomaly vs. Confirmed Hardware Fault

It is essential to distinguish between a statistical machine learning anomaly and a confirmed physical hardware failure:

1. **ML-Detected Anomaly**: Indicates that an observation's combination of weather parameters is statistically rare relative to the learned training distribution.
2. **Possible Causes**:
   - **Genuine Severe Weather Event**: Cyclonic storms, cloudbursts, severe heatwaves, and cold snaps.
   - **Electrical/Sensor Hardware Fault**: Stuck sensors, ADC calibration drift, loose thermistors, voltage surges.
3. **Resolution**: Our system augments Isolation Forest predictions with **Physical Sanity Domain Checks** (e.g. ambient reading $> 55^\circ\text{C}$, inverted $min\_temp > max\_temp$, negative rainfall) to help operators discern hardware failures from extreme natural events.
