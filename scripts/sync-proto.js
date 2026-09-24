#!/usr/bin/env node
// Copia proto/auth.proto (fuente unica en la raiz) a <servicio>/proto/auth.proto.
// Correr a mano (`node scripts/sync-proto.js auth-service` / `gateway`) despues
// de editar proto/auth.proto, ANTES de `docker build`/`docker compose build`:
// la copia sincronizada queda versionada dentro de cada servicio para que su
// build context siga siendo autocontenido (igual que notifications-service) y
// no dependa de una carpeta hermana durante el build del contenedor.
// Uso: node scripts/sync-proto.js <auth-service|gateway>
const { copyFileSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const root = join(__dirname, '..');
const source = join(root, 'proto', 'auth.proto');
const destination = join(__dirname, '..', process.argv[2] ?? '.', 'proto', 'auth.proto');

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`proto/auth.proto -> ${destination}`);
