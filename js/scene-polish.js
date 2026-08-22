(function () {
  const THREE = AFRAME.THREE;

  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function valueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep(x - x0);
    const ty = smoothstep(y - y0);
    const a = hash2(x0, y0);
    const b = hash2(x0 + 1, y0);
    const c = hash2(x0, y0 + 1);
    const d = hash2(x0 + 1, y0 + 1);
    const ab = a + (b - a) * tx;
    const cd = c + (d - c) * tx;
    return ab + (cd - ab) * ty;
  }

  function fbm(x, y) {
    let value = 0;
    let amplitude = 0.55;
    let frequency = 1;
    let total = 0;
    for (let octave = 0; octave < 5; octave++) {
      value += valueNoise(x * frequency, y * frequency) * amplitude;
      total += amplitude;
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return value / total;
  }

  function createStoneTextures(size) {
    const albedoCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    albedoCanvas.width = albedoCanvas.height = size;
    bumpCanvas.width = bumpCanvas.height = size;

    const albedoCtx = albedoCanvas.getContext('2d');
    const bumpCtx = bumpCanvas.getContext('2d');
    const albedo = albedoCtx.createImageData(size, size);
    const bump = bumpCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size;
        const ny = y / size;
        const broad = fbm(nx * 5.2, ny * 5.2);
        const fine = fbm(nx * 18.0 + 11.3, ny * 18.0 - 7.4);
        const vein = Math.abs(Math.sin((nx * 7.2 + broad * 1.8) * Math.PI) * Math.cos((ny * 6.1 - fine) * Math.PI));
        const ridge = Math.pow(Math.max(0, 0.62 - Math.abs(broad - 0.5)), 1.5);
        const height = Math.min(1, Math.max(0, broad * 0.72 + fine * 0.20 + vein * 0.08));
        const shade = Math.floor(14 + height * 42 + ridge * 30);
        const i = (y * size + x) * 4;

        albedo.data[i] = Math.floor(shade * 0.78);
        albedo.data[i + 1] = Math.floor(shade * 0.84);
        albedo.data[i + 2] = Math.floor(shade * 0.90);
        albedo.data[i + 3] = 255;

        const bumpValue = Math.floor(height * 255);
        bump.data[i] = bumpValue;
        bump.data[i + 1] = bumpValue;
        bump.data[i + 2] = bumpValue;
        bump.data[i + 3] = 255;
      }
    }

    albedoCtx.putImageData(albedo, 0, 0);
    bumpCtx.putImageData(bump, 0, 0);

    const colorMap = new THREE.CanvasTexture(albedoCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(1.6, 1.15);
    bumpMap.repeat.copy(colorMap.repeat);
    colorMap.anisotropy = 4;
    bumpMap.anisotropy = 4;

    if ('colorSpace' in colorMap && THREE.SRGBColorSpace) colorMap.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) colorMap.encoding = THREE.sRGBEncoding;

    return { colorMap, bumpMap };
  }

  function createCavernWall(textures) {
    const geometry = new THREE.PlaneGeometry(54, 27, 84, 42);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const nx = (x + 27) / 54;
      const ny = (y + 13.5) / 27;
      const broad = fbm(nx * 4.2, ny * 4.2);
      const detail = fbm(nx * 13.0 + 2.7, ny * 13.0 - 1.8);
      const edgeFalloff = Math.sin(Math.min(1, nx) * Math.PI) * Math.sin(Math.min(1, ny) * Math.PI);
      const depth = ((broad - 0.5) * 2.9 + (detail - 0.5) * 0.85) * (0.65 + edgeFalloff * 0.55);
      positions.setZ(i, depth);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#252a30'),
      map: textures.colorMap,
      bumpMap: textures.bumpMap,
      bumpScale: 0.95,
      roughness: 0.94,
      metalness: 0.015,
      side: THREE.DoubleSide
    });

    const wall = new THREE.Mesh(geometry, material);
    wall.name = 'textured-cavern-wall';
    wall.position.set(22.5, 8.2, 0);
    wall.rotation.y = -Math.PI / 2;
    wall.receiveShadow = true;
    return wall;
  }

  function createSideWall(textures, side) {
    const geometry = new THREE.PlaneGeometry(31, 25, 44, 30);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const nx = (x + 15.5) / 31;
      const ny = (y + 12.5) / 25;
      const depth = (fbm(nx * 4.5 + side * 4.1, ny * 4.5) - 0.5) * 2.2;
      positions.setZ(i, depth);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#171b20'),
      map: textures.colorMap,
      bumpMap: textures.bumpMap,
      bumpScale: 0.7,
      roughness: 0.97,
      metalness: 0.01,
      side: THREE.DoubleSide
    });

    const wall = new THREE.Mesh(geometry, material);
    wall.name = side < 0 ? 'cavern-side-left' : 'cavern-side-right';
    wall.position.set(10.5, 7.0, side * 27.0);
    wall.rotation.y = side < 0 ? -0.92 : -2.22;
    wall.receiveShadow = true;
    return wall;
  }

  function setMaterial(entity, values) {
    if (!entity) return;
    const current = entity.getAttribute('material') || {};
    entity.setAttribute('material', Object.assign({}, current, values));
  }

  function applyScenePolish() {
    const scene = document.querySelector('#scene1');
    const group = document.querySelector('#scene-fidelity-group');
    const car = document.querySelector('#merc');
    if (!scene || !group || !car) return false;
    if (scene.object3D.getObjectByName('textured-cavern-wall')) return true;

    group.querySelectorAll('a-dodecahedron').forEach(rock => rock.setAttribute('visible', false));

    const textures = createStoneTextures(320);
    scene.object3D.add(createCavernWall(textures));
    scene.object3D.add(createSideWall(textures, -1));
    scene.object3D.add(createSideWall(textures, 1));

    const floor = document.querySelector('#showroom-floor');
    const podiumBase = document.querySelector('#podium-base');
    const podiumTop = document.querySelector('#podium-top');
    const outerRing = document.querySelector('#podium-light-ring');
    const innerRing = document.querySelector('#podium-inner-ring');

    setMaterial(floor, {
      shader: 'standard', color: '#090c10', metalness: 0.48, roughness: 0.24
    });
    floor && floor.setAttribute('showroom-lightmap', 'mode: floor; intensity: 0.82');
    floor && floor.setAttribute('showroom-reflections', 'intensity: 1.18');

    setMaterial(podiumBase, {
      shader: 'standard', color: '#050608', metalness: 0.76, roughness: 0.18
    });
    podiumBase && podiumBase.setAttribute('showroom-reflections', 'intensity: 1.35');

    setMaterial(podiumTop, {
      shader: 'standard', color: '#11151a', metalness: 0.68, roughness: 0.22
    });
    podiumTop && podiumTop.setAttribute('showroom-lightmap', 'mode: radial; intensity: 0.92; warm: false');
    podiumTop && podiumTop.setAttribute('showroom-reflections', 'intensity: 1.65');

    setMaterial(outerRing, {
      shader: 'standard', color: '#fffdf7', emissive: '#fff5df', emissiveIntensity: 3.0, metalness: 0.08, roughness: 0.12
    });
    setMaterial(innerRing, {
      shader: 'standard', color: '#98a2ad', emissive: '#8995a5', emissiveIntensity: 0.42, metalness: 0.32, roughness: 0.28
    });

    const lights = group.querySelectorAll('a-light');
    if (lights[0]) lights[0].setAttribute('intensity', '0.11');
    if (lights[1]) { lights[1].setAttribute('intensity', '0.82'); lights[1].setAttribute('color', '#f4f7ff'); }
    if (lights[2]) { lights[2].setAttribute('intensity', '0.72'); lights[2].setAttribute('color', '#9dbdff'); }
    if (lights[3]) { lights[3].setAttribute('intensity', '1.95'); lights[3].setAttribute('color', '#ffbd67'); }
    if (lights[4]) { lights[4].setAttribute('intensity', '0.68'); lights[4].setAttribute('color', '#eef3ff'); }
    if (lights[5]) lights[5].setAttribute('intensity', '0.42');
    if (lights[6]) lights[6].setAttribute('intensity', '0.38');

    const rearRim = document.createElement('a-light');
    rearRim.setAttribute('type', 'point');
    rearRim.setAttribute('color', '#ffb45d');
    rearRim.setAttribute('intensity', '2.2');
    rearRim.setAttribute('distance', '30');
    rearRim.setAttribute('decay', '2');
    rearRim.setAttribute('position', '8 4 8');
    group.appendChild(rearRim);

    const coolEdge = document.createElement('a-light');
    coolEdge.setAttribute('type', 'point');
    coolEdge.setAttribute('color', '#8fb6ff');
    coolEdge.setAttribute('intensity', '1.15');
    coolEdge.setAttribute('distance', '32');
    coolEdge.setAttribute('decay', '2');
    coolEdge.setAttribute('position', '5 8 -12');
    group.appendChild(coolEdge);

    scene.setAttribute('fog', 'type: exponential; color: #07090c; density: 0.0065');

    const player = document.querySelector('#player');
    const camera = document.querySelector('#camera_1');
    if (player) {
      player.setAttribute('position', '-39.5 4.6 0.4');
      player.setAttribute('rotation', '0.8 -87.2 0');
    }
    if (camera) camera.setAttribute('camera', 'active: true; fov: 38');

    car.setAttribute('showroom-reflections', 'intensity: 2.05; tune: true');

    if (scene.renderer) scene.renderer.toneMappingExposure = 0.91;
    scene.addEventListener('renderstart', function () {
      if (scene.renderer) scene.renderer.toneMappingExposure = 0.91;
    }, { once: true });

    return true;
  }

  function bootScenePolish(attempt) {
    if (applyScenePolish()) return;
    if (attempt < 80) window.setTimeout(() => bootScenePolish(attempt + 1), 100);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bootScenePolish(0);
  });
  window.addEventListener('load', function () {
    bootScenePolish(0);
  });
})();