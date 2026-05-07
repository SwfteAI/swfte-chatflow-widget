# Contributing to `@swfte/chatflow-widget`

Thanks for your interest in improving the official [Swfte ChatFlow](https://www.swfte.com/products/chatflows) widget. This guide is short on purpose — open an issue or a draft PR if anything is unclear.

## Code of conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Be kind, give people the benefit of the doubt, and assume good faith. Report concerns to [conduct@swfte.com](mailto:conduct@swfte.com).

## Contributor License Agreement (CLA)

For any non-trivial contribution we ask you to sign our CLA at **[cla.swfte.com](https://cla.swfte.com)**. The CLA simply confirms that you own the code you are contributing and that you grant [Swfte, Inc.](https://www.swfte.com) the right to relicense it under MIT alongside the rest of the project. It takes about 30 seconds.

## Development

```bash
git clone https://github.com/SwfteAI/swfte-chatflow-widget.git
cd swfte-chatflow-widget
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsup
```

The repo is a single TypeScript package — no monorepo, no submodules.

### Running examples locally

```bash
cd examples/01-react-onboarding
npm install
npm run dev
```

## Pull-request checklist

- [ ] Existing public API is **backwards-compatible** — no breaking renames or signature changes without a discussion first.
- [ ] `npm run typecheck` is clean.
- [ ] `npm run build` is clean.
- [ ] New public symbols have JSDoc comments.
- [ ] If you add a new dependency, please mention it explicitly in the PR description and prefer zero-dep alternatives where possible.
- [ ] Update [CHANGELOG.md](CHANGELOG.md) under the **Unreleased** section.
- [ ] CLA signed at [cla.swfte.com](https://cla.swfte.com) for non-trivial changes.

## Filing issues

- **Bug reports** — please include the package version, browser / Node version, a minimal repro, and the actual vs expected behaviour.
- **Feature requests** — describe the use-case first, then the proposed shape. We reject features without a use-case story.
- **Questions** — please ask on [swfte.com/developers](https://www.swfte.com/developers) or email [developers@swfte.com](mailto:developers@swfte.com); the issue tracker is for actionable bugs and proposals.

## Security disclosures

Do **not** open public issues for vulnerabilities. Email [security@swfte.com](mailto:security@swfte.com); see [SECURITY.md](SECURITY.md).

## Licensing

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and may be relicensed by [Swfte, Inc.](https://www.swfte.com) per the CLA.
