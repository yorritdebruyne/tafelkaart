# Privétegels (niet op GitHub)

Alles in deze map, behalve dit bestand, staat in `.gitignore` en gaat **niet** mee naar GitHub.
Gebruik deze map voor tegels die je wel thuis mag gebruiken maar niet openbaar mag delen,
zoals de gratis set van **Forgotten Adventures** ("for personal use").

```
src/tiles/prive/
  props/   barrel.png, hay.png, trough.png, ...
  floor/   dirt.png, cobble.png, ...
```

- **Naam = tegel-id** (zie `src/tiles/README.md` en de projectcontext). Hernoem dus de kopie:
  `Barrel_Wood_A1_1x1.png` → `barrel.png`.
- Kopieer alleen wat je nodig hebt, niet de hele bibliotheek.
- Een tegel hier wint van een tegel met dezelfde naam in `src/tiles/props/` of `src/tiles/floor/`.
- **Back-up:** GitHub bewaart deze map niet. Hou zelf een kopie bij (bv. OneDrive of de Raspberry Pi).
- **Niet online zetten:** een build met deze tegels (map `dist/`) bevat de afbeeldingen. Zet die dus
  niet op GitHub Pages of een andere openbare site; thuis draaien (`dev:telefoon`, of op de Pi) is prima.
