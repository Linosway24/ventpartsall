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

        // --- Enhanced Renderer settings for HDR ---
        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 7.0; // Decreased from 10.0 to 7.0
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

        // Create side panel programmatically (do this early in initialization)
        this.createSidePanel();
        
        // Add flag to track side panel state
        this.sidePanelOpen = false;

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
    }

    setupLights() {
        // --- Load HDR environment map with PMREMGenerator ---
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const rgbeLoader = new THREE.RGBELoader();
        rgbeLoader.setDataType(THREE.FloatType);
        rgbeLoader.load('libs/TS Studio Tabletop.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            
            // Only use HDR for environment lighting, not background
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            this.scene.environment = envMap;
            
            // Add ambient light to boost overall brightness
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
            
            texture.dispose();
            pmremGenerator.dispose();
            
            console.log("HDR loaded and processed with PMREM");
        }, undefined, (error) => {
            console.error('Error loading HDR:', error);
        });
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
            { name: 'Ventilator Tube', path: 'assets/VentilatorTube-WhitePlastic.glb', scale: 0.1125, position: [-9, 4, 0], rotation: [0,0,0], tooltip: 'Flexible breathing tube for patient ventilation' },
            { name: 'HEPA Filter Attachment', path: 'assets/HeppaAttachment-2025.glb', scale: 0.3, position: [-3, 3, 0], rotation: [0,0,0], tooltip: 'High-Efficiency Particulate Air filter attachment' },
            { name: 'Halyard Attachment Tube', path: 'assets/HalyardAttachmentTube.glb', scale: 20.0, position: [7, 3, 0], rotation: [-Math.PI / 4, Math.PI/2 + Math.PI/4, 0], tooltip: 'Halyard attachment tube for ventilation' },
            { name: 'Pulse Oximeter', path: 'assets/PulseOx.glb', scale: 0.2, position: [17, 3, 5], rotation: [Math.PI/4, Math.PI/2, 0], tooltip: 'Pulse oximeter for monitoring oxygen saturation' },
            { name: 'Glbeck Humid Vent', path: 'assets/Gibeck Humid-Vent (1).glb', scale: 20.0, position: [-9, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Humidification vent for patient comfort' },
            { name: 'Oxygen Regulator', path: 'assets/Oxygen Regulator.glb', scale: 20.0, position: [-3, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Oxygen flow regulator' },
            { name: 'Test Lung', path: 'assets/Test Lung 210-2025 1.glb', scale: 0.2, position: [3, -3.5, 0], rotation: [0, Math.PI/2 + Math.PI/4, 0], tooltip: 'Test lung for ventilator calibration' },
            { name: 'Green Oxygen Hose', path: 'assets/Green Oxygen Hose.glb', scale: 16.2, position: [10, -3.5, 0], rotation: [Math.PI/4, Math.PI/2 + Math.PI/4, 0], tooltip: 'Green oxygen hose for oxygen delivery' },
            { name: '731 Power Adapter', path: 'assets/731%20Power%20Adapter.glb', scale: 0.121, position: [18, -3.5, 0], rotation: [Math.PI/4, Math.PI/2 + Math.PI/4, 0], tooltip: '731 Power Adapter' }
        ];

        const loadPromises = modelConfigs.map(config => 
            new Promise((resolve, reject) => {
                this.loader.load(
                    config.path, 
                    (gltf) => resolve({ gltf, config }), // Resolve with gltf and config
                    undefined, // Progress callback (optional)
                    (error) => reject({ error, config }) // Reject with error and config
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
                
                // If we found an object with tooltip data
                if (currentObj && currentObj.userData.tooltipText) {
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
        if (this.isZoomed) return;
        
        this.isZoomed = true;
        this.zoomedModel = model;
        this.hideTooltip();
        // REMOVE: this.boundingBoxes.forEach(box => { if (box) box.visible = false; });

        // Fade out other objects
        this.fadeOutOtherObjects(model); // Default duration is 0.5s

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
        if (!this.isZoomed || !this.zoomedModel) return;
        
        const model = this.zoomedModel;
        this.isRotating = false;

        // Fade in all objects
        this.fadeInAllObjects(); // Default duration is 0.5s
        
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

    createSidePanel() {
        // Create side panel element
        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'side-panel';
        this.sidePanel.className = 'side-panel';
        
        // Create panel header
        const panelHeader = document.createElement('div');
        panelHeader.className = 'panel-header';
        
        // Create part name heading
        const partName = document.createElement('h2');
        partName.id = 'part-name';
        partName.textContent = 'Part Details';
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.id = 'close-panel';
        closeButton.innerHTML = '&times;';
        console.log("Created close button element:", closeButton);

        // --- ATTACH LISTENER HERE ---
        closeButton.addEventListener('click', (e) => {
            console.log("Close button clicked (listener attached in createSidePanel)");
            e.stopPropagation(); // Prevent click from bubbling to container
            if (this.isZoomed && this.zoomedModel) {
                console.log("Zoomed model detected, calling zoomOut()...");
                this.zoomOut();
            }
            console.log("Calling closeSidePanel()...");
            this.closeSidePanel();
        });
        // --- END LISTENER ATTACHMENT ---

        // Create panel content
        const panelContent = document.createElement('div');
        panelContent.className = 'panel-content';
        
        // Create part details container
        const partDetails = document.createElement('div');
        partDetails.id = 'part-details';
        partDetails.textContent = 'Select a part to view details';
        
        // Assemble the panel
        panelHeader.appendChild(partName);
        panelHeader.appendChild(closeButton);
        panelContent.appendChild(partDetails);
        this.sidePanel.appendChild(panelHeader);
        this.sidePanel.appendChild(panelContent);
        
        // Add panel to document
        document.body.appendChild(this.sidePanel);
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
        const panel = document.getElementById('side-panel');
        const partName = document.getElementById('part-name');
        const partDetails = document.getElementById('part-details');

        if (panel && partName && partDetails) {
            partName.textContent = model.name || 'Selected Part';
                partDetails.textContent = model.userData.tooltipText || 'No details available.';
            panel.classList.add('open');
            this.sidePanelOpen = true;
            
            // --- REMOVED LISTENER LOGIC FROM HERE ---
            // const closeButton = panel.querySelector('#close-panel');
            // if (closeButton && !closeButton.dataset.listenerAttached) { ... }
            // --- END REMOVED LISTENER LOGIC ---
             
        } else {
            console.error('Side panel elements not found!');
        }
    }

    // Close side panel
    closeSidePanel() {
        console.log("Inside closeSidePanel method");
        const panel = document.getElementById('side-panel');
        if (panel) {
            console.log("Panel found. Current classes before removal:", panel.className);
            panel.classList.remove('open');
            console.log("Panel classes after removal:", panel.className);
        } else {
            console.error("Could not find side panel element!");
        }
        this.sidePanelOpen = false;
        console.log("Side panel state set to closed.");
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

    fadeOutOtherObjects(selectedObject, duration = 0.5) {
        this.fadeInAllObjects(0); // Instantly restore any previously faded objects before starting new fade

        this.interactiveGroup.children.forEach(object => {
            if (object !== selectedObject && object.isGroup) { // Check interactive groups
                object.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(material => {
                            if (!this.originalMaterialStates.has(material)) {
                                // Store original state
                                this.originalMaterialStates.set(material, {
                                    originalOpacity: material.opacity,
                                    originalTransparent: material.transparent
                                });
                            }
                            // Make transparent and animate opacity to 0
                            material.transparent = true;
                            gsap.to(material, { opacity: 0.0, duration: duration, ease: "power1.inOut" });
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