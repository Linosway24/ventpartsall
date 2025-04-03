# Model Configurations and Information

## Static Display Model
### Ventilator
- Position: (-15, 0, 0)
- Scale: Based on camera frustum
- No interaction or information display

## Interactive Models

### 1. Ventilator Tube
- File: 'assets/VentilatorTube-WhitePlastic.glb'
- Position: (-9, 4, 0)
- Scale: scale * 0.1125
- Information:
  - Title: "Ventilator Tube"
  - Description: "Flexible breathing tube for patient ventilation"
  - Technical Specs:
    - Material: Medical-grade plastic
    - Type: Patient interface
    - Connection: Standard 22mm

### 2. HEPA Filter
- File: 'assets/HeppaAttachment-2025.glb'
- Position: (-3, 3, 0)
- Scale: scale * 0.3
- Information:
  - Title: "HEPA Filter Attachment"
  - Description: "High-Efficiency Particulate Air filter attachment"
  - Technical Specs:
    - Filtration: 99.97% of particles
    - Size: 0.3 microns
    - Type: Viral/bacterial filter

### 3. Halyard Attachment
- File: 'assets/HalyardAttachmentTube.glb'
- Position: (7, 3, 0)
- Scale: 20.0
- Rotation: y: Math.PI/2 + Math.PI/4, x: -Math.PI/4
- Information:
  - Title: "Halyard Attachment Tube"
  - Description: "Halyard attachment tube for ventilation"
  - Technical Specs:
    - Compatibility: Universal connection
    - Material: Medical-grade polymer
    - Usage: Secondary breathing circuit

### 4. Pulse Oximeter
- File: 'assets/PulseOx.glb'
- Position: (17, 3, 5)
- Scale: 0.2
- Rotation: y: Math.PI/2, x: Math.PI/4
- Information:
  - Title: "Pulse Oximeter"
  - Description: "Monitors oxygen saturation and heart rate"
  - Technical Specs:
    - Range: SpO2 0-100%
    - Accuracy: ±2%
    - Display: LED digital

### 5. Glbeck Humid Vent
- File: 'assets/Gibeck Humid-Vent (1).glb'
- Position: (-9, -3.5, 0)
- Scale: scale * 20.0
- Rotation: y: Math.PI/2 + Math.PI/4
- Information:
  - Title: "Glbeck Humid-Vent"
  - Description: "Humidifies and filters air"
  - Technical Specs:
    - Humidity Output: 30-100% RH
    - Filter Type: HME
    - Connection: Standard port

### 6. Oxygen Regulator
- File: 'assets/Oxygen Regulator.glb'
- Position: (-3, -3.5, 0)
- Scale: scale * 20.0
- Rotation: y: Math.PI/2 + Math.PI/4
- Information:
  - Title: "Oxygen Regulator"
  - Description: "Controls oxygen flow rate"
  - Technical Specs:
    - Flow Range: 0-15 LPM
    - Pressure Range: 0-50 PSI
    - Connection: Standard O2 inlet

### 7. Test Lung
- File: 'assets/Test Lung 210-2025 1.glb'
- Position: (3, -3.5, 0)
- Scale: scale * 0.2
- Rotation: y: Math.PI/2 + Math.PI/4
- Information:
  - Title: "Test Lung"
  - Description: "Simulates patient breathing for calibration"
  - Technical Specs:
    - Capacity: 1L
    - Compliance: Adjustable
    - Usage: Testing/Training

### 8. Green Oxygen Hose
- File: 'assets/Green Oxygen Hose.glb'
- Position: (10, -3.5, 0)
- Scale: scale * 16.2
- Rotation: y: Math.PI/2 + Math.PI/4, x: Math.PI/4
- Information:
  - Title: "Green Oxygen Hose"
  - Description: "Delivers oxygen to the ventilator"
  - Technical Specs:
    - Length: Standard 2m
    - Color: ISO Green
    - Pressure Rating: 50 PSI

### 9. 731 Power Adapter
- File: 'assets/731 Power Adapter.glb'
- Position: (18, -3.5, 0)
- Scale: scale * 0.121
- Rotation: y: Math.PI/2 + Math.PI/4, x: Math.PI/4
- Information:
  - Title: "731 Power Adapter"
  - Description: "Provides power to the ventilator"
  - Technical Specs:
    - Input: 100-240V AC
    - Output: 24V DC
    - Power: 150W 