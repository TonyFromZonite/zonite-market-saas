#!/usr/bin/env node
/**
 * Pipeline de pré-publication ZONITE Market.
 *
 * Étapes :
 *  1. Tests unitaires Vitest (187 tests attendus).
 *  2. Smoke tests Playwright sur /TableauDeBord, /InscriptionVendeur, /EspaceVendeur.
 *
 * Usage : npm run pre-publish
 * Toute étape qui échoue interrompt le pipeline avec un code de sortie != 0.
 */
import { spawnSync } from "node:child_process";

const steps = [
  {
    name: "Tests unitaires (Vitest)",
    cmd: "npm",
    args: ["run", "test", "--", "--reporter=default"],
  },
  {
    name: "Smoke tests navigateur (Playwright)",
    cmd: "npx",
    args: ["playwright", "test", "e2e/smoke-pre-publish.spec.ts", "--reporter=list"],
  },
];

let failed = false;
for (const step of steps) {
  console.log(`\n▶ ${step.name}`);
  const r = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`✖ Échec de l'étape : ${step.name}`);
    failed = true;
    break;
  }
  console.log(`✓ OK : ${step.name}`);
}

if (failed) {
  console.error("\n❌ Pipeline de pré-publication échoué — ne publiez pas.");
  process.exit(1);
}
console.log("\n✅ Pipeline de pré-publication réussi — prêt à publier.");
