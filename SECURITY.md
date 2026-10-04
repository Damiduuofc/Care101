# Security Policy

Care101 handles workflows that may involve health, identity, payment, and account information. Please help protect users by reporting security issues responsibly.

## Supported Versions

Security fixes are generally applied to the latest version on the default branch. Older versions may not receive security updates.

## Reporting a Vulnerability

Do not report security vulnerabilities in public issues, pull requests, discussions, or chat messages.

Use GitHub's **Private vulnerability reporting** or **Security Advisories** for this repository when available. If those options are unavailable, contact the repository maintainer privately through the contact details on the repository owner profile and include `Care101 security report` in the subject.

Please include:

- A clear description of the vulnerability and its impact.
- The affected component, route, file, or version.
- Reproduction steps or a minimal proof of concept.
- Any prerequisites, configuration, or permissions required.
- Suggested remediation, if known.
- Whether you believe data may have been accessed or credentials may be exposed.

Use synthetic accounts and data in demonstrations. Do not attach real patient records, access tokens, passwords, payment details, or other personal information.

## Response Expectations

The maintainers will acknowledge a valid private report as soon as practical, investigate the issue, and coordinate a fix or mitigation. Please allow reasonable time for triage and remediation before making a public disclosure. We may ask for additional details or confirmation after a fix is available.

## Sensitive Data and Secrets

- Never commit `.env` files, API keys, JWT secrets, database credentials, private keys, or production configuration.
- Never use real healthcare or payment data in development, tests, screenshots, logs, or issue reports.
- Revoke and rotate any secret that may have been exposed, then notify the maintainers privately.
- Avoid logging authentication tokens, passwords, medical records, payment data, or unnecessary personal information.
- Treat uploaded files, generated PDFs, and local development databases as sensitive and remove them when no longer needed.

## Scope

Examples of issues worth reporting privately include authentication or authorization bypasses, exposure of medical or personal data, insecure file access, injection vulnerabilities, payment flaws, credential leakage, and exploitable dependency or configuration issues.

This policy does not replace applicable legal, regulatory, or organizational incident-response requirements.
