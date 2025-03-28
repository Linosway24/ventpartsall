// DataTextureLoader class needed by RGBELoader

THREE.DataTextureLoader = class extends THREE.Loader {
	constructor(manager) {
		super(manager);
	}

	load(url, onLoad, onProgress, onError) {
		const scope = this;
		const texture = new THREE.DataTexture();

		const loader = new THREE.FileLoader(this.manager);
		loader.setResponseType('arraybuffer');
		loader.setRequestHeader(this.requestHeader);
		loader.setPath(this.path);
		loader.setWithCredentials(this.withCredentials);

		loader.load(url, function(buffer) {
			const texData = scope.parse(buffer);
			
			if (!texData) return;

			if (texData.image !== undefined) {
				texture.image = texData.image;
			} else if (texData.data !== undefined) {
				texture.image.width = texData.width;
				texture.image.height = texData.height;
				texture.image.data = texData.data;
			}

			texture.wrapS = texData.wrapS !== undefined ? texData.wrapS : THREE.ClampToEdgeWrapping;
			texture.wrapT = texData.wrapT !== undefined ? texData.wrapT : THREE.ClampToEdgeWrapping;

			texture.magFilter = texData.magFilter !== undefined ? texData.magFilter : THREE.LinearFilter;
			texture.minFilter = texData.minFilter !== undefined ? texData.minFilter : THREE.LinearMipmapLinearFilter;

			texture.anisotropy = texData.anisotropy !== undefined ? texData.anisotropy : 1;

			if (texData.colorSpace !== undefined) {
				texture.colorSpace = texData.colorSpace;
			} else if (texData.encoding !== undefined) {
				texture.encoding = texData.encoding;
			}

			if (texData.flipY !== undefined) {
				texture.flipY = texData.flipY;
			}

			if (texData.format !== undefined) {
				texture.format = texData.format;
			}

			if (texData.type !== undefined) {
				texture.type = texData.type;
			}

			if (texData.mipmaps !== undefined) {
				texture.mipmaps = texData.mipmaps;
				texture.minFilter = THREE.LinearMipmapLinearFilter;
			}

			if (texData.mipmapCount === 1) {
				texture.minFilter = THREE.LinearFilter;
			}

			if (texData.generateMipmaps !== undefined) {
				texture.generateMipmaps = texData.generateMipmaps;
			}

			texture.needsUpdate = true;

			if (onLoad) onLoad(texture, texData);
		}, onProgress, onError);

		return texture;
	}
}; 