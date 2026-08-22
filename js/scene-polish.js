(function () {
  if (window.__VISION_DUET_SCENE_POLISH__) return;
  window.__VISION_DUET_SCENE_POLISH__ = true;

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
    let amp = 0.55;
    let freq = 1;
    let total = 0;
    for (let i = 0; i < 5; i++) {
      value += valueNoise(x * freq, y * freq) * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return value / total;
  }

  function createStoneMaps(size) {
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
        const u = x / size;
        const v = y / size;
        const broad = fbm(u * 4.0, v * 4.0);
        const mid = fbm(u * 11.0 + 4.3, v * 11.0 - 2.7);
        const fine = fbm(u * 31.0 - 8.1, v * 31.0 + 6.4);
        const strata = Math.abs(Math.sin((v * 19.0 + broad * 5.0 + Math.sin(u * 8.0) * 0.65) * Math.PI));
        const folded = Math.abs(Math.sin((u * 8.0 + mid * 4.0) * Math.PI) * Math.cos((v * 7.0 - broad * 2.0) * Math.PI));
        const crackWave = Math.abs(Math.sin((u * 13.0 + v * 5.5 + mid * 3.0) * Math.PI));
        const crack = Math.pow(Math.max(0, 0.12 - crackWave) / 0.12, 2.4);

        let height = broad * 0.50 + mid * 0.24 + fine * 0.10 + strata * 0.10 + folded * 0.06;
        height = Math.max(0, Math.min(1, height));

        let shade = 44 + height * 112 + strata * 22 + folded * 18 - crack * 65;
        shade = Math.max(24, Math.min(178, shade));

        const i = (y * size + x) * 4;
        albedo.data[i] = Math.floor(shade * 0.82);
        albedo.data[i + 1] = Math.floor(shade * 0.87);
        albedo.data[i + 2] = Math.floor(shade * 0.92);
        albedo.data[i + 3] = 255;

        const bumpValue = Math.floor(Math.max(0, Math.min(1, height - crack * 0.25)) * 255);
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
    colorMap.repeat.set(3.1, 1.55);
    bumpMap.repeat.copy(colorMap.repeat);
    colorMap.anisotropy = 8;
    bumpMap.anisotropy = 8;

    if ('colorSpace' in colorMap && THREE.SRGBColorSpace) colorMap.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) colorMap.encoding = THREE.sRGBEncoding;

    return { colorMap: colorMap, bumpMap: bumpMap };
  }

  function createCurvedCavern(maps) {
    const width = 70;
    const height = 34;
    const geometry = new THREE.PlaneGeometry(width, height, 140, 68);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const u = (x + width / 2) / width;
      const v = (y + height / 2) / height;
      const curve = (x * x) / 118.0;
      const broad = fbm(u * 4.4, v * 4.4);
      const detail = fbm(u * 13.0 + 3.6, v * 13.0 - 2.1);
      const ledge = Math.sin((v * 9.0 + broad * 2.0) * Math.PI) * 0.55;
      const relief = (broad - 0.5) * 3.4 + (detail - 0.5) * 1.15 + ledge;
      positions.setZ(i, curve + relief);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: maps.colorMap,
      bumpMap: maps.bumpMap,
      bumpScale: 1.75,
      roughness: 0.96,
      metalness: 0.0,
      emissive: new THREE.Color('#1b2026'),
      emissiveMap: maps.colorMap,
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide
    });

    const wall = new THREE.Mesh(geometry, material);
    wall.name = 'vision-duet-curved-cavern';
    wall.position.set(23.5, 8.6, 0);
    wall.rotation.y = -Math.PI / 2;
    wall.receiveShadow = true;
    return wall;
  }

  function setMaterial(entity, values) {
    if (!entity) return;
    const current = entity.getAttribute('material') || {};
    entity.setAttribute('material', Object.assign({}, current, values));
  }

  function getConfiguredColor(car, componentName, fallback) {
    const data = car.getAttribute(componentName);
    return data && data.color ? data.color : fallback;
  }

  function styleMaterial(material, color, type) {
    if (!material) return;
    if (material.map) material.map = null;
    if (material.color) material.color.set(color);

    if (type === 'paint') {
      if ('metalness' in material) material.metalness = 0.22;
      if ('roughness' in material) material.roughness = 0.30;
      if ('envMapIntensity' in material) material.envMapIntensity = 0.82;
      if ('clearcoat' in material) material.clearcoat = 0.72;
      if ('clearcoatRoughness' in material) material.clearcoatRoughness = 0.13;
    } else if (type === 'trim') {
      if ('metalness' in material) material.metalness = 0.76;
      if ('roughness' in material) material.roughness = 0.24;
      if ('envMapIntensity' in material) material.envMapIntensity = 1.05;
    } else if (type === 'interior') {
      if ('metalness' in material) material.metalness = 0.02;
      if ('roughness' in material) material.roughness = 0.78;
      if ('envMapIntensity' in material) material.envMapIntensity = 0.22;
    }

    material.needsUpdate = true;
  }

  function syncConfiguratorMaterials(car) {
    if (!car || !car.object3D) return false;

    const exterior = getConfiguredColor(car, 'model-color__body', '#610000');
    const trim = getConfiguredColor(car, 'model-color__trim', '#c49c6c');
    const interior = getConfiguredColor(car, 'model-color__interior', '#f1e9df');
    let foundPaint = false;

    car.object3D.traverse(function (node) {
      if (!node.isMesh || !node.material) return;
      const name = (node.name || '').toLowerCase();
      const materials = Array.isArray(node.material) ? node.material : [node.material];

      if (name.indexOf('body_odi_carpaint') !== -1) {
        foundPaint = true;
        materials.forEach(function (m) { styleMaterial(m, exterior, 'paint'); });
      } else if (name.indexOf('bronze') !== -1 && name.indexOf('trim') !== -1) {
        materials.forEach(function (m) { styleMaterial(m, trim, 'trim'); });
      } else if (name.indexOf('alcantara') !== -1) {
        materials.forEach(function (m) { styleMaterial(m, interior, 'interior'); });
      }
    });

    return foundPaint;
  }

  function watchConfiguratorMaterials(car) {
    if (car.__visionDuetMaterialWatch) return;
    car.__visionDuetMaterialWatch = true;

    const sync = function () {
      window.requestAnimationFrame(function () { syncConfiguratorMaterials(car); });
    };

    car.addEventListener('model-loaded', sync);
    const observer = new MutationObserver(function (mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const name = mutations[i].attributeName || '';
        if (name.indexOf('model-color__') === 0) {
          sync();
          break;
        }
      }
    });
    observer.observe(car, { attributes: true });
    sync();
  }

  function addPointLight(parent, color, intensity, distance, position) {
    const light = document.createElement('a-light');
    light.setAttribute('type', 'point');
    light.setAttribute('color', color);
    light.setAttribute('intensity', String(intensity));
    light.setAttribute('distance', String(distance));
    light.setAttribute('decay', '2');
    light.setAttribute('position', position);
    parent.appendChild(light);
    return light;
  }

  function applyScenePolish() {
    const scene = document.querySelector('#scene1');
    const group = document.querySelector('#scene-fidelity-group');
    const car = document.querySelector('#merc');
    if (!scene || !group || !car) return false;
    if (!scene.object3D) return false;

    if (!scene.object3D.getObjectByName('vision-duet-curved-cavern')) {
      group.querySelectorAll('a-dodecahedron').forEach(function (rock) {
        rock.setAttribute('visible', false);
      });

      ['textured-cavern-wall', 'cavern-side-left', 'cavern-side-right'].forEach(function (name) {
        const old = scene.object3D.getObjectByName(name);
        if (old && old.parent) old.parent.remove(old);
      });

      const maps = createStoneMaps(512);
      scene.object3D.add(createCurvedCavern(maps));

      const floor = document.querySelector('#showroom-floor');
      const podiumBase = document.querySelector('#podium-base');
      const podiumTop = document.querySelector('#podium-top');
      const outerRing = document.querySelector('#podium-light-ring');
      const innerRing = document.querySelector('#podium-inner-ring');

      setMaterial(floor, { shader: 'standard', color: '#07090c', metalness: 0.34, roughness: 0.30 });
      if (floor) {
        floor.setAttribute('showroom-lightmap', 'mode: floor; intensity: 0.55; warm: false');
        floor.setAttribute('showroom-reflections', 'intensity: 0.72');
      }

      setMaterial(podiumBase, { shader: 'standard', color: '#050607', metalness: 0.58, roughness: 0.24 });
      if (podiumBase) podiumBase.setAttribute('showroom-reflections', 'intensity: 0.82');

      setMaterial(podiumTop, { shader: 'standard', color: '#0e1115', metalness: 0.52, roughness: 0.25 });
      if (podiumTop) {
        podiumTop.setAttribute('showroom-lightmap', 'mode: radial; intensity: 0.52; warm: false');
        podiumTop.setAttribute('showroom-reflections', 'intensity: 0.95');
      }

      setMaterial(outerRing, {
        shader: 'standard', color: '#fffdf8', emissive: '#fff8e7', emissiveIntensity: 2.6,
        metalness: 0.05, roughness: 0.14
      });
      setMaterial(innerRing, {
        shader: 'standard', color: '#7f8995', emissive: '#6d7886', emissiveIntensity: 0.28,
        metalness: 0.26, roughness: 0.32
      });

      const lights = group.querySelectorAll('a-light');
      if (lights[0]) lights[0].setAttribute('intensity', '0.08');
      if (lights[1]) { lights[1].setAttribute('intensity', '0.58'); lights[1].setAttribute('color', '#eef3ff'); }
      if (lights[2]) { lights[2].setAttribute('intensity', '0.46'); lights[2].setAttribute('color', '#9fb8db'); }
      if (lights[3]) { lights[3].setAttribute('intensity', '1.25'); lights[3].setAttribute('color', '#e8a85e'); }
      if (lights[4]) { lights[4].setAttribute('intensity', '0.48'); lights[4].setAttribute('color', '#e8eef8'); }

      addPointLight(group, '#d8e2ee', 1.75, 42, '6 14 -11');
      addPointLight(group, '#8fa6c4', 1.35, 40, '8 8 13');
      addPointLight(group, '#ffb05b', 1.55, 30, '6 4 8');
      addPointLight(group, '#8eabdb', 0.82, 30, '3 7 -10');

      scene.setAttribute('fog', 'type: exponential; color: #080b0f; density: 0.0028');

      const player = document.querySelector('#player');
      const camera = document.querySelector('#camera_1');
      if (player) {
        player.setAttribute('position', '-40.5 4.55 0.2');
        player.setAttribute('rotation', '0.6 -87.2 0');
      }
      if (camera) camera.setAttribute('camera', 'active: true; fov: 37');

      car.setAttribute('showroom-reflections', 'intensity: 0.82; tune: false');

      const setExposure = function () {
        if (scene.renderer) scene.renderer.toneMappingExposure = 0.86;
      };
      setExposure();
      scene.addEventListener('renderstart', setExposure, { once: true });

      document.documentElement.setAttribute('data-scene-polish', 'curved-cavern-v3');
    }

    watchConfiguratorMaterials(car);
    syncConfiguratorMaterials(car);
    return true;
  }

  function boot(attempt) {
    if (applyScenePolish()) return;
    if (attempt < 160) window.setTimeout(function () { boot(attempt + 1); }, 75);
  }

  // Start immediately. This makes the polish independent of whether the script
  // arrives before or after DOMContentLoaded/load.
  boot(0);
  document.addEventListener('DOMContentLoaded', function () { boot(0); }, { once: true });
  window.addEventListener('load', function () { boot(0); }, { once: true });
})();