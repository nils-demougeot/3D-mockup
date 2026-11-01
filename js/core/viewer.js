// Visionneuse 3D : rendu "studio photo", ombre de contact douce, caméra orbitale, export PNG
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/addons/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/VerticalBlurShader.js';
import { setMaxAnisotropy } from './textures.js';

export class Viewer {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.035).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.6;
    room.dispose?.();

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 2000);
    this.camera.position.set(0, 0, 100);

    // Lumière principale (avec ombres portées sur l'objet lui-même)
    const key = new THREE.DirectionalLight(0xfff8f0, 2.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 4;
    key.shadow.intensity = 0.6;
    scene.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    scene.add(rim, rim.target);
    this.rim = rim;

    this.root = new THREE.Group();
    scene.add(this.root);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.autoRotateSpeed = 1.6;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    this.controls = controls;
    controls.addEventListener('start', () => { this._tween = null; });

    this._initContactShadow();

    this.clock = new THREE.Timer();
    this.animators = new Set();
    this._resize = this.resize.bind(this);
    new ResizeObserver(this._resize).observe(container);
    this.resize();
    this._shadowDirty = true;
    renderer.setAnimationLoop(() => this._loop());
  }

  _initContactShadow() {
    const size = 512;
    this.csTarget = new THREE.WebGLRenderTarget(size, size);
    this.csTarget.texture.generateMipmaps = false;
    this.csBlurTarget = new THREE.WebGLRenderTarget(size, size);
    this.csBlurTarget.texture.generateMipmaps = false;
    const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
    this.csPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: this.csTarget.texture, opacity: 0.7, transparent: true, depthWrite: false, toneMapped: false }));
    this.csPlane.renderOrder = 1;
    this.csPlane.scale.y = -1;
    this.csGroup = new THREE.Group();
    this.csGroup.add(this.csPlane);
    this.csBlurPlane = new THREE.Mesh(planeGeo);
    this.csBlurPlane.visible = false;
    this.csGroup.add(this.csBlurPlane);
    this.scene.add(this.csGroup);
    this.csCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.csCamera.rotation.x = Math.PI / 2;
    this.csGroup.add(this.csCamera);
    const dm = new THREE.MeshDepthMaterial();
    dm.userData.darkness = { value: 1.4 };
    dm.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = dm.userData.darkness;
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'
      )}`;
    };
    dm.depthTest = false;
    dm.depthWrite = false;
    dm.side = THREE.DoubleSide;
    this.csDepthMat = dm;
    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
  }

  _blurShadow(amount) {
    const p = this.csBlurPlane;
    p.visible = true;
    p.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.csTarget.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    this.renderer.setRenderTarget(this.csBlurTarget);
    this.renderer.render(p, this.csCamera);
    p.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.csBlurTarget.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    this.renderer.setRenderTarget(this.csTarget);
    this.renderer.render(p, this.csCamera);
    p.visible = false;
  }

  _renderContactShadow() {
    const r = this.renderer;
    const prevBg = this.scene.background;
    const prevEnv = this.scene.environment;
    this.scene.background = null;
    this.scene.environment = null;
    this.csGroup.visible = false;
    const hidden = [];
    this.root.traverse((o) => { if (o.userData.noContactShadow && o.visible) { o.visible = false; hidden.push(o); } });
    this.scene.overrideMaterial = this.csDepthMat;
    const prevClear = r.getClearAlpha();
    r.setClearAlpha(0);
    r.setRenderTarget(this.csTarget);
    r.clear();
    this.csGroup.visible = true;
    this.csPlane.visible = false;
    r.render(this.scene, this.csCamera);
    this.scene.overrideMaterial = null;
    this._blurShadow(this._shadowBlur ?? 1.2);
    this._blurShadow((this._shadowBlur ?? 1.2) * 0.45);
    r.setRenderTarget(null);
    r.setClearAlpha(prevClear);
    this.csPlane.visible = true;
    hidden.forEach((o) => (o.visible = true));
    this.scene.background = prevBg;
    this.scene.environment = prevEnv;
  }

  setShadowOpacity(v) {
    this._shadowMul = v / 0.62;
    this.csPlane.material.opacity = (this._shadowBase ?? 0.62) * this._shadowMul;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Remplace l'objet affiché
  setObject(obj, { views = null, frame = true } = {}) {
    if (this.current) {
      this.root.remove(this.current);
    }
    this.current = obj;
    this.root.add(obj);
    obj.traverse((o) => {
      if (o.isMesh) {
        if (o.castShadow === false && o.userData.forceNoCast) return;
        o.castShadow = o.userData.castShadow !== false;
        o.receiveShadow = o.userData.receiveShadow !== false;
      }
    });
    this.updateBounds();
    if (frame) this.frame(views?.[0], false);
  }

  updateBounds() {
    if (!this.current) return;
    const box = new THREE.Box3();
    this.current.updateMatrixWorld(true);
    this.current.traverse((o) => {
      if (o.isMesh && o.visible && !o.userData.noBounds) {
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    this.box = box;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = size.length() / 2;
    this.radius = radius;
    this.center = center;
    // plan d'ombre de contact
    const st = this.current.userData.shadow || {};
    const gap = radius * (st.gap ?? 0.04);
    this._shadowBlur = st.blur ?? 1.2;
    this._shadowBase = st.opacity ?? 0.62;
    this.csPlane.material.opacity = this._shadowBase * (this._shadowMul ?? 1);
    const s = Math.max(size.x, size.z) * 1.9 + radius * 0.6;
    this.csGroup.position.set(center.x, box.min.y - gap, center.z);
    this.csPlane.scale.set(s, -1, s);
    this.csBlurPlane.scale.set(s, 1, s);
    this.csCamera.left = -s / 2; this.csCamera.right = s / 2;
    this.csCamera.top = s / 2; this.csCamera.bottom = -s / 2;
    this.csCamera.near = 0;
    this.csCamera.far = Math.max(size.y * 0.55, radius * 0.5) + gap;
    this.csCamera.updateProjectionMatrix();
    // lumières
    const k = this.key;
    k.position.copy(center).add(new THREE.Vector3(-0.55, 1.0, 0.75).multiplyScalar(radius * 3));
    k.target.position.copy(center);
    const sc = k.shadow.camera;
    sc.left = -radius * 1.2; sc.right = radius * 1.2; sc.top = radius * 1.2; sc.bottom = -radius * 1.2;
    sc.near = radius * 0.5; sc.far = radius * 6;
    sc.updateProjectionMatrix();
    k.shadow.normalBias = radius * 0.0012;
    this.rim.position.copy(center).add(new THREE.Vector3(0.9, 0.4, -1.0).multiplyScalar(radius * 3));
    this.rim.target.position.copy(center);
    this.camera.near = radius * 0.02;
    this.camera.far = radius * 40;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.6;
    this.controls.maxDistance = radius * 8;
    this._shadowDirty = true;
  }

  // Cadre la caméra : view = { az, el, dist, target:[x,y,z] } (degrés)
  frame(view = {}, animate = true) {
    if (!this.center) return;
    const az = THREE.MathUtils.degToRad(view.az ?? 25);
    const el = THREE.MathUtils.degToRad(view.el ?? 12);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.min(1, this.camera.aspect);
    const dist = (this.radius / Math.sin(fov / 2)) * (view.dist ?? 1.0) / Math.max(0.55, aspect) * 1.12;
    const target = this.center.clone();
    if (view.target) target.add(new THREE.Vector3(...view.target).multiplyScalar(this.radius));
    const pos = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    ).multiplyScalar(dist).add(target);
    if (!animate) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this._tween = {
      fromP: this.camera.position.clone(), toP: pos,
      fromT: this.controls.target.clone(), toT: target,
      t: 0,
    };
  }

  markShadowDirty() { this._shadowDirty = true; }

  // Éclairage "photo studio" relatif à la caméra : la face visible est toujours bien éclairée
  _placeLights() {
    if (!this.radius) return;
    const t = this.controls.target;
    const fwd = this._v1 || (this._v1 = new THREE.Vector3());
    const right = this._v2 || (this._v2 = new THREE.Vector3());
    const up = this._v3 || (this._v3 = new THREE.Vector3());
    fwd.copy(this.camera.position).sub(t).normalize();
    right.crossVectors(this.camera.up, fwd);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    up.crossVectors(fwd, right).normalize();
    const d = this.radius * 3;
    this.key.position.copy(t).addScaledVector(right, -0.55 * d).addScaledVector(up, 0.85 * d).addScaledVector(fwd, 0.75 * d);
    this.key.position.y = Math.max(this.key.position.y, t.y + 0.4 * d);
    this.key.target.position.copy(t);
    this.rim.position.copy(t).addScaledVector(right, 0.9 * d).addScaledVector(up, 0.35 * d).addScaledVector(fwd, -0.9 * d);
    this.rim.target.position.copy(t);
  }

  addAnimator(fn) { this.animators.add(fn); return () => this.animators.delete(fn); }

  _loop() {
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this._tween) {
      const tw = this._tween;
      tw.t = Math.min(1, tw.t + dt / 0.75);
      const e = 1 - Math.pow(1 - tw.t, 3);
      // interpolation sphérique autour de la cible
      const a = tw.fromP.clone().sub(tw.fromT), b = tw.toP.clone().sub(tw.toT);
      const la = a.length(), lb = b.length();
      const dir = a.normalize().lerp(b.normalize(), e).normalize();
      const target = tw.fromT.clone().lerp(tw.toT, e);
      this.camera.position.copy(target).add(dir.multiplyScalar(la + (lb - la) * e));
      this.controls.target.copy(target);
      if (tw.t >= 1) this._tween = null;
    }
    for (const fn of this.animators) if (fn(dt)) this._shadowDirty = true;
    this.controls.update();
    this._placeLights();
    if (this._shadowDirty) {
      this._renderContactShadow();
      this._shadowDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }

  // Export PNG haute définition
  async snapshot({ scale = 2, background = null } = {}) {
    const r = this.renderer;
    const prevRatio = r.getPixelRatio();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    r.setPixelRatio(scale);
    r.setSize(w, h, false);
    this.controls.update();
    this._placeLights();
    this.renderer.render(this.scene, this.camera);
    const src = r.domElement;
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext('2d');
    if (background) background(ctx, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    r.setPixelRatio(prevRatio);
    r.setSize(w, h, false);
    this.renderer.render(this.scene, this.camera);
    return out;
  }
}
