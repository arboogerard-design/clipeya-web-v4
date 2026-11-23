// app.js · galería circular 3D de la portada de Clipeya (three.js r160).
// Qué hace: cuelga en un anillo las capturas y grabaciones reales de nuestras webs y mueve la cámara con el scroll:
//   desde arriba (portada) → dentro, delante de cada obra (secciones) → delante del hueco vacío «tu tienda» (cierre).
// Sin WebGL, con fallo de carga o con «reducir movimiento», la página se lee igual (texto en el HTML + imagen de respaldo).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const raiz = document.documentElement;
const lienzo = document.getElementById('escena');
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const token = (n) => getComputedStyle(raiz).getPropertyValue(n).trim();
const C = { tinta: token('--tinta'), panel: token('--panel'), papel: token('--papel'), gris: token('--gris'), acento: token('--acento') };

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}
if (renderer) arrancar(renderer).catch(() => lienzo.remove());
else lienzo.remove();

async function arrancar(renderer) {
  const V3 = THREE.Vector3;
  const movilEstrecho = () => innerWidth / innerHeight < 0.8;
  const paraVideo = new URLSearchParams(location.search).has('grabar');
  renderer.setPixelRatio(paraVideo ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, movilEstrecho() ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(C.tinta);
  escena.fog = new THREE.Fog(new THREE.Color(C.tinta), 10, 30);
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 120);

  // ---------- las obras ----------
  const R = 6.2;
  const ALTO = 3.0;
  const FILAS = [1.6, 4.85];
  const OBRAS = {
    nolessia_pc: { src: 'obras/nolessia_pc.jpg', a: 1.6 },
    nolessia_movil: { src: 'obras/nolessia_movil.jpg', a: 420 / 909 },
    nolessia_ficha_pc: { src: 'obras/nolessia_ficha_pc.jpg', a: 1.6 },
    nolessia_ficha_movil: { src: 'obras/nolessia_ficha_movil.jpg', a: 420 / 909 },
    clipeya_pc: { src: 'obras/clipeya_pc.jpg', a: 1.6 },
    clipeya_movil: { src: 'obras/clipeya_movil.jpg', a: 420 / 909 },
    presupuesto: { src: 'obras/presupuesto_portada.jpg', a: 420 / 454 },
    crm: { src: 'media/crm_poster.jpg', video: 'media/crm.mp4', a: 0.8 },
    web: { src: 'media/web_poster.jpg', video: 'media/web.mp4', a: 0.8 },
    hueco: { a: 0.8 },
  };
  const FILA_A = ['nolessia_pc', 'nolessia_movil', 'crm', 'clipeya_pc', 'presupuesto', 'nolessia_ficha_movil', 'web', 'nolessia_ficha_pc', 'clipeya_movil', 'hueco'];
  const FILA_B = ['clipeya_movil', 'nolessia_ficha_pc', 'presupuesto', 'web', 'nolessia_pc', 'nolessia_movil', 'clipeya_pc', 'crm', 'nolessia_ficha_movil'];

  const gestor = new THREE.LoadingManager();
  const cargador = new THREE.TextureLoader(gestor);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texturas = new Map();
  const videos = [];

  const voltear = (t) => {
    // vista desde dentro (BackSide): la imagen sale en espejo; se le da la vuelta en horizontal
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1;
    t.offset.x = 1;
    t.anisotropy = maxAniso;
    return t;
  };

  await Promise.race([document.fonts.load('92px "Instrument Serif"'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});

  function texturaHueco() {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 750;
    const g = c.getContext('2d');
    g.fillStyle = C.panel; g.fillRect(0, 0, 600, 750);
    g.setLineDash([22, 16]); g.lineWidth = 6; g.strokeStyle = C.acento;
    g.beginPath(); g.roundRect(34, 34, 532, 682, 26); g.stroke();
    g.fillStyle = C.papel; g.textAlign = 'center';
    g.font = '400 104px "Instrument Serif", Georgia, serif';
    g.fillText('Tu tienda', 300, 380);
    g.fillStyle = C.gris; g.font = '400 34px "Instrument Sans", system-ui, sans-serif';
    g.fillText('aquí, en la pared', 300, 446);
    return voltear(new THREE.CanvasTexture(c));
  }

  function textura(id) {
    if (texturas.has(id)) return texturas.get(id);
    const o = OBRAS[id];
    let t;
    if (id === 'hueco') t = texturaHueco();
    else t = voltear(cargador.load(o.src));
    texturas.set(id, t);
    return t;
  }

  const anillo = new THREE.Group();
  escena.add(anillo);
  const matDorso = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.panel), side: THREE.FrontSide });
  const paneles = [];

  function colocarFila(lista, y, fila, desfase) {
    const anchos = lista.map((id) => ALTO * OBRAS[id].a);
    const total = anchos.reduce((s, w) => s + w, 0);
    const huecoAng = (2 * Math.PI * R - total) / lista.length / R;
    let ang = desfase;
    lista.forEach((id, i) => {
      const len = anchos[i] / R;
      const inicio = ang + huecoAng / 2;
      const segs = Math.max(6, Math.ceil(len * 28));
      const mat = new THREE.MeshBasicMaterial({ map: textura(id), side: THREE.BackSide, color: new THREE.Color(0.8, 0.8, 0.8) });
      const cara = new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTO, segs, 1, true, inicio, len), mat);
      const dorso = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, ALTO, segs, 1, true, inicio, len), matDorso);
      cara.position.y = dorso.position.y = y;
      anillo.add(cara, dorso);
      paneles.push({ id, fila, mat, centro: inicio + len / 2, y, ancho: anchos[i], brillo: 0.8 });
      ang += len + huecoAng;
    });
  }
  colocarFila(FILA_A, FILAS[0], 0, 0);
  colocarFila(FILA_B, FILAS[1], 1, 0.31);

  // vídeos reales: el cartel primero; cuando el vídeo tiene imagen, pasa a vídeo
  for (const id of ['crm', 'web']) {
    const v = document.createElement('video');
    Object.assign(v, { src: OBRAS[id].video, muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
    v.setAttribute('playsinline', '');
    v.addEventListener('loadeddata', () => {
      const tv = voltear(new THREE.VideoTexture(v));
      paneles.filter((p) => p.id === id).forEach((p) => { p.mat.map = tv; p.mat.needsUpdate = true; });
    }, { once: true });
    videos.push(v);
  }
  const reproducir = () => { if (!paraVideo) videos.forEach((v) => v.play().catch(() => {})); };

  // ---------- suelo, chispa y polvo ----------
  function canvasRadial(tam, paradas) {
    const c = document.createElement('canvas'); c.width = c.height = tam;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    paradas.forEach(([p, col]) => gr.addColorStop(p, col));
    g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const acentoRGB = new THREE.Color(C.acento);
  const rgba = (a) => `rgba(${Math.round(acentoRGB.r * 255)},${Math.round(acentoRGB.g * 255)},${Math.round(acentoRGB.b * 255)},${a})`;
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.9, 72),
    new THREE.MeshBasicMaterial({ map: canvasRadial(512, [[0, rgba(0.5)], [0.22, rgba(0.2)], [0.55, rgba(0.05)], [1, rgba(0)]]), transparent: true, depthWrite: false })
  );
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.01;
  escena.add(suelo);
  const raya = new THREE.Mesh(new THREE.RingGeometry(R - 0.03, R + 0.03, 128), new THREE.MeshBasicMaterial({ color: acentoRGB, transparent: true, opacity: 0.45 }));
  raya.rotation.x = -Math.PI / 2; raya.position.y = 0.02;
  escena.add(raya);

  function texturaChispa() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.translate(256, 256); g.scale(0.5, 0.5);
    g.shadowColor = C.acento; g.shadowBlur = 90;
    g.fillStyle = C.acento; g.fill(new Path2D('M62 -181Q75 -13 246 0Q75 13 62 181Q49 13 -122 0Q49 -13 62 -181Z'));
    g.shadowBlur = 30; g.shadowColor = C.papel;
    g.fillStyle = C.papel; g.fill(new Path2D('M314.0 -174.0A359 359 0 1 0 314.0 174.0L200.3 111.0A229 229 0 1 1 200.3 -111.0Z'));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const chispa = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaChispa(), transparent: true, depthWrite: false }));
  chispa.scale.setScalar(1.35); chispa.position.set(0, 3.4, 0);
  escena.add(chispa);

  const N = 240, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt((i * 0.6180339 * 7) % 1) * (R - 0.4), a = i * 2.39996;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = ((i * 0.377) % 1) * 7; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const polvoGeo = new THREE.BufferGeometry(); polvoGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const polvo = new THREE.Points(polvoGeo, new THREE.PointsMaterial({ color: new THREE.Color(C.papel), size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  escena.add(polvo);

  // ---------- cámara guiada por el scroll ----------
  const secciones = [...document.querySelectorAll('[data-vista]')];
  let vistas = [];

  function vista(clave) {
    const asp = camara.aspect, movil = asp < 0.8;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    if (clave === 'arriba') {
      // móvil: el anillo más cerca y en la mitad de arriba, para que el titular quede debajo
      if (movil) return { pos: new V3(0, 15.5, 12.5), tgt: new V3(0, -2.6, 0), orbita: 1, foco: null };
      return { pos: new V3(0, 12.5, 10.5), tgt: new V3(0, 1.2, 0), orbita: 1, foco: null };
    }
    const id = clave.split(':')[1];
    const p = paneles.find((x) => x.id === id && x.fila === 0);
    // móvil: la obra arriba (mitad superior) y el texto debajo; ordenador: la obra a la derecha y el texto a la izquierda
    const necesitoAlto = (ALTO * (movil ? 2.3 : 1.6)) / (2 * tanV);
    const necesitoAncho = (p.ancho * (movil ? 1.15 : 2.2)) / (2 * tanV * asp);
    const d = Math.min(Math.max(necesitoAlto, necesitoAncho), R * 1.75);
    const dir = new V3(Math.sin(p.centro), 0, Math.cos(p.centro));
    const centro = new V3(dir.x * R, p.y, dir.z * R);
    const posi = centro.clone().addScaledVector(dir, -d);
    posi.y = p.y + (movil ? 0.2 : 0.12);
    const adelante = centro.clone().sub(posi);
    let tgt;
    if (movil) {
      tgt = centro.clone();
      tgt.y = p.y - 0.36 * adelante.length() * tanV; // centro de la obra al 32 % desde arriba
    } else {
      const alfa = Math.atan(0.36 * tanV * asp); // centro de la obra al 68 % del ancho
      tgt = posi.clone().add(adelante.applyAxisAngle(new V3(0, 1, 0), alfa));
      tgt.y = p.y - 0.04;
    }
    return { pos: posi, tgt, orbita: 0, foco: id };
  }

  function medir() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.fov = camara.aspect < 0.8 ? 64 : 50;
    camara.updateProjectionMatrix();
    escena.fog.near = camara.aspect < 0.8 ? 15 : 10;
    escena.fog.far = camara.aspect < 0.8 ? 42 : 30;
    vistas = secciones.map((s) => vista(s.dataset.vista));
  }
  medir();
  addEventListener('resize', medir);

  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pinza = (x) => Math.min(1, Math.max(0, x));
  const objetivo = { pos: new V3(), tgt: new V3(), orbita: 1, foco: null };

  function calcularObjetivo() {
    const y = scrollY;
    let i = 0;
    for (let k = 0; k < secciones.length; k++) if (secciones[k].offsetTop <= y + 1) i = k;
    const j = Math.min(i + 1, secciones.length - 1);
    const a = secciones[i].offsetTop, b = secciones[j].offsetTop;
    const t = j === i ? 0 : pinza((y - a) / (b - a));
    const e = suave(pinza((t - 0.12) / 0.76));
    const A = vistas[i], B = vistas[j];
    objetivo.pos.lerpVectors(A.pos, B.pos, e);
    objetivo.tgt.lerpVectors(A.tgt, B.tgt, e);
    objetivo.orbita = A.orbita + (B.orbita - A.orbita) * e;
    objetivo.foco = e < 0.5 ? A.foco : B.foco;
  }

  const puntero = { x: 0, y: 0 };
  if (matchMedia('(pointer: fine)').matches && !quieto) {
    addEventListener('pointermove', (ev) => { puntero.x = ev.clientX / innerWidth * 2 - 1; puntero.y = ev.clientY / innerHeight * 2 - 1; });
  }

  calcularObjetivo();
  const actual = { pos: objetivo.pos.clone(), tgt: objetivo.tgt.clone() };
  const reloj = new THREE.Clock();
  let giro = 0, primero = true;
  const eje = new V3(0, 1, 0), derecha = new V3(), arriba = new V3(), mira = new V3(), tmp = new V3();

  function cuadro(pasoFijo) {
    const dt = pasoFijo || Math.min(reloj.getDelta(), 0.05);
    calcularObjetivo();
    if (!quieto) giro += dt * 0.045 * objetivo.orbita;
    const pos = tmp.copy(objetivo.pos).applyAxisAngle(eje, giro * objetivo.orbita);
    const k = quieto || primero ? 1 : 1 - Math.exp(-dt * 3.2);
    actual.pos.lerp(pos, k);
    actual.tgt.lerp(objetivo.tgt, k);
    primero = false;
    camara.position.copy(actual.pos);
    camara.lookAt(actual.tgt);
    if (!quieto) {
      derecha.setFromMatrixColumn(camara.matrixWorld, 0); arriba.setFromMatrixColumn(camara.matrixWorld, 1);
      mira.copy(actual.tgt).addScaledVector(derecha, puntero.x * 0.35).addScaledVector(arriba, -puntero.y * 0.22);
      camara.lookAt(mira);
    }
    const dentro = 1 - objetivo.orbita;
    for (const p of paneles) {
      const quiero = p.id === objetivo.foco && p.fila === 0 && dentro > 0.5 ? 1 : 0.85 - 0.5 * dentro;
      p.brillo += (quiero - p.brillo) * (quieto ? 1 : 1 - Math.exp(-dt * 4));
      p.mat.color.setScalar(p.brillo);
    }
    chispa.material.rotation += quieto ? 0 : dt * 0.25;
    chispa.material.opacity = Math.pow(pinza((objetivo.orbita - 0.55) / 0.45), 2); // solo desde fuera: dentro se cruzaría delante de la cámara
    chispa.visible = chispa.material.opacity > 0.01;
    polvo.rotation.y += quieto ? 0 : dt * 0.01;
    renderer.render(escena, camara);
  }

  gestor.onLoad = () => {
    lienzo.classList.add('lista');
    document.getElementById('respaldo').style.visibility = 'hidden';
    setTimeout(reproducir, 600);
  };
  addEventListener('scroll', reproducir, { once: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach((v) => v.pause()); else reproducir();
  });
  // ?grabar=1: sin bucle; quien graba avanza la escena fotograma a fotograma (vídeo fluido aunque el PC vaya lento)
  const grabando = new URLSearchParams(location.search).has('grabar');
  if (!grabando) renderer.setAnimationLoop(() => { if (!document.hidden) cuadro(); });
  window.__galeria = {
    listo: () => lienzo.classList.contains('lista'),
    paneles: paneles.length,
    paso: (dt) => cuadro(dt),
  };
  if (grabando) {
    // solo para grabar: los vídeos se mueven a mano (a la vez que los fotogramas) y la foto sale del lienzo
    Object.assign(window.__galeria, {
      videos,
      async videosA(t) {
        await Promise.all(videos.map((v) => new Promise((ok) => {
          if (!v.duration) return ok();
          v.addEventListener('seeked', ok, { once: true });
          v.currentTime = t % v.duration;
          setTimeout(ok, 1500);
        })));
        paneles.forEach((p) => { if (p.mat.map && p.mat.map.isVideoTexture) p.mat.map.needsUpdate = true; });
      },
      foto: () => { cuadro(0.016); return lienzo.toDataURL('image/jpeg', 0.86); },
    });
  }
}
