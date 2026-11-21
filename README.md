# makefun-gta6-3d

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/saidgank/makefun-gta6-3d/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/saidgank/makefun-gta6-3d/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Heat 3D** — a third-person 3D open-world crime game in one static page, built with three.js. Cruise the golden-hour coastal city of Solmar: four districts (Downtown, Beachfront, the Docks, the Suburbs) each with its own standing that rises with jobs done there and falls with the heat you bring. Work a 9-job story chain for Marisol Vega — deliveries, a timed package run, a forced three-star escape, the Beachfront Dash street race against Pico, a dock shootout, a convoy ambush, a garage heist and a four-star night finale under the police helicopter — while respect ranks (Rookie → Runner → Fixer → Shotcaller → Kingpin) unlock the SMG and Dre's getaway call-in. Full wanted system: police pursuit with ramming AI, roadblocks at three stars, the Condor helicopter with a searchlight at four, a bust meter, fines and hospital bills. Steal any car, outrun traffic AI, fight with fists/pistol/SMG, repair and respray at Kingpin Garage, and ride with three synth radio stations. HUD with district standing, GPS-routed minimap with police blips, and localStorage saves. No build step, no network calls — every system is a small classic script under `game/js/`, one job per file.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
# (or serve the game/ folder with any static file server)
```

Controls: WASD drive/walk · mouse aim (click the game to lock the pointer) · left mouse fire · **E** enter/exit car · **F** interact / start jobs · **G** Dre's getaway call-in · **1/2/3** fists/pistol/SMG · **R** radio station · **M** mute · **P** pause · Shift sprint · Space handbrake.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kvcj2dy8&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
