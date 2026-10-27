# Tafelkaart (M4 – Fysiek)

Statische web-app die een D&D-kaart tekent uit JSON van de DM. Spelers slepen hun token,
de app telt de afstand en kopieert de posities terug voor de chat. Tijdens het spel stuurt de DM
kleine wijzigingen (patches): tokens verplaatsen, deuren openen, verborgen kamers tonen.

---

## 1. Eenmalig klaarzetten

### 1.1 Node.js installeren
1. Download de **LTS**-versie van <https://nodejs.org> en installeer met de standaardopties.
2. **Herstart PyCharm** daarna, zodat het Node vindt.

Node is voor JavaScript wat de Python-interpreter voor Python is.
`npm` komt mee: dat is de "pip" van JavaScript.

### 1.2 Project openen in PyCharm
1. Pak de zip uit op een gewone plek, bv. `Documenten\tafelkaart`
   (niet in OneDrive: straks komen er duizenden bibliotheekbestanden bij).
2. *File → Open* → kies de map `tafelkaart` → *Trust Project*.
3. Vraagt PyCharm om een **Python-interpreter**? Negeer of sluit die melding: dit project gebruikt geen Python.

### 1.3 Node koppelen (alleen als PyCharm erom vraagt)
*Settings → Languages & Frameworks → Node.js* → bij *Node interpreter* de geïnstalleerde Node kiezen.

### 1.4 Bibliotheken installeren
Open `package.json`. Bovenaan verschijnt een balk **"Run 'npm install'"**: klik erop.
Lukt dat niet, open dan de terminal (*View → Tool Windows → Terminal*, of `Alt+F12`) en typ:

```
npm install
```

Dit leest `package.json` (zoals `requirements.txt`) en maakt de map `node_modules/`. Duurt ±1 minuut.

### 1.5 Controle
In de terminal:

```
node -v      → v22 of hoger
npm test     → alles groen ("passed")
```

---

## 2. Elke keer: de app draaien

**Makkelijkste manier:** rechtsklik op `package.json` → **Show npm Scripts**.
Er opent een paneel met de scripts; dubbelklik op het script dat je wil.

| Script | Wat het doet | Daarna |
| --- | --- | --- |
| `dev` | start de app op je pc | open <http://localhost:5173> |
| `dev:telefoon` | start de app, ook bereikbaar in je netwerk | open het `Network:`-adres uit de uitvoer op je telefoon (zelfde wifi) |
| `test` | draait alle tests | alles moet groen zijn |
| `build` | maakt de website voor online | resultaat in `dist/` |
| `tafel` | zoals `dev:telefoon`: app + tafel voor telefoons en tv | zie hieronder |
| `tafel:server` | app + tafel zonder Vite (bv. op de Pi), na `fa-bundle` of `build` | poort 8080 |

### Spelen met de tv en jullie telefoons (de "tafel")

1. Op de pc (die met HDMI aan de tv hangt): dubbelklik op het script **`tafel`**.
   In de uitvoer staat een `Network:`-adres, bv. `http://192.168.1.20:5173/`.
2. **Tv**: open op de pc `http://localhost:5173/?tv` in een venster op de tv. Klik één keer
   (of druk **F**) voor volledig scherm. Ook de browser van de Google TV kan dat adres openen
   (met het `Network:`-adres in plaats van `localhost`).
3. **Telefoons** (zelfde wifi): open het `Network:`-adres. Bovenaan staat dan `tafel: 3`
   (2 telefoons + tv). Wie het eerst een kaart heeft of laadt, bepaalt de kaart voor iedereen.
4. Slepen, deuren, patches, *Nieuwe beurt* en *Ongedaan* verschijnen meteen op alle toestellen.
   **Licht** en **sfeer** gelden voor de hele tafel: kies ze op je telefoon en de tv volgt.
   Thema en zoom blijven per toestel.

Op de tv (`?tv`): **F** = volledig scherm, **L** = kaart laden, **Ctrl+Z** = ongedaan. Slepen met de muis kan ook.
In het weekend via Tailscale: zelfde stappen, met het Tailscale-adres van de pc (of de Pi, met `tafel:server`).

Stoppen: het rode vierkantje in het Run-venster, of `Ctrl+C` in de terminal.

Tests kan je ook los draaien met het **groene pijltje** naast `describe(...)` of `it(...)` in een `.test.ts`-bestand.

Terwijl `dev` draait: sla je een bestand op, dan herlaadt de browser vanzelf.

**Windows Firewall** vraagt bij `dev:telefoon` misschien toestemming voor Node: kies *privénetwerken*.

---

## 3. Testlijst

Er zijn twee testkaarten: **Testkaart (stal)** en **Testkaart (dorp)** (een algemeen dorp met huizen,
herberg, plein en moestuin, om stijlen en sferen te vergelijken).

Klik in de app op **Laden → Testkaart (stal)** en controleer:

- [ ] De stal staat er: aarde binnen, kasseien onder, houten muren, deur bij H7.
- [ ] Akmenos slepen werkt met de muis (pc) en met je vinger (telefoon).
- [ ] De badge op het token telt (`3/6`), de stippellijn toont je weg, terugslepen telt terug.
- [ ] Amara 8 vakjes slepen → token en lijst worden rood.
- [ ] T1, T2 en het paard kan je niet slepen.
- [ ] **Kopieer posities** → plakken geeft `Posities: Akmenos: …, Amara: …, Paard: …, T1: …, T2: …`
- [ ] **Nieuwe beurt** zet de tellers op 0; **Beurt ↺** doet dat per speler.
- [ ] Zoomknoppen − en + werken; met één vinger scroll je over een grote kaart.
- [ ] Thema-knop wisselt tussen auto, licht en donker.
- [ ] **Laden → Open bestand** → `voorbeelden/fouten-demo.json`:
      foutmeldingen per veld, een grijs vakje "marmer", en de rest van de kaart staat er wel.
- [ ] Pagina herladen → kaart en posities blijven staan.

**M2 (nieuw)** – laad eerst opnieuw de testkaart:

- [ ] De zadelkamer (H6:J8) is bedekt met donkere mist met streepjes; de deur bij H7 zie je wel.
- [ ] Hooi, ladder, zakken en trog staan er als gekleurde blokjes met hun naam (reserve-tekening).
- [ ] Sleep Akmenos de mist in: hij blijft zichtbaar boven de mist.
- [ ] **Laden → Testpatch (stal)**: T1 staat op C3, T2 is weg, T3 staat op G7, de deur staat open,
      de mist is weg. Onderaan verschijnt een melding met alle wijzigingen.
- [ ] Nog eens **Testpatch** → "Deze patch is al toegepast. Niets veranderd."
- [ ] **Kopieer posities** → T2 staat er niet meer in, T3 wel.
- [ ] Pagina herladen → de patch blijft toegepast.
- [ ] Plak `voorbeelden/testpatch-stal.json` met `"map": "Grot"` → foutmelding, niets veranderd.
- [ ] Sleep Akmenos tegen een muur of de dichte deur bij H7: hij stopt ervoor. Na de testpatch (deur open) mag hij erdoor.

**M3 (nieuw)** – laad opnieuw de testkaart (stal):

- [ ] De stal is donker; rond E9 schijnt paars licht naar binnen door de opening, met schaduwen
      van de muren. De zadelkamer blijft donker tot de deur opengaat (testpatch).
- [ ] **Licht: auto / aan / uit**: auto = donker zodra de kaart `lights` heeft. In het dorp op *aan*:
      haarden en de lantaarn geven vanzelf licht, de muren houden het tegen, ramen niet.
- [ ] Bij het hooi (A1:B1, A2) staan schuine streepjes: moeilijk terrein. Sleep Amara via B1 naar A1:
      telt 2 per vakje, onderaan staat "… ver, … extra".
- [ ] Sleep Akmenos door Amara heen: dat vakje telt dubbel (door een bondgenoot = moeilijk terrein).
- [ ] Na de **testpatch**: Akmenos heeft een geel labeltje "liggend" en elk vakje kost 1 extra (kruipen).
- [ ] Sleep Amara naast T2 en daarna weer weg → onderaan "verlaat T2: opportunity attack?".
- [ ] Tik op een vijand → onderaan zijn naam, plek en condities.
- [ ] **↶ Ongedaan** (of Ctrl+Z) zet de laatste stap terug: slepen, deur, patch of nieuwe beurt.
- [ ] Sleep Akmenos op Amara: hij blijft staan waar hij was. Sleep hem dóór Amara naar G9: dat mag.
- [ ] Sleep Akmenos dóór een vijand (T1 of T2): hij stopt ervoor.
- [ ] Sleep Akmenos één vakje schuin, ook een beetje slordig: de teller zegt 1, niet 2.
- [ ] **Dorp:** sleep Akmenos tegen de kar of de waterput: hij stopt ervoor. Onder een boomkruin
      mag je door, alleen de stam (middelste vakje) houdt tegen.
- [ ] **Dorp:** tik op de deur van huis 1 (onder, E6): ze gaat open en je kan naar binnen.
      Huis 2 (rode rand) is op slot. *Kopieer posities* eindigt op `(deur huis1 open)`;
      na *Nieuwe beurt* valt die melding weg.

**M4 (nieuw): tv en telefoons** – start `tafel` (zie 2.)

- [ ] Open `http://localhost:5173/?tv` op de pc: donker, geen knoppen, melding "Nog geen kaart".
- [ ] Telefoon 1: open het `Network:`-adres, laad de stal. De tv toont ze meteen, bovenaan de telefoon `tafel: 2`.
- [ ] Telefoon 2 (Kim): open hetzelfde adres. Ze krijgt de stal zonder iets te laden (`tafel: 3`).
- [ ] Sleep Akmenos op telefoon 1: de tv en telefoon 2 zien het token live mee bewegen.
- [ ] Sleep tegelijk Akmenos (telefoon 1) en Amara (telefoon 2): allebei komen ze goed aan, overal.
- [ ] Deur openen, testpatch, *Nieuwe beurt* en *Ongedaan* op één telefoon: zelfde op de andere en de tv.
- [ ] Herlaad de tv (F5): de kaart en posities staan er meteen weer.
- [ ] Zet de wifi van een telefoon even uit en weer aan: `tafel: weg…`, daarna weer gelijk.
- [ ] Op de tv: F = volledig scherm, de kaart schaalt mee.

**Na de M4-test**

- [ ] Testkaart met een kast (`cupboard`): je ziet een echte kast (2 vakjes breed), geen deurtje of staafje.
      Na het pullen eerst `npm run fa-index`.
- [ ] Telefoon, dorp: blijf op **−** drukken tot de hele kaart in de breedte past.
- [ ] Telefoon liggend: tik op **▴** naast de kaartnaam → alleen de titel en de zoomknoppen blijven over. **▾** brengt
      de knoppen terug. De keuze blijft bewaard.
- [ ] Tafel: zet op je telefoon **Licht** of **Sfeer** om → de tv en de andere telefoon volgen.

**M4 (nieuw): afdrukken**

- [ ] Laad de stal → **Afdrukken**. De dialoog zegt: *2 bladen A4 staand … kaart 25 × 25 cm*.
- [ ] Kies **A3** → het dorp zegt *4 bladen A3 liggend*; op A4 *8 bladen*.
- [ ] **Afdrukken** → in het printvenster: schaal **100 %** / *Ware grootte* (niet "Aanpassen aan pagina").
      Kies eventueel eerst *Opslaan als PDF* om te kijken zonder papier te verspillen.
- [ ] **Testprint nameten**: één vakje = **25 mm** (± 1 mm), 4 vakjes = 10 cm. Meet horizontaal én verticaal.
- [ ] Elk blad heeft letters boven, cijfers links, snijtekens op de hoeken en onderaan
      `Stal · blad 1/2 · rij 1, kolom 1 · A1–E10`. Rechtsonder toont een mini-plattegrond welk blad waar ligt.
- [ ] Knip langs de snijtekens en leg de bladen aan elkaar: de gridlijnen lopen door.
- [ ] Standaard: geen tokens, geen donker/licht, de zadelkamer is blanco (wit met grid).
- [ ] Vinkje **Verborgen kamers op aparte bladen** → een extra blad met alleen H6–J8, om later op de
      blanco vakjes te leggen. Vinkje **Tokens** en **Inktspaarmodus** doen wat ze zeggen.
- [ ] Gewoon **Ctrl+P** (zonder de knop) drukt ook de bladen af, met de laatst gekozen instellingen.

Iets mis? Noteer wat je deed, wat je verwachtte en wat er gebeurde (screenshot helpt) en geef het aan Claude.

---

## 4. Waar zit wat

```
src/
  main.ts        startpunt (Vite laadt dit vanuit index.html)
  coords.ts      "E9" <-> {c:4, r:8}, gebieden, randen van vakjes
  schema.ts      JSON controleren met Zod, Nederlandse foutmeldingen per veld
  state.ts       MapState: kaart + afgelegde weg per token (onveranderlijk)
  patch.ts       patches toepassen: applyPatch(state, json) -> nieuwe state + meldingen
  fog.ts         welke vakjes en tokens in de mist liggen
  movement.ts    slepen: niet door muren of dichte deuren, niet eindigen op een ander token
  rules.ts       afstand (diagonaal = 1), meters, "Posities: ..."
  testmap.ts     de stal en de testpatch
  styles.css     opmaak, licht en donker thema
  render/        SVG-lagen: vloer, grid, props, muren + deuren, weg, tokens, mist
  tiles/         ← hier begint het visuele werk (zie tiles/README.md)
    palette.ts   ALLE kleuren van tegels, tokens en mist
    index.ts     tegel-lader: zoekt afbeeldingen in floor/ en props/
    floor/       vloer-afbeeldingen (<id>.svg of .png)
    props/       prop-afbeeldingen (<id>.svg of .png)
    prive/       tegels die niet op GitHub mogen (staat in .gitignore)
  print/         afdrukken (F16)
    layout.ts    rekenwerk: hoeveel vakjes per blad, welk stuk op welk blad (25 mm per vakje)
    sheets.ts    de bladen bouwen: kaart één keer tekenen, per blad een venster, snijtekens, voettekst
    options.ts   de instellingen (papier, richting, vinkjes)
  ui/
    app.ts       knoppen, laden, status, zoom, thema, printdialoog
    drag.ts      slepen met muis en touch (pointer events)
    clipboard.ts kopiëren, ook op http via de telefoon
    hash.ts      kaart via #map=... of #b64=...
    sync.ts      tafel: met andere telefoons en de tv gelijk blijven (F17)
    storage.ts   laatste kaart en posities bewaren in de browser
  *.test.ts      tests (Vitest)
scripts/
  tafel-relay.js   het doorgeefluik voor de tafel (+ test)
  tafel-server.js  app + tafel zonder Vite, bv. op de Pi
voorbeelden/
  fouten-demo.json     kaart met opzettelijke fouten
  testpatch-stal.json  de testpatch voor de stal
CREDITS.md       bronnen van tegelkunst (nu nog leeg)
```

Mappen die je **niet** aanpast: `node_modules/` (bibliotheken, wordt gemaakt door `npm install`)
en `dist/` (wordt gemaakt door `build`). Beide staan in `.gitignore`.

---

## 5. Wat M1 doet

- **F1** laden: plakken (tekst rond de JSON mag), bestand openen, of URL-hash (`#map=<json>` of `#b64=<base64url>`).
- **F2** grid met letters en cijfers, tot 100 × 100.
- **F3** vloeren, **F4** muren en deuren (dicht, open, op slot; raam en boog).
- **F5** tokens per kant, 1×1 of 2×2. **F6** alleen spelers zijn sleepbaar.
- **F7** afstand sinds begin van de beurt: de afgelegde weg, diagonaal = 1 vakje. Boven de speed: rood.
- **F8** Kopieer posities (spelers eerst).
- **F18** onbekende tegel → grijs vakje met de naam.
- Fouten per veld; de rest van de kaart wordt toch getekend. Onbekende velden worden genegeerd.

## 5b. Wat M2 tot nu toe doet

- **Deuren zelf openen:** tik op een gewone deur of poort om ze te openen of te sluiten (niet op slot).
  *Kopieer posities* meldt het aan de DM tot de volgende *Nieuwe beurt*.
- **F9** patches: plak een patch in hetzelfde venster als een kaart (of via de URL-hash).
  Tokens verplaatsen (`cell`), toevoegen (`add`), weghalen (`remove`), condities zetten (`conditions`),
  deuren (`state`) en verborgen regio's tonen (`reveal`).
  Fout item → melding, de rest wordt toegepast. Patch voor een andere kaart → geweigerd.
  Dezelfde patch twee keer → de tweede keer gebeurt er niets.
- **F10** props op een vakje of rechthoek, met `rot` in graden (met de klok mee).
- **F11** fog of war: `regions` met `hidden` (standaard `true`). Speler-tokens blijven zichtbaar;
  vijanden en npc's in de mist worden niet getekend en niet gekopieerd.
- Slepen: niet door muren, dichte deuren of ramen (open deuren en bogen wel), niet schuin tussen
  twee muren door. Niet door grote props (kar, put, tafel, ton, kast, ...; lijst `BLOCKING_PROPS` in
  `palette.ts`); bij een boom alleen de stam. Niet door een zichtbare vijand. Niet eindigen op een ander zichtbaar token;
  door een bondgenoot of npc lopen mag. De DM kan via een
  patch altijd alles verzetten.
- Tegel-lader: afbeelding in `src/tiles/prive/…` (niet op GitHub), dan `src/tiles/floor/` of
  `src/tiles/props/` → die wordt gebruikt, anders een reserve-tekening. Afbeeldingen worden apart
  geladen, dus grote PNG's maken de app niet traag.

## 5b-bis. Wat M3 doet

- **F12 moeilijk terrein**: `terrain` met `"kind": "difficult"` (streepjes). Elk vakje waar je op stapt
  kost 1 extra. Vanzelf moeilijk: puin, struiken, ondiep en diep water, en door een ander token lopen.
  Ladder = klimmen (+1). Liggend = kruipen (+1). Extra's tellen op; mist kost nooit extra.
  Lijsten: `DIFFICULT_PROPS`, `DIFFICULT_FLOORS`, `CLIMB_PROPS` in `palette.ts`.
- **F13 licht**: `lights` (`cell`, `radius` = heldere straal, `color`). Daarbuiten nog eens zoveel
  schemer. Kaars, lantaarn, vuurkorf, kampvuur en haard geven vanzelf licht (`PROP_LIGHTS`), tenzij de
  DM er zelf een licht op zet. Licht stopt aan muren, dichte deuren en de kaartrand; ramen, bogen en
  open deuren laten het door. Bronnen in de mist schijnen niet. Hoe donker: `LIGHT` in `palette.ts`.
- **F14 condities**: geel labeltje op het token (eerste conditie in het Nederlands, "+2" als er meer
  zijn). Vastgegrepen, in bedwang, verlamd, versteend en bewusteloos = speed 0. Mogen ook al in de kaart.
- **F15 undo**: tot 50 stappen terug (niet over het laden van een nieuwe kaart heen). *Nieuwe beurt* bestond al.
- Hint voor de DM: wie het bereik van een zichtbare vijand verlaat, krijgt "opportunity attack?".

## 5b-ter. Na de testfase

- Tegelnamen: `"Rug"`, `"Weapon_Rack"` of `"carpet"` (als prop) worden `rug`, `weapon-rack`, `rug`
  (info-melding). Zo valt een hoofdletter van de DM niet meer terug op een grijs vakje.
- `wagon` = huifkar (FA `Wagon_Wood_*` met huif, 3×6). `cart` op een groot vak (3×6 of 2×5) wordt een
  open wagen, op 2×3 een handkar. Na het mergen: `npm run fa-index`.
- In een kast of huifkar kruipen (`ENTER_PROPS`): kost 1 extra, het token wordt half doorzichtig en
  *Kopieer posities* zegt bv. `Amara: B1 (in de kast)`.

## 5b-quater. Wat M4 doet (tot nu toe)

- **F16 printmodus**: knop *Afdrukken*. Elk vakje is 25 mm; A4 = 7 × 11 vakjes per blad, A3 = 11 × 15
  (liggend omgekeerd). *Richting automatisch* kiest de richting met de minste bladen. Kolommen en rijen
  worden eerlijk verdeeld (10 kolommen = 5 + 5), zodat je geen smalle reepjes hoeft te plakken.
- Hoe: de kaart wordt één keer extra getekend (zonder licht, sleepwegen en badges) en elk blad toont er
  met `<use>` een stuk van, via een `viewBox`. Het blad zelf is een SVG in millimeter (`viewBox="0 0 210 297"`),
  dus 1 eenheid = 1 mm. `@page { size: …mm; margin: 0 }` zegt de browser hoe groot het papier is.
- Verborgen kamers: blanco op de kaart, of (vinkje) op een apart blad zonder tokens.
- **F17 tv-modus** (besproken 26 okt: tv rechtop, als spelbord, bediening met elk zijn eigen telefoon):
  - `?tv` achter het adres: geen knoppen, donker, de hele kaart past op het scherm, rechts de spelers
    met hoeveel ze bewogen. Volledig scherm met F of een klik.
  - Twee vensters in dezelfde browser (pc + tv-venster) volgen elkaar al via `localStorage` (het
    `storage`-event).
  - Andere toestellen: het **doorgeefluik** `scripts/tafel-relay.js` (draait mee in Vite, of in
    `scripts/tafel-server.js`). Geen WebSocket-bibliotheek: *Server-Sent Events* (een verbinding die
    openblijft, de server stuurt erover) + gewone POST. Het luik onthoudt de laatste volledige toestand
    en de stappen erna, zodat een toestel dat (opnieuw) verbindt meteen gelijk loopt.
  - We sturen **stappen** (`move`, `door`, `turn`, `patch`), geen hele kaart: elk toestel voert ze uit met
    dezelfde functies (`applySyncOp` in `src/ui/sync.ts`), zodat twee spelers tegelijk kunnen slepen.
    Alleen een nieuwe kaart en *Ongedaan* sturen de hele toestand. Tijdens het slepen gaan er ook
    `drag`-berichten mee: de anderen zien het token live bewegen.
  - Let op: *Ongedaan* zet de kaart terug naar vóór jouw laatste stap, ook als een ander intussen iets
    deed. Iedereen in je wifi (of tailnet) kan meedoen: alleen thuis gebruiken.

## 5c. Forgotten Adventures (eenmalig instellen)

De app kan de gratis **Core Mapmaking Pack** van Forgotten Adventures gebruiken, rechtstreeks uit je
eigen map. Er wordt niets gekopieerd en niets gaat naar GitHub (alleen voor persoonlijk gebruik).

1. Pak de drie delen (`Part1`, `Part2`, `Part3`) uit in één map, bv. `C:\ForgottonAdventures`.
2. In de PyCharm-terminal, **één keer**:
   ```
   npm run fa-index -- "C:\ForgottonAdventures"
   ```
   Dat maakt `.env.local` (onthoudt de map) en `src/tiles/prive/fa-index.json` (welke afbeelding bij
   welke tegel hoort). Duurt ±1 minuut.
3. Start `dev` opnieuw (de dev-server leest `.env.local` alleen bij het opstarten).
4. In de app verschijnt de knop **Sfeer**: standaard, rijk of verlaten. Die kiest andere varianten
   (bv. kapotte tonnen bij "verlaten") en een andere vloer: gebarsten aarde, verwilderd gras en
   losse stenen bij "verlaten", nette kasseien en kort gras bij "rijk".

Daarna: `npm run fa-index` (zonder map) opnieuw als je `src/tiles/fa-map.json` aanpast of FA bijwerkt.
Het script bewaart per soort en per grootte een handvol varianten (genoeg voor afwisseling en voor
elke sfeer): ±1000 bestanden i.p.v. 16.700. Alles houden: `npm run fa-index -- --alles`.

**Zonder je pc spelen (Raspberry Pi, offline, later printen en tv):**
```
npm run fa-bundle
```
Dat bouwt de app in `dist/` en kopieert de gebruikte FA-afbeeldingen naar `dist/fa/` (±200 MB).
`dist/` werkt daarna op zichzelf: bekijk ze met `npm run preview`, of zet de map op je Raspberry Pi
achter een gewone webserver. Opnieuw draaien na elke `git pull` of `fa-index`.
**`dist/` met FA-afbeeldingen niet online zetten** (alleen persoonlijk gebruik); thuis is prima.

- Props worden op hun **echte grootte** getekend (FA: 200 px per vakje), in het midden van hun vakjes.
  Past een afbeelding niet, dan zoekt de app een kleinere variant, draait ze een kwartslag, of schaalt ze in.
- Per vakje kiest de app een **variant**, altijd dezelfde op dezelfde plek.
- Vloeren worden FA-texturen, ook op hun echte grootte.
- **Groter dan het vakje van de DM?** Dan tekent de app de prop toch op echte grootte, vanaf dat
  vakje naar rechts en onder (een trog van 2×1 op C7 ligt op C7:D7). Bij 2 of meer vakjes teveel komt de
  helft links/boven (een boom van 3×3 op C3 ligt op B2:D4).
- **Deuren, poorten en ramen** komen ook uit FA, met een kozijn over de muur. Een open deur draait naar
  het vakje toe.
- **Versiering:** op natuurlijke vloeren strooit de app zelf takjes, blaadjes, onkruid en steentjes.
  Hoeveel hangt af van de sfeer (veel bij "verlaten", weinig bij "rijk"). Niet op vakjes met een prop.
- **Schaduw** onder props, muren en deuren. Voelt slepen traag op een oude telefoon? Zet
  `SHADOW.on` op `false` in `src/tiles/palette.ts`.
- **Muur-props** (ladder, boekenkast, kast, haard, wapenrek): staat er een muur naast het vakje en
  geeft de DM geen `rot`, dan draait de app de prop naar die muur en schuift ze ertegen. Welke props
  dat zijn, staat onder `"wall"` in `src/tiles/fa-map.json`.
- **Niet online zetten:** de afbeeldingen komen van je pc (dev-server) of uit `dist/fa/` (bundel).

## 6. Goed om te weten

- **Klembord op je telefoon:** via `http://192.168…` blokkeert de browser het moderne klembord.
  De app gebruikt dan een oudere methode; lukt ook die niet, dan toont ze de tekst om zelf te kopiëren.
  Online via https (GitHub Pages) werkt het normaal.
- **Kaartformaat** (het JSON-contract met de DM) niet zomaar wijzigen: alleen met een nieuw `version`-nummer.
- **Tegel-id's** niet hernoemen; nieuwe toevoegen mag (in `src/tiles/palette.ts`).
