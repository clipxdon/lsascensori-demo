// Line icons drawn for this site (stroke = currentColor, accent = red).
const P = {
  lift: <><rect x="12" y="6" width="40" height="52" rx="2" /><path d="M32 6v52" /><path className="acc" d="M20 22l4-5 4 5M36 17l4 5 4-5" /></>,
  cargo: <><rect x="10" y="8" width="44" height="48" rx="2" /><path d="M10 20h44M10 44h44" /><rect className="acc" x="22" y="26" width="20" height="14" /></>,
  platform: <><path d="M14 52h36M18 52V30h28v22" /><path d="M46 30V8M50 8v44" /><path className="acc" d="M28 22l4-5 4 5M32 17v9" /></>,
  stair: <><path d="M8 56h12v-10h12v-10h12v-10h12" /><path d="M12 40 52 12" /><rect className="acc" x="26" y="20" width="10" height="12" rx="2" /></>,
  shield: <><path d="M32 6 52 14v16c0 13-9 22-20 28C21 52 12 43 12 30V14z" /><path className="acc" d="m23 31 6 6 12-13" /></>,
  ruler: <><rect x="6" y="22" width="52" height="20" rx="2" /><path d="M16 22v8M26 22v12M36 22v8M46 22v12" /><path className="acc" d="M6 52h52" /></>,
  pin: <><path d="M32 58S14 38 14 26a18 18 0 0 1 36 0c0 12-18 32-18 32z" /><circle className="acc" cx="32" cy="26" r="6" /></>,
}
export default function Glyph({ name }) {
  return <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">{P[name]}</svg>
}
