# Pixelate

Turn images and GIF animations into pixel artwork using structure or K-centroid reconstruction, shared palettes and sequence-consistent settings.

## Install

Requires a running [Ink OS](https://github.com/siliconjungle/ink-os-platform) instance and its `ink-os` CLI. Use Node.js 24 or later for development.

```sh
git clone https://github.com/siliconjungle/ink-app-pixelate.git
cd ink-app-pixelate
npm ci
npm test
npm run build
# Select your Ink instance using its CLI connection profile.
ink-os deploy .
```

The CLI deploys committed source from your checkout. Commit any edits before deploying them. No credentials or personal instance configuration belong in this repository.

## Behaviour and limits

Export PNG, GIF, sprite sheets or ZIP packs. Static-image codec support depends on the browser; GIF animation timings are retained. Processing runs locally in a browser worker.

## Development

`npm run dev` opens a local development server. Preview fixtures are separate from live Ink data.

## License

MIT for app code. Bundled third-party components retain their own licenses and notices.
