// Impianto modellato in Blender (GLB quantizzato + gzip, incorporato nella pagina).
// Lo scroll muove cabina, contrappeso, porte di cabina e di piano; funi e cavo flessibile si aggiornano dal vivo.
import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import glbUrl from '../assets/impianto.glb.gz?url'
import META from '../assets/impianto.json'
import { scene, isMobile, reducedMotion, FLOORS, FLOOR_H } from '../store'
import { DOTS } from '../components/dots'

const { x: CAR_X, w: CW, h: CH, d: CD } = META.car
const CWX = META.cwx
const TOP = META.top
const SD = META.sd

// ------------------------------------------------------------------ caricamento del GLB
// Il GLB è nella pagina come base64 (gzip): lo decodifichiamo in un ArrayBuffer e lo passiamo a GLTFLoader.parse.
// Niente fetch di data: URI, così funziona anche nelle anteprime con CSP rigida, da file locale e su Pages.
let MODEL = null
async function bytesOf(url) {
  if (url.startsWith('data:')) {
    const bin = atob(url.slice(url.indexOf(',') + 1))
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  }
  return new Uint8Array(await (await fetch(url)).arrayBuffer())
}
async function gunzip(u8) {
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8.buffer
  const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(ds).arrayBuffer()
}
function loadModel() {
  if (!MODEL) {
    const r = { status: 'pending' }
    r.promise = (async () => {
      const buf = await gunzip(await bytesOf(glbUrl))
      return await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))
    })().then((g) => { r.status = 'done'; r.value = g }, (e) => { r.status = 'error'; r.error = e })
    MODEL = r
  }
  if (MODEL.status === 'pending') throw MODEL.promise
  if (MODEL.status === 'error') throw MODEL.error
  return MODEL.value
}

// ------------------------------------------------------------------ texture procedurali (canvas, una volta sola)
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}
function makeTextures() {
  const concrete = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8a857e'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      const v = 100 + Math.random() * 60
      g.fillStyle = `rgba(${v},${v - 3},${v - 7},${Math.random() * 0.35})`
      const s = Math.random() * 3 + 0.5
      g.fillRect(Math.random() * w, Math.random() * h, s, s)
    }
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(40,38,35,${Math.random() * 0.12})`); gr.addColorStop(1, 'rgba(40,38,35,0)')
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    g.strokeStyle = 'rgba(30,28,26,.3)'; g.lineWidth = 2
    g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.5); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.5, h); g.stroke()
    for (const [x, y] of [[w * .25, h * .25], [w * .75, h * .25], [w * .25, h * .75], [w * .75, h * .75]]) {
      g.fillStyle = 'rgba(25,24,22,.5)'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill()
    }
  })
  const brushed = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bfc4c9'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 1800; i++) {
      const v = 175 + Math.random() * 60
      g.strokeStyle = `rgba(${v},${v + 3},${v + 8},${0.04 + Math.random() * 0.07})`
      g.lineWidth = Math.random() * 1.2 + 0.2
      const y = Math.random() * h
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 3); g.stroke()
    }
  })
  const granite = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1d1e21'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 4000; i++) {
      const v = Math.random() < 0.08 ? 160 : 40 + Math.random() * 40
      g.fillStyle = `rgba(${v},${v},${v + 4},${0.4 + Math.random() * 0.5})`
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
    }
  })
  brushed.repeat.set(3, 3)
  return { concrete, brushed, granite }
}

// numeri di piano dipinti a spruzzo sulla parete di fondo, come fanno i montatori
function floorLabelTex(n) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(232,228,220,.78)'
    g.font = '800 150px "Archivo", "Arial Narrow", Arial, sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(n === 0 ? 'T' : String(n), w / 2, h / 2 + 6)
    g.font = '600 26px "Archivo", Arial, sans-serif'
    g.fillText(n === 0 ? 'Piano terra' : `Piano ${n}`, w / 2, h - 26)
  })
}

function drawDisplay(g, w, h, label, dir) {
  g.fillStyle = '#050608'; g.fillRect(0, 0, w, h)
  const cell = 9
  const draw = (glyph, ox, oy) => DOTS[glyph].forEach((row, y) => [...row].forEach((b, x) => {
    g.fillStyle = b === '1' ? '#ff3b3b' : 'rgba(255,60,60,.07)'
    g.beginPath(); g.arc(ox + x * cell, oy + y * cell, 3.4, 0, 7); g.fill()
  }))
  if (dir) draw(dir > 0 ? 'U' : 'D', 14, 40)
  draw(label, 70, 40)
}

// ------------------------------------------------------------------ punti tecnici (coordinate relative alla cabina, sistema three.js)
export const CALLOUTS = [
  { id: 'porte', p: [CAR_X - 0.05, CH + 0.16, CD / 2 - 0.12], car: true },
  { id: 'funi', p: [CAR_X, CH + 0.75, 0], car: true },
  { id: 'pattini', p: [CAR_X + CW / 2 + 0.14, CH + 0.32, 0], car: true },
  { id: 'paracadute', p: [CAR_X + CW / 2 + 0.15, -0.48, 0], car: true },
  { id: 'guide', p: [META.rails[1] + 0.03, 1.2, 0], car: true },
  { id: 'contrappeso', p: [CWX, 0.7, 0], cw: true },
]

function Model() {
  const gltf = loadModel()
  const { gl, scene: three, camera, size } = useThree()
  const tx = useMemo(makeTextures, [])
  const parts = useMemo(() => {
    const parts_atrio = []
    const root = gltf.scene
    const get = (n) => root.getObjectByName(n)
    const car = get('Cabina'), cw = get('Contrappeso'), shaft = get('Vano')
    const carDoors = [], landing = Array.from({ length: FLOORS }, () => [])
    root.traverse((o) => {
      if (o.name.startsWith('AntaCabina')) carDoors.push(o)
      const m = o.name.match(/^AntaPiano(\d+)_/)
      if (m) landing[+m[1]].push(o)
      if (o.isMesh) {
        o.castShadow = false; o.receiveShadow = false
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((mt) => {
          if (!mt || mt.userData.done) return
          mt.userData.done = true
          mt.envMapIntensity = 1
          switch (mt.name) {
            case 'Cemento': mt.map = tx.concrete; mt.color.set('#b9b4ac'); mt.roughness = 0.95; break
            case 'Solaio': mt.map = tx.concrete; mt.color.set('#8d8a85'); break
            case 'Inox': mt.map = tx.brushed; mt.color.set('#e4e8ec'); mt.metalness = 1; mt.roughness = 0.3; break
            case 'InoxScuro': mt.map = tx.brushed; mt.color.set('#6c7178'); break
            case 'Granito': mt.map = tx.granite; mt.color.set('#ffffff'); mt.roughness = 0.35; break
            case 'Specchio': mt.roughness = 0.04; mt.metalness = 1; mt.envMapIntensity = 1.4; break
            case 'LED': mt.emissive.set('#eaf4ff'); mt.emissiveIntensity = 2.4; mt.toneMapped = false; break
            case 'Pulsante': mt.emissive.set('#5a7cff'); mt.emissiveIntensity = 0.25; break
            case 'Atrio': mt.transparent = true; mt.color.set('#a8a39a'); parts_atrio.push(mt); break
            case 'Guida': mt.roughness = 0.2; mt.envMapIntensity = 1.3; break
            default: break
          }
          mt.needsUpdate = true
        })
      }
    })
    carDoors.forEach((d) => { d.userData.x0 = CAR_X + d.userData.closed; d.userData.x1 = CAR_X + d.userData.open })
    landing.flat().forEach((d) => { d.userData.x0 = CAR_X + d.userData.closed; d.userData.x1 = CAR_X + d.userData.open })
    return { root, car, cw, shaft, carDoors, landing, atrio: parts_atrio }
  }, [gltf, tx])

  // environment per i riflessi dell'acciaio
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const rt = pm.fromScene(new RoomEnvironment(), 0.04)
    three.environment = rt.texture
    three.environmentIntensity = 0.6
    return () => { rt.dispose(); pm.dispose() }
  }, [gl, three])

  // numeri di piano sulla parete
  const labels = useMemo(() => Array.from({ length: FLOORS }, (_, i) => floorLabelTex(i)), [])
  // display di cabina (sulla colonna pulsantiera)
  const disp = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext('2d'), t, last: '' }
  }, [])

  // funi di trazione e del contrappeso: cilindri scalati ogni frame
  const ropeGeo = useMemo(() => new THREE.CylinderGeometry(0.0055, 0.0055, 1, 6, 1, true), [])
  const ropeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a9096', metalness: 0.9, roughness: 0.45 }), [])
  const carRopes = useRef(), cwRopes = useRef()
  // cavo flessibile piatto (si srotola in un'ansa sotto la cabina)
  const cable = useRef()
  const cableMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#202225', roughness: 0.7 }), [])
  const cableState = useRef({ y: -999 })
  const light = useRef()

  const st = useRef({ y: scene.floor * FLOOR_H, doors: 0, v: 0 })

  useFrame((_, dt) => {
    const s = st.current
    const d = Math.min(dt, 0.05)
    const k = reducedMotion ? 1 : 1 - Math.exp(-3.2 * d)
    const prev = s.y
    s.y += (scene.floor * FLOOR_H - s.y) * k
    s.v = (s.y - prev) / Math.max(dt, 1e-3)
    const targetDoors = scene.doors * scene.intro
    s.doors += (targetDoors - s.doors) * (reducedMotion ? 1 : 1 - Math.exp(-6 * d))
    const open = Math.min(Math.max(s.doors, 0), 1)
    const { car, cw, carDoors, landing } = parts
    car.position.y = s.y
    // la parete dell'atrio sparisce quando la camera esce in sezione
    const fa = 1 - Math.min(1, Math.max(0, (scene.floor - 0.15) / 0.5))
    parts.atrio.forEach((m) => { m.opacity = fa; m.depthWrite = fa > 0.99; m.visible = fa > 0.01 })
    const cwY = (FLOORS - 1) * FLOOR_H - s.y + 0.6
    cw.position.y = cwY
    // porte: telescopiche, quelle di piano si aprono solo al piano dove la cabina è ferma
    carDoors.forEach((o) => { o.position.x = o.userData.x0 + (o.userData.x1 - o.userData.x0) * open })
    const atFloor = Math.round(s.y / FLOOR_H)
    const aligned = Math.abs(s.y - atFloor * FLOOR_H) < 0.04
    landing.forEach((arr, i) => {
      const f = i === atFloor && aligned ? open : 0
      arr.forEach((o) => { o.position.x = o.userData.x0 + (o.userData.x1 - o.userData.x0) * f })
    })
    // funi
    const carTop = s.y + CH + 0.5
    const lenCar = Math.max(TOP - 0.2 - carTop, 0.01)
    carRopes.current.scale.y = lenCar; carRopes.current.position.y = carTop + lenCar / 2
    const cwTop = cwY + 1.42
    const lenCw = Math.max(TOP + 0.2 - cwTop, 0.01)
    cwRopes.current.scale.y = lenCw; cwRopes.current.position.y = cwTop + lenCw / 2
    light.current.intensity = 1.2 + open * 3
    // cavo flessibile: dal fondo cabina a un punto fisso a metà vano, con l'ansa in basso
    if (Math.abs(s.y - cableState.current.y) > 0.01) {
      cableState.current.y = s.y
      const fixY = 3 * FLOOR_H + 1.2
      const a = new THREE.Vector3(CAR_X + 0.42, s.y - 0.3, -0.55)
      const b = new THREE.Vector3(CAR_X + 0.42, fixY, -SD / 2 + 0.05)
      const low = Math.min(a.y, fixY) - 0.5 - Math.abs(a.y - fixY) * 0.5
      const pts = [a, new THREE.Vector3(a.x, (a.y + low) / 2, -0.58), new THREE.Vector3(a.x, low, -0.75), new THREE.Vector3(a.x, (low + fixY) / 2, -0.9), b]
      const curve = new THREE.CatmullRomCurve3(pts)
      const geo = new THREE.TubeGeometry(curve, 48, 0.018, 4, false)
      geo.scale(1, 1, 1)
      if (cable.current.geometry) cable.current.geometry.dispose()
      cable.current.geometry = geo
    }
    // display di cabina
    const near = atFloor
    const dir = Math.abs(s.v) > 0.15 ? Math.sign(s.v) : 0
    const key = near + ':' + dir
    if (key !== disp.last) { disp.last = key; drawDisplay(disp.g, 128, 128, near === 0 ? 'T' : String(near), dir); disp.t.needsUpdate = true }
    // proiezione dei punti tecnici per le etichette HTML
    if (scene.tech > 0.01) {
      const v = new THREE.Vector3()
      scene.callouts = CALLOUTS.map((c) => {
        v.set(c.p[0], c.p[1] + (c.cw ? cwY : s.y), c.p[2]).project(camera)
        return { id: c.id, x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, vis: v.z < 1 }
      })
    }
  })

  return (
    <group>
      <primitive object={parts.root} />
      {/* luce di cabina: segue la cabina */}
      <primitive object={parts.car}>
        <pointLight ref={light} position={[CAR_X, CH - 0.25, 0.1]} intensity={2} distance={4} decay={1.4} color="#eef5ff" />
        <mesh position={[CAR_X + CW / 2 - 0.047, 1.56, 0.22]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.12, 0.12]} />
          <meshBasicMaterial map={disp.t} toneMapped={false} />
        </mesh>
      </primitive>
      <group ref={carRopes} position={[CAR_X, 0, 0]}>
        {[-0.06, -0.02, 0.02, 0.06].map((x) => <mesh key={x} geometry={ropeGeo} material={ropeMat} position={[x, 0, 0]} />)}
      </group>
      <group ref={cwRopes} position={[CWX, 0, 0]}>
        {[-0.06, -0.02, 0.02, 0.06].map((z) => <mesh key={z} geometry={ropeGeo} material={ropeMat} position={[0, 0, z]} />)}
      </group>
      <mesh ref={cable} material={cableMat} />
      {labels.map((t, i) => (
        <mesh key={i} position={[-0.45, i * FLOOR_H + 1.6, -SD / 2 + 0.005]}>
          <planeGeometry args={[0.75, 0.75]} />
          <meshBasicMaterial map={t} transparent toneMapped={false} opacity={0.85} />
        </mesh>
      ))}
      {/* display di piano sopra ogni porta */}
      {Array.from({ length: FLOORS }, (_, i) => (
        <FloorDisplay key={i} floor={i} />
      ))}
    </group>
  )
}

// Display a LED sopra la porta di piano: mostra il piano della cabina
function FloorDisplay({ floor }) {
  const d = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext('2d'), t, last: '' }
  }, [])
  useFrame(() => {
    const n = Math.round(scene.floor)
    const dir = Math.abs(scene.floor - n) > 0.02 ? 1 : 0
    const key = n + ':' + dir
    if (key !== d.last) { d.last = key; drawDisplay(d.g, 128, 128, n === 0 ? 'T' : String(n), dir); d.t.needsUpdate = true }
  })
  return (
    <mesh position={[CAR_X, floor * FLOOR_H + 2.32, SD / 2 + 0.09]}>
      <planeGeometry args={[0.1, 0.1]} />
      <meshBasicMaterial map={d.t} toneMapped={false} />
    </mesh>
  )
}

// ------------------------------------------------------------------ camera: una posa per piano, interpolata con lo scroll
// pos/target relativi alla quota della cabina. Desktop: impianto a destra, testo a sinistra.
const POSES_D = [
  { pos: [CAR_X + 1.25, 1.55, 4.6], tgt: [CAR_X - 0.75, 1.25, 0] },   // 0 atrio, davanti alle porte
  { pos: [5.4, 2.8, 7.4], tgt: [-1.1, 1.0, 0] },                      // 1 sezione 3/4
  { pos: [5.8, 1.4, 6.8], tgt: [-1.0, 1.3, 0] },                      // 2
  { pos: [3.9, 1.9, 4.2], tgt: [-0.1, 0.9, 0] },                      // 3 cosa controlliamo, più vicino
  { pos: [5.4, 3.0, 7.2], tgt: [-1.1, 1.1, 0] },                      // 4
  { pos: [6.0, 1.2, 7.0], tgt: [-1.0, 1.5, 0] },                      // 5
  { pos: [5.0, 3.3, 7.4], tgt: [-1.0, 3.0, 0] },                      // 6 arrivo, si vede il macchinario
]
const POSES_M = [
  { pos: [CAR_X + 0.35, 1.5, 5.4], tgt: [CAR_X, 1.55, 0] },
  { pos: [2.4, 2.4, 6.4], tgt: [0.1, 1.6, 0] },
  { pos: [2.6, 1.3, 6.0], tgt: [0.1, 1.6, 0] },
  { pos: [2.6, 1.8, 4.6], tgt: [0.35, 1.3, 0] },
  { pos: [2.4, 2.6, 6.2], tgt: [0.1, 1.6, 0] },
  { pos: [2.6, 1.4, 6.0], tgt: [0.1, 1.6, 0] },
  { pos: [2.2, 3.6, 6.6], tgt: [0.1, 2.4, 0] },
]
function Rig() {
  const { camera, size } = useThree()
  const s = useRef({ y: 0, f: 0, init: false })
  const P = useRef(new THREE.Vector3()), T = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const poses = size.width > 820 ? POSES_D : POSES_M
    const k = reducedMotion ? 1 : 1 - Math.exp(-2.6 * Math.min(dt, 0.05))
    s.current.f += (scene.floor - s.current.f) * (s.current.init ? k : 1)
    s.current.init = true
    const f = Math.max(0, Math.min(FLOORS - 1, s.current.f))
    const i = Math.min(FLOORS - 2, Math.floor(f)), t = f - i
    const e = t * t * (3 - 2 * t)
    const a = poses[i], b = poses[i + 1]
    const y = f * FLOOR_H
    P.current.set(a.pos[0] + (b.pos[0] - a.pos[0]) * e, y + a.pos[1] + (b.pos[1] - a.pos[1]) * e, a.pos[2] + (b.pos[2] - a.pos[2]) * e)
    T.current.set(a.tgt[0] + (b.tgt[0] - a.tgt[0]) * e, y + a.tgt[1] + (b.tgt[1] - a.tgt[1]) * e, a.tgt[2] + (b.tgt[2] - a.tgt[2]) * e)
    P.current.x += scene.pointer.x * 0.35
    P.current.y -= scene.pointer.y * 0.2
    camera.position.copy(P.current)
    camera.lookAt(T.current)
  })
  return null
}

function Pointer() {
  const { invalidate } = useThree()
  useEffect(() => {
    scene.invalidate = invalidate
    if (reducedMotion || isMobile) return
    const on = (e) => {
      scene.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      scene.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', on, { passive: true })
    return () => window.removeEventListener('pointermove', on)
  }, [invalidate])
  return null
}

function Ready({ onReady }) {
  useEffect(() => { scene.ready = true; onReady && onReady() }, [onReady])
  return null
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch(e) { console.warn('3D non disponibile', e); this.props.onError && this.props.onError() }
  render() { return this.state.err ? null : this.props.children }
}

export default function Scene({ onReady, onError }) {
  return (
    <div className="canvas-wrap" aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 1.75]}
        camera={{ position: [2, 1.7, 5.6], fov: isMobile ? 50 : 36, near: 0.05, far: 60 }}
        gl={{ antialias: !isMobile, powerPreference: 'high-performance', alpha: false }}
        frameloop={reducedMotion ? 'demand' : 'always'}
        onCreated={({ gl, scene: s }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          s.background = new THREE.Color('#0b0c0e')
          s.fog = new THREE.Fog('#0b0c0e', 8, 18)
        }}
      >
        <Boundary onError={onError}>
          <Suspense fallback={null}>
            <Model />
            <Ready onReady={onReady} />
          </Suspense>
        </Boundary>
        <Rig />
        <Pointer />
        <hemisphereLight args={['#dfe7f0', '#2a2622', 0.5]} />
        <directionalLight position={[4, 9, 7]} intensity={1.0} color="#fff4e6" />
        <directionalLight position={[-3, 4, 6]} intensity={0.35} color="#cfe0ff" />
      </Canvas>
    </div>
  )
}
