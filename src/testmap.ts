// De testkaart uit de projectcontext (al gespeeld, geen spoiler).
export const TEST_MAP = `{
  "type": "map", "version": 1, "name": "Stal",
  "cols": 10, "rows": 10,
  "floor": [
    { "tile": "cobble", "area": "A9:J10" },
    { "tile": "dirt", "area": "A1:J8" }
  ],
  "walls": [
    { "tile": "wood", "path": [[4,8],[0,8],[0,0],[10,0],[10,8],[6,8]] },
    { "tile": "wood", "path": [[7,0],[7,3]] },
    { "tile": "wood", "path": [[8,3],[10,3]] },
    { "tile": "wood", "path": [[7,5],[10,5]] },
    { "tile": "wood", "path": [[7,5],[7,6]] },
    { "tile": "wood", "path": [[7,7],[7,8]] }
  ],
  "doors": [
    { "id": "zadel", "tile": "door-wood", "cell": "H7", "side": "W", "state": "closed" }
  ],
  "props": [
    { "tile": "hay", "area": "A1:B1" },
    { "tile": "hay", "cell": "A2" },
    { "tile": "ladder", "cell": "D1" },
    { "tile": "sacks", "cell": "F4" },
    { "tile": "trough", "cell": "C7" }
  ],
  "terrain": [
    { "kind": "difficult", "area": "A1:B1" },
    { "kind": "difficult", "area": "A2:A2" }
  ],
  "lights": [{ "cell": "E9", "radius": 3, "color": "#b48cff" }],
  "regions": [{ "id": "zadelkamer", "area": "H6:J8", "hidden": true }],
  "tokens": [
    { "id": "Ak", "name": "Akmenos", "side": "player", "cell": "E9", "speed": 6 },
    { "id": "Am", "name": "Amara", "side": "player", "cell": "F9", "speed": 7 },
    { "id": "P", "name": "Paard", "side": "npc", "cell": "I2" },
    { "id": "T1", "name": "T1", "side": "enemy", "cell": "B2" },
    { "id": "T2", "name": "T2", "side": "enemy", "cell": "D4" }
  ]
}`;

// Een testpatch voor de stal: verplaatst T1, haalt T2 weg, zet T3 erbij,
// Akmenos ligt neer, de deur van de zadelkamer gaat open en de zadelkamer wordt zichtbaar.
export const TEST_PATCH = `{
  "type": "patch", "version": 1, "map": "Stal",
  "tokens": {
    "T1": { "cell": "C3" },
    "T2": { "remove": true },
    "T3": { "add": { "name": "T3", "side": "enemy", "cell": "G7" } },
    "Ak": { "conditions": ["prone"] }
  },
  "doors": { "zadel": { "state": "open" } },
  "reveal": ["zadelkamer"]
}`;

// Een algemeen dorp om stijlen te vergelijken (geen campagne-inhoud).
// Twee huizen, een herberg, een moestuin met hek, een plein met waterput en kar.
export const TEST_VILLAGE = `{
  "type": "map", "version": 1, "name": "Dorpsplein",
  "cols": 24, "rows": 18,
  "floor": [
    { "tile": "grass", "area": "A1:X18" },
    { "tile": "dirt", "area": "A9:X10" },
    { "tile": "dirt", "area": "K1:L18" },
    { "tile": "cobble", "area": "I6:N13" },
    { "tile": "wood", "area": "B2:G6" },
    { "tile": "wood", "area": "Q2:W6" },
    { "tile": "tiles", "area": "B12:H17" }
  ],
  "walls": [
    { "tile": "stone", "path": [[4,6],[1,6],[1,1],[7,1],[7,6],[5,6]] },
    { "tile": "wood", "path": [[19,6],[16,6],[16,1],[23,1],[23,6],[20,6]] },
    { "tile": "brick", "path": [[4,11],[1,11],[1,17],[8,17],[8,11],[5,11]] },
    { "tile": "fence", "path": [[16,13],[16,11],[23,11],[23,17],[16,17],[16,14]] }
  ],
  "doors": [
    { "id": "huis1", "tile": "door-wood", "cell": "E6", "side": "Z", "state": "closed" },
    { "id": "raam1", "tile": "window", "cell": "C2", "side": "N" },
    { "id": "huis2", "tile": "door-wood", "cell": "T6", "side": "Z", "state": "locked" },
    { "id": "herberg", "tile": "door-iron", "cell": "E12", "side": "N", "state": "open" },
    { "id": "raam2", "tile": "window", "cell": "H14", "side": "O" }
  ],
  "props": [
    { "tile": "bed", "area": "B2:B3" },
    { "tile": "fireplace", "cell": "F2" },
    { "tile": "table", "area": "C4:D4" },
    { "tile": "chair", "cell": "C5" },
    { "tile": "chair", "cell": "D5", "rot": 180 },
    { "tile": "chest", "cell": "G6" },
    { "tile": "barrel", "cell": "G2" },
    { "tile": "rug", "area": "R4:U5" },
    { "tile": "bookshelf", "area": "Q2:R2" },
    { "tile": "cupboard", "cell": "W3" },
    { "tile": "table", "area": "S3:T3" },
    { "tile": "counter", "area": "B13:D13" },
    { "tile": "fireplace", "cell": "B16" },
    { "tile": "table", "area": "D15:E15" },
    { "tile": "table", "area": "F15:G15" },
    { "tile": "bench", "area": "D16:E16" },
    { "tile": "bench", "area": "F16:G16" },
    { "tile": "barrel", "cell": "H12" },
    { "tile": "barrel", "cell": "H13" },
    { "tile": "well", "area": "I7:J8" },
    { "tile": "cart", "area": "M11:N13" },
    { "tile": "crate", "cell": "N7" },
    { "tile": "crate", "cell": "N8" },
    { "tile": "barrel", "cell": "I12" },
    { "tile": "sacks", "cell": "I13" },
    { "tile": "lantern", "cell": "M7" },
    { "tile": "tree", "area": "H2:J4" },
    { "tile": "tree", "area": "N2:P4" },
    { "tile": "tree", "area": "N14:P16" },
    { "tile": "bush", "cell": "I15" },
    { "tile": "bush", "cell": "B8" },
    { "tile": "bush", "cell": "R8" },
    { "tile": "rock", "cell": "X12" },
    { "tile": "flowers", "area": "R13:S14" },
    { "tile": "flowers", "area": "U13:V14" },
    { "tile": "hay", "area": "U16:V16" },
    { "tile": "sacks", "cell": "T16" }
  ],
  "regions": [{ "id": "huis2", "area": "Q2:W6", "hidden": true }],
  "tokens": [
    { "id": "Ak", "name": "Akmenos", "side": "player", "cell": "K14", "speed": 6 },
    { "id": "Am", "name": "Amara", "side": "player", "cell": "L14", "speed": 7 },
    { "id": "W", "name": "Waard", "side": "npc", "cell": "E14" },
    { "id": "H", "name": "Handelaar", "side": "npc", "cell": "M8" },
    { "id": "B1", "name": "Bandiet 1", "side": "enemy", "cell": "R16" },
    { "id": "B2", "name": "Bandiet 2", "side": "enemy", "cell": "S16" }
  ]
}`;
