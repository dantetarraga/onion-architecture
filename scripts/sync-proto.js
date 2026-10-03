#!/usr/bin/env node
// Copia cada contrato de proto/ (fuente unica en la raiz) a la carpeta proto/
// de cada servicio que lo usa, como servidor o como cliente. La copia queda
// versionada dentro de cada servicio para que su build context de Docker siga
// siendo autocontenido (igual que notifications-service) y no dependa de una
// carpeta hermana durante el build del contenedor.
//
// Correr despues de editar cualquier archivo de proto/, ANTES de
// `docker compose build`:
//   node scripts/sync-proto.js           # sincroniza todo
//   node scripts/sync-proto.js --check   # falla si alguna copia quedo desactualizada
const { copyFileSync, mkdirSync, readFileSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');

const root = join(__dirname, '..');

// contrato -> servicios que lo necesitan (servidor primero).
const CONSUMERS = {
  'auth.proto': ['auth-service', 'gateway', 'backend'],
  'payments.proto': ['payments-service', 'backend'],
  'parking.proto': ['backend', 'payments-service'],
};

const check = process.argv.includes('--check');
let stale = 0;

for (const [file, services] of Object.entries(CONSUMERS)) {
  const source = join(root, 'proto', file);
  const content = readFileSync(source);

  for (const service of services) {
    const destination = join(root, service, 'proto', file);
    const upToDate =
      existsSync(destination) && readFileSync(destination).equals(content);

    if (check) {
      if (!upToDate) {
        console.error(`desactualizado: ${service}/proto/${file}`);
        stale++;
      }
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    console.log(`proto/${file} -> ${service}/proto/${file}`);
  }
}

if (check && stale > 0) {
  console.error('Correr `node scripts/sync-proto.js` para regenerar las copias.');
  process.exit(1);
}
