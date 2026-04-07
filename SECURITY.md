# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities by emailing the maintainers directly or by using [GitHub's private vulnerability reporting](https://github.com/alegerber/folio-client/security/advisories/new).

When reporting, please include:

- A description of the vulnerability
- Affected version, image tag, or commit SHA
- Deployment mode: Docker, local Node, or AWS Lambda
- Clear reproduction steps or a proof of concept
- Expected impact and any assumptions about attacker access
- Relevant logs, request samples, or configuration details with secrets redacted
- Any suggested fix (if applicable)

## Response Timeline

- **Acknowledgement**: We will acknowledge receipt of your report within 72 hours.
- **Assessment**: We aim to assess and validate the vulnerability within 7 days.
- **Fix**: Critical vulnerabilities will be prioritized and patched as soon as possible.

## Operational Security Notes

This package is a thin HTTP client with no server-side code and no transitive runtime dependencies. The main security surface is:

- **API key handling** — the `apiKey` option is sent as a request header; never log or expose `FolioClientOptions`
- **Input passed to the Folio server** — HTML/CSS content is forwarded as-is; sanitize untrusted input before passing it to `generate()`

