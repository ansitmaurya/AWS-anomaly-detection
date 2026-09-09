"""
Isolation Forest Anomaly Detection Training Pipeline for AWS Weather Stations
Project: AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

This script:
1. Loads the actual weather telemetry dataset from data/.
2. Selects numerical weather features and extracts domain interactions.
3. Preprocesses data with median imputation and robust scaling.
4. Trains an unsupervised Isolation Forest model from scikit-learn.
5. Computes anomaly classifications (1 = anomaly, 0 = normal) and continuous anomaly scores.
6. Serializes model artifacts to ml/models/.
7. Exports scored results to data/processed/aws_anomaly_predictions.csv.
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler
from sklearn.pipeline import Pipeline

# Windows UTF-8 console output support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_project_paths():
    """Return key project directories."""
    project_root = Path(__file__).resolve().parent.parent
    return {
        "root": project_root,
        "data": project_root / "data",
        "processed_data": project_root / "data" / "processed",
        "models": project_root / "ml" / "models"
    }


def load_raw_dataset(data_dir: Path) -> pd.DataFrame:
    """Find and load the primary Excel/CSV weather dataset."""
    excel_files = list(data_dir.glob("*.xlsx")) + list(data_dir.glob("*.xls"))
    if excel_files:
        target_file = max(excel_files, key=lambda f: f.stat().st_size)
        print(f"[+] Loading dataset: {target_file.name} ({target_file.stat().st_size / (1024*1024):.2f} MB)...")
        try:
            df = pd.read_excel(target_file, engine="calamine")
        except Exception:
            df = pd.read_excel(target_file, engine="openpyxl")
        return df
    
    csv_files = list(data_dir.glob("*.csv")) + list((data_dir / "raw").glob("*.csv"))
    if csv_files:
        target_file = max(csv_files, key=lambda f: f.stat().st_size)
        print(f"[+] Loading dataset: {target_file.name}...")
        return pd.read_csv(target_file)
        
    raise FileNotFoundError(f"No weather dataset found in {data_dir}")


def extract_features(df: pd.DataFrame):
    """
    Extract and engineer numerical features for anomaly detection.
    Features used:
    - Primary sensor telemetry: avg_temp, min_temp, max_temp, rainfall, wind_speed, air_pressure
    - Topography / spatial: elevation, latitude, longitude
    - Derived: diurnal temperature range (temp_range = max_temp - min_temp)
    """
    feature_df = pd.DataFrame(index=df.index)
    
    # Core numerical weather columns
    core_cols = [
        "avg_temp", "min_temp", "max_temp",
        "wind_speed", "air_pressure", "rainfall",
        "elevation", "latitude", "longitude"
    ]
    
    for col in core_cols:
        if col in df.columns:
            feature_df[col] = pd.to_numeric(df[col], errors="coerce")
            
    # Derived feature: Diurnal Temperature Range (captures sensor freeze / inversion anomalies)
    if "max_temp" in feature_df.columns and "min_temp" in feature_df.columns:
        feature_df["temp_range"] = feature_df["max_temp"] - feature_df["min_temp"]
        
    return feature_df


def train_isolation_forest():
    """Execute complete end-to-end model training and serialization."""
    start_time = time.time()
    paths = get_project_paths()
    paths["models"].mkdir(parents=True, exist_ok=True)
    paths["processed_data"].mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print(" ISOLATION FOREST ANOMALY DETECTION TRAINING PIPELINE")
    print("=" * 80)
    
    # 1. Load Data
    raw_df = load_raw_dataset(paths["data"])
    total_records = len(raw_df)
    print(f"[+] Loaded {total_records:,} weather station records.")
    
    # 2. Extract Features
    X = extract_features(raw_df)
    feature_names = list(X.columns)
    print(f"\n[+] Selected {len(feature_names)} features for anomaly detection:")
    for f in feature_names:
        null_count = X[f].isnull().sum()
        print(f"    • {f:<15} (Missing: {null_count:,} / {null_count/total_records*100:.1f}%)")
        
    # 3. Build Preprocessing Pipeline
    # SimpleImputer with median handles missing sensor streams without distorting distributions
    # RobustScaler scales using median and interquartile range (IQR), robust to outlier spikes
    print("\n[+] Fitting Preprocessing Pipeline (Median Imputer + RobustScaler)...")
    preprocessor = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler(with_centering=True, with_scaling=True))
    ])
    
    X_transformed = preprocessor.fit_transform(X)
    
    # 4. Configure & Train Isolation Forest
    # Parameters:
    # - n_estimators=100: Ensemble of 100 isolation trees
    # - contamination=0.02: Prior assumption of ~2% anomalous/faulty telemetry records
    # - max_samples=100000: Optimized sub-sample size per tree for speed & isolation depth
    # - random_state=42: Ensures full reproducibility
    # - n_jobs=-1: Parallelized across CPU cores
    contamination_rate = 0.02
    n_estimators = 100
    
    print(f"\n[+] Training Isolation Forest Model...")
    print(f"    - n_estimators : {n_estimators}")
    print(f"    - contamination: {contamination_rate} (~{int(total_records * contamination_rate):,} expected anomalies)")
    print(f"    - random_state : 42")
    print(f"    - n_jobs       : -1 (all CPU cores)")
    
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination_rate,
        max_samples=min(100000, total_records),
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_transformed)
    
    # 5. Generate Predictions and Anomaly Scores
    print("\n[+] Generating anomaly predictions and continuous scores...")
    raw_predictions = model.predict(X_transformed)
    # Map: scikit-learn -1 (anomaly) -> 1, 1 (normal) -> 0
    anomaly_flags = np.where(raw_predictions == -1, 1, 0)
    
    # Decision function: lower values mean more anomalous
    # Convert to continuous normalized anomaly score [0, 1] where higher = more anomalous
    decision_scores = model.decision_function(X_transformed)
    # Sigmoid inversion scaling centered around 0 decision boundary
    anomaly_scores = 1.0 / (1.0 + np.exp(decision_scores * 5.0))
    anomaly_scores = np.round(anomaly_scores, 4)
    
    anomaly_count = int(np.sum(anomaly_flags == 1))
    normal_count = int(np.sum(anomaly_flags == 0))
    anomaly_pct = (anomaly_count / total_records) * 100
    
    print("\n" + "-" * 80)
    print(" MODEL PREDICTION SUMMARY")
    print("-" * 80)
    print(f"Total Evaluated Records : {total_records:,}")
    print(f"Normal Records (0)      : {normal_count:,} ({100 - anomaly_pct:.2f}%)")
    print(f"Anomalous Records (1)   : {anomaly_count:,} ({anomaly_pct:.2f}%)")
    print(f"Anomaly Score Range     : {anomaly_scores.min():.4f} (most normal) to {anomaly_scores.max():.4f} (most anomalous)")
    
    # 6. Save Processed Dataset
    print("\n[+] Constructing processed output dataset...")
    output_df = raw_df.copy()
    output_df["anomaly"] = anomaly_flags
    output_df["anomaly_score"] = anomaly_scores
    
    # Sort with highest anomaly scores first for immediate inspection
    output_csv_path = paths["processed_data"] / "aws_anomaly_predictions.csv"
    print(f"[+] Saving processed predictions to: {output_csv_path}...")
    output_df.to_csv(output_csv_path, index=False)
    print(f"    File saved! ({output_csv_path.stat().st_size / (1024*1024):.2f} MB)")
    
    # 7. Serialize Models and Metadata
    model_path = paths["models"] / "isolation_forest_model.joblib"
    preprocessor_path = paths["models"] / "preprocessor.joblib"
    metadata_path = paths["models"] / "model_metadata.json"
    
    print(f"[+] Serializing model artifacts to {paths['models']}...")
    joblib.dump(model, model_path)
    joblib.dump(preprocessor, preprocessor_path)
    
    metadata = {
        "model_name": "IsolationForest_AWS_Anomaly_Detector",
        "algorithm": "Isolation Forest (scikit-learn)",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "total_training_records": total_records,
        "features": feature_names,
        "parameters": {
            "n_estimators": n_estimators,
            "contamination": contamination_rate,
            "max_samples": min(100000, total_records),
            "random_state": 42
        },
        "results": {
            "normal_count": normal_count,
            "anomaly_count": anomaly_count,
            "anomaly_percentage": round(anomaly_pct, 4),
            "min_score": float(anomaly_scores.min()),
            "max_score": float(anomaly_scores.max()),
            "mean_score": float(anomaly_scores.mean())
        },
        "artifacts": {
            "model_file": str(model_path.name),
            "preprocessor_file": str(preprocessor_path.name)
        }
    }
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    elapsed = time.time() - start_time
    print(f"✅ Training and serialization completed successfully in {elapsed:.2f} seconds!")
    print("=" * 80)
    
    return metadata


if __name__ == "__main__":
    train_isolation_forest()
