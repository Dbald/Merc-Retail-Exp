/**
 * Specifies an envMap on an entity, without replacing any existing material
 * properties.
 */
AFRAME.registerComponent('camera-cube-env', {
  schema: {
        resolution: { type:'number', default: 128},
        distance: {type:'number', default: 100000},
        interval: { type:'number', default: 1000},
        repeat: { type:'boolean', default: false}
      },

      /**
       * Set if component needs multiple instancing.
       */
      multiple: false,

      /**
       * Called once when component is attached. Generally for initial setup.
       */
      init: function(){
        this.counter = this.data.interval;
        this.cam = new THREE.CubeCamera( 1.0, this.data.distance, this.data.resolution);
        
        this.cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
        this.cam.renderTarget.texture.generateMipmaps = true;
        this.el.object3D.add( this.cam );

        this.done = false;
        var myCam = this.cam;
        var myEl = this.el;
        var myMesh = this.el.getObject3D('mesh');

        document.querySelector('a-scene').addEventListener('loaded', function (myCam, myEl, myMesh) {
          if(myMesh){
            myMesh.traverse( function( child ) { 
              if ( child instanceof THREE.Mesh ) {
                child.material.envMap = myCam.renderTarget.texture;
                child.material.needsUpdate = true;
              }
            });
          }
        });      
          
      },
      
      tick: function(t,dt){
        var myCam = this.cam;
        if(!this.done){
          if( this.counter > 0){
            this.counter-=dt;
          }else{
            this.mesh = this.el.getObject3D('mesh');
            
            if(this.mesh){
                this.mesh.visible = false;
                AFRAME.scenes[0].renderer.autoClear = true;
                // getWorldPosition FIX
                myCam.position.copy(this.el.object3D.worldToLocal(this.el.object3D.getWorldPosition(myCam.position)));
                myCam.update( AFRAME.scenes[0].renderer, this.el.sceneEl.object3D );

                this.mesh.traverse( function( child ) { 
                    if ( child instanceof THREE.Mesh ){
                      child.material.envMap = myCam.renderTarget.texture;
                      child.material.needsUpdate = true;
                    }
                });
                this.mesh.visible = true;
            
                if(!this.data.repeat){
                  this.done = true;
                  this.counter = this.data.interval;
                }
            }
          }
        }
      },
      
      /**
       * Called when component is attached and when component data changes.
       * Generally modifies the entity based on the data.
       */
      update: function (oldData) {
          this.counter = this.data.interval;
          this.cam = new THREE.CubeCamera( 1.0, this.data.distance, this.data.resolution);
          this.cam.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
          this.el.object3D.add( this.cam );
          this.done = false;
          var myCam = this.cam;
          
          this.mesh = this.el.getObject3D('mesh');
          if(this.mesh){
            this.mesh.traverse( function( child ) { 
                if ( child instanceof THREE.Mesh ) {
                  child.material.envMap = myCam.renderTarget.texture;
                  myCam.renderTarget.texture.generateMipmaps = true;
                  child.material.needsUpdate = true;
                }
            });
          }
      },

      /**
       * Called when a component is removed (e.g., via removeAttribute).
       * Generally undoes any modifications made by the component.
       */
      remove: function () {},

      pause: function () { },
      play: function () { }
    });

// camera-cube-env.js is parsed synchronously in <head>. Inject the second-pass
// scene treatment synchronously too, so its DOMContentLoaded/load handlers are
// registered before either event can fire. The previous dynamic loader could
// arrive after both events, leaving only the first-pass faceted rocks visible.
document.write('<script src="js/scene-polish.js?v=20260822-1621" data-scene-polish="true"></' + 'script>');

// Preserve the selected exterior paint color under the environment map. The
// first reflection pass pushed body metalness/env intensity high enough that
// burgundy could read as silver/white. This runs after the model is available
// and whenever its material tree is rebuilt.
(function registerPaintPreservation() {
  function tunePaint() {
    var car = document.querySelector('#merc');
    if (!car || !car.object3D) return false;

    var foundBody = false;
    car.object3D.traverse(function (node) {
      if (!node.isMesh || !node.material) return;
      var materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(function (material) {
        if (!material) return;
        var materialName = ((material.name || '') + ' ' + (node.name || '')).toLowerCase();
        if (materialName.indexOf('carpaint') !== -1 || materialName.indexOf('body_odi') !== -1) {
          foundBody = true;
          if ('roughness' in material) material.roughness = 0.27;
          if ('metalness' in material) material.metalness = 0.28;
          if ('envMapIntensity' in material) material.envMapIntensity = 0.92;
          material.needsUpdate = true;
        }
      });
    });
    return foundBody;
  }

  function boot(attempt) {
    if (tunePaint()) return;
    if (attempt < 100) window.setTimeout(function () { boot(attempt + 1); }, 100);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var car = document.querySelector('#merc');
    if (car) car.addEventListener('model-loaded', function () { boot(0); });
    boot(0);
  });
})();