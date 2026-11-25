export const COMPANY = {
  name: 'LS Ascensori',
  legal: 'LS Ascensori Srls',
  phones: [
    { label: '339 407 2508', href: 'tel:+393394072508' },
    { label: '331 177 1466', href: 'tel:+393311771466' },
  ],
  email: 'lsascensorisrls@gmail.com',
  address: 'Via Conte Petitti 44',
  city: '12062 Roreto di Cherasco (CN)',
  maps: 'https://www.google.com/maps/search/?api=1&query=Via+Conte+Petitti+44+Roreto+di+Cherasco',
  instagram: 'https://www.instagram.com/ls_ascensori/',
  vat: '04147380044',
  privacy: './privacy.html',
}

// Firma nel footer: link al sito donAutomation
export const CREDIT = { name: 'donAutomation', url: 'https://donautomation.it' }

export const SERVICES = [
  { n: '01', title: 'Vendita e installazione', text: 'Nuovi impianti in edifici esistenti o in costruzione: dal rilievo del vano alla consegna chiavi in mano, con cabine e finiture scelte insieme.' },
  { n: '02', title: 'Manutenzione programmata', text: 'Visite periodiche come previsto dal DPR 162/99, controlli di funi, freni, porte e dispositivi di sicurezza. Il tuo impianto sempre in regola.' },
  { n: '03', title: 'Riparazioni', text: 'Guasti, porte che non chiudono, fermate imprecise, rumori: diagnosi rapida e ricambi di qualità per rimettere l’impianto in servizio.' },
  { n: '24h', title: 'Pronto intervento', text: 'Persone bloccate in cabina o impianto fermo? Un tecnico risponde al telefono giorno e notte, 365 giorni l’anno.', hot: true },
]

export const SYSTEMS = [
  { id: 'lift', title: 'Ascensori civili e industriali', text: 'Condomini, uffici, capannoni e strutture ricettive. Impianti elettrici o oleodinamici, nuovi o da ammodernare.' },
  { id: 'cargo', title: 'Montacarichi', text: 'Per magazzini, aziende agricole, cantine e attività commerciali: portate robuste e comandi semplici.' },
  { id: 'platform', title: 'Piattaforme elevatrici', text: 'La soluzione su misura per case e piccoli edifici, anche dove non c’è spazio per un vano tradizionale.' },
  { id: 'stair', title: 'Servoscala', text: 'Poltroncine e pedane che seguono la scala esistente per abbattere le barriere architettoniche, senza opere murarie importanti.' },
]

export const STEPS = [
  { t: 'Sopralluogo', d: 'Veniamo a vedere spazi, accessi e vano: ascoltiamo cosa ti serve e chi userà l’impianto.' },
  { t: 'Progetto su misura', d: 'Ti proponiamo la soluzione più adatta, con preventivo chiaro e tempi definiti.' },
  { t: 'Installazione', d: 'Montaggio con materiali di qualità e cantiere ordinato, seguito da noi dall’inizio alla fine.' },
  { t: 'Collaudo', d: 'Prove di tutte le sicurezze e messa in servizio dell’impianto secondo normativa.' },
  { t: 'Manutenzione', d: 'Restiamo il tuo riferimento: controlli periodici e pronto intervento quando serve.' },
]

export const AREAS = ['Bra', 'Cherasco', 'Alba', 'Fossano', 'Savigliano', 'Cuneo', 'Langhe e Roero', 'Torino', 'tutto il Piemonte']

export const CHECKS = [
  { id: 'porte', t: 'Porte e operatore', d: 'Chiusura, riapertura davanti a un ostacolo, contatti di sicurezza e allineamento delle ante di cabina e di piano.' },
  { id: 'funi', t: 'Funi e attacchi', d: 'Usura, allungamento e tensione uniforme delle funi, molle e fissaggi degli attacchi in cabina e sul contrappeso.' },
  { id: 'pattini', t: 'Pattini e rulli', d: 'Scorrimento sulle guide senza giochi né rumori, stato dei rulli e lubrificazione.' },
  { id: 'paracadute', t: 'Paracadute', d: 'Il freno d’emergenza montato sotto la cabina, comandato dal limitatore di velocità: deve intervenire sempre.' },
  { id: 'guide', t: 'Guide e staffe', d: 'Allineamento delle guide a T e tenuta dei fissaggi alle pareti lungo tutta la corsa.' },
  { id: 'contrappeso', t: 'Contrappeso', d: 'Blocchi, pattini e distanze di sicurezza in fossa e in testata.' },
]
