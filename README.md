# Fratch TV

Un canale TV personale: una pagina web che riproduce i tuoi video in ordine casuale, con un palinsesto che cambia in base a data e ora (Natale, sera, notte…), un logo in sovraimpressione e un contenitore a proporzione fissa.

## Avvio rapido

### Con Docker Compose

```bash
echo "VIDEOS_PATH=/percorso/dei/tuoi/video" > .env
docker compose up --build -d
```

Apri http://localhost:1997 e premi play. I video stanno in un volume (montato in sola lettura): per aggiungerne o toglierne non serve ricostruire l'immagine, basta attendere circa 45 secondi.

### Con Docker

```bash
docker build -t fratch-tv .
docker run --rm --init -p 1997:1997 -v /percorso/video:/videos:ro --name fratch-tv fratch-tv
```

### Senza Docker (Node.js 18+)

```bash
npm install
VIDEOS_DIR=/percorso/video npm start
```

## Cartelle dei video

```
videos/
├── (file sciolti)          → fallback
├── default/                → fallback
├── natale/                 → attiva nel periodo "natale"
├── sera/                   → attiva nella fascia "sera"
└── natale/sera/            → attiva solo quando valgono entrambe
```

Ordine di priorità: `data/ora`, `data`, `ora`, `default`. Gli intervalli si definiscono in `config.json`. Estensioni lette: `.mp4`, `.avi`, `.mkv`, `.webm`. I file che iniziano con `.` sono ignorati; i collegamenti simbolici (symlink) sono seguiti, ma in Docker devono puntare dentro il volume montato.

Le fasce possono sovrapporsi (per esempio `giorno` e `pomeriggio`): in quel caso si sommano.

### Intervalli (`config.json`)

- Date: `"start": "12-01", "end": "12-26"` (MM-GG). Il giorno finale è incluso per intero. Se l'inizio è dopo la fine l'intervallo scavalca il capodanno (`12-21` → `03-19`).
- Orari: `"start": "22:00", "end": "05:59"` (estremi inclusi, può scavalcare la mezzanotte).
- `"enabled": false` disattiva un intervallo senza cancellarlo (come `compleanno`: imposta le date e togli `enabled`).
- Voci con formato errato vengono ignorate e segnalate all'avvio.
- `"timezone"`: fuso orario usato per le fasce (la variabile `TZ` ha la precedenza).

## Come vengono scelti i video

A ogni richiesta il server costruisce una scaletta (`playlist.length` video):

- `scheduledWeight` (0.6 = 60%) è la probabilità che il prossimo video venga dalle cartelle di palinsesto invece che dal fallback;
- dentro ciascun gruppo i video escono tutti una volta prima di ripetersi, e nessuno torna prima di `minGap` video dello stesso gruppo;
- il player chiede una scaletta nuova (con un seme diverso) quando quella attuale sta finendo, e ogni 10 minuti controlla se il palinsesto è cambiato (per esempio è iniziata la sera): in quel caso sostituisce solo i video futuri, senza interrompere quello in corso.

## Comandi da tastiera

| Tasto              | Azione                                |
| ------------------ | ------------------------------------- |
| `R`                | cambia formato (16:9 → 4:3 → schermo) |
| `L`                | mostra/nasconde il logo               |
| `F` o doppio click | schermo intero                        |
| `←` / `→`          | video precedente / successivo         |
| Spazio             | pausa / riproduzione                  |

Aprendo `http://localhost:1997/?kiosk` la riproduzione parte da sola. Con Chrome serve avviarlo con `--autoplay-policy=no-user-gesture-required`; altrimenti basta un click sul pulsante. Cursore e barra dei controlli spariscono dopo `ui.idleSeconds` secondi senza movimenti.

## Variabili d'ambiente

| Variabile                | Default                          | Significato                                                                    |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------ |
| `PORT`                   | `1997`                           | porta del server                                                               |
| `VIDEOS_DIR`             | `./videos` (`/videos` in Docker) | cartella dei video                                                             |
| `TZ`                     | `Europe/Rome` in Docker          | fuso orario per le fasce                                                       |
| `CONFIG_PATH`            | `./config.json`                  | percorso della configurazione                                                  |
| `ALLOW_TIME_OVERRIDE`    | disattivato                      | con `true` abilita `/videos?at=2026-12-24T20:00:00` per i test                 |
| `AUTH_USER`, `AUTH_PASS` | disattivata                      | password (HTTP Basic) su tutto tranne `/health`; imposta entrambe              |
| `TRUST_PROXY`            | disattivato                      | numero di proxy davanti al server (es. `1`), per il limite di richieste per IP |
| `VIDEOS_CACHE_SECONDS`   | `45`                             | durata della cache della scansione delle cartelle                              |
| `VIDEOS_RATE_LIMIT`      | `300`                            | richieste a `/videos` ogni 15 minuti per IP                                    |

## Sicurezza

- Content Security Policy restrittiva (`helmet`); Video.js è servito in locale da `node_modules`, nessuna risorsa esterna. Gli stili inline sono ammessi solo perché Video.js ne inserisce uno dinamico.
- Nessun CORS: pagina e API sono sulla stessa origine.
- Se esponi il servizio su internet imposta `AUTH_USER` e `AUTH_PASS`, oppure usa una rete privata (per esempio Tailscale senza Funnel).
- `/video` serve qualunque file presente nella cartella montata: non metterci altro.

## Sviluppo

```bash
npm test
```

I test coprono intervalli di data e ora (ultimo giorno, inizio uguale alla fine, scavalco dell'anno e della mezzanotte), generatore casuale e scaletta pesata, e non dipendono dal fuso orario del computer.

## Licenza

MIT, vedi il file `LICENSE`.
