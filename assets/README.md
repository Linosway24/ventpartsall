# Assets Directory

This directory contains 3D models and textures for the ventilator parts.

## Supported Formats
- GLTF/GLB models
- Textures (PNG, JPG, etc.)

## Usage
Place your model files in this directory and import them in main.js using:
```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('assets/your-model.gltf', (gltf) => {
    scene.add(gltf.scene);
});
``` 