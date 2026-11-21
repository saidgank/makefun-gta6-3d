// Solmar Heat 3D — hand-in program for the make.fun "Make GTA 6" bounty.
//
// The entry itself is the static site in game/: a third-person 3D
// open-world crime game (Solmar, a golden-hour coastal city) written as
// plain classic scripts with three.js r149 vendored beside them. It runs
// offline in a desktop browser — no build step, no network calls.
//
// This program's only job is delivery. It copies game/ and screenshots/
// into the output directory and writes dossier.json there with the
// vendored make.fun library, under the scorer's published caps: at most
// 4 screenshots of at most 256 KiB each, at most 993 files / 48 MiB under
// game/, no game path longer than 1000 bytes, and the dossier's embedded
// source text truncated at 163840 bytes. Running it twice over the same
// tree produces a byte-identical dossier.
//
// Local check (Node 22):  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (the vendored builder throws if the tree breaks any cap above, so a
// clean run doubles as the cap audit)
// Local play:             node serve.ts  →  http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(entryDir, 'game'))) {
  throw new Error('game/ is missing next to main.ts — run this from the entry root');
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(entryDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(entryDir, 'screenshots'))) {
  cpSync(join(entryDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
