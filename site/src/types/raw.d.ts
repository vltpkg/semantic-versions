// The canonical Markdown and the grammars are bundled as strings (next.config.ts
// gives *.md and *.bnf to raw-loader), so the graph and the text routes can
// serve them wherever the server runs.
declare module "*.md" {
  const text: string;
  export default text;
}
declare module "*.bnf" {
  const text: string;
  export default text;
}
