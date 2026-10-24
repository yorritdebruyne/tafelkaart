# Privétegels (niet op GitHub)

Alles in deze map, behalve dit bestand, staat in `.gitignore` en gaat **niet** mee naar GitHub.
Gebruik deze map voor tegels die je wel thuis mag gebruiken maar niet openbaar mag delen,
zoals de gratis set van **Forgotten Adventures** ("for personal use").

```
src/tiles/prive/
  props/   barrel.png, hay.png, trough.png, ...
  floor/   dirt.png, cobble.png, ...
```

- **Forgotten Adventures hoef je hier niet te kopiëren.** De app leest de bibliotheek rechtstreeks
  uit je eigen map (zie de README in de hoofdmap, deel "Forgotten Adventures"). Hier komt dan alleen
  `fa-index.json` te staan, gemaakt door `npm run fa-index`.
- Wil je voor een tegel altijd één bepaalde afbeelding? Zet ze hier met de tegel-id als naam
  (bv. `props/barrel.png`). Die wint van alles.
- **Back-up:** GitHub bewaart deze map niet. Hou zelf een kopie bij (bv. OneDrive of de Raspberry Pi).
- **Niet online zetten:** een build met deze tegels (map `dist/`) bevat de afbeeldingen. Zet die dus
  niet op GitHub Pages of een andere openbare site; thuis draaien (`dev:telefoon`, of op de Pi) is prima.
