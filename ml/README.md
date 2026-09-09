# Machine Learning: Automatic Weather Station (AWS) Anomaly Detection

This directory contains the machine learning pipeline and inference engine for detecting abnormal, corrupted, or faulty telemetry readings from Automatic Weather Stations (AWS).

---

## 1. What is Anomaly Detection?

In meteorological networks, Automatic Weather Stations (AWS) continuously record and transmit ambient environmental parameters such as temperature, atmospheric pressure, wind speed, and precipitation.

However, station readings can frequently suffer from:
- **Hardware & Sensor Malfunctions:** E.g., open circuits causing temperature sensors to jump to maximum ADC bounds (such as 87°C), frozen anemometers reading constant 0 km/h, or flipped calibration polarity (`min_temp > max_temp`).
- **Transmission & Packet Corruption:** Bit flips, dropped sensor signals resulting in missing streams.
- **Extreme Weather Events:** Unusually severe weather such as flash floods, squall lines, or cyclones.

**Anomaly Detection** is the automated process of identifying observations that deviate significantly from standard meteorological patterns and sensor physics.

---

## 2. Why Isolation Forest?

We selected **Isolation Forest** (`sklearn.ensemble.IsolationForest`) as the core unsupervised algorithm because:
1. **Unsupervised Nature:** Real-world weather station telemetry does not come with verified ground-truth "fault" labels. Isolation Forest does not require labeled data to learn normal behavior.
2. **Isolation Principle:** Anomalies are "few and different". Instead of profiling normal clusters (which is computationally expensive in high dimensions), Isolation Forest isolates anomalies by randomly partitioning feature space with binary trees. Outliers require very few splits (short tree depth) to isolate.
3. **High Efficiency & Scalability:** Operates in linear time complexity $\mathcal{O}(n \log n)$, making it capable of training across nearly 1,000,000 records in seconds.
4. **Multivariate Awareness:** Detects subtle cross-sensor discrepancies (e.g. atmospheric pressure dropping without corresponding wind or precipitation changes).

---

## 3. Features Used

The model uses the following 10 features extracted directly from the actual dataset:

| Feature Name | Type | Description |
|---|---|---|
| `avg_temp` | Primary | Daily average ambient temperature (°C) |
| `min_temp` | Primary | Daily minimum temperature (°C) |
| `max_temp` | Primary | Daily maximum temperature (°C) |
| `wind_speed` | Primary | Wind velocity (km/h) |
| `air_pressure` | Primary | Station air pressure (hPa) |
| `rainfall` | Primary | 24-hour total precipitation (mm) |
| `elevation` | Context | Height above sea level (m) |
| `latitude` | Spatial | Geographic latitude coordinate |
| `longitude` | Spatial | Geographic longitude coordinate |
| `temp_range` | Derived | Diurnal Temperature Range ($max\_temp - min\_temp$) |

---

## 4. Preprocessing Performed

1. **Missing Telemetry Imputation (`SimpleImputer(strategy='median')`):**
   - Weather stations occasionally drop specific sensors (e.g. pressure or wind).
   - Rather than dropping rows (which loses valuable data), missing entries are imputed using feature medians, preserving the overall distribution.
2. **Robust Feature Scaling (`RobustScaler`):**
   - Instead of standard scaling (which is easily skewed by extreme outliers like 87°C), `RobustScaler` centers data on the **median** and scales by the **Interquartile Range (IQR = Q3 - Q1)**.
3. **Reproducibility Pipeline:**
   - The imputer and scaler are fitted together in a `scikit-learn Pipeline` and serialized to ensure identical transformations during future real-time inference.

---

## 5. Understanding Predictions & Anomaly Scores

For each weather record, the model generates two primary outputs:

### A. Anomaly Prediction (`anomaly`)
- **`0` = Normal:** The observation fits standard physical and meteorological patterns.
- **`1` = Anomaly:** The observation exhibits unusual feature combinations or sensor faults.

### B. Anomaly Score (`anomaly_score`)
- Continuous score ranging from **`0.0` (Highly Normal)** to **`1.0` (Critical Anomaly)**.
- Formulated by normalizing the tree isolation decision function:
  $$\text{Anomaly Score} = \frac{1}{1 + e^{5 \cdot \text{decision\_value}}}$$
- **Severity Tiers:**
  - `0.00 - 0.39`: **Normal** (Clean regular telemetry)
  - `0.40 - 0.54`: **Moderate** (Mild deviation / borderline weather)
  - `0.55 - 0.74`: **High Alert** (Unusual weather pattern or minor sensor drift)
  - `0.75 - 1.00`: **Critical Anomaly** (Extreme outlier, sensor failure, or severe hazard)

---

## 6. How to Train the Model

To run or retrain the model locally on the Kaggle dataset:

```powershell
# Navigate to project root
cd AWS

# Run training script
python ml/train_anomaly_model.py
```

### Outputs Generated:
- **Trained Model:** `ml/models/isolation_forest_model.joblib`
- **Preprocessor:** `ml/models/preprocessor.joblib`
- **Metadata & Config:** `ml/models/model_metadata.json`
- **Processed Scored Dataset:** `data/processed/aws_anomaly_predictions.csv`

---

## 7. How to Run Inference

To test predictions on sample records using Python:

```powershell
python ml/predict_anomaly.py
```

Or import the detector in Python / FastAPI backend:
```python
from ml.predict_anomaly import WeatherAnomalyDetector

detector = WeatherAnomalyDetector()
result = detector.predict_record({
    "station_name": "Delhi AWS",
    "avg_temp": 28.0,
    "min_temp": 22.0,
    "max_temp": 34.0,
    "rainfall": 5.0,
    "wind_speed": 12.0,
    "air_pressure": 1010.0,
    "elevation": 216,
    "latitude": 28.6139,
    "longitude": 77.2090
})

print(result)
# Output: {'anomaly': 0, 'is_anomaly': False, 'anomaly_score': 0.18, 'severity': 'Normal', ...}
```
