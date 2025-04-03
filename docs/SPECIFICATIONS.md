# Ventilator Parts Demonstration - Technical Specification

## Environment Setup
### Server Requirements
- Local HTTP server on port 8000
- Python 3.x for server
- Command: `python3 -m http.server 8000`

### Required Libraries
- Three.js
- GLTFLoader.js
- OrbitControls.js
- GSAP (for animations)
- dat.GUI (for UI controls)
- EffectComposer.js
- UnrealBloomPass.js

## Scene Configuration
### Camera Setup
- Type: OrthographicCamera
- Frustum Size: 20 units
- Position: (0, 0, 20)
- Look At: (0, 0, 0)
- Near: 0.1
- Far: 1000
- Zoom: 1.0

### Scene Settings
- Background: Dark blue (0x1c2430)
- Layout: Two horizontal rows of models
- Grid Helper: 20x20 units, 20 divisions
- Position Marker: Red sphere at origin

### Resizing Behavior
- Window resize handler updates:
  - Camera aspect ratio
  - Renderer size
  - Effect composer size
  - Bloom pass resolution
- Maintains aspect ratio
- Updates pixel ratio for high DPI displays
- Scales model positions relative to view size
- Preserves model relationships during resize

## Lighting and Materials
### HDR Environment
- File: 'libs/TS Studio Tabletop.hdr'
- Processing: PMREMGenerator
- Usage: Environment lighting only (not background)

### Lights
- Ambient Light: 0xffffff, intensity 0.5
- Original Intensities:
  - Ambient: 1.0
  - Directional: 1.0

### Material Properties
- Metalness: 0.0
- Roughness: 0.5
- EnvMapIntensity: 1.0

## 4. Interaction Model
### Core Functionality
1. Model Click Behavior:
   - Zoom in to 1.5x scale
   - Center in view
   - Auto-rotate animation starts
   - Side panel opens with info
   - Other models fade out

2. Return to Normal View:
   - Click again or click close button
   - Model returns to original position/scale
   - Rotation stops
   - Side panel closes
   - Other models fade back in

### Animation Settings
- Zoom Duration: 1 second
- Scale: 1.5x original size
- Easing: power2.inOut
- Rotation Speed: 0.01 radians per frame
- Fade Duration: 0.5 seconds (opacity 20%) 