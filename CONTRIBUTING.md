# Contributing to Care101

Thank you for helping improve Care101. Contributions should keep the platform reliable, secure, and respectful of the sensitive healthcare workflows it supports.

## Before You Start

- Read the [README](README.md) and confirm the required Node.js, MongoDB, and environment setup.
- Check existing issues and pull requests before starting work.
- For substantial changes, open an issue first so the design and scope can be discussed.
- Never use real patient, medical, payment, or other sensitive personal data in local development, tests, screenshots, or pull requests.

## Development Setup

Care101 is organized into three applications:

- `backend/` - Express API and MongoDB services
- `frontend/` - Next.js web application
- `care101_app/` - Expo mobile application

Install dependencies in the area you are changing:

```bash
cd backend && npm install
cd frontend && npm install
cd care101_app && npm install
```

Use local `.env` files for configuration. Do not commit secrets, tokens, private keys, database credentials, or production URLs.

## Making Changes

1. Create a focused branch from the current development branch.
2. Keep changes small and limited to the behavior being changed.
3. Follow the existing JavaScript, TypeScript, React, Express, and MongoDB patterns in the surrounding code.
4. Update documentation when setup, configuration, API behavior, or user-facing behavior changes.
5. Add or update tests when changing business logic, authentication, authorization, payments, medical records, or other shared behavior.
6. Review the final diff for accidental secrets, generated files, debug logging, and unrelated formatting changes.

## Checks Before Opening a Pull Request

Run the checks relevant to your changes:

```bash
# Web frontend
cd frontend
npm run typecheck
npm run lint
npm run build

# Mobile app
cd care101_app
npm run lint

# Backend
cd backend
npm start
```

The backend currently does not define an automated test or lint script. When changing backend behavior, exercise the affected API routes locally and verify authentication, authorization, validation, and error handling.

## Pull Requests

A pull request should:

- Explain the problem and the solution.
- Identify the affected area: backend, web frontend, mobile app, or shared workflow.
- Include testing steps and their results.
- Include screenshots or recordings for meaningful UI changes, using synthetic data only.
- Call out database migrations, environment-variable changes, API changes, and security implications.
- Avoid committing dependency lockfile or generated-file changes unrelated to the contribution.

Maintainers may request revisions for correctness, accessibility, security, maintainability, or consistency with existing product behavior.

## Commit Messages

Use concise, imperative commit messages that describe the change, for example:

```text
Add appointment cancellation validation
Fix doctor schedule authorization
Update mobile setup instructions
```

## Reporting Problems

Please do not disclose security vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) for security reports. For ordinary bugs and feature requests, use the repository's issue tracker with enough detail to reproduce the behavior without including sensitive data.

## License

By contributing to Care101, you agree that your contributions are provided under the repository's [ISC License](LICENSE).
