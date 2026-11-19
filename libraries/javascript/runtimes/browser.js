// Conformance in real browsers, on the main thread and in a module worker:
// serves the repository, loads runtimes/check.js unbundled as native ES
// modules, and runs it in Chromium, Firefox and WebKit through Playwright.
//
//   cd runtimes && npm install && npx playwright install chromium firefox webkit
//   npm run browsers
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' }

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
const load = async () => Object.fromEntries(await Promise.all(
  ['versions', 'precedence', 'ranges', 'desugar'].map(async (n) => [n, await (await fetch('/conformance/' + n + '.json')).json()])))
const suite = await load()
const { check } = await import('/libraries/javascript/runtimes/check.js')
const main = check(suite)
const worker = await new Promise((resolve, reject) => {
  const w = new Worker(URL.createObjectURL(new Blob([
    "import { check } from '" + location.origin + "/libraries/javascript/runtimes/check.js';" +
    "onmessage = (e) => postMessage(check(e.data));"
  ], { type: 'text/javascript' })), { type: 'module' })
  w.onmessage = (e) => resolve(e.data)
  w.onerror = (e) => reject(new Error(e.message))
  w.postMessage(suite)
})
window.result = { main, worker }
</script>`

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE)
  if (!/^\/(packages\/parser\/(index\.js|lib\/|runtimes\/)|conformance\/)/.test(path)) return res.writeHead(404).end()
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/plain' }).end(await readFile(root + path.slice(1)))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/`

let failed = false
for (const type of [chromium, firefox, webkit]) {
  let browser
  try {
    browser = await type.launch()
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(url)
    const result = await page.waitForFunction(() => window.result, null, { timeout: 30000 }).then((h) => h.jsonValue())
    for (const [where, r] of Object.entries(result)) {
      for (const f of r.failures) console.error(`FAIL ${type.name()} ${where}: ${f}`)
      console.log(`${type.name()} ${browser.version()} (${where === 'main' ? 'page' : 'worker'}): ${r.total - r.failures.length}/${r.total} checks passed`)
      failed ||= r.failures.length > 0
    }
    for (const e of errors) console.error(`ERROR ${type.name()}: ${e}`)
    failed ||= errors.length > 0
  } catch (e) {
    console.error(`ERROR ${type.name()}: ${e.message}`)
    failed = true
  } finally {
    await browser?.close()
  }
}
server.close()
process.exit(failed ? 1 : 0)
