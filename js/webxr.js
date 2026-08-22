// AFRAME Exporter for Blender - https://silverslade.itch.io/a-frame-blender-exporter

window.addEventListener('enter-vr', e => {
  if (AFRAME.utils.device.checkHeadsetConnected()) {
    if (document.getElementById("cursor")) {
      document.getElementById("cursor").remove();
    }
  }
});

// Components
AFRAME.registerComponent('toggle-handler', {
  schema: {
    target: { default: '#' }
  },
  init: function () {
    var data = this.data;
    var toggle_obj = document.getElementById(data.target);
    if (toggle_obj) {
      toggle_obj.setAttribute("visible", "false");
    }

    this.el.addEventListener('click', function () {
      var toggle_obj = document.getElementById(data.target);
      if (!toggle_obj) return;
      let value = toggle_obj.getAttribute("visible");
      toggle_obj.setAttribute("visible", value !== true);
    });
  }
});

AFRAME.registerComponent('link-handler', {
  schema: {
    target: { default: '#' }
  },
  init: function () {
    var data = this.data;
    this.el.addEventListener('click', function () {
      if (data.target !== "") {
        window.open(data.target);
      }
    });
  }
});

// click to jump next images
AFRAME.registerComponent('images-handler', {
  init: function () {
    this.el.addEventListener('click', function () {
      let value = this.getAttribute("src");
      this.setAttribute("src", value === "#image_1" ? "#image_2" : "#image_1");
    });
  }
});

// init function is called after onload event
function init() {
  var isMobile = AFRAME.utils.device.isMobile();
  if (isMobile) {
    // Reserved for mobile-specific behavior.
  }
}

/**
 * Specifies a light map on an entity, without replacing existing material properties.
 * Retained from the original project for compatibility with baked assets.
 */
AFRAME.registerComponent('light-map-geometry', {
  schema: {
    path: { default: '' },
    format: { default: 'RGBFormat' },
    intensity: { default: 1.0 }
  },

  init: function () {
    const data = this.data;
    this.texture = new THREE.TextureLoader().load(data.path);
    this.intensity = data.intensity;
    this.applyLightMap();
    this.el.addEventListener('object3dset', this.applyLightMap.bind(this));
  },

  applyLightMap: function () {
    const mesh = this.el.getObject3D('mesh');
    const lightMap = this.texture;
    if (!mesh || !lightMap) return;

    lightMap.flipY = false;
    const value = this.intensity;
    mesh.traverse(function (node) {
      if (node.geometry && node.geometry.attributes && node.geometry.attributes.uv && !node.geometry.attributes.uv2) {
        node.geometry.setAttribute('uv2', node.geometry.attributes.uv.clone());
      }
      if (node.material && 'lightMap' in node.material) {
        node.material.lightMap = lightMap;
        node.material.lightMapIntensity = value;
        node.material.needsUpdate = true;
      }
    });
  }
});

/**
 * Procedural light map for the new showroom floor and podium. The goal is to
 * keep the live WebXR scene lightweight while still producing the broad baked
 * illumination gradients visible in the approved concept render.
 */
AFRAME.registerComponent('showroom-lightmap', {
  schema: {
    intensity: { type: 'number', default: 1.35 },
    mode: { type: 'string', default: 'radial' },
    warm: { type: 'boolean', default: false }
  },

  init: function () {
    const THREE = AFRAME.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (this.data.mode === 'floor') {
      const gradient = ctx.createRadialGradient(256, 220, 24, 256, 256, 330);
      gradient.addColorStop(0, this.data.warm ? '#8b765a' : '#727987');
      gradient.addColorStop(0.28, '#343a42');
      gradient.addColorStop(0.62, '#15191e');
      gradient.addColorStop(1, '#050608');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
    } else {
      const gradient = ctx.createRadialGradient(256, 256, 28, 256, 256, 300);
      gradient.addColorStop(0, this.data.warm ? '#a88a5b' : '#727984');
      gradient.addColorStop(0.5, '#343941');
      gradient.addColorStop(0.82, '#171a1f');
      gradient.addColorStop(1, '#08090b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);

      // A soft outer ring makes the platform edge read like baked architectural light.
      ctx.strokeStyle = this.data.warm ? 'rgba(236, 199, 133, .62)' : 'rgba(226, 232, 240, .38)';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(256, 256, 222, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.flipY = false;
    this.texture.needsUpdate = true;
    this.applyLightMap = this.applyLightMap.bind(this);
    this.el.addEventListener('object3dset', this.applyLightMap);
    this.el.addEventListener('loaded', this.applyLightMap);
    requestAnimationFrame(this.applyLightMap);
  },

  applyLightMap: function () {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh || !this.texture) return;

    mesh.traverse(node => {
      if (!node.isMesh || !node.material) return;
      if (node.geometry && node.geometry.attributes && node.geometry.attributes.uv && !node.geometry.attributes.uv2) {
        node.geometry.setAttribute('uv2', node.geometry.attributes.uv.clone());
      }
      if ('lightMap' in node.material) {
        node.material.lightMap = this.texture;
        node.material.lightMapIntensity = this.data.intensity;
        node.material.needsUpdate = true;
      }
    });
  },

  remove: function () {
    if (this.texture) this.texture.dispose();
  }
});

/**
 * Uses the original six-face environment map to give the Vision Duet stronger
 * automotive reflections without changing the configurable material hooks.
 */
AFRAME.registerComponent('showroom-reflections', {
  schema: {
    intensity: { type: 'number', default: 1.6 },
    tune: { type: 'boolean', default: false }
  },

  init: function () {
    const THREE = AFRAME.THREE;
    this.apply = this.apply.bind(this);
    const urls = [
      './env/posx.jpg', './env/negx.jpg',
      './env/posy.jpg', './env/negy.jpg',
      './env/posz.jpg', './env/negz.jpg'
    ];

    this.texture = new THREE.CubeTextureLoader().load(urls, this.apply);
    if ('colorSpace' in this.texture && THREE.SRGBColorSpace) {
      this.texture.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      this.texture.encoding = THREE.sRGBEncoding;
    }

    this.el.addEventListener('model-loaded', this.apply);
    this.el.addEventListener('object3dset', this.apply);
    requestAnimationFrame(this.apply);
  },

  apply: function () {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh || !this.texture) return;

    mesh.traverse(node => {
      if (!node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        if (!material || !('envMap' in material)) return;
        material.envMap = this.texture;
        material.envMapIntensity = this.data.intensity;

        if (this.data.tune && 'roughness' in material) {
          const materialName = ((material.name || '') + ' ' + (node.name || '')).toLowerCase();
          if (materialName.includes('carpaint') || materialName.includes('body')) {
            material.roughness = 0.22;
            if ('metalness' in material) material.metalness = Math.max(material.metalness || 0, 0.55);
            material.envMapIntensity = 2.05;
          } else if (materialName.includes('bronze') || materialName.includes('trim') || materialName.includes('metal')) {
            material.roughness = 0.18;
            if ('metalness' in material) material.metalness = Math.max(material.metalness || 0, 0.82);
            material.envMapIntensity = 2.25;
          } else if (materialName.includes('glass') || materialName.includes('window')) {
            material.roughness = Math.min(material.roughness || 0.08, 0.12);
            material.envMapIntensity = 1.9;
          } else if (materialName.includes('alcantara') || materialName.includes('seat') || materialName.includes('interior')) {
            material.roughness = Math.max(material.roughness || 0.65, 0.65);
            material.envMapIntensity = 0.65;
          }
        }
        material.needsUpdate = true;
      });
    });
  }
});

function createShowroomEntity(tag, attributes, parent) {
  const el = document.createElement(tag);
  Object.keys(attributes || {}).forEach(name => el.setAttribute(name, attributes[name]));
  (parent || document.querySelector('#scene1')).appendChild(el);
  return el;
}

function installSceneFidelity() {
  const scene = document.querySelector('#scene1');
  const car = document.querySelector('#merc');
  if (!scene || !car || document.querySelector('#scene-fidelity-group')) return;

  // Retire the original showroom dressing while retaining it in the source tree.
  scene.querySelectorAll('a-gltf-model').forEach(model => {
    if (model.id !== 'merc') model.setAttribute('visible', false);
  });
  scene.querySelectorAll('a-circle').forEach(circle => circle.setAttribute('visible', false));
  const originalSky = scene.querySelector('a-sky');
  if (originalSky) originalSky.setAttribute('visible', false);

  scene.setAttribute('fog', 'type: exponential; color: #050609; density: 0.011');
  scene.setAttribute('background', 'color: #030405');

  // Cinematic renderer treatment.
  scene.addEventListener('renderstart', function () {
    const THREE = AFRAME.THREE;
    const renderer = scene.renderer;
    if (!renderer) return;
    if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }, { once: true });

  const group = createShowroomEntity('a-entity', { id: 'scene-fidelity-group' }, scene);

  // Deep neutral sky so the faceted rock wall is what the camera reads.
  createShowroomEntity('a-sky', {
    color: '#030405',
    radius: '75'
  }, group);

  // Reflective graphite floor.
  createShowroomEntity('a-plane', {
    id: 'showroom-floor',
    position: '3 -0.44 0',
    rotation: '-90 0 0',
    width: '92',
    height: '72',
    material: 'shader: standard; color: #080a0d; metalness: 0.34; roughness: 0.36',
    shadow: 'receive: true',
    'showroom-lightmap': 'mode: floor; intensity: 1.55',
    'showroom-reflections': 'intensity: 0.78'
  }, group);

  // Architectural podium: black base + polished upper deck + two illuminated rings.
  createShowroomEntity('a-cylinder', {
    id: 'podium-base',
    position: '0 -0.28 0',
    radius: '13.65',
    height: '0.48',
    segments: '96',
    material: 'shader: standard; color: #08090b; metalness: 0.62; roughness: 0.24',
    shadow: 'receive: true',
    'showroom-reflections': 'intensity: 1.12'
  }, group);

  createShowroomEntity('a-cylinder', {
    id: 'podium-top',
    position: '0 -0.02 0',
    radius: '13.28',
    height: '0.12',
    segments: '96',
    material: 'shader: standard; color: #171a1f; metalness: 0.72; roughness: 0.19',
    shadow: 'receive: true',
    'showroom-lightmap': 'mode: radial; intensity: 1.8; warm: true',
    'showroom-reflections': 'intensity: 1.4'
  }, group);

  createShowroomEntity('a-ring', {
    id: 'podium-light-ring',
    position: '0 0.055 0',
    rotation: '-90 0 0',
    'radius-inner': '13.08',
    'radius-outer': '13.26',
    segments: '128',
    material: 'shader: standard; color: #fff3da; emissive: #f0c884; emissiveIntensity: 2.4; metalness: 0.15; roughness: 0.18'
  }, group);

  createShowroomEntity('a-ring', {
    id: 'podium-inner-ring',
    position: '0 0.061 0',
    rotation: '-90 0 0',
    'radius-inner': '11.72',
    'radius-outer': '11.79',
    segments: '128',
    material: 'shader: standard; color: #89909a; emissive: #8792a1; emissiveIntensity: 0.65; metalness: 0.32; roughness: 0.25'
  }, group);

  // Soft contact shadow beneath the car keeps it grounded even on lower-end devices.
  createShowroomEntity('a-circle', {
    position: '0 0.075 0',
    rotation: '-90 0 0',
    radius: '1',
    scale: '8.3 4.4 1',
    material: 'shader: flat; color: #000000; transparent: true; opacity: 0.3; depthWrite: false'
  }, group);

  // Faceted cavern wall. Layered low-poly stone forms read as sculptural rock under soft light.
  const rocks = [
    ['20 6 -17', '9 10 8', '12 18 7', '#111319'],
    ['22 9 -9', '10 13 8', '-8 22 -5', '#0d0f13'],
    ['23 10 0', '11 15 9', '7 -12 11', '#121419'],
    ['22 8 10', '10 12 8', '-11 14 5', '#0c0e12'],
    ['20 6 18', '9 10 8', '8 -20 -8', '#111318'],
    ['27 17 -14', '12 10 10', '16 8 14', '#090b0e'],
    ['28 18 2', '13 12 11', '-14 -10 7', '#0b0d10'],
    ['27 16 17', '11 11 10', '9 19 -13', '#080a0d']
  ];

  rocks.forEach((rock, index) => {
    createShowroomEntity('a-dodecahedron', {
      class: 'cavern-rock',
      position: rock[0],
      scale: rock[1],
      rotation: rock[2],
      radius: '1',
      detail: '0',
      material: `shader: standard; color: ${rock[3]}; metalness: 0.04; roughness: ${index % 2 ? '0.91' : '0.84'}; flatShading: true`,
      shadow: 'receive: true'
    }, group);
  });

  // Side rock masses create depth and keep the eye centered on the vehicle.
  [
    ['9 4 -24', '7 12 9', '#090b0e'],
    ['10 3 24', '8 11 10', '#0b0d11'],
    ['3 8 -30', '10 15 8', '#07090b'],
    ['4 8 30', '10 14 9', '#080a0d']
  ].forEach((rock, index) => {
    createShowroomEntity('a-dodecahedron', {
      position: rock[0],
      scale: rock[1],
      rotation: index % 2 ? '13 32 -9' : '-9 -24 11',
      radius: '1',
      material: `shader: standard; color: ${rock[2]}; metalness: 0.02; roughness: 0.96; flatShading: true`,
      shadow: 'receive: true'
    }, group);
  });

  // Low cool ambience + warm automotive key/rim lights.
  createShowroomEntity('a-light', {
    type: 'ambient',
    color: '#71809a',
    intensity: '0.22'
  }, group);

  createShowroomEntity('a-light', {
    type: 'directional',
    color: '#fff5e7',
    intensity: '1.45',
    position: '-11 15 -8',
    'cast-shadow': 'true',
    shadow: 'camera: -22 22 22 -22 0.5 70; mapSize: 2048 2048; bias: -0.0008'
  }, group);

  createShowroomEntity('a-light', {
    type: 'point',
    color: '#dce8ff',
    intensity: '1.15',
    distance: '42',
    decay: '2',
    position: '-5 8 12'
  }, group);

  createShowroomEntity('a-light', {
    type: 'point',
    color: '#ffc879',
    intensity: '1.55',
    distance: '34',
    decay: '2',
    position: '7 5 -10'
  }, group);

  createShowroomEntity('a-light', {
    type: 'point',
    color: '#e9edf5',
    intensity: '1.2',
    distance: '32',
    decay: '2',
    position: '0 13 1'
  }, group);

  // Soft warm floor lights make the illuminated ring bounce onto the bodywork.
  createShowroomEntity('a-light', {
    type: 'point',
    color: '#d7aa62',
    intensity: '0.9',
    distance: '22',
    decay: '2',
    position: '-2 1.2 -9'
  }, group);
  createShowroomEntity('a-light', {
    type: 'point',
    color: '#d7aa62',
    intensity: '0.75',
    distance: '22',
    decay: '2',
    position: '4 1.2 9'
  }, group);

  // Car treatment: slightly elevated on the new platform with richer reflections and shadows.
  car.setAttribute('position', '0.049 0.16 0.169');
  car.setAttribute('shadow', 'cast: true; receive: false');
  car.setAttribute('showroom-reflections', 'intensity: 1.8; tune: true');
}

document.addEventListener('DOMContentLoaded', installSceneFidelity);
