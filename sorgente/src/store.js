// Stato condiviso: lo scroll scrive, il loop R3F legge (nessun re-render React).
export const scene = {
  floor: 0,         // posizione della cabina in piani (continua)
  doors: 0,         // apertura porte 0..1 (obiettivo)
  intro: 0,         // 0..1 apertura iniziale delle porte al caricamento
  tech: 0,          // 0..1 quanto è attiva la vista "Cosa controlliamo"
  pointer: { x: 0, y: 0 },
  invalidate: null, // impostato dal canvas (usato con movimento ridotto)
  callouts: null,   // proiezioni sullo schermo dei punti tecnici (scritte dal canvas)
  ready: false,
}

export const FLOORS = 7
export const FLOOR_H = 3.2

export const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const isMobile =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
