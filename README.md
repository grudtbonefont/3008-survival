# 3008 Survival v2.1.0

An original multiplayer survival game you play in the browser. You are trapped in an endless, procedurally generated furniture store. By day the faceless employees ignore you. When the store closes they hunt in groups, so scavenge, craft and build a fort before night falls. Everything in the game (models, textures, sounds) is original and made in code.

**Play:** https://three008-survival.onrender.com

## What's new in 2.1 — model rework
- All 33 furniture types rebuilt from a shared catalogue (`shared/furniture.js`) at real-world dimensions, with bevelled/rounded edges, handles, drawer seams, pillows, blankets, lampshades, books and consistent palettes. Everything stands on the floor and snaps to the grid.
- `node tools/check-furniture.mjs` validates every model: floor contact, footprint, height, and no floating parts.
- Furniture is merged into one mesh per material per chunk (rounded-box / cylinder / sphere templates + vertex colours), which keeps draw calls low.
- Players use a jointed humanoid rig (neck, shoulders, elbows, hands, hips, knees, feet) with smooth idle / walk / run / jump / carry / emote animations.
- Employees share the rig in a yellow-shirt/blue-pants uniform with a faceless waxy head. Variants: Staff, the thin long-armed Runner, and the tall Giant. At night their red eyes glow.
- Model showcase: open `/showcase.html` (`?types=bed,sofa`, `?chars&night&pose=walk`).

## Features
- **World:** infinite seeded store in 24 m chunks with themed zones (Bedrooms, Kitchens, Showroom, Restaurant, Bathrooms, Offices, Warehouse, Clock Atrium…) and dozens of furniture types.
- **Visuals:** ACES tone mapping, fog, flickering ceiling lights, a dimmed night with red emergency lighting, a flashlight (F), shadows, vignette and grain. Three quality presets.
- **Employees:** pathfinding (A*) with group flanking. Types are Staff, Runner and Giant. They smash barricades when stuck and get 20 s of grace after closing time.
- **Survival:** health, hunger, energy and stamina. Sleep, cooking and crafting, tool durability, opt-in PvP (`/pvp`).
- **Building:** grab or place any loose furniture, rotate it, craft barricades, lock items (L). Builds persist across restarts.
- **Social:** XP and levels, leaderboard (Tab), parties, emotes, chat, kill feed, nameplates.
- **Audio:** procedural WebAudio sound effects and ambience.
- **UI:** minimap and compass, main menu, settings, pause, help, touch controls (`?touch`).

## Controls
| Key | Action |
|---|---|
| WASD / Shift / Space | Move / sprint / jump |
| E | Interact / pick up / grab |
| Q or LMB | Place (R rotates) |
| X or RMB | Use item |
| G | Drop |
| Z | Sleep |
| L | Lock |
| C | Craft |
| F | Flashlight |
| Tab | Leaderboard |
| Enter | Chat |
| Esc | Pause |
| H / J / K / U / Y | Wave / dance / sit / point / cheer |

## Run locally
```
npm install
npm start      # http://localhost:3000
npm test       # multiplayer integration test
```

## Environment
- `PORT`
- `SEED`: world seed.
- `DATA_DIR`: where `world.json` is saved. Saves run every 30 s and on SIGTERM.
- `START_TIME`
- `ALLOW_DEBUG=1`: enables `/debug/time?t=`, `/time day|night` and the client param `?debugTime=day|night|<sec>`.
- Client params: `?autoplay&name=X`.

## Deploy (Render)
`render.yaml` sets up a free Node web service. Health check: `/health`, which returns the version, players and time.

**Note:** free instances have an ephemeral disk, so placed builds reset on redeploy or restart unless you attach a persistent disk and point `DATA_DIR` at it.
