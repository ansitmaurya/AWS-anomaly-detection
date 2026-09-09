"""
Data Analysis & Profiling Script for AWS Weather Dataset
Project: AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

This script loads the dataset from the data/ folder, analyzes schema, missing values,
duplicates, statistics, and performs sensible physical range checks for weather variables.
Original dataset files are strictly read-only and never modified.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure UTF-8 encoding support on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def find_weather_dataset(data_dir: Path) -> Path:
    """Find the weather dataset Excel or CSV file inside data directory."""
    excel_files = list(data_dir.glob("*.xlsx")) + list(data_dir.glob("*.xls"))
    if excel_files:
        return max(excel_files, key=lambda f: f.stat().st_size)
    
    csv_files = list(data_dir.glob("*.csv")) + list((data_dir / "raw").glob("*.csv"))
    if csv_files:
        return max(csv_files, key=lambda f: f.stat().st_size)
    
    raise FileNotFoundError(f"No .xlsx, .xls, or .csv dataset found in {data_dir}")


def load_dataset(file_path: Path) -> pd.DataFrame:
    """Load dataset with high-performance engine if available."""
    print(f"\n[+] Loading dataset '{file_path.name}' into pandas...")
    if file_path.suffix.lower() in [".xlsx", ".xls"]:
        try:
            # calamine provides 10-20x speedup for large Excel files
            df = pd.read_excel(file_path, engine="calamine")
        except Exception:
            df = pd.read_excel(file_path, engine="openpyxl")
    else:
        df = pd.read_csv(file_path)
    return df


def analyze_dataset(file_path: Path):
    """Analyze the weather dataset and print a comprehensive report."""
    print("=" * 80)
    print(" AWS WEATHER DATASET ANALYSIS & PROFILING REPORT")
    print("=" * 80)
    
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    print(f"\n[Dataset File] : {file_path.name}")
    print(f"[Full Path]    : {file_path.resolve()}")
    print(f"[File Size]    : {file_size_mb:.2f} MB")
    
    df = load_dataset(file_path)
    rows, cols = df.shape
    print(f"[+] Loaded successfully! Dimensions: {rows:,} rows x {cols} columns\n")
    
    # 1. Column Schema & Data Types
    print("-" * 80)
    print("1. COLUMN SCHEMA & DATA TYPES")
    print("-" * 80)
    schema_df = pd.DataFrame({
        "Column Name": df.columns,
        "Data Type": [str(dtype) for dtype in df.dtypes],
        "Non-Null Count": df.notnull().sum().values,
        "Null Count": df.isnull().sum().values,
        "Null %": (df.isnull().sum().values / rows * 100).round(2)
    })
    print(schema_df.to_string(index=False))
    
    # 2. Duplicate Rows Analysis
    print("\n" + "-" * 80)
    print("2. DUPLICATE ROWS ANALYSIS")
    print("-" * 80)
    duplicate_count = df.duplicated().sum()
    duplicate_pct = (duplicate_count / rows) * 100
    print(f"Total duplicate rows: {duplicate_count:,} ({duplicate_pct:.2f}%)")
    
    # 3. Temporal & Station/Location Metadata
    print("\n" + "-" * 80)
    print("3. TEMPORAL & LOCATION METADATA")
    print("-" * 80)
    
    # Check date column
    if "date_of_record" in df.columns:
        dates = pd.to_datetime(df["date_of_record"])
        print(f"[Date Range]    : {dates.min().strftime('%Y-%m-%d')} to {dates.max().strftime('%Y-%m-%d')} ({dates.nunique():,} unique dates)")
    if "season" in df.columns:
        print(f"[Seasons]       : {df['season'].value_counts().to_dict()}")
        
    # Location Metadata
    if "station_name" in df.columns:
        print(f"[Unique Stations]: {df['station_name'].nunique():,} Automatic Weather Stations")
    if "state" in df.columns:
        print(f"[Unique States]  : {df['state'].nunique():,} States/UTs")
    if "district" in df.columns:
        print(f"[Unique Districts]: {df['district'].nunique():,} Districts")
        
    # 4. Numerical Weather Variables & Statistics
    print("\n" + "-" * 80)
    print("4. NUMERICAL WEATHER FEATURES & DESCRIPTIVE STATISTICS")
    print("-" * 80)
    numeric_df = df.select_dtypes(include=[np.number])
    if not numeric_df.empty:
        stats = numeric_df.describe().T
        stats["null_count"] = df[numeric_df.columns].isnull().sum()
        stats["null_pct"] = (stats["null_count"] / rows * 100).round(2)
        print(stats[["count", "null_count", "null_pct", "mean", "std", "min", "25%", "50%", "75%", "max"]].to_string())
    else:
        print("[Info] No numeric columns found.")

    # 5. Weather Column Categorization
    print("\n" + "-" * 80)
    print("5. IDENTIFIED WEATHER VARIABLES")
    print("-" * 80)
    weather_categories = {
        "Precipitation / Rainfall": [c for c in df.columns if any(k in str(c).lower() for k in ["rain", "precip", "prcp"])],
        "Temperature": [c for c in df.columns if any(k in str(c).lower() for k in ["temp", "tmax", "tmin", "tavg"])],
        "Wind": [c for c in df.columns if any(k in str(c).lower() for k in ["wind", "speed", "gust"])],
        "Pressure": [c for c in df.columns if any(k in str(c).lower() for k in ["press", "baro", "slp", "msl", "hpa"])],
        "Geospatial / Topography": [c for c in df.columns if any(k in str(c).lower() for k in ["elevation", "latitude", "longitude"])],
    }
    
    for category, matched_cols in weather_categories.items():
        if matched_cols:
            print(f"  * {category}: {matched_cols}")
            
    # 6. Physical Sanity & Range Checks (Anomaly / Suspicious Data Profiling)
    print("\n" + "-" * 80)
    print("6. PHYSICAL DOMAIN & RANGE CHECKS (SUSPICIOUS VALUE PROFILING)")
    print("   [Note: Read-only inspection; no values are modified or removed]")
    print("-" * 80)
    
    suspicious_findings = []
    
    for col in numeric_df.columns:
        col_lower = str(col).lower()
        series = df[col].dropna()
        if series.empty:
            continue
            
        # Rainfall / Precipitation checks: Cannot be negative
        if any(k in col_lower for k in ["rain", "precip"]):
            neg_count = (series < 0).sum()
            if neg_count > 0:
                suspicious_findings.append({
                    "Feature": col,
                    "Check": "Negative Rainfall (< 0 mm)",
                    "Suspicious Count": neg_count,
                    "Min Value": series.min(),
                    "Max Value": series.max()
                })
            extreme_rain = (series > 1000).sum()
            if extreme_rain > 0:
                suspicious_findings.append({
                    "Feature": col,
                    "Check": "Extreme Single-Day Rainfall (> 1000 mm)",
                    "Suspicious Count": extreme_rain,
                    "Min Value": series.min(),
                    "Max Value": series.max()
                })
                
        # Temperature checks
        elif any(k in col_lower for k in ["temp", "tmax", "tmin"]):
            extreme_temp = ((series < -40) | (series > 60)).sum()
            if extreme_temp > 0:
                suspicious_findings.append({
                    "Feature": col,
                    "Check": "Extreme Temperature (< -40C or > 60C)",
                    "Suspicious Count": extreme_temp,
                    "Min Value": series.min(),
                    "Max Value": series.max()
                })
            # Check consistency if min_temp > max_temp
            if col == "min_temp" and "max_temp" in df.columns:
                inverted_temp = (df["min_temp"] > df["max_temp"]).sum()
                if inverted_temp > 0:
                    suspicious_findings.append({
                        "Feature": "min_temp vs max_temp",
                        "Check": "Inverted Sensor Readings (min_temp > max_temp)",
                        "Suspicious Count": inverted_temp,
                        "Min Value": "-",
                        "Max Value": "-"
                    })
                
        # Wind Speed checks
        elif any(k in col_lower for k in ["wind", "speed"]):
            invalid_wind = ((series < 0) | (series > 250)).sum()
            if invalid_wind > 0:
                suspicious_findings.append({
                    "Feature": col,
                    "Check": "Negative or Extreme Wind Speed (< 0 or > 250 km/h)",
                    "Suspicious Count": invalid_wind,
                    "Min Value": series.min(),
                    "Max Value": series.max()
                })
                
        # Pressure checks
        elif any(k in col_lower for k in ["press", "baro"]):
            invalid_press = ((series < 750) | (series > 1100)).sum()
            if invalid_press > 0:
                suspicious_findings.append({
                    "Feature": col,
                    "Check": "Atmospheric Pressure outside [750 hPa, 1100 hPa]",
                    "Suspicious Count": invalid_press,
                    "Min Value": series.min(),
                    "Max Value": series.max()
                })

    if suspicious_findings:
        susp_df = pd.DataFrame(suspicious_findings)
        print("[!] Flagged Potential Outliers / Suspicious Range Deviations:")
        print(susp_df.to_string(index=False))
    else:
        print("[OK] No values violated basic physical range bounds.")
        
    print("\n" + "=" * 80)
    print(" ANALYSIS COMPLETED SUCCESSFULLY")
    print("=" * 80)
    return df


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    data_directory = project_root / "data"
    try:
        dataset_path = find_weather_dataset(data_directory)
        analyze_dataset(dataset_path)
    except Exception as e:
        print(f"[Error] Dataset analysis failed: {e}", file=sys.stderr)
        sys.exit(1)
