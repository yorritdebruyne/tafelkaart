# Tegels (voor Yorrit)

Hier begint het visuele werk. Je hoeft geen code aan te raken: bestanden toevoegen is genoeg.

## Waar zet je wat

| Map | Wat | Hoe getekend |
| --- | --- | --- |
| `floor/` | vloeren (`dirt.svg`, `cobble.png`, …) | herhaald, één keer per vakje |
| `props/` | meubels, bomen, kisten (`barrel.svg`, `hay.png`, …) | op het vakje of de rechthoek van de prop |
| `palette.ts` | kleuren: vloer, muur, deur, tokens, mist, reserve-kleur per prop | effen kleur |
| `prive/floor/`, `prive/props/` | tegels die **niet** op GitHub mogen (bv. Forgotten Adventures) | wint van de gewone map; zie `prive/README.md` |

- **Bestandsnaam = tegel-id** uit de projectcontext: `src/tiles/props/trough.svg` is de tegel `trough`.
- Formaten: `.svg`, `.png`, `.webp`, `.jpg`. Voor PNG: liefst ± 300–512 px per vakje (scherp bij printen op 25 mm). Staan `barrel.png` en `barrel.svg` er allebei, dan wint de PNG.
- Teken **vierkant** (bv. `viewBox="0 0 64 64"`), met **boven = noord**. Een prop met `"rot": 90` draait met de klok mee.
- Een prop wordt **nooit vervormd**: de afbeelding komt zo groot mogelijk in zijn vakjes, met behoud van verhouding, in het midden. Een 2×2-hooibaal op 2×1 vakjes wordt dus kleiner getekend, niet platgedrukt. Teken een prop van 2×1 vakjes dus op die maat (bv. 1024 × 512).
- Een vloer-PNG met doorzichtige stukken toont daar de kleur uit `palette.ts`.
- Nieuw bestand toegevoegd terwijl `dev` draait? De browser herlaadt vanzelf.

## Zonder afbeelding

Dan tekent de app een **reserve-tekening**: een gekleurd blokje met de naam, en een wit streepje aan de bovenkant (zo zie je de rotatie). De kleur per categorie staat in `palette.ts` (`PROP`).
Een id die nergens bestaat (geen kleur, geen bestand) wordt grijs met een stippelrand, en de app geeft een waarschuwing.

`props/_voorbeeld.svg` is alleen een voorbeeld om te tonen dat het werkt (tegel-id `_voorbeeld`).

## Volgorde

Voor elke tegel zoekt de app, in deze volgorde:

1. `prive/props/<id>.png` (of `prive/floor/`): één vaste afbeelding die niet op GitHub mag.
2. `props/<id>` (of `floor/`): eigen tekening of vrije licentie.
3. **Forgotten Adventures**, automatisch (zie de README in de hoofdmap, deel "Forgotten Adventures").
4. De reserve-tekening.

Wil je één bepaalde FA-ton altijd gebruiken? Kopieer hem als `prive/props/barrel.png` (stap 1 wint).

## Forgotten Adventures: welke mappen?

`fa-map.json` zegt per tegel-id in welke FA-map de app zoekt en met welk woord de bestandsnaam begint.
Je mag dit bestand aanpassen of uitbreiden; draai daarna opnieuw `npm run fa-index`.
De sferen (standaard, rijk, verlaten) staan er ook: woorden in de bestandsnaam die de app
liever wel (`prefer`) of liever niet (`avoid`) kiest. Een nieuwe sfeer toevoegen mag.
FA-vloeren hebben geen sfeerwoorden in hun naam (`Dirt_A_01.jpg`), daarom zegt `floors` per sfeer
welke vloerfamilie hoort bij elke vloer-id, bv. `"dirt": "^Cracked_Dirt_"` voor "verlaten".
Vloertexturen zwaarder dan `floorMaxKB` (2 MB) worden overgeslagen, zodat de bundel licht blijft.
Paddenstoelen, schimmel, ratten en dergelijke worden altijd uitgesloten (`deny`).

## Regels

- Bestaande id's **niet hernoemen** (de DM gebruikt ze). Nieuwe toevoegen mag: zet ze dan ook in de lijst in de projectcontext en in het D&D-project.
- Geen paddenstoelen, schimmel of ratten.
- Alleen kunst met een licentie voor thuisgebruik (bv. CC0, Kenney). Zet de bron in `CREDITS.md`.
