class App {
    constructor() {
        this.container = document.getElementById('scene-container');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1c2430);
        
        // Placeholder initial camera setup - will be adjusted after models load
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.OrthographicCamera(-aspect * 5, aspect * 5, 5, -5, 0.1, 1000);
        this.camera.position.set(0, 0, 25); // MOVED camera back slightly (was 20)

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // --- Basic Renderer settings ---
        this.renderer.physicallyCorrectLights = false;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // --- Define properties used by GUI and event listeners EARLY ---
        this.ambientLight = null;
        this.mainLight = null;
        this.originalAmbientIntensity = 1.0; // Reset initial ambient intensity
        this.originalDirectionalIntensity = 1.0; // Reset initial directional intensity
        this.interactiveGroup = new THREE.Group(); // Define group before listeners
        this.scene.add(this.interactiveGroup);
        // Add map to store original material opacity and transparency states
        this.originalMaterialStates = new Map();
        // --- End early definitions ---

        this.setupLights();

        // Setup GLTF loader
        this.loader = new THREE.GLTFLoader();
        
        // Store loaded model reference
        this.loadedModel = null;
        
        // Setup tooltip
        this.tooltip = document.getElementById('tooltip');
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        
        // Track zoom state
        this.isZoomed = false;
        this.zoomedModel = null;
        
        // Track rotation
        this.rotationSpeed = 0.01; // Speed of rotation
        this.isRotating = false;  // Flag to track whether rotation is active
        
        // Add mouse event listeners (Now safe to add)
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('mouseout', this.hideTooltip.bind(this));
        this.container.addEventListener('click', this.onClick.bind(this));
        
        // Add a separate event for the side panel - using right-click
        this.container.addEventListener('contextmenu', this.onRightClick.bind(this));
        
        // Setup GUI (Now safe to call)
        this.setupGUI();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Load both models
        this.loadModels();

        // Start animation loop
        this.animate();

        // Initialize side panel reference
        this.sidePanel = document.getElementById('side-panel');
        this.panelContent = document.getElementById('part-details');
        
        // Add flag to track side panel state
        this.sidePanelOpen = false;
        
        // Add click handler for close button
        const closeButton = document.getElementById('close-panel');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isZoomed && this.zoomedModel) {
                    this.zoomOut();
                }
                this.closeSidePanel();
            });
        }

        // --- Add properties for lights and original intensities --- 
        // Already defined earlier, remove or comment out these redundant lines
        // this.ambientLight = null; 
        // this.mainLight = null;
        // this.originalAmbientIntensity = 1.0; // Default or initial value
        // this.originalDirectionalIntensity = 1.0; // Default or initial value
        // --- End added properties ---

        // --- Add model loading state ---
        this.modelsReady = false; // Keep this flag
        // --- End model loading state ---

        // --- Add light dimming factors --- 
        // Already defined earlier, remove or comment out these redundant lines
        // this.ambientDimFactor = 0.2; // Default dim factor for ambient light
        // this.directionalDimFactor = 0.1; // Default dim factor for directional light
        // --- End light dimming factors ---

        // --- Properties for bounds calculation ---
        this.totalBounds = new THREE.Box3();
        this.allModelsLoaded = false;
        this.paddingFactor = 1.2; // INCREASED padding (was 1.1)
        // --- End bounds properties ---

        // Add current model index tracking
        this.currentModelIndex = -1;
        this.modelGroups = [];
        
        // Add event listeners for bottom navigation buttons
        const prevButton = document.getElementById('prevButton');
        const nextButton = document.getElementById('nextButton');
        
        if (prevButton) {
            console.log('Found previous button in bottom navigation');
            prevButton.addEventListener('click', (e) => {
                console.log('Bottom previous button clicked');
                this.navigateModels(-1);
            });
        } else {
            console.log('Previous button not found in bottom navigation');
        }
        
        if (nextButton) {
            console.log('Found next button in bottom navigation');
            nextButton.addEventListener('click', (e) => {
                console.log('Bottom next button clicked');
                this.navigateModels(1);
            });
        } else {
            console.log('Next button not found in bottom navigation');
        }

        // Initialize audio objects
        this.audioElements = new Map();
        this.loadAudioFiles();

        // Initialize OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = false; // Disable all controls
        this.controls.enableRotate = false; // Disable rotation
        this.controls.enablePan = false; // Disable panning
        this.controls.enableZoom = false; // Disable zooming
    }

    setupLights() {
        // Remove HDR environment map
        this.scene.environment = null;
        
        // Set background to Air Force blue
        this.scene.background = new THREE.Color(0x00308F);
        this.scene.background.multiplyScalar(0.9); // Keep the 0.9 opacity
        
        // Subtle ambient light for base illumination
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);
        
        // Main front light - stronger for primary illumination
        const frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
        frontLight.position.set(5, 10, 7.5);
        frontLight.castShadow = true;
        this.scene.add(frontLight);
        
        // Back light for rim definition
        const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
        backLight.position.set(-5, 8, -7.5);
        backLight.castShadow = true;
        this.scene.add(backLight);
        
        // Right side light
        const rightLight = new THREE.DirectionalLight(0xffffff, 1.0);
        rightLight.position.set(7.5, 8, -5);
        rightLight.castShadow = true;
        this.scene.add(rightLight);
        
        // Left side light
        const leftLight = new THREE.DirectionalLight(0xffffff, 1.0);
        leftLight.position.set(-7.5, 8, 5);
        leftLight.castShadow = true;
        this.scene.add(leftLight);
        
        // Additional fill light for screen detail
        const fillLight = new THREE.DirectionalLight(0xfff0e0, 0.3);
        fillLight.position.set(0, -2, 10);
        this.scene.add(fillLight);
        
        // Store lights for individual models
        this.modelLights = new Map();

        // Enable shadow rendering
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupModelLights(model) {
        if (this.modelLights.has(model)) {
            const existingLights = this.modelLights.get(model);
            existingLights.forEach(light => this.scene.remove(light));
        }

        const lights = [];
        
        // Only add focused lighting for non-ventilator models
        if (model.name !== 'Ventilator Unit') {
            // Main spotlight for focused illumination
            const spotLight = new THREE.SpotLight(0xffffff, 1.2);
            spotLight.position.set(5, 8, 10);
            spotLight.angle = Math.PI / 6;
            spotLight.penumbra = 0.7;
            spotLight.castShadow = true;
            lights.push(spotLight);
            
            // Fill light for details
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
            fillLight.position.set(-3, 2, 5);
            fillLight.castShadow = true;
            lights.push(fillLight);
        }

        // Add all lights to scene
        lights.forEach(light => this.scene.add(light));
        this.modelLights.set(model, lights);
    }
    
    setupGUI() {
        // Create GUI, but don't auto-place it
        this.gui = new dat.GUI({ autoPlace: false });
        
        // Hide GUI by default
        this.gui.domElement.style.display = 'none';
        
        // Manually add the GUI to the container
        this.container.appendChild(this.gui.domElement);

        // --- Halyard Attachment Tube Controls ---
        const halyardParams = {
            scale: 2.0 // Initial scale factor
        };
        const halyardFolder = this.gui.addFolder('Halyard Attachment Tube');
        halyardFolder.add(halyardParams, 'scale', 0.1, 10).name('Scale').onChange(value => {
            const halyardGroup = this.interactiveGroup.children.find(child => child.name === 'Halyard Attachment Tube');
            if (halyardGroup) {
                halyardGroup.scale.setScalar(value);
            }
        });
        halyardFolder.open();
    }

    loadModels() {
        const modelConfigs = [
            { name: 'Ventilator Unit', path: 'assets/ventilator.glb', scale: 1, position: [-15, 0, 0], rotation: [0,0,0], tooltip: 'Main ventilator device providing respiratory support' },
            { name: 'Ventilator Tube', path: 'assets/VentilatorTube-WhitePlastic.glb', scale: 0.1125, position: [-9, 4, 0], rotation: [0,0,0], tooltip: 'Ventilator Circuit', needsClickableArea: true },
            { name: 'HEPA Filter Attachment', path: 'assets/HeppaAttachment-2025.glb', scale: 0.3, position: [-3, 3, 0], rotation: [0,0,0], tooltip: 'HEPA Filter Attachment' },
            { name: 'Halyard Attachment Tube', path: 'assets/HalyardAttachmentTube.glb', scale: 20.0, position: [7, 3, 0], rotation: [-Math.PI / 4, Math.PI/2 + Math.PI/4, 0], tooltip: 'Halyard Attachment Tube', needsClickableArea: true },
            { name: 'Pulse Oximeter', path: 'assets/PulseOx.glb', scale: 0.2, position: [17, 3, 5], rotation: [Math.PI/4, Math.PI/2, 0], tooltip: 'Pulse Oximeter', needsClickableArea: true },
            { name: 'Glbeck Humid Vent', path: 'assets/Gibeck Humid-Vent (1).glb', scale: 2.0, position: [-9, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Glbeck Humid Vent', needsClickableArea: true },
            { name: 'Oxygen Regulator', path: 'assets/Oxygen Regulator.glb', scale: 20.0, position: [-3, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Oxygen Regulator' },
            { name: 'Test Lung', path: 'assets/Test Lung 210-2025 1.glb', scale: 0.2, position: [3, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Test Lung' },
            { name: 'Green Oxygen Hose', path: 'assets/Green Oxygen Hose.glb', scale: 16.2, position: [10, -3.5, 0], rotation: [Math.PI/4, Math.PI/2 + Math.PI/4, 0], tooltip: 'Green Oxygen Hose', needsClickableArea: true },
            { name: '731 Power Adapter', path: 'assets/731%20Power%20Adapter.glb', scale: 0.121, position: [18, -3.5, 0], rotation: [Math.PI/4, Math.PI/2 + Math.PI/4, 0], tooltip: '731 Power Adapter', needsClickableArea: true },
            { name: 'O2 Bag and Connector', path: 'assets/O2 Bag and connector-06.glb', scale: 0.5, position: [0, 0, 0], rotation: [0, 0, 0], tooltip: 'O2 Bag and Connector', needsClickableArea: true },
            { name: 'HME to Entitle O2', path: 'assets/HMEtoEntitleO2.glb', scale: 2.0, position: [5, -3.5, 0], rotation: [0, 0, 0], tooltip: 'HME to Entitle O2', needsClickableArea: true }
        ];

        const loadPromises = modelConfigs.map(config => 
            new Promise((resolve, reject) => {
                this.loader.load(
                    config.path, 
                    (gltf) => {
                        // Special handling for Halyard Attachment Tube
                        if (config.name === 'Halyard Attachment Tube') {
                            gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                                    // Ensure proper material settings
                                    child.material.side = THREE.DoubleSide;
                                    child.material.depthWrite = true;
                                    child.material.depthTest = true;
                                    child.material.transparent = false;
                                    // Force material update
                                    child.material.needsUpdate = true;
                                }
                            });
                        }
                        resolve({ gltf, config });
                    },
                    undefined,
                    (error) => reject({ error, config })
                );
            })
        );

        Promise.all(loadPromises)
            .then(results => {
                console.log("All models finished loading.");
                this.totalBounds.makeEmpty(); // Reset bounds before calculation

                let initialVentilatorScale = 1; // Variable to store ventilator scale

                results.forEach(({ gltf, config }, index) => { // Added index for debugging
                    const modelGroup = new THREE.Group();
                    const mesh = gltf.scene;

                    // Center the mesh geometry within the group
                    const box = new THREE.Box3().setFromObject(mesh);
                const center = box.getCenter(new THREE.Vector3());
                    mesh.position.sub(center);
                    modelGroup.add(mesh);

                    // Apply scale and position to the GROUP
                    if (config.name === 'Ventilator Unit') {
                        const ventBox = new THREE.Box3().setFromObject(modelGroup); // Use group for accurate bounds
                        const ventSize = ventBox.getSize(new THREE.Vector3());
                        // Calculate scale based on initial camera view (APPROXIMATION)
                        const initialCamHeight = this.camera.top - this.camera.bottom; // Use current camera T/B
                        initialVentilatorScale = (initialCamHeight > 0.1 && ventSize.y > 0.001) ? (initialCamHeight * 0.8) / ventSize.y : 1;
                        console.log(`Calculated initialVentilatorScale for ${config.name}: ${initialVentilatorScale}`);
                        modelGroup.scale.setScalar(initialVentilatorScale * config.scale);
                    } else {
                        modelGroup.scale.setScalar(initialVentilatorScale * config.scale);
                    }
                    
                    modelGroup.position.set(...config.position);
                    modelGroup.rotation.set(...config.rotation);

                    // Assign userData to the GROUP
                    modelGroup.name = config.name;
                    modelGroup.userData.tooltipText = config.tooltip;
                    modelGroup.userData.originalPosition = modelGroup.position.clone();
                    modelGroup.userData.originalScale = modelGroup.scale.clone();
                    modelGroup.userData.originalRotation = modelGroup.rotation.clone();

                    // Add the processed group to the scene and expand bounds
                    this.interactiveGroup.add(modelGroup);
                    this.totalBounds.expandByObject(modelGroup); // Expand by the positioned/scaled group
                    
                    // Add clickable area for tube models
                    if (config.needsClickableArea) {
                        this.addClickableArea(modelGroup, config);
                    }
                    
                    // Store model groups in order for navigation
                    this.modelGroups.push(modelGroup);
                    
                    console.log(`Processed and added model ${index + 1}/${results.length}: ${config.name}`);
                });

                // --- Actions after ALL models are processed --- 
                this.allModelsLoaded = true;
                this.modelsReady = true; // Allow interactions
                console.log("Final calculated bounds MIN:", this.totalBounds.min);
                console.log("Final calculated bounds MAX:", this.totalBounds.max);
                
                // Check if OrbitControls is initialized
                if (!this.controls) {
                    console.error("OrbitControls not initialized before fitCameraToBounds call!");
                    // Initialize controls here if needed, or ensure it's done earlier
                    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                    // Add necessary configurations for controls if initializing here
                }
                
                this.fitCameraToBounds(); // Fit camera now that bounds are complete
                this.onWindowResize();    // Ensure initial viewport is correct
                console.log("Fit camera called after all models processed.");

            })
            .catch(results => {
                console.error("Error loading one or more models:", results);
                // Handle errors appropriately (e.g., show a message to the user)
                if (Array.isArray(results)) { // Check if results is an array (might not be if Promise.all throws early)
                    results.forEach(({ error, config }) => {
                        if (config && error) {
                             console.error(`Failed to load ${config.name}:`, error);
                        }
                    });
                } else {
                     console.error("An unexpected error occurred during model loading:", results);
                }
        });
    }

    onWindowResize() {
        // Update renderer size first
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

        // Recalculate and fit camera to bounds based on new aspect ratio
        this.fitCameraToBounds(); 
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Rotate the model if we're in rotation mode
        if (this.isRotating && this.zoomedModel) {
            // Apply rotation
            this.zoomedModel.rotation.y += this.rotationSpeed;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    // Handle mouse movement for tooltip
    onMouseMove(event) {
        // --- Add check for interactiveGroup ---
        if (!this.interactiveGroup) return; // Exit if group not ready
        // --- End check ---

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all objects intersecting the ray FROM THE INTERACTIVE GROUP
        const intersects = this.raycaster.intersectObjects(this.interactiveGroup.children, true);
        
        let showTooltip = false;
        let hoveredObject = null;
        
        // Check for intersections
        if (intersects.length > 0) {
            // Find the first object that has tooltip data
            for (let i = 0; i < intersects.length; i++) {
                // Traverse up the parent chain to find an object with tooltip data
                let currentObj = intersects[i].object;
                while (currentObj && !currentObj.userData.tooltipText) {
                    currentObj = currentObj.parent;
                }
                
                // If we found an object with tooltip data and it's not the Ventilator Unit
                if (currentObj && currentObj.userData.tooltipText && currentObj.name !== 'Ventilator Unit') {
                    // Show tooltip
                    this.tooltip.innerHTML = currentObj.userData.tooltipText;
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.left = event.clientX + 10 + 'px';
                    this.tooltip.style.top = event.clientY + 10 + 'px';
                    
                    // Store hovered object for highlighting
                    hoveredObject = currentObj;
                    
                    showTooltip = true;
                    break;
                }
            }
        }
        
        // Update highlighting
        this.updateHighlighting(hoveredObject);
        
        // Hide tooltip if no relevant intersection found
        if (!showTooltip) {
            this.hideTooltip();
        }
    }
    
    // Hide tooltip
    hideTooltip() {
        this.tooltip.style.display = 'none';
        // Remove highlighting when tooltip is hidden
        this.updateHighlighting(null);
    }
    
    // Update object highlighting
    updateHighlighting(hoveredObject) {
        // Disabled highlighting effect
        return;
    }

    // Handle click events
    onClick(event) {
        // --- Add check for models ready ---
        if (!this.modelsReady) {
            console.log("Models not ready yet, ignoring click.");
            return;
        }
        // --- End check ---

        // Ignore clicks originating from within the side panel
        if (this.sidePanel && this.sidePanel.contains(event.target)) {
            console.log("Click originated inside side panel. Ignoring in container listener.");
            return; 
        }
        
        // Calculate mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections ONLY WITHIN THE INTERACTIVE GROUP
        const intersects = this.raycaster.intersectObjects(this.interactiveGroup.children, true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            let model = object;
            // Find the top-level group in the interactiveGroup
            while (model && model.parent !== this.interactiveGroup && model.parent !== this.scene) { 
                model = model.parent;
            }
            
            if (!model || model === this.interactiveGroup) return; // Skip if we didn't find a valid model
            
            // Skip if this is the Ventilator Unit
            if (model.name === 'Ventilator Unit') {
                console.log('Ventilator Unit clicked - ignoring');
                return;
            }

            console.log('Clicked model:', model.name, model); 

            const isZoomable = [
                'Ventilator Tube', 'HEPA Filter Attachment', 'Halyard Attachment Tube', 
                'Pulse Oximeter', 'Glbeck Humid Vent', 'Oxygen Regulator', 
                'Test Lung', 'Green Oxygen Hose', '731 Power Adapter'
            ].includes(model.name);

            if (this.isZoomed) {
                // --- CASE 1: Clicked the CURRENTLY zoomed model ---
                if (this.zoomedModel === model) {
                    console.log(model.name + ' (already zoomed) clicked. Zooming out.');
                    this.zoomOut(); // No callback needed, default is to close panel
                } 
                // --- CASE 2: Clicked a DIFFERENT ZOOMABLE model ---
                else if (isZoomable) { 
                    console.log(model.name + ' (zoomable) clicked while another is zoomed. Switching zoom.');
                    this.zoomOut(() => { // Callback to zoom into the new model
                        console.log("Zoom out finished, zooming into:", model.name);
                        this.zoomIn(model);
                        this.showSidePanel(model); // Show panel for the new model
                    });
                } 
                // --- CASE 3: Clicked a NON-ZOOMABLE model ---
                else { 
                    console.log(model.name + ' (non-zoomable) clicked while zoomed. Zooming out and showing panel.');
                    this.zoomOut(() => { // Callback to show panel for the non-zoomable model
                        console.log("Zoom out finished, showing side panel for:", model.name);
                        this.showSidePanel(model);
                    });
                }
            } else {
                // --- CASE 4: Nothing is zoomed ---
                if (isZoomable) {
                    console.log(model.name + ' (zoomable) clicked. Zooming in.');
                    // --- Add Logging Before Zoom --- 
                    if (model.name === 'Ventilator Tube') {
                        console.log('--- Ventilator Tube Pre-Zoom State ---');
                        console.log('Position:', model.position.clone());
                        console.log('Scale:', model.scale.clone());
                        console.log('Rotation:', model.rotation.clone());
                        console.log('Camera Top/Bottom:', this.camera.top, this.camera.bottom);
                        console.log('------------------------------------');
                    }
                    // --- End Logging ---
                    this.zoomIn(model);
                    // Delay panel slightly to match zoom animation
                    setTimeout(() => { this.showSidePanel(model); }, 300); 
                } else {
                    console.log(model.name + ' (non-zoomable) clicked. Showing panel.');
                    this.showSidePanel(model); // Show panel immediately
                }
            }
        } else {
             // --- CASE 5: Clicked on empty space ---
             console.log('Clicked on empty space.');
             if (this.isZoomed) {
                 console.log("Zoomed in, zooming out due to empty space click.");
                 this.zoomOut(); // Zoom out if clicked empty space while zoomed
             } else {
                 this.closeSidePanel(); // Close panel if open and clicked empty space
             }
        }
    }
    
    // Zoom in on a model
    zoomIn(model) {
        if (!model || this.isZoomed) return;
        
        // Play the audio for this model
        this.playModelAudio(model.name);
        
        this.isZoomed = true;
        this.zoomedModel = model;
        this.hideTooltip();
        
        // Setup lights for this model
        this.setupModelLights(model);
        
        // Fade out other objects
        this.fadeOutOtherObjects(model);

        let targetScaleVector;
        let targetPosition = new THREE.Vector3(0, 0, 5); // Default target position

        // --- Special Case: Tube, HEPA, Halyard, Pulse Ox, Glbeck, O2 Reg, Test Lung, Green Hose, Power Adapter - Scale x1.5 ONLY ---
        if (model.name === 'Ventilator Tube' || model.name === 'HEPA Filter Attachment' || model.name === 'Halyard Attachment Tube' || model.name === 'Pulse Oximeter' || model.name === 'Glbeck Humid Vent' || model.name === 'Oxygen Regulator' || model.name === 'Test Lung' || model.name === 'Green Oxygen Hose' || model.name === '731 Power Adapter') {
            console.log(`Applying fixed scale x1.5 and adjusted position for ${model.name}.`);
            
            // --- Calculate final scale vector: Multiply current scale by 1.5 ---
            targetScaleVector = model.scale.clone().multiplyScalar(1.5); 
            console.log(`Target Scale Vector (current * 1.5) for ${model.name}:`, targetScaleVector);
            // --- End Scale Calculation ---

            // Adjust target position - Y=0 
            targetPosition.set(0, 0, 5); // Vertically centered
        
        } else {
            // --- Auto-Detect Scaling for all other models ---
            console.log(`Applying auto-detect scaling for: ${model.name}`);
            const viewHeight = this.camera.top - this.camera.bottom;
            const viewWidth = this.camera.right - this.camera.left;
            const targetSize = Math.min(viewHeight, viewWidth) * 0.8; // Target 80%

            let modelSize;
            const currentGroupScale = model.scale.clone();
            const groupScaleMatrix = new THREE.Matrix4().scale(currentGroupScale);

            // Method 1: Size of whole group
            const boxGroup = new THREE.Box3().setFromObject(model); 
            const modelSizeGroup = boxGroup.getSize(new THREE.Vector3());

            // Method 2: Combined size of visible meshes
            const boxVisible = new THREE.Box3();
            let visibleMeshFound = false;
            model.traverse((child) => {
                if (child.isMesh && child.visible && !(child.material && child.material.visible === false)) {
                    const meshBoxLocal = new THREE.Box3().setFromObject(child);
                    child.updateWorldMatrix(true, false);
                    const meshWorldMatrix = child.matrixWorld.clone();
                    const groupWorldMatrixInv = model.matrixWorld.clone().invert(); 
                    meshWorldMatrix.premultiply(groupWorldMatrixInv);
                    meshBoxLocal.applyMatrix4(meshWorldMatrix);
                    boxVisible.union(meshBoxLocal);
                    visibleMeshFound = true;
                }
            });
            boxVisible.applyMatrix4(groupScaleMatrix); 
            const modelSizeVisible = visibleMeshFound ? boxVisible.getSize(new THREE.Vector3()) : modelSizeGroup;

            // Compare and decide which size to use
            const sizeThresholdFactor = 1.5;
            if (visibleMeshFound && modelSizeGroup.length() > modelSizeVisible.length() * sizeThresholdFactor) {
                modelSize = modelSizeVisible;
            } else {
                modelSize = modelSizeGroup;
            }

            // Calculate scale factors (common logic)
            const scaleFactorX = modelSize.x > 0.001 ? targetSize / modelSize.x : 1;
            const scaleFactorY = modelSize.y > 0.001 ? targetSize / modelSize.y : 1;
            const requiredScaleFactor = Math.min(scaleFactorX, scaleFactorY);

            // Calculate final target scale vector
            targetScaleVector = model.scale.clone().multiplyScalar(requiredScaleFactor);
            // --- End Auto-Detect Scaling ---
        }
        
        // --- Apply Animations (Common to all models) ---
        gsap.to(model.position, {
            x: targetPosition.x,
            y: targetPosition.y, // Use the potentially adjusted Y
            z: targetPosition.z,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                this.isRotating = true; // Allow rotation after zoom completes
            }
        });
        
        // --- Animate Scale for ALL models again ---
        gsap.to(model.scale, {
            x: targetScaleVector.x,
            y: targetScaleVector.y,
            z: targetScaleVector.z,
            duration: 1,
            ease: "power2.inOut"
        });
    }
    
    // Restore original view
    zoomOut(onCompleteCallback = null) {
        if (!this.isZoomed) {
            if (onCompleteCallback && typeof onCompleteCallback === 'function') {
                console.log("Zoom out complete, executing callback.");
                onCompleteCallback();
            } else {
                console.log("Zoom out complete, closing side panel by default.");
                this.closeSidePanel();
            }
            return;
        }
        
        // Stop any playing audio
        for (const audio of this.audioElements.values()) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        const model = this.zoomedModel;
        this.isRotating = false;

        // Remove model-specific lights
        if (this.modelLights.has(model)) {
            const lights = this.modelLights.get(model);
            lights.forEach(light => this.scene.remove(light));
            this.modelLights.delete(model);
        }
        
        // Fade in all objects
        this.fadeInAllObjects();
        
        // Get original transform values
        const origPos = model.userData.originalPosition;
        const origScale = model.userData.originalScale;
        const origRot = model.userData.originalRotation;
        console.log(`[ZoomOut] Restoring ${model.name} to Original Rotation:`, origRot); // Log original rotation
        
        // Use GSAP to animate back to original transform
        gsap.to(model.position, {
            x: origPos.x,
            y: origPos.y,
            z: origPos.z,
            duration: 1,
            ease: "power2.inOut"
        });
        
        gsap.to(model.scale, {
            x: origScale.x,
            y: origScale.y,
            z: origScale.z,
            duration: 1,
            ease: "power2.inOut"
        });
        
        // Also restore the original rotation
        gsap.to(model.rotation, {
            x: origRot.x,
            y: origRot.y,
            z: origRot.z,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                // Reset zoom state first
                const previouslyZoomedModel = this.zoomedModel; // Keep ref if needed
                this.isZoomed = false;
                this.zoomedModel = null;

                // Restore bounding box visibility 
                // REMOVE: if (this.showBoundingBoxes) {
                // REMOVE:     this.boundingBoxes.forEach(box => {
                // REMOVE:         if (box) {
                // REMOVE:             box.visible = true;
                // REMOVE:         }
                // REMOVE:     });
                // REMOVE: }

                // Execute the callback if provided, otherwise close the panel
                if (onCompleteCallback && typeof onCompleteCallback === 'function') {
                    console.log("Zoom out complete, executing callback.");
                    onCompleteCallback();
                } else {
                    console.log("Zoom out complete, closing side panel by default.");
                    this.closeSidePanel();
                }
            }
        });
    }

    // Helper method to check if an object is a child of another
    isChildOf(child, parent) {
        let currentParent = child.parent;
        while (currentParent) {
            if (currentParent === parent) {
                return true;
            }
            currentParent = currentParent.parent;
        }
        return false;
    }

    // Completely separate method to update side panel info - doesn't affect other behavior
    updateSidePanelInfo(model) {
        const nameElement = document.getElementById('part-name');
        const detailsElement = document.getElementById('part-details');
        
        if (!model) {
            nameElement.textContent = 'Part Details';
            detailsElement.textContent = 'Select a part to view details';
            return;
        }
        
        // Set part name
        nameElement.textContent = model.name || 'Unknown Part';
        
        // Generate part details HTML
        let detailsHTML = '';
        
        if (model.userData) {
            // Add tooltip text if available
            if (model.userData.tooltipText) {
                detailsHTML += `<p>${model.userData.tooltipText}</p>`;
            }
            
            // Add more details as needed
            detailsHTML += `<p><span class="property">Type:</span> ${model.type || 'Model'}</p>`;
            detailsHTML += `<p><span class="property">Position:</span> X: ${model.position.x.toFixed(2)}, Y: ${model.position.y.toFixed(2)}, Z: ${model.position.z.toFixed(2)}</p>`;
            
            // Add material info if available
            if (model.children && model.children.length > 0) {
                const child = model.children[0];
                if (child.material) {
                    detailsHTML += `<p><span class="property">Material:</span> ${child.material.name || 'Standard'}</p>`;
                }
            }
        }
        
        // Update details content
        detailsElement.innerHTML = detailsHTML || 'No details available for this part.';
    }

    // Show side panel with details
    showSidePanel(model) {
        console.log('showSidePanel called for model:', model.name);
        if (!this.sidePanel || !model) return;

        // Update panel content
        this.updatePanelContent(model);

        // Show panel with animation
        this.sidePanel.style.display = 'block';
        requestAnimationFrame(() => {
            this.sidePanel.classList.add('open');
        });
        this.sidePanelOpen = true;

        // Add event listeners for navigation buttons
        const prevButton = document.getElementById('prevModel');
        const nextButton = document.getElementById('nextModel');

        console.log('Looking for navigation buttons...');
        console.log('Previous button found:', prevButton !== null);
        console.log('Next button found:', nextButton !== null);

        if (prevButton) {
            console.log('Adding click listener to previous button');
            prevButton.addEventListener('click', (e) => {
                console.log('Previous button clicked - event listener');
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Current model:', model.name);
                const currentIndex = this.modelGroups.findIndex(m => m === model);
                const prevIndex = (currentIndex - 1 + this.modelGroups.length) % this.modelGroups.length;
                const prevModel = this.modelGroups[prevIndex];
                console.log('Navigating from index', currentIndex, 'to', prevIndex);
                console.log('Previous model:', prevModel.name);
                
                if (this.isZoomed && this.zoomedModel !== prevModel) {
                    console.log('Zooming out before navigating to previous model');
                    this.zoomOut(() => {
                        this.zoomToModel(prevModel);
                        this.updatePanelContent(prevModel);
                    });
                } else {
                    console.log('Directly navigating to previous model');
                    this.zoomToModel(prevModel);
                    this.updatePanelContent(prevModel);
                }
            });
        }

        if (nextButton) {
            console.log('Adding click listener to next button');
            nextButton.addEventListener('click', (e) => {
                console.log('Next button clicked - event listener');
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Current model:', model.name);
                const currentIndex = this.modelGroups.findIndex(m => m === model);
                const nextIndex = (currentIndex + 1) % this.modelGroups.length;
                const nextModel = this.modelGroups[nextIndex];
                console.log('Navigating from index', currentIndex, 'to', nextIndex);
                console.log('Next model:', nextModel.name);
                
                if (this.isZoomed && this.zoomedModel !== nextModel) {
                    console.log('Zooming out before navigating to next model');
                    this.zoomOut(() => {
                        this.zoomToModel(nextModel);
                        this.updatePanelContent(nextModel);
                    });
                } else {
                    console.log('Directly navigating to next model');
                    this.zoomToModel(nextModel);
                    this.updatePanelContent(nextModel);
                }
            });
        }
    }

    updatePanelContent(model) {
        if (!this.panelContent || !model) return;

        let content = '';
        
        // Add model name
        const displayName = model.name === 'Ventilator Tube' ? 'Ventilator Circuit' : model.name;
        content += `
            <div style="
                background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                padding: 15px 20px;
                border-radius: 12px;
                margin-bottom: 20px;
            ">
                <h2 style="
                    margin: 0;
                    font-size: 20px;
                    color: white;
                    font-weight: 500;
                ">${displayName}</h2>
            </div>
        `;
        
        // Add description based on model
        let description = '';
            if (model.name === 'Ventilator Tube') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                            Connects the ventilator to the patient
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                            Delivers oxygen and removes exhaled air
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                            Proper assembly ensures effective ventilation and minimizes air leaks
                    </div>
                </div>
            `;
        } else if (model.name === 'HEPA Filter Attachment') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Filters exhaled air to prevent contamination
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Protects healthcare workers from airborne particles
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Must be replaced according to schedule
                    </div>
                </div>
                `;
            } else if (model.name === 'Pulse Oximeter') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Monitors patient's oxygen saturation levels
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Provides continuous heart rate readings
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Alerts staff to dangerous changes in vital signs
                    </div>
                </div>
                `;
            } else if (model.name === 'Halyard Attachment Tube') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Connects to ventilator for secure airflow delivery
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Compatible with standard ventilator circuits
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Ensures airtight seal for reliable ventilation
                    </div>
                </div>
                `;
            } else if (model.name === 'Glbeck Humid Vent') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Adds moisture to inhaled air for patient comfort
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Helps maintain optimal airway temperature
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Reduces risk of airway dryness and irritation
                    </div>
                </div>
                `;
            } else if (model.name === 'Oxygen Regulator') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Controls oxygen flow rate to the patient
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Maintains precise oxygen pressure levels
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Features adjustable flow settings for patient needs
                    </div>
                </div>
            `;
        } else if (model.name === 'Test Lung') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Simulates patient breathing for ventilator testing
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Verifies proper ventilator function and settings
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Essential for equipment checks and training
                    </div>
                </div>
            `;
        } else if (model.name === 'Green Oxygen Hose') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Delivers oxygen from wall supply to ventilator
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        High-pressure rated for safe oxygen transport
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Color-coded green for oxygen line identification
                    </div>
                </div>
            `;
        } else if (model.name === '731 Power Adapter') {
            description = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Provides reliable power supply to ventilator unit
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Converts AC power to appropriate DC voltage
                    </div>
                    <div style="
                        background: rgba(28, 36, 48, 0.9);
                        padding: 15px 20px;
                        border-radius: 8px;
                        color: white;
                        font-size: 15px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    ">
                        <div style="
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            background: linear-gradient(90deg, #00308F 0%, #0057B8 100%);
                            border-top-left-radius: 8px;
                            border-bottom-left-radius: 8px;
                        "></div>
                        Features safety mechanisms for stable operation
                    </div>
                </div>
            `;
        } else if (model.userData && model.userData.tooltipText) {
            description = model.userData.tooltipText;
        }
        
        if (description) {
            content += description;
        }

        this.panelContent.innerHTML = content;
    }

    // Close side panel
    closeSidePanel() {
        if (!this.sidePanel) return;
        
        this.sidePanel.classList.remove('open');
        this.sidePanelOpen = false;
    }

    // Helper to find the parent model of an intersected object
    findParentModel(object) {
        // Traverse up to find a named parent (likely the model)
        let current = object;
        while (current && !current.name) {
            current = current.parent;
        }
        return current;
    }

    // Add this new method
    onRightClick(event) {
        // Prevent the default context menu
        event.preventDefault();
        
        // Calculate mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections ONLY WITHIN THE INTERACTIVE GROUP
        const sideIntersects = this.raycaster.intersectObjects(this.interactiveGroup.children, true);
        
        if (sideIntersects.length > 0) {
            const object = sideIntersects[0].object;
            
            let model = object;
            // Stop climbing when the parent is the interactiveGroup
            while (model && model.parent !== this.interactiveGroup && model.parent !== this.scene) {
                model = model.parent;
            }
            
            // Skip if this is the Ventilator Unit
            if (model && model.name === 'Ventilator Unit') {
                console.log('Ventilator Unit right-clicked - ignoring');
                return;
            }
            
            // If we found a model (and not the group itself), show its info
            if (model && model !== this.interactiveGroup) {
                this.showSidePanel(model);
            }
        }
    }

    toggleGUIVisibility() {
        const guiElement = this.gui.domElement;
        const offset = 5; // Offset amount when GUI is shown
        
        if (guiElement.style.display === 'none') {
            guiElement.style.display = 'block';
            // Shift models right when GUI is shown
            this.interactiveGroup.children.forEach(model => {
                model.position.x += offset;
            });
        } else {
            guiElement.style.display = 'none';
            // Shift models left when GUI is hidden
            this.interactiveGroup.children.forEach(model => {
                model.position.x -= offset;
            });
        }
    }

    loadModel(modelPath, callback) {
        const loader = new THREE.GLTFLoader();
        loader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            
            // Apply physical materials for better HDR interaction
            model.traverse((child) => {
                if (child.isMesh) {
                    // Create new physical material while preserving textures
                    const oldMaterial = child.material;
                    child.material = new THREE.MeshPhysicalMaterial({
                        map: oldMaterial.map,
                        normalMap: oldMaterial.normalMap,
                        roughnessMap: oldMaterial.roughnessMap,
                        metalnessMap: oldMaterial.metalnessMap,
                        metalness: 0.0,
                        roughness: 0.5,
                        envMapIntensity: 1.0
                    });
                    
                    // Clean up old material
                    oldMaterial.dispose();
                }
            });

            if (callback) callback(model);
        });
    }

    // --- REPLACED HELPER FUNCTIONS ---

    // Function to hide all objects except the selected one
    hideOtherObjects(selectedObject) {
        this.interactiveGroup.children.forEach(object => {
            if (object !== selectedObject && object.isGroup) { // Check if it's one of our interactive groups
                object.visible = false;
            }
        });
    }

    // Function to make all interactive objects visible
    showAllObjects() {
        this.interactiveGroup.children.forEach(object => {
            if (object.isGroup) { // Check if it's one of our interactive groups
                 object.visible = true;
            }
        });
    }

    // --- END REPLACED HELPER FUNCTIONS ---

    // --- UPDATED HELPER FUNCTIONS for fading ---

    fadeOutOtherObjects(selectedObject, duration = 0.8) {
        this.fadeInAllObjects(0);

        this.interactiveGroup.children.forEach(object => {
            if (object !== selectedObject && object.isGroup) {
                object.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(material => {
                            if (!this.originalMaterialStates.has(material)) {
                                this.originalMaterialStates.set(material, {
                                    originalOpacity: material.opacity,
                                    originalTransparent: material.transparent
                                });
                            }
                            material.transparent = true;
                            gsap.to(material, { 
                                opacity: 0.05, // Reduced from 0.15 to be much less visible
                                duration: duration,
                                ease: "power2.inOut"
                            });
                        });
                    }
                });
            }
        });
    }

    fadeInAllObjects(duration = 0.5) {
        this.originalMaterialStates.forEach((state, material) => {
            // Animate opacity back to original
            gsap.to(material, {
                opacity: state.originalOpacity,
                duration: duration,
                ease: "power1.inOut",
                onComplete: () => {
                    // Restore original transparency state ONLY if opacity is back to normal (or target is > 0)
                    if (state.originalOpacity > 0) { 
                       material.transparent = state.originalTransparent;
                    }
                }
            });
        });
        this.originalMaterialStates.clear(); // Clear the map after initiating the restore
    }

    // --- END UPDATED HELPER FUNCTIONS ---

    // NEW function to fit camera
    fitCameraToBounds() {
        if (!this.allModelsLoaded || this.totalBounds.isEmpty()) return;

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        this.totalBounds.getCenter(center);
        this.totalBounds.getSize(size);

        // Apply padding
        size.multiplyScalar(this.paddingFactor);

        const aspect = this.container.clientWidth / this.container.clientHeight;
        const boundsAspect = size.x / size.y;

        let camWidth, camHeight;

        // Determine camera view dimensions based on aspect ratios
        if (aspect > boundsAspect) {
            // Viewport is wider than bounds -> Use bounds height, calculate width
            camHeight = size.y / 2;
            camWidth = camHeight * aspect;
        } else {
            // Viewport is taller or same aspect -> Use bounds width, calculate height
            camWidth = size.x / 2;
            camHeight = camWidth / aspect;
        }

        // Update camera frustum
        this.camera.left = -camWidth;
        this.camera.right = camWidth;
        this.camera.top = camHeight;
        this.camera.bottom = -camHeight;

        // Adjust camera position to be centered on bounds (keep original Z offset for now)
        this.camera.position.x = center.x;
        this.camera.position.y = center.y;
        // Keep this.camera.position.z as it was initially set

        // Update controls target
        this.controls.target.copy(center);

        // IMPORTANT: Update projection matrix
        this.camera.updateProjectionMatrix();
        this.controls.update(); // Update controls after target change
    }

    // Add this new method after loadModels
    addClickableArea(modelGroup, config) {
        // Skip if not one of our target models
        if (!['Ventilator Tube', 'Halyard Attachment Tube', 'Pulse Oximeter', 'Glbeck Humid Vent', 'Green Oxygen Hose', '731 Power Adapter'].includes(modelGroup.name)) return;

        // Create geometry based on the model
        let planeGeometry;
        if (modelGroup.name === 'Ventilator Tube') {
            planeGeometry = new THREE.PlaneGeometry(2, 6);
        } else if (modelGroup.name === 'Halyard Attachment Tube') {
            planeGeometry = new THREE.PlaneGeometry(10, 6);
        } else if (modelGroup.name === 'Pulse Oximeter') {
            planeGeometry = new THREE.PlaneGeometry(8, 8);
        } else if (modelGroup.name === 'Glbeck Humid Vent') {
            planeGeometry = new THREE.PlaneGeometry(4, 4);
        } else if (modelGroup.name === 'Green Oxygen Hose') {
            planeGeometry = new THREE.PlaneGeometry(6, 6);
        } else if (modelGroup.name === '731 Power Adapter') {
            planeGeometry = new THREE.PlaneGeometry(4, 7);
        }

        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0057B8,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide
        });
        
        const clickableArea = new THREE.Mesh(planeGeometry, planeMaterial);
        
        // Compensate for the model's scale to maintain size
        const modelScale = modelGroup.scale.x;
        clickableArea.scale.set(1/modelScale, 1/modelScale, 1/modelScale);
        
        // Set rotation based on the model type
        if (modelGroup.name === 'Halyard Attachment Tube') {
            clickableArea.rotation.set(0, 0, 0);
        } else if (modelGroup.name === 'Pulse Oximeter') {
            clickableArea.rotation.set(0, Math.PI/2, 0);
            clickableArea.position.set(0, 0, 0);
        } else if (modelGroup.name === 'Glbeck Humid Vent') {
            clickableArea.rotation.set(0, Math.PI/2, 0);
            clickableArea.position.set(0, 0, 0);
        } else if (modelGroup.name === 'Green Oxygen Hose') {
            clickableArea.rotation.set(0, Math.PI/2, 0); // Start with same rotation as others
            clickableArea.position.set(0, 0, 0); // Start at center
        }
        
        // Add as a child of the model group so it follows all transformations
        modelGroup.add(clickableArea);
        
        // Copy the userData for interaction
        clickableArea.userData = modelGroup.userData;
    }

    // Add navigation method
    navigateModels(direction) {
        console.log('navigateModels called with direction:', direction);
        
        if (this.modelGroups.length === 0) {
            console.log('No models available for navigation');
            return;
        }

        // Find the current model's index based on what's currently zoomed or shown in panel
        let currentModel = this.zoomedModel;
        if (!currentModel && this.sidePanelOpen) {
            // If no model is zoomed but panel is open, find the model shown in panel
            const panelTitle = document.querySelector('.panel-header .header-title').textContent;
            currentModel = this.modelGroups.find(model => model.name === panelTitle);
        }

        if (!currentModel) {
            console.log('No current model found');
            return;
        }

        // Find current index
        const currentIndex = this.modelGroups.findIndex(m => m === currentModel);
        console.log('Current model:', currentModel.name, 'at index:', currentIndex);
        
        // Find next valid model (skipping Ventilator Unit)
        let nextIndex = currentIndex;
        do {
            nextIndex = (nextIndex + direction + this.modelGroups.length) % this.modelGroups.length;
        } while (this.modelGroups[nextIndex].name === 'Ventilator Unit');
        
        console.log('New model index:', nextIndex);
        
        // Get the model at next index
        const targetModel = this.modelGroups[nextIndex];
        console.log('Target model:', targetModel ? targetModel.name : 'none');
        
        // Navigate to the target model
        if (targetModel) {
            if (this.isZoomed && this.zoomedModel !== targetModel) {
                console.log('Zooming out from current model before navigating');
                this.zoomOut(() => {
                    console.log('Zooming into new model:', targetModel.name);
                    this.zoomIn(targetModel);
                    this.showSidePanel(targetModel);
                });
        } else {
                console.log('Directly navigating to new model:', targetModel.name);
                this.zoomIn(targetModel);
                this.showSidePanel(targetModel);
            }
        }
    }

    // Add zoomToModel method
    zoomToModel(model) {
        if (!model) return;
        
        if (!this.isZoomed) {
            this.zoomIn(model);
        } else if (this.zoomedModel !== model) {
            this.zoomOut(() => {
                this.zoomIn(model);
            });
        }
    }

    // Add audio loading method
    loadAudioFiles() {
        // Create audio elements for each model
        const modelAudioMap = {
            'Pulse Oximeter': 'Pulse Ox.mp3',
            'Glbeck Humid Vent': 'glibeck.mp3',
            'Green Oxygen Hose': 'Green Oxygen hose.mp3',
            'HEPA Filter Attachment': 'Heepa.mp3',
            'Test Lung': 'Test lung.mp3',
            '731 Power Adapter': 'Ac Power.mp3',
            'Oxygen Regulator': 'Oxygen reg.mp3',
            'Ventilator Tube': 'Ventlator Circut.mp3',
            'Halyard Attachment Tube': 'hylard.mp3'
        };

        // Load each audio file
        for (const [modelName, audioFile] of Object.entries(modelAudioMap)) {
            const audio = new Audio(`audio/${audioFile}`);
            audio.preload = 'auto';
            this.audioElements.set(modelName, audio);
            console.log('Loaded audio for:', modelName); // Add logging
        }
    }

    // Play audio for a model
    playModelAudio(modelName) {
        // Stop any currently playing audio
        for (const audio of this.audioElements.values()) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        // Play the audio for this model
        const audio = this.audioElements.get(modelName);
        if (audio) {
            console.log('Playing audio for:', modelName);
            audio.play().catch(error => {
                console.log('Audio playback failed:', error);
            });
        }
    }
}

// Initialize the app when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    
    // Add key event listener to toggle bounding boxes
    window.addEventListener('keydown', (event) => {
        if (event.key === 'b' || event.key === 'B') {
            // REMOVE: app.toggleBoundingBoxes();
        }
        if (event.key === 'g' || event.key === 'G') {
            app.toggleGUIVisibility();
        }
    });
}); 