# Example: Vanilla HTML / CDN

Single `index.html` showing how to embed a Swfte ChatFlow with no build tooling — just a `<script type="module">` and a CDN-hosted ESM bundle.

## Run

Either open `index.html` in a browser directly, or serve it with any static server:

```bash
npx serve .
```

Edit `index.html` and replace:

- `cf_yourchatflowid` with your ChatFlow ID
- `sk-swfte-...` with a Swfte API key (demo only)
- `226` with your workspace ID

## Production note

This example loads the API key directly into the browser, which is fine for local demos but **never** for public deployments. Use the [proxy pattern](../../docs/proxy-pattern.md) in production.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
