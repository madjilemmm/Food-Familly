#!/bin/bash
# Lance la pile locale des essais : PostgreSQL, PostgREST (3001, comme l'API de Supabase) et un faux Supabase (54321).
# Prérequis : voir ../README.md (PostgreSQL 16, le binaire postgrest dans ce dossier, la base « atable »).
cd "$(dirname "$0")" || exit 1
service postgresql start >/dev/null 2>&1; sleep 2
curl -s -o /dev/null localhost:3001/ || (nohup ./postgrest postgrest.conf > postgrest.log 2>&1 &)
curl -s -o /dev/null localhost:54321/rest/v1/ || (nohup node fake-supabase.mjs > fake.log 2>&1 &)
sleep 2
pg_isready -h localhost
