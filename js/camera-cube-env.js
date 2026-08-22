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

// The scene treatment now starts its own retry loop as soon as this asset loads,
// so it no longer depends on DOMContentLoaded/load timing. A versioned URL keeps
// deploy previews deterministic while we finish the art-direction pass.
(function loadScenePolish() {
  if (document.querySelector('script[data-scene-polish-v3]')) return;
  var script = document.createElement('script');
  script.src = 'js/scene-polish.js?v=20260822-1628';
  script.async = true;
  script.setAttribute('data-scene-polish-v3', 'true');
  script.onload = function () {
    document.documentElement.setAttribute('data-scene-polish-loader', 'loaded-v3');
  };
  document.head.appendChild(script);
})();