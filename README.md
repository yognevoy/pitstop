<h1 align="center">pitstop</h1>

<p align="center">
  <em>Box, box! Your codebase is coming in for service.</em>
</p>

<p align="center">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111111">
</p>

pitstop is a Claude Code plugin for periodic codebase maintenance: run it weekly, after a sprint, or monthly. It looks at what changed since the last run and surfaces the cumulative drift (duplication, needless abstractions, drifting module boundaries) that per-change reviews miss.

## Install (local development)

Clone the repo, then from inside a Claude Code session in any project:

```
/plugin marketplace add /path/to/pitstop
/plugin install pitstop@pitstop
```

Run `/pitstop:pitstop` to confirm it loaded; it won't do anything yet.

To try a local checkout for a single session without installing it, start Claude Code with:

```bash
claude --plugin-dir /path/to/pitstop
```

## License

[MIT](LICENSE)
