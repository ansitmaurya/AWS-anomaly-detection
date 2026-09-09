"""
Inference Module for Weather Station Anomaly Prediction
Project: AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

This module loads the trained Isolation Forest model and preprocessor to perform
real-time anomaly scoring for individual weather records or batches.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any, List, Union
import numpy as np
import pandas as pd
import joblib

# Windows UTF-8 console output support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


class WeatherAnomalyDetector:
    """Wrapper class for loading Isolation Forest model and scoring new weather telemetry."""

    def __init__(self, models_dir: Union[str, Path] = None):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent / "models"
        else:
            models_dir = Path(models_dir)

        self.models_dir = models_dir
        self.model_path = models_dir / "isolation_forest_model.joblib"
        self.preprocessor_path = models_dir / "preprocessor.joblib"
        self.metadata_path = models_dir / "model_metadata.json"

        self.model = None
        self.preprocessor = None
        self.metadata = {}
        self.feature_names = []
        self._load_artifacts()

    def _load_artifacts(self):
        """Load serialised joblib model and preprocessing pipeline."""
        if not self.model_path.exists() or not self.preprocessor_path.exists():
            raise FileNotFoundError(
                f"Model artifacts missing in {self.models_dir}. "
                f"Please run 'python ml/train_anomaly_model.py' first."
            )

        self.model = joblib.load(self.model_path)
        self.preprocessor = joblib.load(self.preprocessor_path)

        if self.metadata_path.exists():
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
                self.feature_names = self.metadata.get("features", [])
        else:
            self.feature_names = [
                "avg_temp", "min_temp", "max_temp",
                "wind_speed", "air_pressure", "rainfall",
                "elevation", "latitude", "longitude", "temp_range"
            ]

    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Align input DataFrame with trained feature schema."""
        feature_df = pd.DataFrame(index=df.index)

        for col in [
            "avg_temp", "min_temp", "max_temp",
            "wind_speed", "air_pressure", "rainfall",
            "elevation", "latitude", "longitude"
        ]:
            if col in df.columns:
                feature_df[col] = pd.to_numeric(df[col], errors="coerce")
            else:
                feature_df[col] = np.nan

        # Compute derived Diurnal Temperature Range
        feature_df["temp_range"] = feature_df["max_temp"] - feature_df["min_temp"]

        # Ensure exact column order matching trained model
        return feature_df[self.feature_names]

    def predict_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Predict anomaly status and score for a single weather station record."""
        df_input = pd.DataFrame([record])
        X = self._prepare_features(df_input)
        X_transformed = self.preprocessor.transform(X)

        raw_pred = self.model.predict(X_transformed)[0]
        decision_score = self.model.decision_function(X_transformed)[0]

        # 1 = anomaly, 0 = normal
        anomaly_flag = 1 if raw_pred == -1 else 0
        anomaly_score = float(np.round(1.0 / (1.0 + np.exp(decision_score * 5.0)), 4))

        # Determine risk severity level
        if anomaly_score >= 0.75:
            severity = "Critical Anomaly"
        elif anomaly_score >= 0.55:
            severity = "High Alert"
        elif anomaly_score >= 0.40:
            severity = "Moderate"
        else:
            severity = "Normal"

        return {
            "anomaly": anomaly_flag,
            "is_anomaly": bool(anomaly_flag == 1),
            "anomaly_score": anomaly_score,
            "severity": severity,
            "decision_value": float(np.round(decision_score, 4)),
            "station_name": record.get("station_name", "Unknown"),
            "date_of_record": str(record.get("date_of_record", "")),
        }

    def predict_batch(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Predict anomalies for a batch of weather records."""
        if not records:
            return []
        df_input = pd.DataFrame(records)
        X = self._prepare_features(df_input)
        X_transformed = self.preprocessor.transform(X)

        raw_preds = self.model.predict(X_transformed)
        decision_scores = self.model.decision_function(X_transformed)

        anomaly_flags = np.where(raw_preds == -1, 1, 0)
        anomaly_scores = np.round(1.0 / (1.0 + np.exp(decision_scores * 5.0)), 4)

        results = []
        for i, rec in enumerate(records):
            flag = int(anomaly_flags[i])
            score = float(anomaly_scores[i])
            severity = "Critical Anomaly" if score >= 0.75 else "High Alert" if score >= 0.55 else "Moderate" if score >= 0.40 else "Normal"
            results.append({
                "anomaly": flag,
                "is_anomaly": bool(flag == 1),
                "anomaly_score": score,
                "severity": severity,
                "station_name": rec.get("station_name", "Unknown"),
                "date_of_record": str(rec.get("date_of_record", "")),
            })
        return results


def test_sample_predictions():
    """Run verification tests on sample synthetic and realistic weather observations."""
    print("=" * 80)
    print(" INFERENCE MODULE VERIFICATION TEST")
    print("=" * 80)
    
    detector = WeatherAnomalyDetector()
    print(f"[+] Detector loaded successfully from: {detector.models_dir}")
    print(f"[+] Model Features: {detector.feature_names}\n")

    test_cases = [
        {
            "name": "Case 1: Standard Normal Weather (Pune / Maharashtra)",
            "data": {
                "station_name": "Pune AWS",
                "date_of_record": "2023-07-15",
                "avg_temp": 26.5,
                "min_temp": 22.0,
                "max_temp": 30.5,
                "rainfall": 12.4,
                "wind_speed": 10.2,
                "air_pressure": 1008.5,
                "elevation": 560,
                "latitude": 18.5204,
                "longitude": 73.8567
            }
        },
        {
            "name": "Case 2: Faulty Sensor Spike (87.0°C Max Temp Fault)",
            "data": {
                "station_name": "Sensor #104 Fault",
                "date_of_record": "2022-05-10",
                "avg_temp": 45.0,
                "min_temp": 28.0,
                "max_temp": 87.0,  # Extreme impossible spike
                "rainfall": 0.0,
                "wind_speed": 8.0,
                "air_pressure": 1005.0,
                "elevation": 200,
                "latitude": 24.0,
                "longitude": 78.0
            }
        },
        {
            "name": "Case 3: Inverted Temperature Sensor Fault (min_temp > max_temp)",
            "data": {
                "station_name": "Faulty Inverted Unit",
                "date_of_record": "2024-01-18",
                "avg_temp": 15.0,
                "min_temp": 35.0,  # Inverted!
                "max_temp": 12.0,
                "rainfall": 0.0,
                "wind_speed": 5.0,
                "air_pressure": 1014.0,
                "elevation": 400,
                "latitude": 28.0,
                "longitude": 77.0
            }
        },
        {
            "name": "Case 4: Extreme Cyclone Event / Pressure Drop & Gale Winds",
            "data": {
                "station_name": "Coastal AWS",
                "date_of_record": "2021-05-26",
                "avg_temp": 27.0,
                "min_temp": 24.0,
                "max_temp": 29.0,
                "rainfall": 350.0,
                "wind_speed": 62.0,
                "air_pressure": 930.0,  # Very low pressure
                "elevation": 15,
                "latitude": 21.0,
                "longitude": 87.0
            }
        }
    ]

    for test in test_cases:
        result = detector.predict_record(test["data"])
        status_icon = "⚠️ [ANOMALY]" if result["is_anomaly"] else "✅ [NORMAL]"
        print(f"{test['name']}:")
        print(f"   Classification : {status_icon} (Flag: {result['anomaly']})")
        print(f"   Anomaly Score  : {result['anomaly_score']} ({result['severity']})")
        print(f"   Decision Value : {result['decision_value']}")
        print()


if __name__ == "__main__":
    test_sample_predictions()
