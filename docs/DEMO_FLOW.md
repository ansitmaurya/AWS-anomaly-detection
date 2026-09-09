# SIH Presentation Demo Script & Flow (3–5 Minutes)

**Project Title:** AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)  
**Theme:** Meteorological Telemetry Quality Control, Early Warning & Automated Observation Validation

---

## ⏱️ Pitch Timeline & Talking Points

### **Minute 0:00 – 0:45: The Problem & Solution Overview**
> *"Respected Jury Members, across India, over 400 Automatic Weather Stations (AWS) transmit critical meteorological data hourly. However, environmental factors, sensor degradation, electrical interference, and calibration drift cause faulty or unphysical readings (e.g. 87°C spikes or inverted diurnal temperatures). When bad data enters meteorological forecasting or flood warning models, the results can be catastrophic.*
>
> *Our solution is an **Atmospheric Intelligence & ML Anomaly Detection System**. Using unsupervised machine learning—specifically an Isolation Forest trained on 970,000+ historical observations across 32 Indian States—our platform continuously monitors sensor streams, flags anomalous multivariate observations in real-time, and isolates deteriorating stations before hardware fails."*

---

### **Minute 0:45 – 1:30: Live Dashboard & Geographic AWS Network**
- **Action:** Open `http://localhost:5173` on the **Geospatial Node Map** tab.
- **Talking Points:**
  > *"Here is our Weather Operations Center. On the top KPI bar, we immediately see live system telemetry: 970,339 total historical records analyzed, 406 physical weather stations indexed across 314 districts, with an unsupervised prior anomaly rate of 2.00%.*
  >
  > *On our **Dark Atmospheric Radar Map**, all 406 station nodes are plotted using exact dataset coordinates. Nodes are dynamically color-coded by operational status: Blue for Normal, Amber for Suspicious, Red for Anomaly, and Deep Red with a radar ring for Critical sensor degradation.*
  >
  > *Clicking any station node—such as **Srinagar AWS** or **Gulmarg AWS**—opens an instant telemetry inspector displaying coordinates, elevation, historical transmission counts, and our calculated **Telemetry Quality Index**."*

---

### **Minute 1:30 – 2:30: Live ML Simulator (Real-Time Inference & Explainability)**
- **Action:** Switch to the **⚡ Live Telemetry Simulator** tab.
- **Talking Points:**
  > *"Let's test our live inference engine connected directly to our local FastAPI backend and Scikit-Learn Isolation Forest model.*
  >
  > *First, let's load a **Normal Day** preset for Pune AWS (26.5°C avg, 11 km/h wind, 1010.5 hPa). Clicking 'Run Live ML Anomaly Analysis' yields a **Normal Observation** with an isolation score of 35.6% (well below our threshold).*
  >
  > *Now, let's simulate a sudden hardware fault by loading the **87°C Sensor Spike** preset. When we trigger inference, the Isolation Forest instantly isolates this point near tree roots, outputting an Anomaly Score of **66.7% (HIGH SEVERITY)**.*
  >
  > *Crucially, our system doesn't just output a black-box number—it provides **Explainable AI Reasoning** alongside physical domain sanity checks (e.g. ambient reading exceeds 55°C ceiling or inverted temperature order). This allows meteorological engineers to immediately know whether an anomaly is due to an extreme storm or an electrical sensor malfunction."*

---

### **Minute 2:30 – 3:30: Multi-Sensor Time-Series & Anomaly Explorer**
- **Action:** Navigate to **📊 Telemetry Analytics** and then **🔍 Anomaly Explorer**.
- **Talking Points:**
  > *"On our **Telemetry Analytics** view, meteorological officers can inspect sequential daily observations for any station across Temperature, Rainfall, Wind Velocity, and Barometric Pressure. Flagged anomaly dates are highlighted with warning indicators.*
  >
  > *In the **Anomaly Explorer**, operators can query and sort through all 19,407 flagged anomalies across all 32 States, filtering by severity tier, date range, or keyword, with complete diagnostic breakdowns."*

---

### **Minute 3:30 – 4:00: Station Health Directory & Practical Value**
- **Action:** Open **📍 Station Health Directory**.
- **Talking Points:**
  > *"To prioritize maintenance crews, our system computes a **Station Health Quality Index**:*
  > $$\text{Health} = \max(0, 100 - (\text{Anomaly Rate} \times 2.5))$$
  > *Stations experiencing frequent sensor drift drop in score, alerting ground technicians for inspection.*
  >
  > *In conclusion: our platform is fully functional, lightweight, privacy-preserving, runs locally without cloud dependencies, and provides actionable early warnings for India's weather station network. Thank you, and we welcome your questions!"*

---

## 🎯 Quick Answers to Likely Jury Questions

| Jury Question | Key Answer |
|---|---|
| **Why Isolation Forest instead of Supervised ML?** | Weather station anomalies are rare, diverse, and lack ground-truth manual labels for all 970k historical transmissions. Isolation Forest isolates anomalies without requiring labeled training datasets. |
| **Is an ML anomaly always a sensor failure?** | No. An anomaly indicates statistically abnormal multivariate behavior. It can represent a genuine extreme weather event (cyclone/cloudburst) or a physical sensor fault. Our rule engine clarifies which one it is. |
| **Where do station coordinates come from?** | 100% of station coordinates come directly from the real Kaggle Automatic Weather Station dataset (ranging $7.98^\circ\text{N} - 34.08^\circ\text{N}$, $68.85^\circ\text{E} - 95.38^\circ\text{E}$). |
| **Can this run on real edge AWS hardware?** | Yes. Our inference engine evaluates single telemetry packets in under $10\text{ ms}$, making it deployable on low-power edge microcontrollers or central gateway servers. |
