# Tafelkaart (M2 – Mooi, in opbouw)

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

Stoppen: het rode vierkantje in het Run-venster, of `Ctrl+C` in de terminal.

Tests kan je ook los draaien met het **groene pijltje** naast `describe(...)` of `it(...)` in een `.test.ts`-bestand.

Terwijl `dev` draait: sla je een bestand op, dan herlaadt de browser vanzelf.

**Windows Firewall** vraagt bij `dev:telefoon` misschien toestemming voor Node: kies *privénetwerken*.

---

## 3. Testlijst

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
  rules.ts       afstand (diagonaal = 1), meters, "Posities: ..."
  testmap.ts     de stal en de testpatch
  styles.css     opmaak, licht en donker thema
  render/        SVG-lagen: vloer, grid, props, muren + deuren, weg, tokens, mist
  tiles/         ← hier begint het visuele werk (zie tiles/README.md)
    palette.ts   ALLE kleuren van tegels, tokens en mist
    index.ts     tegel-lader: zoekt afbeeldingen in floor/ en props/
    floor/       vloer-afbeeldingen (<id>.svg of .png)
    props/       prop-afbeeldingen (<id>.svg of .png)
  ui/
    app.ts       knoppen, laden, status, zoom, thema
    drag.ts      slepen met muis en touch (pointer events)
    clipboard.ts kopiëren, ook op http via de telefoon
    hash.ts      kaart via #map=... of #b64=...
    storage.ts   laatste kaart en posities bewaren in de browser
  *.test.ts      tests (Vitest)
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

- **F9** patches: plak een patch in hetzelfde venster als een kaart (of via de URL-hash).
  Tokens verplaatsen (`cell`), toevoegen (`add`), weghalen (`remove`), condities zetten (`conditions`,
  getoond vanaf M3), deuren (`state`) en verborgen regio's tonen (`reveal`).
  Fout item → melding, de rest wordt toegepast. Patch voor een andere kaart → geweigerd.
  Dezelfde patch twee keer → de tweede keer gebeurt er niets.
- **F10** props op een vakje of rechthoek, met `rot` in graden (met de klok mee).
- **F11** fog of war: `regions` met `hidden` (standaard `true`). Speler-tokens blijven zichtbaar;
  vijanden en npc's in de mist worden niet getekend en niet gekopieerd.
- Tegel-lader: afbeelding in `src/tiles/floor/` of `src/tiles/props/` → die wordt gebruikt,
  anders een reserve-tekening.
- `terrain` en `lights` worden al aanvaard maar pas in M3 getekend (info-melding).

## 6. Goed om te weten

- **Klembord op je telefoon:** via `http://192.168…` blokkeert de browser het moderne klembord.
  De app gebruikt dan een oudere methode; lukt ook die niet, dan toont ze de tekst om zelf te kopiëren.
  Online via https (GitHub Pages) werkt het normaal.
- **Kaartformaat** (het JSON-contract met de DM) niet zomaar wijzigen: alleen met een nieuw `version`-nummer.
- **Tegel-id's** niet hernoemen; nieuwe toevoegen mag (in `src/tiles/palette.ts`).
