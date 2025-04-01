class App {
    constructor() {
        this.container = document.getElementById('scene-container');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1c2430); // Restore dark blue background
        
        // Calculate orthographic camera frustum
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 15; // Increased to accommodate both models
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 20);

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
        this.showBoundingBoxes = true;
        this.interactiveGroup = new THREE.Group(); // Define group before listeners
        this.scene.add(this.interactiveGroup);
        // --- End early definitions ---

        this.setupLights();

        // Setup GLTF loader
        this.loader = new THREE.GLTFLoader();
        
        // Store loaded model reference
        this.loadedModel = null;
        
        // Store bounding boxes
        this.boundingBoxes = [];
        
        // Flag to toggle bounding box visibility
        this.showBoundingBoxes = true;
        
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
        this.modelsToLoad = 8; // Updated count to include the Power Adapter
        this.modelsLoadedCount = 0; // How many have loaded
        this.modelsReady = false; // Flag to enable interactions
        // --- End model loading state ---

        // --- Add light dimming factors --- 
        // Already defined earlier, remove or comment out these redundant lines
        // this.ambientDimFactor = 0.2; // Default dim factor for ambient light
        // this.directionalDimFactor = 0.1; // Default dim factor for directional light
        // --- End light dimming factors ---
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

        // Keep Grid Helper and Marker
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        this.scene.add(gridHelper);
        const markerGeometry = new THREE.SphereGeometry(0.2, 32, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.positionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.positionMarker.position.set(5, 0, 0);
        this.scene.add(this.positionMarker);
    }
    
    setupGUI() {
        // Create GUI, but don't auto-place it
        this.gui = new dat.GUI({ autoPlace: false });
        
        // Hide GUI by default
        this.gui.domElement.style.display = 'none';
        
        // Manually add the GUI to the container
        this.container.appendChild(this.gui.domElement);
        
        // --- Bounding Box Control (Existing) ---
        const params = {
            showBoundingBoxes: this.showBoundingBoxes
        };
        
        this.gui.add(params, 'showBoundingBoxes')
            .name('Show Bounding Boxes')
            .onChange(value => {
                this.showBoundingBoxes = value;
                this.boundingBoxes.forEach(box => {
                    if (box) {
                        box.visible = value;
                    }
                });
            });

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
    
    // Helper method to create a bounding box for a model
    createBoundingBox(object, color = 0x00ff00) {
        // Remove any existing bounding box for this object
        this.removeBoundingBox(object);
        
        // Create a new bounding box
        const box = new THREE.Box3().setFromObject(object);
        const helper = new THREE.Box3Helper(box, color);
        
        // Store reference to the original object with the helper
        helper.userData.targetObject = object;
        
        // Store reference to the helper
        object.userData.boundingBoxHelper = helper;
        this.boundingBoxes.push(helper);
        
        // Add to scene
        this.scene.add(helper);
        
        return helper;
    }
    
    // Helper method to remove a bounding box
    removeBoundingBox(object) {
        if (object.userData.boundingBoxHelper) {
            this.scene.remove(object.userData.boundingBoxHelper);
            
            // Remove from bounding boxes array
            const index = this.boundingBoxes.indexOf(object.userData.boundingBoxHelper);
            if (index !== -1) {
                this.boundingBoxes.splice(index, 1);
            }
            
            object.userData.boundingBoxHelper = null;
        }
    }
    
    // Toggle all bounding boxes
    toggleBoundingBoxes() {
        this.showBoundingBoxes = !this.showBoundingBoxes;
        
        this.boundingBoxes.forEach(box => {
            if (box) {
                box.visible = this.showBoundingBoxes;
            }
        });
    }

    loadModels() {
        // --- Add counter function ---
        const onModelLoad = (model) => {
            // Log material types used by the model
            console.log(`Checking materials for: ${model.name}`);
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Log material type for each mesh
                    console.log(`  - Mesh: ${child.name || '(no name)'}, Material Type: ${child.material.type}`);
                    // If multiple materials, log them all
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat, index) => {
                            console.log(`    - Material[${index}]: ${mat.type}`);
                        });
                    } else {
                        // Already logged single material type above
                    }
                }
            });

            this.interactiveGroup.add(model); // Add to interactive group
            this.modelsLoadedCount++;
            if (this.modelsLoadedCount === this.modelsToLoad) {
                this.modelsReady = true;
                console.log("All models loaded and ready for interaction.");
            }
        };
        // --- End counter function ---

        // Load ventilator
        this.loader.load('assets/ventilator.glb', (gltf) => {
            const ventilator = gltf.scene; // Use local const again
            
            // Get ventilator size
            const ventBox = new THREE.Box3().setFromObject(ventilator);
            const ventSize = ventBox.getSize(new THREE.Vector3());
            
            // Scale ventilator
            const scale = (this.camera.top * 2 * 0.8) / ventSize.y;
            ventilator.scale.setScalar(scale);
            
            // Position ventilator with minimal left padding
            ventilator.position.set(-15, 0, 0); // Further left
            
            // Add name property for identification in raycasting
            ventilator.name = 'Ventilator Unit';
            
            // Add tooltip data
            ventilator.userData.tooltipText = 'Main ventilator device providing respiratory support';
            
            // Save original transform data for animation
            ventilator.userData.originalPosition = ventilator.position.clone();
            ventilator.userData.originalScale = ventilator.scale.clone();
            ventilator.userData.originalRotation = ventilator.rotation.clone();
            
            // Create bounding box for ventilator (green)
            this.createBoundingBox(ventilator, 0x00ff00);

            onModelLoad(ventilator); // Call the counter function
            
            // Now load the tube
            this.loader.load('assets/VentilatorTube-WhitePlastic.glb', (gltf) => {
                const tube = gltf.scene; // Use local const again
                
                // Scale tube to be smaller than ventilator
                // Use the 'scale' calculated for the ventilator
                tube.scale.setScalar(scale * 0.1125); 
                
                // Position tube relative to ventilator
                tube.position.set(-9, 4, 0); // Further left
                
                // Add name property for identification in raycasting
                tube.name = 'Ventilator Tube';
                
                // Add tooltip data
                tube.userData.tooltipText = 'Flexible breathing tube for patient ventilation';
                
                // Save original transform data for animation
                tube.userData.originalPosition = tube.position.clone();
                tube.userData.originalScale = tube.scale.clone();
                tube.userData.originalRotation = tube.rotation.clone();
                
                // Create bounding box for tube (blue)
                this.createBoundingBox(tube, 0x0000ff);

                onModelLoad(tube); // Call the counter function

            }, undefined, (error) => {
                console.error('Error loading tube:', error);
            });
            
            // Load the HEPA filter
            this.loader.load('assets/HeppaAttachment-2025.glb', (gltf) => {
                const hepaMesh = gltf.scene; // The actual mesh/scene object
                const hepaFilterGroup = new THREE.Group(); // Create a parent group

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(hepaMesh);
                const center = box.getCenter(new THREE.Vector3());

                // Offset the mesh position so its center is at the group's origin (0,0,0)
                hepaMesh.position.sub(center);

                // Add the centered mesh to the group
                hepaFilterGroup.add(hepaMesh);

                // --- Apply scale and position to the GROUP --- 
                hepaFilterGroup.scale.setScalar(scale * 0.3); // Apply 30% scale to the group
                // Set group position for HEPA filter
                hepaFilterGroup.position.set(-3, 3, 0); // Restore HEPA filter position

                // --- Assign userData to the GROUP --- 
                hepaFilterGroup.name = 'HEPA Filter Attachment';
                hepaFilterGroup.userData.tooltipText = 'High-Efficiency Particulate Air filter attachment';

                // Save original transform data for the GROUP
                hepaFilterGroup.userData.originalPosition = hepaFilterGroup.position.clone(); // Update original position
                hepaFilterGroup.userData.originalScale = hepaFilterGroup.scale.clone();
                hepaFilterGroup.userData.originalRotation = hepaFilterGroup.rotation.clone(); // Use group's initial rotation
                
                // Create bounding box for the GROUP (let's use yellow)
                this.createBoundingBox(hepaFilterGroup, 0xffff00); 

                // Add the GROUP to the interactive scene using the counter
                onModelLoad(hepaFilterGroup);

            }, undefined, (error) => {
                console.error('Error loading HEPA filter:', error);
            });
            
            // Load the Halyard Attachment Tube
            this.loader.load('assets/HalyardAttachmentTube.glb', (gltf) => {
                const halyardMesh = gltf.scene; // The actual mesh/scene object
                const halyardGroup = new THREE.Group(); // Create a parent group

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(halyardMesh);
                const center = box.getCenter(new THREE.Vector3());

                // Offset the mesh position so its center is at the group's origin (0,0,0)
                halyardMesh.position.sub(center);

                // Add the centered mesh to the group
                halyardGroup.add(halyardMesh);

                // Create an invisible box to improve raycaster detection
                const boxGeometry = new THREE.BoxGeometry(15, 5, 5); // Larger dimensions
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);

                // Add the invisible box to the group
                halyardGroup.add(invisibleBox);

                // --- Apply scale and position to the GROUP --- 
                halyardGroup.scale.setScalar(20.0); // Original scale
                halyardGroup.position.set(7, 3, 0); // Move to x=7

                // --- Assign userData to the GROUP --- 
                halyardGroup.name = 'Halyard Attachment Tube';
                halyardGroup.userData.tooltipText = 'Halyard attachment tube for ventilation';

                // Save original transform data for the GROUP
                halyardGroup.userData.originalPosition = halyardGroup.position.clone();
                halyardGroup.userData.originalScale = halyardGroup.scale.clone();
                halyardGroup.userData.originalRotation = halyardGroup.rotation.clone(); // Use group's initial rotation
                
                // Create bounding box for the GROUP (let's use cyan)
                this.createBoundingBox(halyardGroup, 0x00ffff); 

                // Add the GROUP to the interactive scene using the counter
                onModelLoad(halyardGroup);
                console.log('Halyard Attachment Tube added to interactiveGroup:', halyardGroup);

                // Verify bounding box
                const halyardBox = new THREE.Box3().setFromObject(halyardGroup);
                console.log('Halyard Attachment Tube bounding box dimensions:', halyardBox.getSize(new THREE.Vector3()));
                console.log('Halyard Attachment Tube bounding box:', halyardBox);

            }, undefined, (error) => {
                console.error('Error loading Halyard Attachment Tube:', error);
            });
            
            // Load the PulseOx model
            console.log('Starting to load PulseOx model...');
            this.loader.load('assets/PulseOx.glb', (gltf) => {
                console.log('PulseOx model loaded successfully:', gltf);
                const pulseOxMesh = gltf.scene;
                console.log('PulseOx mesh:', pulseOxMesh);

                // Debug mesh structure
                pulseOxMesh.traverse((child) => {
                    if (child.isMesh) {
                        console.log('Found mesh:', child);
                        console.log('Geometry:', child.geometry);
                        console.log('Material:', child.material);
                        console.log('Vertices:', child.geometry.attributes.position.count);
                    }
                });

                const pulseOxGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(pulseOxMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('PulseOx bounding box:', box);
                console.log('PulseOx center:', center);

                // Center the mesh
                pulseOxMesh.position.sub(center);
                pulseOxGroup.add(pulseOxMesh);

                // Add invisible box for better raycasting
                const boxGeometry = new THREE.BoxGeometry(20, 10, 10); // Larger dimensions for better detection
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                pulseOxGroup.add(invisibleBox);

                // Scale and position
                pulseOxGroup.scale.setScalar(0.2); // Much smaller scale
                pulseOxGroup.position.set(17, 3, 5); // Position further right
                pulseOxGroup.rotation.y = Math.PI/2; // Rotate 90 degrees around Y axis
                pulseOxGroup.rotation.x = Math.PI/4; // Tilt 45 degrees away from camera
                console.log('PulseOx final position:', pulseOxGroup.position);
                console.log('PulseOx final scale:', pulseOxGroup.scale);
                console.log('PulseOx final rotation:', pulseOxGroup.rotation);

                // Debug final structure
                console.log('Final PulseOx structure:');
                pulseOxGroup.traverse((child) => {
                    console.log('Child:', child.type, child.name, child.visible);
                });

                // Add metadata
                pulseOxGroup.name = 'Pulse Oximeter';
                pulseOxGroup.userData.tooltipText = 'Pulse oximeter for monitoring oxygen saturation';
                pulseOxGroup.userData.originalPosition = pulseOxGroup.position.clone();
                pulseOxGroup.userData.originalScale = pulseOxGroup.scale.clone();
                pulseOxGroup.userData.originalRotation = pulseOxGroup.rotation.clone();

                // Create bounding box (magenta)
                this.createBoundingBox(pulseOxGroup, 0xff00ff);
                console.log('PulseOx bounding box created');

                // Ensure visibility
                pulseOxGroup.visible = true;
                pulseOxMesh.visible = true;
                console.log('Visibility set:', pulseOxGroup.visible, pulseOxMesh.visible);

                onModelLoad(pulseOxGroup);
                console.log('PulseOx added to scene and ready');

            }, 
            // Add progress callback
            (xhr) => {
                console.log('PulseOx loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading PulseOx:', error);
            });
            
            // Load the Glbeck humid vent
            console.log('Starting to load Glbeck humid vent model...');
            this.loader.load('assets/Gibeck Humid-Vent (1).glb', (gltf) => {
                console.log('Glbeck humid vent model loaded successfully:', gltf);
                const humidVentMesh = gltf.scene;
                console.log('Glbeck humid vent mesh:', humidVentMesh);

                const humidVentGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(humidVentMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('Glbeck humid vent bounding box:', box);
                console.log('Glbeck humid vent center:', center);

                // Center the mesh
                humidVentMesh.position.sub(center);
                humidVentGroup.add(humidVentMesh);

                // Add invisible box for better raycaster detection
                const boxGeometry = new THREE.BoxGeometry(5, 2, 2); // Smaller dimensions to match model
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                humidVentGroup.add(invisibleBox);

                // Scale and position
                humidVentGroup.scale.setScalar(scale * 20.0); // Much larger scale
                humidVentGroup.position.set(-9, -3.5, 0); // Move up to -3.5
                humidVentGroup.rotation.y = Math.PI/2 + Math.PI/4; // Keep rotation
                console.log('Glbeck humid vent final position:', humidVentGroup.position);
                console.log('Glbeck humid vent final scale:', humidVentGroup.scale);
                console.log('Glbeck humid vent final rotation:', humidVentGroup.rotation);

                // Add metadata
                humidVentGroup.name = 'Glbeck Humid Vent';
                humidVentGroup.userData.tooltipText = 'Humidification vent for patient comfort';
                humidVentGroup.userData.originalPosition = humidVentGroup.position.clone();
                humidVentGroup.userData.originalScale = humidVentGroup.scale.clone();
                humidVentGroup.userData.originalRotation = humidVentGroup.rotation.clone();

                // Create bounding box (orange)
                this.createBoundingBox(humidVentGroup, 0xffa500);
                console.log('Glbeck humid vent bounding box created');

                // Ensure visibility
                humidVentGroup.visible = true;
                humidVentMesh.visible = true;
                console.log('Visibility set:', humidVentGroup.visible, humidVentMesh.visible);

                onModelLoad(humidVentGroup);
                console.log('Glbeck humid vent added to scene and ready');

            }, 
            // Add progress callback
            (xhr) => {
                console.log('Glbeck humid vent loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading Glbeck humid vent:', error);
            });
            
            // Load the Oxygen Regulator
            console.log('Starting to load Oxygen Regulator model...');
            this.loader.load('assets/Oxygen Regulator.glb', (gltf) => {
                console.log('Oxygen Regulator model loaded successfully:', gltf);
                const oxygenRegulatorMesh = gltf.scene;
                console.log('Oxygen Regulator mesh:', oxygenRegulatorMesh);

                const oxygenRegulatorGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(oxygenRegulatorMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('Oxygen Regulator bounding box:', box);
                console.log('Oxygen Regulator center:', center);

                // Center the mesh
                oxygenRegulatorMesh.position.sub(center);
                oxygenRegulatorGroup.add(oxygenRegulatorMesh);

                // Add invisible box for better raycaster detection
                const boxGeometry = new THREE.BoxGeometry(5, 2, 2); // Smaller dimensions to match model
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                oxygenRegulatorGroup.add(invisibleBox);

                // Scale and position
                oxygenRegulatorGroup.scale.setScalar(scale * 20.0); // Same scale as Glbeck
                oxygenRegulatorGroup.position.set(-3, -3.5, 0); // Same Y as Glbeck, different X
                oxygenRegulatorGroup.rotation.y = Math.PI/2 + Math.PI/4; // Same rotation as Glbeck
                console.log('Oxygen Regulator final position:', oxygenRegulatorGroup.position);
                console.log('Oxygen Regulator final scale:', oxygenRegulatorGroup.scale);
                console.log('Oxygen Regulator final rotation:', oxygenRegulatorGroup.rotation);

                // Add metadata
                oxygenRegulatorGroup.name = 'Oxygen Regulator';
                oxygenRegulatorGroup.userData.tooltipText = 'Oxygen flow regulator for controlling oxygen delivery';
                oxygenRegulatorGroup.userData.originalPosition = oxygenRegulatorGroup.position.clone();
                oxygenRegulatorGroup.userData.originalScale = oxygenRegulatorGroup.scale.clone();
                oxygenRegulatorGroup.userData.originalRotation = oxygenRegulatorGroup.rotation.clone();

                // Create bounding box (purple)
                this.createBoundingBox(oxygenRegulatorGroup, 0x800080);
                console.log('Oxygen Regulator bounding box created');

                // Ensure visibility
                oxygenRegulatorGroup.visible = true;
                oxygenRegulatorMesh.visible = true;
                console.log('Visibility set:', oxygenRegulatorGroup.visible, oxygenRegulatorMesh.visible);

                onModelLoad(oxygenRegulatorGroup);
                console.log('Oxygen Regulator added to scene and ready');

            }, 
            // Add progress callback
            (xhr) => {
                console.log('Oxygen Regulator loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading Oxygen Regulator:', error);
            });
            
            // Load the Test Lung
            console.log('Starting to load Test Lung model...');
            this.loader.load('assets/Test Lung 210-2025 1.glb', (gltf) => {
                console.log('Test Lung model loaded successfully:', gltf);
                const testLungMesh = gltf.scene;
                console.log('Test Lung mesh:', testLungMesh);

                const testLungGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(testLungMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('Test Lung bounding box:', box);
                console.log('Test Lung center:', center);

                // Center the mesh
                testLungMesh.position.sub(center);
                testLungGroup.add(testLungMesh);

                // Add invisible box for better raycaster detection
                const boxGeometry = new THREE.BoxGeometry(5, 2, 2); // Smaller dimensions to match model
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                testLungGroup.add(invisibleBox);

                // Scale and position
                testLungGroup.scale.setScalar(scale * 0.2); // Reduced from 0.5 to 0.2
                testLungGroup.position.set(3, -3.5, 0); // To the right of Oxygen Regulator
                testLungGroup.rotation.y = Math.PI/2 + Math.PI/4; // Same rotation as other models
                console.log('Test Lung final position:', testLungGroup.position);
                console.log('Test Lung final scale:', testLungGroup.scale);
                console.log('Test Lung final rotation:', testLungGroup.rotation);

                // Add metadata
                testLungGroup.name = 'Test Lung';
                testLungGroup.userData.tooltipText = 'Test lung for ventilator calibration and testing';
                testLungGroup.userData.originalPosition = testLungGroup.position.clone();
                testLungGroup.userData.originalScale = testLungGroup.scale.clone();
                testLungGroup.userData.originalRotation = testLungGroup.rotation.clone();

                // Create bounding box (red)
                this.createBoundingBox(testLungGroup, 0xff0000);
                console.log('Test Lung bounding box created');

                // Ensure visibility
                testLungGroup.visible = true;
                testLungMesh.visible = true;
                console.log('Visibility set:', testLungGroup.visible, testLungMesh.visible);

                onModelLoad(testLungGroup);
                console.log('Test Lung added to scene and ready');

            }, 
            // Add progress callback
            (xhr) => {
                console.log('Test Lung loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading Test Lung:', error);
            });
            
            // Load the Green Oxygen Hose
            console.log('Starting to load Green Oxygen Hose model...');
            this.loader.load('assets/Green Oxygen Hose.glb', (gltf) => {
                console.log('Green Oxygen Hose model loaded successfully:', gltf);
                const greenOxygenHoseMesh = gltf.scene;
                console.log('Green Oxygen Hose mesh:', greenOxygenHoseMesh);

                const greenOxygenHoseGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(greenOxygenHoseMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('Green Oxygen Hose bounding box:', box);
                console.log('Green Oxygen Hose center:', center);

                // Center the mesh
                greenOxygenHoseMesh.position.sub(center);
                greenOxygenHoseGroup.add(greenOxygenHoseMesh);

                // Add invisible box for better raycaster detection
                const boxGeometry = new THREE.BoxGeometry(0.025, 0.025, 0.025); // Reduced to half the previous size
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                greenOxygenHoseGroup.add(invisibleBox);

                // Scale and position
                greenOxygenHoseGroup.scale.setScalar(scale * 16.2); // Reduced by another 10% from 18.0
                greenOxygenHoseGroup.position.set(10, -3.5, 0); // Moved 2 units left from x=12
                greenOxygenHoseGroup.rotation.y = Math.PI/2 + Math.PI/4; // Keep existing rotation
                greenOxygenHoseGroup.rotation.x = Math.PI/4; // Add 45-degree forward rotation
                console.log('Green Oxygen Hose final position:', greenOxygenHoseGroup.position);
                console.log('Green Oxygen Hose final scale:', greenOxygenHoseGroup.scale);
                console.log('Green Oxygen Hose final rotation:', greenOxygenHoseGroup.rotation);

                // Add metadata
                greenOxygenHoseGroup.name = 'Green Oxygen Hose';
                greenOxygenHoseGroup.userData.tooltipText = 'Green oxygen hose for oxygen delivery';
                greenOxygenHoseGroup.userData.originalPosition = greenOxygenHoseGroup.position.clone();
                greenOxygenHoseGroup.userData.originalScale = greenOxygenHoseGroup.scale.clone();
                greenOxygenHoseGroup.userData.originalRotation = greenOxygenHoseGroup.rotation.clone();

                // Create bounding box (green)
                this.createBoundingBox(greenOxygenHoseGroup, 0x00ff00);
                console.log('Green Oxygen Hose bounding box created');

                // Ensure visibility
                greenOxygenHoseGroup.visible = true;
                greenOxygenHoseMesh.visible = true;
                console.log('Visibility set:', greenOxygenHoseGroup.visible, greenOxygenHoseMesh.visible);

                onModelLoad(greenOxygenHoseGroup);
                console.log('Green Oxygen Hose added to scene and ready');

            }, 
            (xhr) => {
                console.log('Green Oxygen Hose loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading Green Oxygen Hose:', error);
            });
            
            // Load the 731 Power Adapter
            console.log('Starting to load 731 Power Adapter model...');
            this.loader.load('assets/731%20Power%20Adapter.glb', (gltf) => {
                console.log('731 Power Adapter model loaded successfully:', gltf);
                const powerAdapterMesh = gltf.scene;
                console.log('731 Power Adapter mesh:', powerAdapterMesh);

                const powerAdapterGroup = new THREE.Group();

                // Calculate the center of the mesh
                const box = new THREE.Box3().setFromObject(powerAdapterMesh);
                const center = box.getCenter(new THREE.Vector3());
                console.log('731 Power Adapter bounding box:', box);
                console.log('731 Power Adapter center:', center);

                // Center the mesh
                powerAdapterMesh.position.sub(center);
                powerAdapterGroup.add(powerAdapterMesh);

                // Add invisible box for better raycaster detection
                const boxGeometry = new THREE.BoxGeometry(5, 2, 2);
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
                const invisibleBox = new THREE.Mesh(boxGeometry, boxMaterial);
                powerAdapterGroup.add(invisibleBox);

                // Scale and position - starting with larger scale since we can't see it
                powerAdapterGroup.scale.setScalar(scale * 0.121); // Increased by another 10% from 0.11
                powerAdapterGroup.position.set(18, -3.5, 0); // Moved 3 units right from x=15
                powerAdapterGroup.rotation.y = Math.PI/2 + Math.PI/4;
                powerAdapterGroup.rotation.x = Math.PI/4;

                // Add metadata
                powerAdapterGroup.name = '731 Power Adapter';
                powerAdapterGroup.userData.tooltipText = '731 Power Adapter for ventilator power supply';
                powerAdapterGroup.userData.originalPosition = powerAdapterGroup.position.clone();
                powerAdapterGroup.userData.originalScale = powerAdapterGroup.scale.clone();
                powerAdapterGroup.userData.originalRotation = powerAdapterGroup.rotation.clone();

                // Create bounding box (brown)
                this.createBoundingBox(powerAdapterGroup, 0x8B4513);

                // Add to scene BEFORE setting up visibility
                this.interactiveGroup.add(powerAdapterGroup);

                // Ensure visibility after adding to scene
                powerAdapterGroup.visible = true;
                powerAdapterMesh.visible = true;
                console.log('Power Adapter visibility:', powerAdapterGroup.visible, powerAdapterMesh.visible);
                console.log('Power Adapter parent:', powerAdapterGroup.parent);
                console.log('Power Adapter world position:', powerAdapterGroup.getWorldPosition(new THREE.Vector3()));

                onModelLoad(powerAdapterGroup);
                console.log('731 Power Adapter added to scene and ready');

            }, 
            (xhr) => {
                console.log('731 Power Adapter loading progress:', (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading 731 Power Adapter:', error);
            });
            
        }, undefined, (error) => {
            console.error('Error loading ventilator:', error);
        });
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 15; // Base frustum size
        
        // Update camera 
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

        // Update positions of all models in the interactive group
        if (this.interactiveGroup) {
            this.interactiveGroup.children.forEach(model => {
                if (model.userData.originalPosition) {
                    // If we're not zoomed in on this model, restore its original position
                    if (!this.isZoomed || this.zoomedModel !== model) {
                        model.position.copy(model.userData.originalPosition);
                    }
                }
            });
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Update bounding boxes if models have moved
        if (this.showBoundingBoxes) {
            this.boundingBoxes.forEach(box => {
                if (box && box.userData && box.userData.targetObject) {
                    // Force the box3 to recalculate
                    box.box.makeEmpty();
                    box.box.setFromObject(box.userData.targetObject);
                }
            });
        }
        
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
        
        // Debugging: Log intersected objects
        console.log('Intersected objects:', intersects.map(intersect => intersect.object.name));

        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            let model = object;
            // Stop climbing when the parent is the interactiveGroup
            while (model && model.parent !== this.interactiveGroup && model.parent !== this.scene) { 
                model = model.parent;
            }
            
            if (!model || model === this.interactiveGroup) return; // Skip if we didn't find a model or ended up at the group itself
            
            console.log('Clicked model:', model.name, model); 
            
            // Check if the clicked model is the Tube, HEPA Filter, Halyard Attachment Tube, or PulseOx
            if (model.name === 'Ventilator Tube' || model.name === 'HEPA Filter Attachment' || 
                model.name === 'Halyard Attachment Tube' || model.name === 'Pulse Oximeter' ||
                model.name === 'Glbeck Humid Vent' || model.name === 'Oxygen Regulator' ||
                model.name === 'Test Lung' || model.name === 'Green Oxygen Hose' ||
                model.name === '731 Power Adapter') {
                console.log(model.name + ' clicked. Zoom state:', this.isZoomed);
                if (this.isZoomed && this.zoomedModel === model) { // Only zoom out if it's the currently zoomed model
                    this.zoomOut();
                } else if (!this.isZoomed) { // Only zoom in if nothing is currently zoomed
                    this.zoomIn(model);
                }
                // Always show side panel, maybe after a delay if zooming in
                if (!this.isZoomed || (this.isZoomed && this.zoomedModel !== model)) {
                     // If zooming in or clicking a different model while zoomed, show panel after delay
                    setTimeout(() => { this.showSidePanel(model); }, 300); 
                } else {
                     // If zooming out, show panel immediately (or handle closing elsewhere)
                     this.showSidePanel(model);
                }
            } else {
                console.log('Other model clicked:', model.name);
                // If something else is zoomed, zoom out first
                if (this.isZoomed) {
                    this.zoomOut();
                }
                this.showSidePanel(model); // Show panel for non-zoomable models
            }
        } else {
             console.log('Clicked on empty space');
        }
    }
    
    // Zoom in on a model
    zoomIn(model) {
        if (this.isZoomed) return;
        
        this.isZoomed = true;
        this.zoomedModel = model;
        this.hideTooltip();
        this.boundingBoxes.forEach(box => { if (box) box.visible = false; });

        // --- Animate background dimming --- 
        // Removed background animation

        // --- Hide other objects ---
        // Removed hiding logic

        // --- Dim Lights (Existing) --- 
        // Removed light dimming animations
        /*
        if (this.ambientLight && this.mainLight) {
            // ... removed code ...
        }
        */
        // --- End Dim Lights ---
        
        // --- Activate Spotlight ---
        // Removed spotlight activation
        // --- End Activate Spotlight ---
        
        // Determine target position (center of screen, slightly forward)
        const targetPosition = new THREE.Vector3(0, 0, 5); // Center screen target
        
        // Determine target scale (increased for better visibility when zoomed)
        const targetScale = model.userData.originalScale.clone().multiplyScalar(1.875); // Reduced by 25% from 2.5
        
        // Use GSAP to animate ONLY the tube's position and scale
        gsap.to(model.position, {
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                this.isRotating = true;
            }
        });
        
        gsap.to(model.scale, {
            x: targetScale.x,
            y: targetScale.y,
            z: targetScale.z,
            duration: 1,
            ease: "power2.inOut"
        });
    }
    
    // Restore original view
    zoomOut() {
        if (!this.isZoomed || !this.zoomedModel) return;
        
        const model = this.zoomedModel;
        this.isRotating = false;
        
        // --- Restore background color ---
        // Removed background animation

        // --- Restore other objects ---
        // Removed object restoration logic

        // --- Restore Lights (Existing) --- 
        // Removed light restoration animations
        /*
        if (this.ambientLight && this.mainLight) {
            // ... removed code ... 
        }
        */
        // --- End Restore Lights ---
        
        // --- Deactivate Spotlight ---
        // Removed spotlight deactivation
        // --- End Deactivate Spotlight ---
        
        // Get original transform values
        const origPos = model.userData.originalPosition;
        const origScale = model.userData.originalScale;
        const origRot = model.userData.originalRotation;
        
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
                // Reset zoom state
                this.isZoomed = false;
                this.zoomedModel = null;

                // Close side panel if no model is zoomed in
                if (!this.isZoomed) {
                    this.closeSidePanel();
                }

                // Restore bounding box visibility
                if (this.showBoundingBoxes) {
                    this.boundingBoxes.forEach(box => {
                        if (box) {
                            box.visible = true;
                        }
                    });
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
            
            // --- ADD LISTENER LOGIC HERE ---
            const closeButton = panel.querySelector('#close-panel');
            if (closeButton && !closeButton.dataset.listenerAttached) {
                console.log("Attaching listener to close button inside showSidePanel");
                closeButton.addEventListener('click', (e) => {
                    console.log("Close button clicked (listener attached in showSidePanel)");
                    e.stopPropagation();
                    if (this.isZoomed && this.zoomedModel) {
                        console.log("Zoomed model detected, calling zoomOut()...");
                        this.zoomOut();
                    }
                    console.log("Calling closeSidePanel()...");
                    this.closeSidePanel();
                });
                closeButton.dataset.listenerAttached = 'true'; // Mark listener as attached
            }
             // --- END LISTENER LOGIC ---
             
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

    // --- Helper functions for dimming/restoring materials ---
    // Removed helper functions dimObjectMaterials and restoreObjectMaterials
    // --- End Helper functions ---

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
}

// Initialize the app when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    
    // Add key event listener to toggle bounding boxes
    window.addEventListener('keydown', (event) => {
        if (event.key === 'b' || event.key === 'B') {
            app.toggleBoundingBoxes();
        }
        if (event.key === 'g' || event.key === 'G') {
            app.toggleGUIVisibility();
        }
    });
}); 