# Ventilator Training Module

A 3D ventilator training application built with Three.js and Vite.

## Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Run development server**:
   ```
   npm run dev
   ```

3. **Build for production**:
   ```
   npm run build
   ```

4. **Preview production build**:
   ```
   npm run preview
   ```

## Models

Place your 3D models in the `models` directory:
- Main model: `models/ventilator.glb`
- Additional parts can be separate .glb files

Model requirements:
- Format: glTF (.glb or .gltf)
- Size: Keep under 10MB for optimal performance
- Scale: Models should be properly scaled
- Setup: Parts that should be interactive should be separate meshes

If you don't have your own models, you can find 3D models on:
- [Sketchfab](https://sketchfab.com/)
- [TurboSquid](https://www.turbosquid.com/)
- [CGTrader](https://www.cgtrader.com/)
- [Free3D](https://free3d.com/)

## Structure

- `index.html`: Main HTML file
- `main.js`: Main JavaScript file with Three.js setup
- `models/`: Directory for 3D models
- `package.json`: Project dependencies and scripts

## Features

- **Interactive 3D Models**: Click on model parts to highlight them and view information
- **Part Information**: Displays name and description of selected parts in an info panel
- **Model Loading**: Loads 3D models with GLTFLoader
- **Loading Progress**: Displays loading screen with progress bar
- **Placeholder Object**: Shows a basic representation while models are loading
- **Responsive Design**: Adjusts to window size changes
- **Orbit Controls**: Rotate and zoom the model with mouse controls
- **Material Highlighting**: Selected parts are highlighted with emissive materials 