class App {
    constructor() {
        this.container = document.getElementById('scene-container');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1c2430);
        
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
        
        // Add mouse event listeners
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('mouseout', this.hideTooltip.bind(this));
        this.container.addEventListener('click', this.onClick.bind(this));
        
        // Add a separate event for the side panel - using right-click
        this.container.addEventListener('contextmenu', this.onRightClick.bind(this));
        
        // Setup GUI
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
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(5, 5, 5);
        this.scene.add(mainLight);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        this.scene.add(gridHelper);

        // Add position marker (red sphere)
        const markerGeometry = new THREE.SphereGeometry(0.2, 32, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.positionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.positionMarker.position.set(5, 0, 0); // Example position - right side
        this.scene.add(this.positionMarker);
    }
    
    setupGUI() {
        // Create GUI
        this.gui = new dat.GUI();
        
        // Add controls
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
        // Load ventilator
        this.loader.load('assets/ventilator.glb', (gltf) => {
            const ventilator = gltf.scene;
            
            // Get ventilator size
            const ventBox = new THREE.Box3().setFromObject(ventilator);
            const ventSize = ventBox.getSize(new THREE.Vector3());
            
            // Scale ventilator
            const scale = (this.camera.top * 2 * 0.8) / ventSize.y;
            ventilator.scale.setScalar(scale);
            
            // Position ventilator on the left
            ventilator.position.set(-10, 0, 0);
            
            // Add name property for identification in raycasting
            ventilator.name = 'Ventilator Unit';
            
            // Add tooltip data
            ventilator.userData.tooltipText = 'Main ventilator device providing respiratory support';
            
            // Save original transform data for animation
            ventilator.userData.originalPosition = ventilator.position.clone();
            ventilator.userData.originalScale = ventilator.scale.clone();
            ventilator.userData.originalRotation = ventilator.rotation.clone();
            
            this.scene.add(ventilator);
            
            // Create bounding box for ventilator (green)
            this.createBoundingBox(ventilator, 0x00ff00);
            
            // Now load the tube
            this.loader.load('assets/VentilatorTube-WhitePlastic.glb', (gltf) => {
                const tube = gltf.scene;
                
                // Scale tube to be smaller than ventilator
                tube.scale.setScalar(scale * 0.1125); // 75% of previous size (0.15 * 0.75 = 0.1125)
                
                // Position tube with visible padding from the top of the screen
                // and 5 units from the ventilator horizontally
                tube.position.set(-2, 4, 0); // Moved further right to avoid hitting ventilator
                
                // Add name property for identification in raycasting
                tube.name = 'Ventilator Tube';
                
                // Add tooltip data
                tube.userData.tooltipText = 'Flexible breathing tube for patient ventilation';
                
                // Save original transform data for animation
                tube.userData.originalPosition = tube.position.clone();
                tube.userData.originalScale = tube.scale.clone();
                tube.userData.originalRotation = tube.rotation.clone();
                
                this.scene.add(tube);
                
                // Create bounding box for tube (blue)
                this.createBoundingBox(tube, 0x0000ff);
            }, undefined, (error) => {
                console.error('Error loading tube:', error);
            });
            
        }, undefined, (error) => {
            console.error('Error loading ventilator:', error);
        });
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 15; // Increased to accommodate both models
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
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
            // Store original position
            const originalPos = new THREE.Vector3(2, 1.5, 0);
            
            // Apply rotation
            this.zoomedModel.rotation.y += this.rotationSpeed;
            
            // Reset position to ensure it doesn't move during rotation
            this.zoomedModel.position.set(originalPos.x, originalPos.y, originalPos.z);
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    // Handle mouse movement for tooltip
    onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all objects intersecting the ray
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
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
        // Reset all object materials to their original state
        this.scene.traverse((object) => {
            if (object.userData && object.userData.isHighlighted) {
                // Get all meshes in the object and its children
                object.traverse((child) => {
                    if (child.isMesh && child.userData.originalMaterial) {
                        // Restore original material
                        child.material = child.userData.originalMaterial;
                        delete child.userData.originalMaterial;
                    }
                });
                
                object.userData.isHighlighted = false;
            }
        });
        
        // Apply highlighting to the hovered object
        if (hoveredObject) {
            hoveredObject.userData.isHighlighted = true;
            
            // Get all meshes in the object and its children
            hoveredObject.traverse((child) => {
                if (child.isMesh) {
                    // Store original material if not already stored
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                        
                        // Create a clone of the material
                        const highlightMaterial = child.material.clone();
                        
                        // Apply highlight effect (subtle emissive glow)
                        highlightMaterial.emissive = new THREE.Color(0x333333);
                        
                        // Apply the highlight material
                        child.material = highlightMaterial;
                    }
                }
            });
        }
    }

    // Handle click events
    onClick(event) {
        // Calculate mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            // Find the top-level model
            let model = object;
            while (model && model.parent !== this.scene) {
                model = model.parent;
            }
            
            // Nothing was found
            if (!model) return;
            
            // Handle animations for the tube
            if (model.name === 'Ventilator Tube') {
                // Check if we're already zoomed in
                if (this.isZoomed) {
                    // If zoomed in, zoom out
                    this.zoomOut();
                } else {
                    // If not zoomed in, zoom in
                    this.zoomIn(model);
                }
                
                // Show the side panel after a slight delay
                setTimeout(() => {
                    this.showSidePanel(model);
                }, 300);
            } else {
                // For other models, just show the side panel without animation
                this.showSidePanel(model);
            }
        }
    }
    
    // Zoom in on a model
    zoomIn(model) {
        if (this.isZoomed) return;
        
        // Set zoom state
        this.isZoomed = true;
        this.zoomedModel = model;
        
        // Hide tooltip
        this.hideTooltip();
        
        // Hide bounding boxes during zoom
        this.boundingBoxes.forEach(box => {
            if (box) {
                box.visible = false;
            }
        });
        
        // Determine target position (center of screen, but 1.5 units higher)
        const targetPosition = new THREE.Vector3(2, 1.5, 0); // Moved to the right and higher
        
        // Determine target scale (reduced slightly to ensure full visibility)
        const targetScale = model.scale.clone().multiplyScalar(1.75); // Reduced from 2.0 to 1.75
        
        // Use GSAP to animate ONLY the tube's position and scale
        gsap.to(model.position, {
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                // Start rotating the model once it's in position
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
        
        // Stop the rotation
        this.isRotating = false;
        
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
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling to container
            this.closeSidePanel();
        });
        
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

    // Show side panel without affecting other behavior
    showSidePanel(model) {
        const panel = document.getElementById('side-panel');
        
        // Update the panel information
        this.updateSidePanelInfo(model);
        
        // Show the panel
        panel.classList.add('open');
        this.sidePanelOpen = true;
    }

    // Close side panel
    closeSidePanel() {
        const panel = document.getElementById('side-panel');
        panel.classList.remove('open');
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
        
        // Find intersections
        const sideIntersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (sideIntersects.length > 0) {
            const object = sideIntersects[0].object;
            
            // Find the top-level model
            let model = object;
            while (model && model.parent !== this.scene) {
                model = model.parent;
            }
            
            // If we found a model, show its info
            if (model) {
                this.showSidePanel(model);
            }
        }
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
    });
}); 