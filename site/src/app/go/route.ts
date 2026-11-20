import { REPO } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Vanity import path for the Go module in libraries/go (`go get
 * semver.xyz/go`; the subdirectory field needs Go 1.25+). The Go tool reads
 * the meta tags; a person is sent on to the Go section of the libraries page.
 */
export const GET = () =>
  new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>semver.xyz/go: Semantic Versions for Go</title>
  <meta name="go-import" content="semver.xyz/go git ${REPO} libraries/go">
  <meta name="go-source" content="semver.xyz/go ${REPO} ${REPO}/tree/main/libraries/go{/dir} ${REPO}/blob/main/libraries/go{/dir}/{file}#L{line}">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=/libraries/#go">
</head>
<body>
  <p><code>go get semver.xyz/go</code>. Documentation: <a href="https://pkg.go.dev/semver.xyz/go">pkg.go.dev/semver.xyz/go</a>, <a href="/libraries/#go">semver.xyz/libraries</a>.</p>
</body>
</html>
`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
