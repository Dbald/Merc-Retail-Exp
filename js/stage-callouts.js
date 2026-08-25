/**
 * Stage callouts and turntable indicator.
 *
 * The approved render shows each configurator callout tethered to the part it
 * edits by a thin leader line. Because the car is on a slow turntable, those
 * anchors cannot be hard-coded in CSS -- they are projected every frame from
 * the real mesh the category writes to, so a leader always points at the
 * surface the swatches are about to repaint.
 *
 * Everything here degrades quietly: if A-Frame, the scene camera or the model
 * is unavailable the hotspots keep their static CSS positions and no lines are
 * drawn.
 */
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var HOTSPOT_RADIUS = 14.5;
  var VIEW_COUNT = 7;
  var VIEW_STEP = 360 / 7;

  // Mesh each category recolors, the local-space nudge that moves the anchor on
  // to a visible face, and where the label floats relative to that anchor.
  var CALLOUTS = {
    interior: {
      mesh: 'FronSeatUpper_odi_ALCANTARA_FrontSeatUpper_0',
      lift: 0.35,
      labelOffset: [-128, -88],
      fallbackAnchor: [0.42, 0.42]
    },
    exterior: {
      mesh: 'Body_odi_CARPAINT_Red_0',
      lift: 0.34,
      labelOffset: [94, -40],
      fallbackAnchor: [0.50, 0.40]
    },
    trim: {
      mesh: 'Star_BronzeTrim_0',
      lift: 0.2,
      labelOffset: [242, 82],
      fallbackAnchor: [0.24, 0.55]
    }
  };

  var stage, svg, car, sceneEl, dots;
  var entries = [];
  var anchorCache = {};
  var scratch = null;
  var failures = 0;
  var running = false;
  var manualView = -1;

  function el(tag, className) {
    var node = document.createElementNS(SVG_NS, tag);
    node.setAttribute('class', className);
    return node;
  }

  function collect() {
    stage = document.querySelector('.stage-copy');
    svg = document.querySelector('#callout-lines');
    car = document.querySelector('#merc');
    sceneEl = document.querySelector('#scene1');
    dots = Array.prototype.slice.call(document.querySelectorAll('.view-dot'));
    if (!stage || !svg) return false;

    entries = Object.keys(CALLOUTS).map(function (category) {
      var hotspot = document.querySelector('.hotspot[data-category="' + category + '"]');
      if (!hotspot) return null;
      var line = el('line', 'callout-line');
      var anchor = el('circle', 'callout-anchor');
      anchor.setAttribute('r', '6');
      svg.appendChild(line);
      svg.appendChild(anchor);
      return {
        category: category,
        config: CALLOUTS[category],
        hotspot: hotspot,
        line: line,
        anchor: anchor,
        placed: false
      };
    }).filter(Boolean);

    return entries.length > 0;
  }

  /** World-space anchor point for a category, or null while the model loads. */
  function anchorWorld(entry) {
    var THREE = window.AFRAME && AFRAME.THREE;
    if (!THREE || !car || !car.object3D) return null;

    var cached = anchorCache[entry.category];
    if (!cached) {
      var mesh = car.object3D.getObjectByName(entry.config.mesh);
      if (!mesh || !mesh.geometry) return null;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      var box = mesh.geometry.boundingBox;
      if (!box) return null;
      // Local centre, nudged up the mesh so the leader lands on a lit face
      // rather than buried inside the volume.
      var local = new THREE.Vector3(
        (box.min.x + box.max.x) / 2,
        (box.min.y + box.max.y) / 2 + (box.max.y - box.min.y) * entry.config.lift,
        (box.min.z + box.max.z) / 2
      );
      cached = anchorCache[entry.category] = { mesh: mesh, local: local };
    }

    if (!scratch) scratch = new THREE.Vector3();
    scratch.copy(cached.local);
    cached.mesh.updateWorldMatrix(true, false);
    return cached.mesh.localToWorld(scratch);
  }

  function activeCamera() {
    if (sceneEl && sceneEl.camera) return sceneEl.camera;
    var camEl = document.querySelector('#camera_1');
    return (camEl && camEl.getObject3D && camEl.getObject3D('camera')) || null;
  }

  function drawIdle(entry, stageRect) {
    // Hand the hotspot back to its CSS position before measuring it, otherwise
    // a stale projected offset would anchor the fallback line.
    if (entry.placed) {
      entry.hotspot.style.left = '';
      entry.hotspot.style.top = '';
      entry.placed = false;
    }
    var fx = entry.config.fallbackAnchor[0] * stageRect.width;
    var fy = entry.config.fallbackAnchor[1] * stageRect.height;
    paint(entry, fx, fy, null);
  }

  /**
   * Place one callout. `anchor` in stage-local pixels; when `labelPoint` is null
   * the hotspot keeps whatever position CSS gave it.
   */
  function paint(entry, ax, ay, labelPoint) {
    var hx, hy;
    if (labelPoint) {
      hx = labelPoint[0];
      hy = labelPoint[1];
      entry.hotspot.style.left = (hx - HOTSPOT_RADIUS) + 'px';
      entry.hotspot.style.top = (hy - HOTSPOT_RADIUS) + 'px';
      entry.placed = true;
    } else {
      var box = entry.hotspot.getBoundingClientRect();
      var stageBox = stage.getBoundingClientRect();
      hx = box.left - stageBox.left + HOTSPOT_RADIUS;
      hy = box.top - stageBox.top + HOTSPOT_RADIUS;
    }

    var dx = ax - hx;
    var dy = ay - hy;
    var length = Math.sqrt(dx * dx + dy * dy);
    var isActive = entry.hotspot.classList.contains('active');

    // Nothing worth drawing if the anchor sits under the callout itself.
    if (!isFinite(length) || length < HOTSPOT_RADIUS + 14) {
      entry.line.setAttribute('opacity', '0');
      entry.anchor.setAttribute('opacity', '0');
      return;
    }

    var startX = hx + (dx / length) * (HOTSPOT_RADIUS + 3);
    var startY = hy + (dy / length) * (HOTSPOT_RADIUS + 3);
    var endX = ax - (dx / length) * 7;
    var endY = ay - (dy / length) * 7;

    entry.line.setAttribute('x1', startX.toFixed(1));
    entry.line.setAttribute('y1', startY.toFixed(1));
    entry.line.setAttribute('x2', endX.toFixed(1));
    entry.line.setAttribute('y2', endY.toFixed(1));
    entry.line.setAttribute('opacity', '1');
    entry.anchor.setAttribute('cx', ax.toFixed(1));
    entry.anchor.setAttribute('cy', ay.toFixed(1));
    entry.anchor.setAttribute('opacity', '1');

    entry.line.classList.toggle('active', isActive);
    entry.anchor.classList.toggle('active', isActive);
  }

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  function updateDots() {
    if (!dots.length || !car || !car.object3D) return;
    var index = manualView;
    if (index < 0) {
      // The turntable animation sweeps heading from 0 to -360 degrees.
      var heading = -(car.object3D.rotation.y * 180 / Math.PI);
      heading = ((heading % 360) + 360) % 360;
      index = Math.round(heading / VIEW_STEP) % VIEW_COUNT;
    }
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === index);
    }
  }

  function frame() {
    if (!running) return;
    try {
      var stageRect = stage.getBoundingClientRect();
      if (stageRect.width > 0) {
        svg.setAttribute('viewBox', '0 0 ' + stageRect.width + ' ' + stageRect.height);

        var camera = activeCamera();
        var canvas = sceneEl && sceneEl.canvas;
        var canvasRect = canvas && canvas.getBoundingClientRect();
        var projectable = camera && canvasRect && canvasRect.width > 0;

        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var world = projectable ? anchorWorld(entry) : null;
          if (!world) {
            drawIdle(entry, stageRect);
            continue;
          }

          var ndc = world.project(camera);
          // Behind the camera: fall back rather than drawing a mirrored line.
          if (ndc.z > 1) {
            drawIdle(entry, stageRect);
            continue;
          }

          var ax = (ndc.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left - stageRect.left;
          var ay = (-ndc.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top - stageRect.top;
          var offset = entry.config.labelOffset;
          var lx = clamp(ax + offset[0], 70, stageRect.width - 110);
          var ly = clamp(ay + offset[1], 96, stageRect.height - 70);
          paint(entry, ax, ay, [lx, ly]);
        }
      }
      updateDots();
      failures = 0;
    } catch (error) {
      // A projection hiccup must never take the configurator down; give it a
      // few frames to recover, then settle for the static CSS layout.
      if (++failures > 12) {
        running = false;
        entries.forEach(function (entry) {
          entry.hotspot.style.left = '';
          entry.hotspot.style.top = '';
          entry.placed = false;
          entry.line.setAttribute('opacity', '0');
          entry.anchor.setAttribute('opacity', '0');
        });
        return;
      }
    }
    window.requestAnimationFrame(frame);
  }

  function bindDots() {
    if (!dots.length) return;
    dots.forEach(function (dot, index) {
      dot.addEventListener('click', function () {
        if (!car || !car.object3D) return;
        var animation = car.components && car.components.animation;
        if (manualView === index) {
          // Second click on the current view hands the turntable back.
          manualView = -1;
          if (animation && animation.resumeAnimation) animation.resumeAnimation();
          return;
        }
        manualView = index;
        if (animation && animation.pauseAnimation) animation.pauseAnimation();
        car.setAttribute('rotation', '0 ' + (-(index * VIEW_STEP)).toFixed(3) + ' 0');
        updateDots();
      });
    });
  }

  function start() {
    if (running || !collect()) return;
    bindDots();
    running = true;
    window.requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', start);
  window.addEventListener('load', start);
})();
