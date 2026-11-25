// Indicatore di piano a punti (5x7 LED), come quello sopra le porte di piano. Unico elemento "firma" del sito.
import { useEffect, useRef } from 'react'
import { DOTS } from './dots'
import { ledFlicker } from '../motion'

function Glyph({ g, on }) {
  return (
    <svg viewBox="0 0 50 70" className="led-glyph">
      {DOTS[g].flatMap((row, y) => [...row].map((b, x) => (
        <circle key={`${x}-${y}`} cx={5 + x * 10} cy={5 + y * 10} r="3.6" className={b === '1' && on ? 'on' : 'off'} />
      )))}
    </svg>
  )
}

export default function LedDisplay({ floor, dir }) {
  const label = floor === 0 ? 'T' : String(floor)
  const num = useRef(null)
  useEffect(() => { ledFlicker(num.current) }, [label])
  return (
    <div className="led" role="status" aria-label={floor === 0 ? 'Piano terra' : `Piano ${floor}`}>
      <span className={`led-dir ${dir ? 'moving' : ''}`}><Glyph g="U" on={!!dir} /></span>
      <span ref={num}><Glyph g={label} on /></span>
    </div>
  )
}
