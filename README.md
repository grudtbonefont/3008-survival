# 3008 Survival — The Infinite Store

An original, browser-based, third-person online multiplayer survival game inspired by SCP-3008.
All code and art are written from scratch (primitive/procedural 3D with Three.js). No Roblox assets or code.

## Features
- Infinite, procedurally generated furniture store (24 m chunks: aisles, bedrooms, living rooms, dining, displays, showrooms, pillars, signs), deterministic from a shared server seed; chunk streaming + one instanced draw call per chunk.
- Third-person camera (pointer lock, mouse orbit), WASD, sprint (uses energy), jump, climb onto low furniture.
- Server-synced day/night cycle (5 min day / 3 min night); lights dim at night, store announcements on screen.
- Server-simulated employee NPCs: wander in the day, chase and attack at night (red eyes). Hitting one in daytime makes it aggressive.
- Health, hunger, energy. Food (meatballs, hot dog, juice, cake), medkits, and melee weapons (bat, pipe, crowbar) spawn in the world and respawn after 4 min.
- Pick up any furniture (E), carry it, rotate (R) and place it (LMB/Q) to build walls/bases — shared with all players.
- 6-slot hotbar inventory, death (lose inventory) & respawn, name entry, name labels, chat, online list.
- Server-authoritative: time, NPCs, damage, item spawns/pickups, furniture, stats. Client-side movement with server sanity checks.

## Controls
WASD move · Shift sprint · Space jump · Mouse look (click to lock) · Shift+wheel zoom · E pick up / grab furniture ·
LMB attack / use food / place furniture · R rotate carried furniture · Q place · 1-6 / wheel select slot · G discard · F flashlight · Enter chat

## Run locally
```bash
npm install
npm start          # http://localhost:3000  (PORT env var respected; optional SEED env var)
npm test           # headless 2-client multiplayer test
```

## Deploy to Render.com
1. Push this folder to a GitHub repo (`git init && git add . && git commit -m init && git remote add origin <url> && git push -u origin main`).
2. On https://dashboard.render.com click **New → Web Service**, connect the repo.
3. Runtime **Node**, Build command `npm install`, Start command `npm start` (or use **New → Blueprint** and it picks up `render.yaml`).
4. Deploy and open `https://<your-service>.onrender.com`. Share the URL; everyone joins the same world.

Note: on Render's free plan the service sleeps when idle (first load takes ~30-60 s) and the world (placed furniture) resets on restart.
