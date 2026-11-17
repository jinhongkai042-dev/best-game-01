// Stardust Courier submission program. Node.js 22.18+, standard library only.
// Run locally: MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader uses /output when MAKEFUN_OUTPUT_DIR is not set.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const folders = ['game', 'screenshots'];

// Refuse destinations that could overwrite or recursively copy the inputs.
for (const folder of folders) {
  const source = join(here, folder);
  if (out === here || out === source || out.startsWith(source + sep)) {
    throw new Error('The output directory must be separate from the submission inputs.');
  }
  for (const targetFolder of folders) {
    const target = join(out, targetFolder);
    if (source === target || source.startsWith(target + sep)) {
      throw new Error('The output directory must not contain the submission inputs.');
    }
  }
}

mkdirSync(out, { recursive: true });
for (const folder of folders) {
  const target = join(out, folder);
  // Replace only generated folders so deleted source files cannot linger.
  rmSync(target, { recursive: true, force: true });
  cpSync(join(here, folder), target, {
    recursive: true,
    // Finder metadata is not part of the playable game or its screenshots.
    filter: (source) =>
      basename(source) !== '.DS_Store' && !basename(source).startsWith('._'),
  });
}

// Use the gate's unchanged builder and caps; write its exact canonical bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (dossier.byteLength > 1572864) {
  throw new Error('dossier.json exceeds the 1.5 MiB submission limit.');
}
writeFileSync(join(out, 'dossier.json'), dossier);