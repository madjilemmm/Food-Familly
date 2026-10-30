#!/bin/bash
# Lance des scénarios l'un après l'autre (base remise à zéro entre chacun) : bash tests/e2e/lancer.sh parcours e2e gouts
# Résultat dans $SP/resultats/ ; une ligne par scénario dans _resume.txt (code de sortie, durée, nombre de ✓).
cd "$(dirname "$0")/../.." || exit 1
: "${SP:?SP doit désigner tests/e2e/stack (export SP=\$PWD/tests/e2e/stack)}"
OUT=$SP/resultats; mkdir -p "$OUT"; rm -f "$OUT/_resume.txt"
for s in "$@"; do
  bash "$SP/reset.sh" >/dev/null 2>&1
  debut=$(date +%s)
  timeout 420 node "tests/e2e/$s.mjs" > "$OUT/$s.txt" 2>&1
  echo "$s exit=$? $(( $(date +%s) - debut ))s $(grep -c '^✓' "$OUT/$s.txt") ✓ $(grep -c '^✗' "$OUT/$s.txt") ✗" >> "$OUT/_resume.txt"
done
echo FINI >> "$OUT/_resume.txt"
