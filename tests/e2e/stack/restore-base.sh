#!/bin/bash
# Remet la base « atable » dans l'état de atable-base.dump (une famille de démonstration, ses recettes), pour repartir de zéro.
export PGPASSWORD=postgres
SP="$(cd "$(dirname "$0")" && pwd)"
pg_restore -h localhost -U postgres -d atable --clean --if-exists --no-owner "$SP/atable-base.dump" 2>&1 | grep -v "does not exist" | head -3
psql -h localhost -U postgres -d atable -q -c "notify pgrst, 'reload schema'"
