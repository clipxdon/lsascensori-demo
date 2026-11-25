# LS Ascensori — bozza sito 3D

Bozza dimostrativa di sito web per LS Ascensori Srls (Roreto di Cherasco, CN).

- `index.html`: sito completo in un unico file (React Three Fiber, GSAP ScrollTrigger, Lenis), pubblicabile con GitHub Pages.
- `sorgente-lsascensori-demo.tgz`: sorgente del progetto (Vite). Per ricostruire: `npm ci && npm run build`.

## Versione 2

Seconda bozza in [`v2/`](v2/): modello 3D dell'impianto realizzato in Blender (GLB incorporato), sezione "Cosa controlliamo" con etichette tecniche sul modello, render degli impianti, micro-animazioni con anime.js e pulizia grafica. Sorgente in `v2/sorgente-lsascensori-demo-v2.tgz`.

## Sito definitivo (cartella `sorgente/`)

Il cliente ha scelto la **v2**. In `sorgente/` c'è il sorgente della v2 portato in produzione (25/11/2026):
- footer senza "bozza dimostrativa", con link alla privacy e firma donAutomation;
- `sorgente/public/privacy.html`: informativa privacy e cookie;
- font in locale (Archivo, JetBrains Mono; licenza OFL): nessuna richiesta a Google, niente banner cookie;
- dominio **lsascensorisrls.it**: canonical, Open Graph, dati strutturati, `robots.txt`, `sitemap.xml`;
- `sorgente/wrangler.jsonc`: pubblicazione su Cloudflare (Workers static assets).

Cloudflare: Path `/sorgente`, Build `npm run build`, Deploy `npx wrangler deploy`. Ogni aggiornamento di `main` ripubblica il sito.
La demo originale (`index.html`, `v2/index.html`) resta invariata su GitHub Pages.
