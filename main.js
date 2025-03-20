// Import Three.js modules
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as dat from 'dat.gui';

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Create camera - use OrthographicCamera instead of PerspectiveCamera to avoid perspective distortion
// This keeps objects looking the same size and shape regardless of distance from camera
const aspectRatio = window.innerWidth / window.innerHeight;
const viewSize = 25; // Controls how much of the scene is visible
const camera = new THREE.OrthographicCamera(
    -viewSize * aspectRatio, // left
    viewSize * aspectRatio,  // right
    viewSize,                // top
    -viewSize,               // bottom
    0.1,                     // near
    1000                     // far
);
camera.position.set(0, 0, 20);

// Add controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Add axes helper
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Add lighting
setupLighting();

// Create loading screen
const loadingScreen = document.createElement('div');
loadingScreen.id = 'loading-screen';
loadingScreen.style.position = 'fixed';
loadingScreen.style.top = '0';
loadingScreen.style.left = '0';
loadingScreen.style.width = '100%';
loadingScreen.style.height = '100%';
loadingScreen.style.background = 'rgba(0,0,0,0.8)';
loadingScreen.style.display = 'flex';
loadingScreen.style.alignItems = 'center';
loadingScreen.style.justifyContent = 'center';
loadingScreen.style.flexDirection = 'column';
loadingScreen.style.zIndex = '1000';
loadingScreen.style.color = 'white';
loadingScreen.innerHTML = `
  <h2>Loading Models...</h2>
  <div style="width: 300px; height: 20px; background: #111; margin-top: 20px; border-radius: 10px; overflow: hidden;">
    <div id="progress-bar" style="width: 0%; height: 100%; background: #4CAF50; transition: width 0.3s;"></div>
  </div>
  <div id="loading-status" style="margin-top: 10px;">Initializing...</div>
`;
document.body.appendChild(loadingScreen);

// Models container
let models = {};
const modelPositions = {
    // Define positions for all models to replace the red boxes in the image
    'ventilator': { 
        path: 'models/NEW 2025-731 Ventilator-NewTop-FOR GLTF Export.glb?v=2',  // New cache bust
        position: { x: -50, y: 0, z: 0 },  // Updated X position to -50
        rotation: { x: 0, y: 0, z: 0 },
        scale: 3.125  // Reduced by 50% from 6.25 (6.25 * 0.5 = 3.125)
    },
    'oxygen-regulator': {
        path: 'models/Oxygen Regulator.glb',
        position: { x: 15, y: 8, z: 0 },  // Top right position
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.2
    },
    'test-lung': {
        path: 'models/Test Lung 210-2025 1.glb',
        position: { x: 15, y: 2, z: 0 },  // Middle right position
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.2
    },
    'oxygen-hose': {
        path: 'models/Green Oxygen Hose-2025animated.glb',
        position: { x: 15, y: -10, z: 0 },  // Bottom right position
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.0
    },
    'humid-vent': {
        path: 'models/Gibeck Humid-Vent (1).glb',
        position: { x: 25, y: 8, z: 0 },  // Top far-right position
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.2
    },
    'power-adapter': {
        path: 'models/731 Power Adapter-2025.glb',
        position: { x: 25, y: 2, z: 0 },  // Middle far-right position
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.5
    },
    'ventilator-tube': {
        path: 'models/VentilatorTube-WhitePlastic.glb',
        position: { x: -30, y: 10, z: 0 },  // Updated X position to -30
        rotation: { x: 0, y: 0, z: 0 },
        scale: 0.57375  // Reduced by 15% from 0.675 (0.675 × 0.85 = 0.57375)
    },
    'halyard-tube': {
        path: 'models/HalyardAttachmentTube.glb',
        position: { x: 25, y: -10, z: 0 },  // Additional model at bottom
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.2
    }
};

// Model variables for GUI
const modelSettings = {
    positionX: -50,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 3.125,  // Reduced to match the new ventilator scale
    showAxes: true,
    selectedModel: 'ventilator',
    // Add a function to move the model and the camera together
    moveToLeft: function() {
        const targetX = -50;
        // Move the model
        this.positionX = targetX;
        updateSelectedModel();
        // Move the camera lookAt point to keep facing the model directly
        controls.target.set(targetX, this.positionY, this.positionZ);
        controls.update();
    },
    resetCamera: function() {
        const model = models[this.selectedModel];
        if (model) {
            // Reset camera position but keep looking at the model
            camera.position.set(model.position.x, 0, 20);
            controls.target.set(model.position.x, 0, 0);
            controls.update();
        } else {
            camera.position.set(0, 0, 20);
            controls.target.set(0, 0, 0);
            controls.update();
        }
    },
    logPosition: function() {
        console.log(`Position: X=${this.positionX}, Y=${this.positionY}, Z=${this.positionZ}`);
        console.log(`Rotation: X=${this.rotationX}, Y=${this.rotationY}, Z=${this.rotationZ}`);
        console.log(`Scale: ${this.scale}`);
    }
};

// Create GUI
const gui = new dat.GUI();
gui.add(modelSettings, 'selectedModel', Object.keys(modelPositions)).name('Select Model').onChange(onModelSelect);

const positionFolder = gui.addFolder('Position');
positionFolder.add(modelSettings, 'positionX', -50, 30).step(0.1).onChange(function(value) {
    updateSelectedModel();
    // Automatically update camera target when model moves
    controls.target.set(value, modelSettings.positionY, modelSettings.positionZ);
    controls.update();
});
positionFolder.add(modelSettings, 'positionY', -20, 20).step(0.1).onChange(updateSelectedModel);
positionFolder.add(modelSettings, 'positionZ', -20, 20).step(0.1).onChange(updateSelectedModel);
positionFolder.open();

const rotationFolder = gui.addFolder('Rotation');
rotationFolder.add(modelSettings, 'rotationX', -Math.PI, Math.PI).step(0.01).onChange(updateSelectedModel);
rotationFolder.add(modelSettings, 'rotationY', -Math.PI, Math.PI).step(0.01).onChange(updateSelectedModel);
rotationFolder.add(modelSettings, 'rotationZ', -Math.PI, Math.PI).step(0.01).onChange(updateSelectedModel);
rotationFolder.open();

gui.add(modelSettings, 'scale', 0.1, 10).step(0.1).onChange(updateSelectedModel);
gui.add(modelSettings, 'showAxes').onChange(function(value) {
    axesHelper.visible = value;
});
gui.add(modelSettings, 'moveToLeft').name('Move To Left (-50)');
gui.add(modelSettings, 'resetCamera');
gui.add(modelSettings, 'logPosition');

// Load all models
loadAllModels();

// Handle window resize
window.addEventListener('resize', onWindowResize);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Functions
function setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    
    // Front directional light - move with camera
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
    frontLight.position.set(0, 0, 10);
    frontLight.castShadow = true;
    camera.add(frontLight); // Attach light to camera so it moves with it
    scene.add(camera); // Add camera to scene for the light to work
    
    // Top light
    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(0, 10, 0);
    topLight.castShadow = true;
    scene.add(topLight);
    
    // Hemisphere light for ambient illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);
}

function loadAllModels() {
    const loader = new GLTFLoader();
    let totalModels = Object.keys(modelPositions).length;
    let loadedCount = 0;
    
    // Clear any existing models
    Object.values(models).forEach(model => {
        if (model && scene.children.includes(model)) {
            scene.remove(model);
        }
    });
    models = {};
    
    // Update loading screen with total count
    document.getElementById('loading-status').textContent = `Loading 0/${totalModels} models...`;
    
    // Load each model
    Object.entries(modelPositions).forEach(([key, modelData]) => {
        // Update status
        document.getElementById('loading-status').textContent = `Loading ${key}...`;
        
        loader.load(
            modelData.path,
            function(gltf) {
                // Model loaded successfully
                const model = gltf.scene;
                
                // Find model center for better rotation
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                
                // Center model pivot point
                model.children.forEach(child => {
                    child.position.sub(center);
                });
                
                // Process materials
                model.traverse(function(node) {
                    if (node.isMesh) {
                        // Enable shadows
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        if (node.material) {
                            // Handle materials
                            if (Array.isArray(node.material)) {
                                // Handle material array
                                node.material.forEach((mat, index) => {
                                    processMaterial(mat);
                                });
                            } else {
                                // Single material
                                processMaterial(node.material);
                            }
                        }
                    }
                });
                
                // Set initial position, rotation and scale
                model.position.set(
                    modelData.position.x,
                    modelData.position.y,
                    modelData.position.z
                );
                
                model.rotation.set(
                    modelData.rotation.x,
                    modelData.rotation.y,
                    modelData.rotation.z
                );
                
                model.scale.set(
                    modelData.scale,
                    modelData.scale,
                    modelData.scale
                );
                
                // Add model to scene and store reference
                scene.add(model);
                models[key] = model;
                
                // Update loading count
                loadedCount++;
                const progressBar = document.getElementById('progress-bar');
                const percent = (loadedCount / totalModels) * 100;
                progressBar.style.width = percent + '%';
                document.getElementById('loading-status').textContent = `Loaded ${loadedCount}/${totalModels} models...`;
                
                // If this is the ventilator model, update the GUI settings
                if (key === 'ventilator') {
                    updateGUIFromModel(key);
                    // Ensure the ventilator has proper scale and position
                    model.scale.set(3.125, 3.125, 3.125);
                    model.position.set(-50, 0, 0);
                }
                
                // If this is the ventilator tube model, ensure it has the right position and scale
                if (key === 'ventilator-tube') {
                    // Ensure the ventilator tube has proper scale and position
                    model.scale.set(0.57375, 0.57375, 0.57375);
                    model.position.set(-30, 10, 0);
                }
                
                // If all models loaded, hide loading screen
                if (loadedCount === totalModels) {
                    document.getElementById('loading-screen').style.display = 'none';
                }
            },
            function(xhr) {
                // Update individual model loading progress
                const progressBar = document.getElementById('progress-bar');
                const totalPercent = ((loadedCount + (xhr.loaded / xhr.total)) / totalModels) * 100;
                progressBar.style.width = totalPercent + '%';
            },
            function(error) {
                // Error loading model
                console.error(`Error loading model ${key}:`, error);
                document.getElementById('loading-status').textContent = `Error loading ${key}`;
                
                // Count as loaded (even though it failed) to allow completion
                loadedCount++;
                if (loadedCount === totalModels) {
                    document.getElementById('loading-screen').style.display = 'none';
                }
            }
        );
    });
}

function onModelSelect(value) {
    // Update GUI values based on selected model
    updateGUIFromModel(value);
}

function updateGUIFromModel(modelKey) {
    const model = models[modelKey];
    if (!model) return;
    
    // Update GUI values without triggering onChange
    const origPositionX = modelSettings.positionX;
    const origPositionY = modelSettings.positionY;
    const origPositionZ = modelSettings.positionZ;
    const origRotationX = modelSettings.rotationX;
    const origRotationY = modelSettings.rotationY;
    const origRotationZ = modelSettings.rotationZ;
    const origScale = modelSettings.scale;
    
    // Set new values
    modelSettings.positionX = model.position.x;
    modelSettings.positionY = model.position.y;
    modelSettings.positionZ = model.position.z;
    modelSettings.rotationX = model.rotation.x;
    modelSettings.rotationY = model.rotation.y;
    modelSettings.rotationZ = model.rotation.z;
    modelSettings.scale = model.scale.x; // Assuming uniform scale
    
    // Update GUI controllers safely
    if (gui && typeof gui.controllers !== 'undefined' && Array.isArray(gui.controllers)) {
        for (const controller of gui.controllers) {
            if (controller && typeof controller.updateDisplay === 'function') {
                controller.updateDisplay();
            }
        }
    }
    
    // Check folders safely
    const folders = [positionFolder, rotationFolder];
    for (const folder of folders) {
        if (folder && typeof folder.controllers !== 'undefined' && Array.isArray(folder.controllers)) {
            for (const controller of folder.controllers) {
                if (controller && typeof controller.updateDisplay === 'function') {
                    controller.updateDisplay();
                }
            }
        }
    }
}

function updateSelectedModel() {
    const model = models[modelSettings.selectedModel];
    if (!model) return;
    
    // Update position
    model.position.set(
        modelSettings.positionX,
        modelSettings.positionY,
        modelSettings.positionZ
    );
    
    // Update rotation
    model.rotation.set(
        modelSettings.rotationX,
        modelSettings.rotationY,
        modelSettings.rotationZ
    );
    
    // Update scale
    model.scale.set(
        modelSettings.scale,
        modelSettings.scale,
        modelSettings.scale
    );
    
    // Save position in modelPositions for future reference
    modelPositions[modelSettings.selectedModel].position = {
        x: modelSettings.positionX,
        y: modelSettings.positionY,
        z: modelSettings.positionZ
    };
    
    modelPositions[modelSettings.selectedModel].rotation = {
        x: modelSettings.rotationX,
        y: modelSettings.rotationY,
        z: modelSettings.rotationZ
    };
    
    modelPositions[modelSettings.selectedModel].scale = modelSettings.scale;
}

function onWindowResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    // Update orthographic camera on resize
    camera.left = -viewSize * aspectRatio;
    camera.right = viewSize * aspectRatio;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Helper function to process materials
function processMaterial(material) {
    // Force material update
    material.needsUpdate = true;
    
    // Handle different texture types
    const textureTypes = [
        'map', 'normalMap', 'specularMap', 'emissiveMap', 
        'metalnessMap', 'roughnessMap', 'bumpMap', 'aoMap'
    ];
    
    textureTypes.forEach(type => {
        if (material[type]) {
            material[type].needsUpdate = true;
            material[type].flipY = false; // Try this if textures are inverted
            
            // Use newer colorspace API instead of encoding
            if (type === 'map' || type === 'emissiveMap') {
                material[type].colorSpace = THREE.SRGBColorSpace;
            }
            
            // Ensure proper texture wrapping
            material[type].wrapS = THREE.RepeatWrapping;
            material[type].wrapT = THREE.RepeatWrapping;
            
            // For normal maps
            if (type === 'normalMap') {
                material.normalScale.set(1, 1);
            }
        }
    });
    
    // Special handling for common display materials
    if (material.name && (
        material.name.toLowerCase().includes('screen') ||
        material.name.toLowerCase().includes('display') ||
        material.name.toLowerCase().includes('panel') ||
        material.name.toLowerCase().includes('button') ||
        material.name.toLowerCase().includes('lcd')
    )) {
        // Enhanced handling for display materials
        if (material.type.includes('MeshStandard')) {
            // Increase emissive for LCD display
            material.emissive = new THREE.Color(0xffffff);
            material.emissiveIntensity = 0.5;
            
            // For screens that should appear illuminated
            if (material.name.includes('LCD') || material.name.includes('Screen')) {
                material.emissiveIntensity = 0.8;
                // Create basic emissive texture if none exists
                if (!material.emissiveMap && material.map) {
                    material.emissiveMap = material.map.clone();
                }
            }
        }
    }
    
    // Ensure material properties are optimized for appearance
    material.side = THREE.DoubleSide; // Render both sides
    
    // For transparent UI elements
    material.transparent = material.transparent || false;
    material.alphaTest = 0.3; // Lower threshold helps with transparent textures
    
    // Try to force shading where possible
    if (material.type.includes('MeshStandard') || material.type.includes('MeshPhysical')) {
        // Don't use environment maps since we removed them
        material.roughness = Math.min(material.roughness || 0.5, 0.5); // Less rough
        material.metalness = Math.max(material.metalness || 0, 0.3); // More metallic
    }
} 