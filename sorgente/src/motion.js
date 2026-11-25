// Micro-interazioni con anime.js v4: pressione dei pulsanti come quelli di cabina, linee che si disegnano, numeri che scorrono.
import { animate, createSpring, stagger, svg, steps } from 'animejs'
import { reducedMotion } from './store'

const spring = createSpring({ stiffness: 420, damping: 18 })

// Pulsanti: si abbassano di poco alla pressione e tornano su con una molla.
export function installPress(root = document) {
  if (reducedMotion) return () => {}
  const sel = '.btn, .nav nav a, .c-big, .check-item'
  const down = (e) => {
    const el = e.target.closest(sel); if (!el) return
    animate(el, { scale: 0.96, duration: 110, ease: 'out(3)' })
  }
  const up = (e) => {
    const el = e.target.closest(sel); if (!el) return
    animate(el, { scale: 1, ease: spring })
  }
  root.addEventListener('pointerdown', down)
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  root.addEventListener('pointerleave', up, true)
  return () => {
    root.removeEventListener('pointerdown', down); root.removeEventListener('pointerup', up)
    root.removeEventListener('pointercancel', up); root.removeEventListener('pointerleave', up, true)
  }
}

// Display a LED: i punti si accendono in ordine sparso, come un vero indicatore di piano.
export function ledFlicker(el) {
  if (reducedMotion || !el) return
  animate(el.querySelectorAll('.on'), { opacity: [0, 1], duration: 90, delay: stagger(9, { from: 'random' }), ease: steps(2) })
}

// Il pulsante di piano nel menu "si accende" quando la cabina arriva
export function lightButton(el) {
  if (reducedMotion || !el) return
  animate(el, { scale: [0.82, 1], duration: 520, ease: spring })
}

// Linee delle etichette tecniche: si disegnano
export function drawLines(paths) {
  if (reducedMotion) return
  const d = svg.createDrawable(paths)
  animate(d, { draw: ['0 0', '0 1'], duration: 700, delay: stagger(90), ease: 'inOut(3)' })
}

export function countTo(el, to, { suffix = '', duration = 1400 } = {}) {
  if (!el) return
  if (reducedMotion) { el.textContent = to + suffix; return }
  const o = { v: 0 }
  animate(o, { v: to, duration, ease: 'out(4)', onUpdate: () => { el.textContent = Math.round(o.v) + suffix } })
}

export function stepLit(el) {
  if (reducedMotion || !el) return
  animate(el, { scale: [0.86, 1], duration: 600, ease: spring })
}
