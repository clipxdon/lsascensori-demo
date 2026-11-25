import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import SplitText from './components/SplitText'
import LedDisplay from './components/LedDisplay'
import Glyph from './components/Glyph'
import Callouts from './components/Callouts'
import logoSmall from './assets/logo-dark-160.webp'
import logoBig from './assets/logo-dark-480.webp'
import stillIngresso from './assets/still-ingresso.webp'
import stillSezione from './assets/still-sezione.webp'
import stillTecnico from './assets/still-tecnico.webp'
import stillArrivo from './assets/still-arrivo.webp'
import sysLift from './assets/sys-lift.webp'
import sysCargo from './assets/sys-cargo.webp'
import sysPlatform from './assets/sys-platform.webp'
import sysStair from './assets/sys-stair.webp'
import { COMPANY, SERVICES, SYSTEMS, STEPS, AREAS, CHECKS, CREDIT } from './content'
import { scene, reducedMotion, isMobile } from './store'
import { installPress, countTo, stepLit, lightButton } from './motion'

gsap.registerPlugin(ScrollTrigger)
const Scene = lazy(() => import('./three/Scene'))

const SYS_IMG = { lift: sysLift, cargo: sysCargo, platform: sysPlatform, stair: sysStair }
const STILLS = [stillIngresso, stillSezione, stillSezione, stillTecnico, stillSezione, stillSezione, stillArrivo]

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t) }

// Scroll -> ascensore: ogni sezione è un piano. La cabina aspetta a porte aperte mentre leggi,
// chiude le porte e sale al piano successivo nell'ultima parte della sezione.
const TECH_FLOOR = 3
function useElevator(setFloor) {
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-floor]')]
    let last = -1, lastDir = 0
    const update = () => {
      const c = window.scrollY + window.innerHeight * 0.5
      let i = 0
      for (let k = 0; k < els.length; k++) if (els[k].offsetTop <= c) i = k
      const el = els[i]
      const t = Math.min(Math.max((c - el.offsetTop) / el.offsetHeight, 0), 1)
      const lastFloor = i === els.length - 1
      const travel = lastFloor ? 0 : smooth(0.68, 1, t)
      const doors = lastFloor
        ? smooth(0.0, 0.12, t)
        : i === 0
          ? 1 - smooth(0.46, 0.62, t)
          : smooth(0.02, 0.14, t) * (1 - smooth(0.52, 0.66, t))
      scene.floor = i + travel
      scene.doors = doors
      scene.tech = i === TECH_FLOOR ? smooth(0.04, 0.16, t) * (1 - smooth(0.6, 0.7, t)) : 0
      const shown = Math.round(scene.floor)
      const dir = travel > 0.02 && travel < 0.98 ? 1 : 0
      if (shown !== last || dir !== lastDir) { last = shown; lastDir = dir; setFloor({ n: shown, dir }) }
      if (scene.invalidate) scene.invalidate()
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [setFloor])
}

function useLenis() {
  useEffect(() => {
    if (reducedMotion) return
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    window.__lenis = lenis
    return () => { gsap.ticker.remove(raf); lenis.destroy() }
  }, [])
}

const go = (id) => (e) => {
  e.preventDefault()
  const el = document.getElementById(id)
  if (window.__lenis) window.__lenis.scrollTo(el, { offset: 0, duration: 1.8 })
  else el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
}

const NAV = [
  { id: 'servizi', n: 1, label: 'Servizi' },
  { id: 'impianti', n: 2, label: 'Impianti' },
  { id: 'controlli', n: 3, label: 'Controlli' },
  { id: 'metodo', n: 4, label: 'Come lavoriamo' },
  { id: 'perche', n: 5, label: 'Perché noi' },
  { id: 'contatti', n: 6, label: 'Contatti' },
]

function Logo({ big = false }) {
  return <img src={big ? logoBig : logoSmall} alt="" className={big ? 'logo-img big' : 'logo-img'} width={big ? 140 : 40} height={big ? 160 : 46} decoding="async" />
}

function Nav({ floor }) {
  const [open, setOpen] = useState(false)
  const nums = useRef({})
  useEffect(() => { if (!floor.dir) lightButton(nums.current[floor.n]) }, [floor.n, floor.dir])
  return (
    <header className="nav">
      <a href="#top" onClick={go('top')} className="brand" aria-label="LS Ascensori, torna su">
        <Logo />
        <span>LS<b>Ascensori</b></span>
      </a>
      <nav aria-label="Piani" className={open ? 'open' : ''}>
        {NAV.map((l) => (
          <a key={l.id} href={`#${l.id}`} onClick={(e) => { setOpen(false); go(l.id)(e) }} className={floor.n === l.n ? 'active' : ''}>
            <span className="nav-n" ref={(el) => (nums.current[l.n] = el)}>{l.n}</span>{l.label}
          </a>
        ))}
      </nav>
      <div className="nav-right">
        <LedDisplay floor={floor.n} dir={floor.dir} />
        <a className="btn btn-red btn-sm" href={COMPANY.phones[0].href}>Chiama</a>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((v) => !v)}><span /><span /></button>
      </div>
    </header>
  )
}

function FloorTag({ n, label }) {
  return (
    <p className="floor-tag"><span className="ft-n">{n === 0 ? 'T' : n}</span><span>{n === 0 ? 'Piano terra' : `Piano ${n}`} · {label}</span></p>
  )
}

function Hero() {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.from('.hero-in', { opacity: 0, y: 24, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.7 })
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true } })
        .to('.hero-title', { yPercent: -14, opacity: 0.2, ease: 'none' }, 0)
    }, ref)
    return () => ctx.revert()
  }, [])
  return (
    <section id="top" className="hero floor" data-floor="0" ref={ref}>
      <div className="hero-copy">
        <FloorTag n={0} label="Ingresso" />
        <h1 className="hero-title" aria-label="LS Ascensori. Si sale, in sicurezza.">
          <SplitText as="span" text="Si sale." className="ht-1" immediate delay={0.25} />
          <SplitText as="span" text="In sicurezza." className="ht-2" immediate delay={0.45} />
        </h1>
        <p className="lead hero-in">Vendita, installazione, manutenzione e riparazione di ascensori, montacarichi, piattaforme elevatrici e servoscala. Da Bra e Cherasco, in tutto il Piemonte.</p>
        <div className="ctas hero-in">
          <a className="btn btn-red" href={COMPANY.phones[0].href}>Chiama {COMPANY.phones[0].label}</a>
          <a className="btn btn-ghost" href="#contatti" onClick={go('contatti')}>Richiedi un preventivo</a>
        </div>
        <p className="badge-24 hero-in"><span className="dot" aria-hidden="true" />Pronto intervento 24 ore su 24</p>
      </div>
      <a href="#servizi" onClick={go('servizi')} className="scroll-hint">Scorri per salire <span aria-hidden="true">▲</span></a>
    </section>
  )
}

function useReveal(ref, sel, opts = {}) {
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.utils.toArray(sel, ref.current).forEach((el, i) =>
        gsap.from(el, {
          y: 24, opacity: 0, duration: 0.9, ease: 'expo.out', delay: (i % 4) * 0.06, ...opts,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        })
      )
    }, ref)
    return () => ctx.revert()
  }, [])
}

function Services() {
  const ref = useRef(null)
  useReveal(ref, '.svc')
  return (
    <section id="servizi" className="floor services" data-floor="1" ref={ref}>
      <div className="panel">
        <FloorTag n={1} label="Servizi" />
        <SplitText text="Dal primo bullone all’ultimo controllo." className="h2" />
        <p className="sub">Un solo referente per tutta la vita dell’impianto: progettiamo, montiamo, controlliamo e interveniamo quando serve.</p>
        <div className="svc-grid">
          {SERVICES.map((s) => (
            <article key={s.n} className={`svc ${s.hot ? 'hot' : ''}`}>
              <span className="svc-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Systems() {
  const ref = useRef(null)
  useReveal(ref, '.sys')
  return (
    <section id="impianti" className="floor systems" data-floor="2" ref={ref}>
      <div className="panel">
        <FloorTag n={2} label="Impianti" />
        <SplitText text="Ogni dislivello ha la sua soluzione." className="h2" />
        <ul className="sys-grid">
          {SYSTEMS.map((s, i) => (
            <li key={s.id} className="sys">
              <figure className="sys-img"><img src={SYS_IMG[s.id]} alt="" loading="lazy" decoding="async" width="480" height="360" /></figure>
              <h3><span className="sys-i">0{i + 1}</span>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Checks({ active }) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  useReveal(ref, '.check-item', { y: 16 })
  return (
    <section id="controlli" className="floor checks" data-floor="3" ref={ref}>
      <div className="panel">
        <FloorTag n={3} label="Cosa controlliamo" />
        <SplitText text="Dentro il vano, pezzo per pezzo." className="h2" />
        <p className="sub">La manutenzione è fatta di controlli precisi su parti che non si vedono. Ecco quelle che verifichiamo a ogni visita, sull’impianto che hai davanti.</p>
        <ol className="check-list">
          {CHECKS.map((c, i) => (
            <li key={c.id} className={`check-item ${hover === c.id ? 'hl' : ''}`} onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)}>
              <span className="check-n">{i + 1}</span>
              <div><h3>{c.t}</h3><p>{c.d}</p></div>
            </li>
          ))}
        </ol>
        <p className="check-note">In testata verifichiamo anche motore, freno e quadro di manovra; in fossa ammortizzatori e tenditore del limitatore.</p>
      </div>
      <Callouts items={CHECKS} hover={hover} active={active} />
    </section>
  )
}

function Method() {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.fromTo('.m-progress', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.m-list', start: 'top 70%', end: 'bottom 60%', scrub: true } })
      gsap.utils.toArray('.m-step', ref.current).forEach((el) =>
        ScrollTrigger.create({
          trigger: el, start: 'top 68%',
          onEnter: () => { el.classList.add('lit'); stepLit(el.querySelector('.m-btn')) },
          onLeaveBack: () => el.classList.remove('lit'),
        })
      )
    }, ref)
    return () => ctx.revert()
  }, [])
  return (
    <section id="metodo" className="floor method" data-floor="4" ref={ref}>
      <div className="panel">
        <FloorTag n={4} label="Come lavoriamo" />
        <SplitText text="Cinque fermate, nessuna sorpresa." className="h2" />
        <ol className="m-list">
          <span className="m-progress" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <li key={s.t} className={`m-step ${reducedMotion ? 'lit' : ''}`}>
              <span className="m-btn" aria-hidden="true">{i + 1}</span>
              <div><h3>{s.t}</h3><p>{s.d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Why() {
  const ref = useRef(null)
  const num = useRef(null)
  useReveal(ref, '.why-card')
  useEffect(() => {
    if (reducedMotion) return
    const st = ScrollTrigger.create({ trigger: num.current, start: 'top 85%', once: true, onEnter: () => countTo(num.current, 24) })
    return () => st.kill()
  }, [])
  return (
    <section id="perche" className="floor why" data-floor="5" ref={ref}>
      <div className="panel">
        <FloorTag n={5} label="Perché noi" />
        <SplitText text="Due tecnici, un numero di telefono." className="h2" />
        <p className="sub">Quando chiami parli direttamente con chi verrà a lavorare sul tuo impianto, senza centralini né passaggi intermedi.</p>
        <div className="why-grid">
          <div className="why-card big"><span className="why-num"><span ref={num}>24</span><small>/7</small></span><p>Pronto intervento, festivi compresi</p></div>
          <div className="why-card"><Glyph name="shield" /><h3>Materiali di qualità</h3><p>Componenti certificati e ricambi affidabili, per impianti sicuri ed efficienti nel tempo.</p></div>
          <div className="why-card"><Glyph name="ruler" /><h3>Soluzioni su misura</h3><p>Ogni edificio è diverso: adattiamo l’impianto agli spazi, non il contrario.</p></div>
          <div className="why-card"><Glyph name="pin" /><h3>Vicini a te</h3><p>Base tra Bra e Cherasco, operativi in tutto il Piemonte.</p></div>
        </div>
        <p className="areas" aria-label="Zone servite">
          {AREAS.map((a, i) => <span key={a}>{a}{i < AREAS.length - 1 && <i aria-hidden="true">▲</i>}</span>)}
        </p>
      </div>
    </section>
  )
}

function Contact() {
  const ref = useRef(null)
  const [form, setForm] = useState({ nome: '', tel: '', tipo: 'Manutenzione', msg: '' })
  useReveal(ref, '.c-in')
  const mail = `mailto:${COMPANY.email}?subject=${encodeURIComponent('Richiesta dal sito: ' + form.tipo)}&body=${encodeURIComponent(`Nome: ${form.nome}\nTelefono: ${form.tel}\nTipo di richiesta: ${form.tipo}\n\n${form.msg}`)}`
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <section id="contatti" className="floor contact" data-floor="6" ref={ref}>
      <div className="panel">
        <FloorTag n={6} label="Contatti" />
        <SplitText text="Siamo arrivati. Parliamone." className="h2" />
        <div className="c-grid">
          <div className="c-card c-in">
            <h3>Chiamaci</h3>
            {COMPANY.phones.map((p) => <a key={p.href} className="c-big" href={p.href}>{p.label}</a>)}
            <p className="c-note"><span className="dot" aria-hidden="true" />Per guasti e persone bloccate rispondiamo 24 ore su 24</p>
            <h3>Scrivici</h3>
            <a className="c-link" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            <h3>Sede</h3>
            <p>{COMPANY.legal}<br />{COMPANY.address}<br />{COMPANY.city}</p>
            <div className="c-actions">
              <a className="btn btn-ghost btn-sm" href={COMPANY.maps} target="_blank" rel="noopener">Indicazioni</a>
              <a className="btn btn-ghost btn-sm" href={COMPANY.instagram} target="_blank" rel="noopener">Instagram</a>
            </div>
          </div>
          <form className="c-card c-form c-in" onSubmit={(e) => { e.preventDefault(); window.location.href = mail }}>
            <h3>Richiedi un preventivo</h3>
            <label>Nome<input required value={form.nome} onChange={set('nome')} autoComplete="name" /></label>
            <label>Telefono<input required type="tel" value={form.tel} onChange={set('tel')} autoComplete="tel" /></label>
            <label>Di cosa hai bisogno
              <select value={form.tipo} onChange={set('tipo')}>
                {['Nuovo impianto', 'Manutenzione', 'Riparazione', 'Piattaforma o servoscala', 'Altro'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>Messaggio<textarea rows="4" value={form.msg} onChange={set('msg')} placeholder="Tipo di edificio, numero di piani, zona" /></label>
            <button className="btn btn-red" type="submit">Invia richiesta</button>
            <p className="form-note">Il modulo apre il tuo programma di posta con il messaggio già compilato.</p>
          </form>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="brand"><Logo big /></div>
      <p>© {new Date().getFullYear()} {COMPANY.legal} · P.IVA {COMPANY.vat} · {COMPANY.address}, {COMPANY.city}</p>
      <p className="demo-note"><a href={COMPANY.privacy}>Privacy e cookie</a> · Immagini e modelli 3D a scopo illustrativo · Sito realizzato da <a href={CREDIT.url} target="_blank" rel="noopener">{CREDIT.name}</a></p>
    </footer>
  )
}

// Render di Blender: sfondo mentre il modello si carica, e al suo posto se WebGL non c'è
function Stills({ floor, hidden }) {
  return (
    <div className={`stills ${hidden ? 'gone' : ''}`} aria-hidden="true">
      {[...new Set(STILLS)].map((src) => (
        <img key={src} src={src} alt="" className={STILLS[floor.n] === src ? 'on' : ''} decoding="async" />
      ))}
    </div>
  )
}

export default function App() {
  const [floor, setFloor] = useState({ n: 0, dir: 0 })
  const [ready, setReady] = useState(false)
  const [webgl, setWebgl] = useState(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
  })
  useLenis()
  useElevator(setFloor)
  useEffect(() => installPress(document), [])
  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 600)
    return () => clearTimeout(t)
  }, [])
  const onReady = useCallback(() => {
    setReady(true)
    // le porte del piano terra si aprono da sole appena il modello è pronto
    if (reducedMotion) { scene.intro = 1; scene.invalidate && scene.invalidate(); return }
    gsap.to(scene, { intro: 1, duration: 1.6, delay: 0.5, ease: 'power2.inOut' })
  }, [])
  const onError = useCallback(() => setWebgl(false), [])
  return (
    <>
      <Stills floor={floor} hidden={ready && webgl} />
      {webgl && <Suspense fallback={null}><Scene onReady={onReady} onError={onError} /></Suspense>}
      <div className="vignette" aria-hidden="true" />
      <Nav floor={floor} />
      <main>
        <Hero />
        <Services />
        <Systems />
        <Checks active={floor.n === TECH_FLOOR && ready && webgl && !isMobile && !reducedMotion} />
        <Method />
        <Why />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
