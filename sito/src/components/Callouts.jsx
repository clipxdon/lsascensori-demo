// Etichette tecniche agganciate ai pezzi del modello 3D: la posizione arriva ogni frame dal canvas (scene.callouts).
// Una linea parte dal pezzo e arriva all'etichetta; anime.js la disegna quando la vista si attiva.
import { useEffect, useRef } from 'react'
import { scene, isMobile } from '../store'
import { drawLines } from '../motion'

export default function Callouts({ items, hover, active }) {
  const wrap = useRef(null)
  const tags = useRef({})
  const lines = useRef({})
  const dots = useRef({})
  const drawn = useRef(false)

  useEffect(() => {
    if (!active) { drawn.current = false; return }
    let raf
    const tick = () => {
      const w = wrap.current
      if (w) {
        const t = scene.tech
        w.style.opacity = t.toFixed(3)
        const pts = scene.callouts
        if (pts && t > 0.01) {
          // etichette su una colonna a destra dell'impianto, ordinate dall'alto in basso
          const W = window.innerWidth
          const colX = isMobile ? W - 12 : Math.min(W - 24, Math.max(...pts.map((p) => p.x)) + 140)
          const sorted = [...pts].sort((a, b) => a.y - b.y)
          const top = isMobile ? 96 : 120
          const gap = Math.max(44, Math.min(78, (window.innerHeight - top - 80) / sorted.length))
          sorted.forEach((p, k) => {
            const tag = tags.current[p.id], line = lines.current[p.id], dot = dots.current[p.id]
            if (!tag) return
            const ty = top + k * gap
            tag.style.transform = `translate(${colX}px, ${ty}px) translate(-100%, -50%)`
            const tw = tag.offsetWidth
            const ex = colX - tw - 8
            line.setAttribute('d', `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${(ex - 24).toFixed(1)} ${ty.toFixed(1)} L${ex.toFixed(1)} ${ty.toFixed(1)}`)
            dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1))
          })
          if (!drawn.current && t > 0.5) {
            drawn.current = true
            drawLines(Object.values(lines.current))
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null
  return (
    <div className="callouts" ref={wrap} aria-hidden="true">
      <svg className="callout-svg">
        {items.map((c) => (
          <g key={c.id} className={hover === c.id ? 'hl' : ''}>
            <path ref={(el) => (lines.current[c.id] = el)} />
            <circle ref={(el) => (dots.current[c.id] = el)} r="4" />
          </g>
        ))}
      </svg>
      {items.map((c, i) => (
        <span key={c.id} ref={(el) => (tags.current[c.id] = el)} className={`callout-tag ${hover === c.id ? 'hl' : ''}`}>
          <b>{i + 1}</b>{c.t}
        </span>
      ))}
    </div>
  )
}
