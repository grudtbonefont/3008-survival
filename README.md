# 3008 Survival v2.6.0

An original multiplayer survival game you play in the browser. You are trapped in an endless, procedurally generated furniture store. By day the faceless employees ignore you. When the store closes they hunt in groups, so scavenge, craft and build a fort before night falls. Everything in the game (models, textures, sounds) is original and made in code.

**Play:** https://three008-survival.onrender.com

## What's new in 2.6: phone + discoverable controls

- **PC:** Escape no longer races with pointer-lock (pause stayed closed — felt like half the keys were missing). F1 / `?` toggles a compact controls hint; full list lives in pause → Controls. Camera sensitivity + smooth look. Clear prompts: `E — взять`, `ЛКМ — ломать`.
- **Phone:** Touch detection, left virtual joystick, right look-drag, buttons for jump / sprint / attack / interact / place / eat / inventory / craft / chat / menu. Tappable hotbar. Landscape preferred with a portrait rotate hint, fullscreen, safe-area insets, no page zoom/scroll.
- **Perf:** Auto/low/med/high graphics (pixel ratio, shadows, fog/draw distance). Model detail kept at medium/high.

## What's new in 2.5: minimalist interface
- New design system: one neutral font, near-white text, translucent blurred dark panels, a single accent colour, thin lines, no emoji (monochrome inline SVG icons in `public/js/icons.js`).
- HUD: thin unlabeled bars bottom-left (hidden when full), minimal hotbar, small day/time pill, minimap behind a toggle (**N** / map button), chat fades when idle, short subtle kill feed and toasts, prompts as small text under the crosshair.
- Interface modes (**H** or Settings): Full / Minimal HUD / Hide HUD.
- Main menu, pause/settings, avatar editor, inventory/crafting/chest, achievements, leaderboard and death screen restyled. Wave emote moved to **B**.
- 3D models unchanged.

## What's new in 2.4: avatar editor, inventory, crafting, destruction

- **Avatar editor** (menu → «Персонаж» or pause menu): live rotating 3D preview with skin, face, hair, hats, glasses/masks, shirt and pants patterns, back accessories and body type, plus colour pickers. It also has Random and Reset buttons. Some items unlock as you level up. The avatar is saved in localStorage, validated on the server and visible to other players.
- **Russian by default**, with an English toggle in settings. The browser language is detected.
- **Inventory screen (I)**: hotbar and backpack grid. Drag and drop, stacking, Shift-click to split, Ctrl-click to drop one, drag outside the window to discard, tooltips, and 1–8 over an item to bind it to the hotbar.
- **Crafting tab (C)**: categories, have/need counts per material, workbench and stove requirements, and a craft button.
- **Chests**: a chest tab that works the same way.
- **Server-authoritative destruction**: furniture has HP and drops materials (wood, metal, cloth, plastic, glass) based on what it is made of. There are cracks, debris, material-specific sounds, and a hammer or axe breaks things faster. At night employees smash barricades. Broken furniture respawns, except inside claimed bases.
- **Placement UX**: grid and snap preview (green when valid, red when not), R to rotate, V or Alt+wheel to pick a height (you can place on tables and shelves), Ctrl+Z to undo.
- **Locations**: hanging, coloured zone banners with icons and Russian names, per-zone lighting tint, and a minimap zone readout.
- **Polish**: smoothed camera, particles, footsteps that change with the floor surface, torch and lantern lights at night, FPS counter, distance LOD, achievements panel, daily streak and level unlocks.

## What's new in 2.3: closer to the original SCP-3008 Roblox game
2.3 also includes the 2.2 character work: blocky R6-style avatars made of boxes, with every animation, plus updated employee variants and showcase.

The gameplay now follows the community-documented mechanics of the Roblox game *SCP-3008* (v2.75). All code, models and sounds here are original. No Roblox assets were used.
- **Day cycle:** day lasts 6 min and night 5 min. Each day has a weekday. Closing and opening announcements play over the store PA, with a 30 s closing warning.
- **Employees:** extra employees spawn at night and despawn at dawn. They hunt anyone they spot, but give up when you get far enough away. At closing they say "Excuse me, the store is now closed. Please exit the building." (speech bubble, plus optional browser TTS).
- **Events:**
  - Foggy Day (every 15th day, plus a small random chance): thick white fog, and employees hunt in daylight and hit much harder.
  - Blood Night (every 10th day, plus a 5% chance): red lighting, and employees are faster, attack more often, see further and reach higher.
- **Food from the wiki's consumables list:** apple, banana, beans, burger, chips, chocolate, cookie, fish crackers, hot dog, ice cream, lemon (and slice), meatballs, pizza, donut, 2 L cola, soda, cola, water, cake, candy corn.
  - Medkits heal over time. Glass shards hurt you.
  - Food restocks only on Monday and Friday mornings. The Cafeteria plot holds the biggest stash.
- **Hunger and energy:** hunger drains about 1 point per 15 s, and twice as fast at 0 energy. At 0 hunger you lose health.
  - Energy drains faster while sprinting, and you can't sprint at 0 energy. Sleep in a bed to recover.
  - Health regenerates only while you are fed and rested. There is no thirst stat, because the original has none.
- **Building:**
  - Grab furniture and stack it on top of other pieces to build up. The placement ghost shows where it will land.
  - Press **L** to anchor (weld) your own pieces so nobody else can move them.
  - You can't grab a piece that has something resting on it.
  - A Claim Flag sets up a **Base Camp** that protects your build and becomes your respawn point. `/team` works as an alias for `/party`.
- **Plots/landmarks:**
  - Cafeteria, Play Plot, Industrial Shelves (pallets and work lights), The Atrium.
  - New: Snack Bar, Pharmacy (medkits), Greenhouse and the Info Booth.
- **Roblox-style HUD:**
  - Player list (Days / Level) at top right, chat at top left, and a menu button.
  - Day, weekday and phase timer at top centre, with stat bars above the hotbar.
  - Smaller minimap.
  - **T** drops up to 4 waypoints (3D beams, minimap marks, distances); **Shift+T** clears them.

**Differences from the original (on purpose):**
- The original has no player weapons, and its employees can't be killed (you can only shove them). Here, crafted weapons are kept as an extra, and employees are only *knocked down* for a few seconds before they get back up.
- Empty hands shove.

**Sources (community wikis, read October 2026):**
- https://scp3008-roblox.fandom.com/wiki/Consumables
- https://scp3008-roblox.fandom.com/wiki/Employees
- https://scp3008-roblox.fandom.com/wiki/Day_Cycle
- https://scp3008-roblox.fandom.com/wiki/Foggy_Day
- https://scp3008-roblox.fandom.com/wiki/Blood_Night
- https://scp3008-roblox.fandom.com/wiki/Survival_Guide
- https://scp3008-roblox.fandom.com/wiki/Category:Plots
- https://scp3008-roblox.fandom.com/wiki/Cafeteria_(plot)
- https://scp3008-roblox.fandom.com/wiki/Industrial_Shelves_(plot)
- https://roblox-3008-wiki.fandom.com/wiki/Floating_House_(plot)
- https://official-rblx-scp3008.fandom.com/wiki/Controls
- SCP-3008 itself: https://scp-wiki.wikidot.com/scp-3008 (CC BY-SA 3.0)

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
| L | Anchor / weld your furniture |
| T / Shift+T | Waypoint / clear waypoints |
| M | Menu |
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
