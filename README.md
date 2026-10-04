# Memora

your album scanner

Applicazione desktop locale per macOS, sviluppata con Angular 22, Electron e SpartanNG LUMA. Conserva album, pagine e posizioni delle fotografie. Nessun login, backend, database o servizio cloud.

## Avvio

Richiede macOS 13 o successivo e Node.js 24.15 o successivo della serie 24. Per compilare il helper nativo servono gli Apple Command Line Tools.

```bash
nvm install
nvm use
npm install
npm run dev
```

`npm run dev` compila Angular, avvia Electron e mantiene Angular in watch. Non avvia un server HTTP. `npm run electron:dev` è un alias. Le modifiche a Electron/preload riavviano Electron; per modifiche al contratto condiviso riavviare il comando di sviluppo.

```bash
npm run build             # Angular e main/preload Electron
npm run scanner:build     # helper Swift ImageCaptureCore
npm run electron:build    # helper + build + Memora.app macOS Intel
```

Applicazione generata: `release/mac/Memora.app`. Build locale non firmata, senza pubblicazione sul Mac App Store. La configurazione prevede anche arm64: per quel target compilare il helper sul Mac arm64 e usare `electron-builder --mac dir --arm64` dopo le build.

## Workflow

1. Crea un album: nome, numero pagine e cartella scelta dal dialog macOS.
2. Seleziona una pagina. Premi **Aggiungi foto**, scegli preset e cella iniziale.
3. Prepara gli slot nella griglia 6×8. Preset: orizzontale 3×2, verticale 2×3, quadrata 2×2. Le celle partono da 1.
4. Seleziona uno slot e premi **Scansiona foto**. Fake Scanner apre il picker JPG/JPEG/PNG.
5. L’immagine viene convertita realmente nel formato selezionato. JPEG usa qualità 95 e fondo bianco per la trasparenza. I DPI del Fake Scanner non ricampionano l’immagine sorgente.
6. Dopo acquisizione viene selezionato il prossimo slot incompleto, anche nelle pagine successive. La ricerca torna all’inizio dopo l’ultima pagina.

Clicca una cella vuota per creare una foto con il preset selezionato. Riga, colonna e preset si aggiornano subito dai controlli sopra la pagina. Trascina una foto per spostarla: la destinazione si aggancia alla griglia e viene evidenziata prima del rilascio. Sono bloccati sovrapposizioni e posizioni fuori griglia. Il formato dello slot descrive la disposizione fisica e non modifica i pixel dell’immagine.

La scansione può sostituire un file solo dopo conferma. Eliminare una foto o un album sposta i file nel Cestino macOS; solo dopo successo vengono rimossi i metadata. Le fotografie non vengono rinumerate dopo un’eliminazione.

## Dati e filesystem

Struttura finale:

```text
Album famiglia 1998/
  .albumscanner-managed
  page-001/
    photo-001.jpg
    photo-002.png
  page-002/
    photo-001.jpg
```

Il file nascosto `.albumscanner-managed` è un marcatore di proprietà, senza metadata dell’album. Impedisce che metadata alterati autorizzino operazioni su cartelle arbitrarie del Mac. Non rimuoverlo.

Metadata, impostazioni e selezione sono salvati esclusivamente in localStorage, chiave `albumscanner.state.v1`. Immagini e base64 non vengono salvati in localStorage. Per mantenere gli album esistenti, gli identificatori tecnici e il profilo originale restano invariati. Profilo Electron: `~/Library/Application Support/AlbumScanner`. Origine stabile `app://albumscanner` per sviluppo e `.app`.

Un file mancante viene segnalato senza cancellarne il path dai metadata. La UI aggiorna il completamento e consente riacquisizione. Una cartella album rimossa produce errore; l’app non la ricrea silenziosamente.

Se localStorage non accetta una scrittura, le modifiche restano in memoria e compare **Riprova salvataggio**. Riprovare prima di chiudere. Dati corrotti vengono conservati; le modifiche restano bloccate fino al ripristino del profilo. Non esiste una copia dei metadata nel filesystem: cancellare il profilo dell’app elimina la struttura degli album, pur lasciando le fotografie nelle cartelle scelte.

## Scanner macOS

Compila il helper con `npm run scanner:build`. La modalità **Scanner macOS** compare quando il binario è disponibile; il packaging lo include nelle risorse dell’app.

Il helper Swift usa `ICDeviceBrowser`, `ICScannerDevice`, delegate e functional unit ImageCaptureCore. Gestisce esclusivamente scanner e scansioni. Non conosce album, pagine o slot.

Il MVP reale supporta piano flatbed, colore e area fisica completa. Le risoluzioni esposte sono quelle realmente supportate tra 300 e 600 DPI. JPEG e PNG sono formati di output ImageCaptureCore. Nessun ADF, crop, OCR, correzione colore o editing.

Electron comunica con un processo persistente tramite JSON Lines con `requestId`. Comandi: `listDevices`, `scan`, `cancel`. stdout contiene solo risposte JSON; stderr è diagnostica. Il helper salva in una cartella temporanea; Electron valida output e applica lo stesso commit usato dal Fake Scanner. Crash e timeout permettono il riavvio del processo alla richiesta successiva.

Scansione annullabile dalla toolbar. Se il driver non conferma l’annullamento, Electron arresta il helper dopo 5 secondi. Una scansione ha timeout massimo di 5 minuti. Il helper chiude le sessioni quando non necessarie e quando termina.

**Stato verifica:** compilazione e protocollo del helper verificati; rilevamento sul Mac di sviluppo restituisce zero scanner. L’adapter è verificato con un processo simulato. L’acquisizione ImageCaptureCore, i permessi e lo scollegamento richiedono verifica finale con scanner fisico. Non sono dichiarati verificati dall’assenza di dispositivi.

## Architettura e sicurezza

```text
src/app/core/           modelli, persistenza, servizi Angular
src/app/features/      album, scanner, impostazioni
src/app/shared/        componenti applicativi condivisi
src/app/ui/            componenti Helm LUMA generati da SpartanNG
shared/                contratti IPC e regole senza dipendenze Node

electron/main.ts       finestra e protocolli locali
electron/preload.ts    API esplicite contextBridge
electron/ipc/          sender/payload validation e coordinamento
electron/files/        autorizzazione path, commit, errori filesystem
electron/scanner/      adapter Fake/macOS e client JSON Lines
native/macos-scanner/   helper Swift
```

Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Angular non importa Node. Preload espone soltanto `window.desktop`, `window.files`, `window.scanner`, mai `ipcRenderer`, `fs`, `require` o `child_process`.

IPC verifica finestra, frame, origine e payload. Path esterni e symlink sono rifiutati. La cartella genitore viene autorizzata soltanto dal dialog nativo. Al riavvio sono riconosciute soltanto cartelle album gestite dall’app. Preview tramite URL temporanei `album-image://`, con accesso ristretto. CSP blocca script inline, oggetti, frame e risorse remote.

## Verifiche ripetibili

```bash
npm test                       # regole album, filesystem, protocollo JSON
npm run typecheck              # Electron e contratti
npm run test:smoke             # UI/Fake, immagini, riavvio, quota, Cestino
npm run test:native-adapter    # adapter reale con peer di protocollo simulato
npm run test:helper            # helper ImageCaptureCore reale, anche senza scanner
npm run test:boundaries        # isolamento Electron, concorrenza, metadata corrotti
npm run test:layout            # clic celle, modifiche immediate e trascinamento
```

I test Electron usano profili e cartelle isolati in `.test-artifacts`. Il picker è simulato, conversione e filesystem sono reali. Il test Fake sposta soltanto file generati dal test nel Cestino reale. Non usa il profilo personale AlbumScanner.

Verifica `.app` fuori dal progetto:

```bash
ALBUMSCANNER_EXECUTABLE="$PWD/release/mac/Memora.app/Contents/MacOS/Memora" npm run test:smoke
```

Gli override `ALBUMSCANNER_TEST_PROFILE` e `ALBUMSCANNER_TEST_HELPER` sono riservati ai test; il secondo è accettato solo con un profilo di test esplicito.

Restano fuori scope Windows/Linux, applicazioni mobile, backup/sync, riconoscimento immagini, editing e condivisione. Le fotografie provenienti da iPhone possono essere importate come JPG/PNG sul Mac; integrazione diretta Continuity Camera e PDF non sono presenti in questa versione.
