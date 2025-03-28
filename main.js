class App {
    constructor() {
        this.container = document.getElementById('scene-container');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);
        
        // Calculate orthographic camera frustum
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,  // left
            frustumSize * aspect / 2,   // right
            frustumSize / 2,            // top
            frustumSize / -2,           // bottom
            0.1,                        // near
            1000                        // far
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

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Load the model
        this.loadModel();

        // Start animation loop
        this.animate();
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

    loadModel() {
        this.loader.load('assets/ventilator.glb', (gltf) => {
            const model = gltf.scene;
            
            // Get model size
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // Scale to fit viewport height
            const scale = (this.camera.top * 2 * 0.8) / size.y;  // 80% of viewport height
            model.scale.setScalar(scale);
            
            // Position model on the left
            model.position.set(-10, 0, 0);
            
            this.scene.add(model);
            
        }, undefined, (error) => {
            console.error('Error loading model:', error);
        });
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 10;
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the app when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new App();
}); 