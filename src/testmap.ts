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
