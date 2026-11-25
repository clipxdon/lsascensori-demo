# LS Ascensori · bozza sito 3D, versione 2

Evoluzione della prima bozza (stessi testi, colori, font e logo). Novità:
- Impianto modellato in Blender (bpy headless): vano in cemento, guide a T e staffe, porte di piano telescopiche con
  bottoniera e display, cabina inox con arcata, pattini, paracadute, operatore porte e balaustra, contrappeso, funi,
  macchinario gearless in testata, limitatore di velocità, ammortizzatori in fossa.
- Sezione "Cosa controlliamo": etichette agganciate ai pezzi del modello, linee disegnate con anime.js.
- Render Cycles dei quattro impianti (ascensore, montacarichi, piattaforma, servoscala) e render di riserva della scena.
- Micro-interazioni anime.js (pressione pulsanti, display LED, numeri), passata unslop su spaziature, colori e movimento.

## Pipeline 3D
```
cd blender
python build.py out --render --samples 40   # .blend, GLB, render di riserva
python systems.py out                        # render dei quattro impianti
npx gltf-transform quantize out/impianto-raw.glb ../assets-src/q.glb && gzip -9 -c ../assets-src/q.glb > ../src/assets/impianto.glb.gz
```
Il GLB (1,8 MB → 440 KB) è incorporato in base64, decodificato in ArrayBuffer e caricato con GLTFLoader.parse.
Se WebGL non c'è, restano i render di Blender. Con prefers-reduced-motion niente transizioni e niente etichette mobili.

## Sviluppo
```
npm ci && npm run build   # dist/index.html, file unico
```
