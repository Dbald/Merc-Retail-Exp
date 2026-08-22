/**
 * Specifies an envMap on an entity, without replacing any existing material
 * properties.
 */
AFRAME.registerComponent('camera-cube-env', {
  schema: {
    resolution: { type: 'number', default: 128 },
    distance: { type: 'number', default: 100000 },
    interval: { type: 'number', default: 1000 },
    repeat: { type: 'boolean', default: false }
  },

  multiple: false,

  init: function () {
    this.counter = this.data.interval;
    this.cam = new THREE.CubeCamera(1.0, this.data.distance, this.data.resolution);
    this.cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
    this.cam.renderTarget.texture.generateMipmaps = true;
    this.el.object3D.add(this.cam);
    this.done = false;
  },

  tick: function (t, dt) {
    var myCam = this.cam;
    if (this.done) return;

    if (this.counter > 0) {
      this.counter -= dt;
      return;
    }

    this.mesh = this.el.getObject3D('mesh');
    if (!this.mesh) return;

    this.mesh.visible = false;
    AFRAME.scenes[0].renderer.autoClear = true;
    myCam.position.copy(this.el.object3D.worldToLocal(this.el.object3D.getWorldPosition(myCam.position)));
    myCam.update(AFRAME.scenes[0].renderer, this.el.sceneEl.object3D);

    this.mesh.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        var materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(function (material) {
          if (!material) return;
          material.envMap = myCam.renderTarget.texture;
          material.needsUpdate = true;
        });
      }
    });

    this.mesh.visible = true;
    if (!this.data.repeat) this.done = true;
    this.counter = this.data.interval;
  },

  update: function () {
    this.counter = this.data.interval;
    this.done = false;
  },

  remove: function () {},
  pause: function () {},
  play: function () {}
});

// Load the showroom treatment first, then the presentation-camera layer. Both
// scripts have their own retry loops, so the behavior stays deterministic even
// when the GLTF finishes after the page shell.
(function loadVisionDuetPresentation() {
  if (document.querySelector('script[data-scene-polish-v3]')) return;

  var polish = document.createElement('script');
  polish.src = 'js/scene-polish.js?v=20260822-1628';
  polish.async = true;
  polish.setAttribute('data-scene-polish-v3', 'true');

  polish.onload = function () {
    document.documentElement.setAttribute('data-scene-polish-loader', 'loaded-v3');

    if (document.querySelector('script[data-focus-camera-v1]')) return;
    var focus = document.createElement('script');
    focus.src = 'js/focus-camera.js?v=20260822-1642';
    focus.async = true;
    focus.setAttribute('data-focus-camera-v1', 'true');
    focus.onload = function () {
      document.documentElement.setAttribute('data-focus-camera-loader', 'loaded-v1');
    };
    document.head.appendChild(focus);
  };

  document.head.appendChild(polish);
})();
