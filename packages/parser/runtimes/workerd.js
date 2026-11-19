// Conformance in workerd, the open-source runtime behind Cloudflare Workers
// (no Node APIs, no DOM). Loads the library's files unbundled as ES modules.
//
//   cd runtimes && npm install && npm run workerd   (or set WORKERD to a binary)
import { spawn } from 'node:child_process'
import { readdirSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const lib = readdirSync(join(root, 'packages/parser/lib')).filter((f) => f.endsWith('.js')).map((f) => `packages/parser/lib/${f}`)
const modules = ['packages/parser/index.js', 'packages/parser/runtimes/check.js', ...lib]
const suites = ['versions', 'precedence', 'ranges', 'desugar']
const dir = mkdtempSync(join(tmpdir(), 'sv-workerd-'))
// workerd embeds files relative to its config, so stage everything beside it.
for (const f of [...modules, ...suites.map((s) => `conformance/${s}.json`)]) {
  mkdirSync(dirname(join(dir, f)), { recursive: true })
  copyFileSync(join(root, f), join(dir, f))
}

writeFileSync(join(dir, 'worker.js'), `
import { check } from 'packages/parser/runtimes/check.js'
${suites.map((s) => `import ${s} from 'conformance/${s}.json'`).join('\n')}
export default {
  fetch () {
    return Response.json(check({ ${suites.join(', ')} }))
  }
}
`)
const port = 20000 + Math.floor(Math.random() * 20000)
writeFileSync(join(dir, 'config.capnp'), `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .worker)],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")],
);
const worker :Workerd.Worker = (
  compatibilityDate = "2026-01-01",
  modules = [
    (name = "worker.js", esModule = embed "worker.js"),
${modules.map((m) => `    (name = "${m}", esModule = embed "${m}"),`).join('\n')}
${suites.map((s) => `    (name = "conformance/${s}.json", json = embed "conformance/${s}.json"),`).join('\n')}
  ],
);
`)

const child = spawn(process.env.WORKERD || 'workerd', ['serve', join(dir, 'config.capnp')], { stdio: ['ignore', 'ignore', 'pipe'] })
child.stderr.on('data', (d) => process.stderr.write(d))
let result
for (let i = 0; i < 100 && !result; i++) {
  await new Promise((r) => setTimeout(r, 200))
  result = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.json()).catch(() => undefined)
}
child.kill()
rmSync(dir, { recursive: true, force: true })
if (!result) {
  console.error('workerd did not answer')
  process.exit(1)
}
for (const f of result.failures) console.error(`FAIL ${f}`)
console.log(`workerd: ${result.total - result.failures.length}/${result.total} checks passed`)
process.exit(result.failures.length ? 1 : 0)
