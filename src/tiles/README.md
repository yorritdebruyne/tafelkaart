# Tegels (voor Yorrit)

Hier begint het visuele werk. Je hoeft geen code aan te raken: bestanden toevoegen is genoeg.

## Waar zet je wat

| Map | Wat | Hoe getekend |
| --- | --- | --- |
| `floor/` | vloeren (`dirt.svg`, `cobble.png`, …) | herhaald, één keer per vakje |
| `props/` | meubels, bomen, kisten (`barrel.svg`, `hay.png`, …) | op het vakje of de rechthoek van de prop |
| `palette.ts` | kleuren: vloer, muur, deur, tokens, mist, reserve-kleur per prop | effen kleur |

- **Bestandsnaam = tegel-id** uit de projectcontext: `src/tiles/props/trough.svg` is de tegel `trough`.
- Formaten: `.svg`, `.png`, `.webp`, `.jpg`. SVG blijft scherp bij printen; PNG mag ook (minstens 128 × 128 px).
- Teken **vierkant** (bv. `viewBox="0 0 64 64"`), met **boven = noord**. Een prop met `"rot": 90` draait met de klok mee.
- Een prop over meerdere vakjes (`"area": "A1:B1"`) wordt **uitgerekt** over die vakjes. Teken zo'n tegel dus op die maat (bv. 128 × 64), of laat de DM losse vakjes gebruiken.
- Een vloer-PNG met doorzichtige stukken toont daar de kleur uit `palette.ts`.
- Nieuw bestand toegevoegd terwijl `dev` draait? De browser herlaadt vanzelf.

## Zonder afbeelding

Dan tekent de app een **reserve-tekening**: een gekleurd blokje met de naam, en een wit streepje aan de bovenkant (zo zie je de rotatie). De kleur per categorie staat in `palette.ts` (`PROP`).
Een id die nergens bestaat (geen kleur, geen bestand) wordt grijs met een stippelrand, en de app geeft een waarschuwing.

`props/crate.svg` is alleen een voorbeeld om te tonen dat het werkt. Vervang of verwijder het gerust.

## Regels

- Bestaande id's **niet hernoemen** (de DM gebruikt ze). Nieuwe toevoegen mag: zet ze dan ook in de lijst in de projectcontext en in het D&D-project.
- Geen paddenstoelen, schimmel of ratten.
- Alleen kunst met een licentie voor thuisgebruik (bv. CC0, Kenney). Zet de bron in `CREDITS.md`.
