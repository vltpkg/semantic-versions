// Conformance on server runtimes: `node server.js`, `deno run --allow-read
// server.js` and `bun server.js` (from runtimes/). Reads the suite with node:fs,
// which all three provide; the library itself imports nothing.
import { readFile } from 'node:fs/promises'
import { check, SUITES } from './check.js'

const runtime = globalThis.Deno ? `Deno ${Deno.version.deno}` : globalThis.Bun ? `Bun ${Bun.version}` : `Node ${process.versions.node}`
const suite = {}
for (const name of SUITES) {
  suite[name] = JSON.parse(await readFile(new URL(`../../../conformance/${name}.json`, import.meta.url), 'utf8'))
}
const { total, failures } = check(suite)
for (const f of failures) console.error(`FAIL ${f}`)
console.log(`${runtime}: ${total - failures.length}/${total} checks passed`)
if (failures.length) process.exit(1)
