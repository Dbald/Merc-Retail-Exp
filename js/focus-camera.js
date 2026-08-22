(function () {
  if (window.__VISION_DUET_FOCUS_CAMERA__) return;
  window.__VISION_DUET_FOCUS_CAMERA__ = true;

  const THREE = AFRAME.THREE;
  const worldUp = new THREE.Vector3(0, 1, 0);
  const localCenter = new THREE.Vector3();
  const worldCenter = new THREE.Vector3();
  const cameraWorld = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const target = new THREE.Vector3();

  let scene;
  let car;
  let player;
  let cameraEl;
  let localCenterReady = false;
  let desktopActive = true;
  let rafId = null;
  let desiredNdcX = 0;
  let desiredNdcY = 0;

  function updateCompositionTarget() {
    const stage = document.querySelector('.stage-copy');
    if (!stage) {
      desiredNdcX = 0;
      desiredNdcY = 0;
      return;
    }

    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;

    desiredNdcX = (centerX / window.innerWidth) * 2 - 1;
    desiredNdcY = 1 - (centerY / window.innerHeight) * 2;
  }

  function computeLocalVisualCenter() {
    if (!car || !car.object3D) return false;

    car.object3D.updateWorldMatrix(true, true);
    const inverseCarWorld = new THREE.Matrix4().copy(car.object3D.matrixWorld).invert();
    const box = new THREE.Box3();
    const nodeBox = new THREE.Box3();
    const relativeMatrix = new THREE.Matrix4();
    let foundMesh = false;

    car.object3D.traverse(function (node) {
      if (!node.isMesh || !node.geometry) return;
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if (!node.geometry.boundingBox) return;

      foundMesh = true;
      nodeBox.copy(node.geometry.boundingBox);
      relativeMatrix.copy(inverseCarWorld).multiply(node.matrixWorld);
      nodeBox.applyMatrix4(relativeMatrix);
      box.union(nodeBox);
    });

    if (!foundMesh || box.isEmpty()) return false;
    box.getCenter(localCenter);
    localCenterReady = true;
    return true;
  }

  function prepareDesktopCamera() {
    if (!cameraEl || !player) return;

    cameraEl.removeAttribute('look-controls');
    player.object3D.rotation.set(0, 0, 0);
    player.object3D.updateMatrixWorld(true);

    const camera = cameraEl.getObject3D('camera');
    if (camera) {
      camera.fov = 37;
      camera.updateProjectionMatrix();
    }
  }

  function frameCar() {
    if (!desktopActive || !localCenterReady || !car || !cameraEl || !player) return;

    // Scene-polish previously used a hard-coded yaw/pitch. Keep the camera rig
    // unrotated and aim the camera itself at the vehicle's true visual center.
    player.object3D.rotation.set(0, 0, 0);
    player.object3D.updateMatrixWorld(true);

    worldCenter.copy(localCenter);
    car.object3D.localToWorld(worldCenter);
    cameraEl.object3D.getWorldPosition(cameraWorld);

    forward.copy(worldCenter).sub(cameraWorld);
    const distance = forward.length();
    if (distance < 0.001) return;
    forward.normalize();

    right.copy(forward).cross(worldUp).normalize();
    up.copy(right).cross(forward).normalize();

    const camera = cameraEl.getObject3D('camera');
    const fov = camera && camera.fov ? camera.fov : 37;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    const halfWidth = halfHeight * aspect;

    // The visible product stage is not the center of the browser: the left rail
    // and right palette panel shift its optical center. Aim slightly past the car
    // by the equivalent world-space amount so the car lands in the stage center.
    target.copy(worldCenter)
      .addScaledVector(right, -desiredNdcX * halfWidth)
      .addScaledVector(up, -desiredNdcY * halfHeight);

    cameraEl.object3D.lookAt(target);
    cameraEl.object3D.updateMatrixWorld(true);
  }

  function loop() {
    frameCar();
    if (desktopActive) rafId = window.requestAnimationFrame(loop);
  }

  function startDesktopFocus() {
    if (!scene || !car || !player || !cameraEl) return;
    desktopActive = true;
    updateCompositionTarget();
    if (!localCenterReady && !computeLocalVisualCenter()) return;
    prepareDesktopCamera();
    if (rafId) window.cancelAnimationFrame(rafId);
    loop();
    document.documentElement.setAttribute('data-focus-camera', 'stage-centered');
  }

  function enterXR() {
    desktopActive = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = null;

    if (player) {
      // Face the vehicle when entering the headset while still allowing full
      // tracked head movement inside XR.
      player.object3D.rotation.set(0, THREE.MathUtils.degToRad(-90), 0);
      player.object3D.updateMatrixWorld(true);
    }

    if (cameraEl) {
      cameraEl.object3D.quaternion.identity();
      cameraEl.setAttribute('look-controls', 'mouseEnabled: false; touchEnabled: false; pointerLockEnabled: false');
    }
  }

  function exitXR() {
    if (cameraEl) {
      cameraEl.removeAttribute('look-controls');
      cameraEl.object3D.quaternion.identity();
    }
    window.requestAnimationFrame(startDesktopFocus);
  }

  function boot(attempt) {
    scene = document.querySelector('#scene1');
    car = document.querySelector('#merc');
    player = document.querySelector('#player');
    cameraEl = document.querySelector('#camera_1');

    if (!scene || !car || !player || !cameraEl || !car.getObject3D('mesh')) {
      if (attempt < 180) window.setTimeout(function () { boot(attempt + 1); }, 75);
      return;
    }

    computeLocalVisualCenter();
    startDesktopFocus();

    if (!scene.__visionDuetFocusEvents) {
      scene.__visionDuetFocusEvents = true;
      scene.addEventListener('enter-vr', enterXR);
      scene.addEventListener('exit-vr', exitXR);
      window.addEventListener('resize', function () {
        updateCompositionTarget();
        frameCar();
      });
    }

    if (!car.__visionDuetFocusModelEvent) {
      car.__visionDuetFocusModelEvent = true;
      car.addEventListener('model-loaded', function () {
        localCenterReady = false;
        computeLocalVisualCenter();
        startDesktopFocus();
      });
    }
  }

  boot(0);
})();
