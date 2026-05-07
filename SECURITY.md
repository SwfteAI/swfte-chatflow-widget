# Security Policy

[Swfte](https://www.swfte.com) takes the security of the `@swfte/chatflow-widget` package — and every product in the [Swfte](https://www.swfte.com) platform — seriously. This document covers how to disclose a vulnerability and what you can expect from us in return.

## Supported versions

| Version | Supported |
|---|---|
| `1.x` | Yes — current stable line. |
| `0.x` | Critical fixes only. |

We recommend always tracking the latest minor release on the `1.x` line.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Email **[security@swfte.com](mailto:security@swfte.com)** with:

- A description of the issue and its impact.
- Steps to reproduce — minimal repro is best.
- The package version(s) affected.
- Your name / handle for credit (optional).
- A PGP-encrypted message if you prefer; the public key is published at [swfte.com/security](https://www.swfte.com/security).

We acknowledge every report within **two business days** and aim to ship a fix or mitigation for valid issues within **30 days**, faster for high-severity reports. We will keep you in the loop, credit you in the changelog, and — for impactful disclosures — coordinate a CVE.

## Out of scope

- Reports that depend on a compromised end-user device, browser extension, or CDN proxy.
- Best-practice or hardening suggestions that do not constitute a vulnerability.
- Issues in third-party dependencies that have an upstream fix already shipped — please report to that project first.
- Any social-engineering or denial-of-wallet test against [Swfte](https://www.swfte.com) production.

## Security best-practices when embedding the widget

- Never expose your Swfte API key to the browser. Use the [proxy pattern](docs/proxy-pattern.md) — `createChatFlowHandler` on Next.js, or your own backend route.
- Bind the proxy to authenticated users only.
- Lock CORS to your own origins.
- Rate-limit `POST /input` per session.
- Read the platform-wide posture at [swfte.com/security](https://www.swfte.com/security).

Thank you for helping keep [Swfte](https://www.swfte.com) and its users safe.
