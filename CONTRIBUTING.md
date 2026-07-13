# Contributing to TargetDash (AI-CRM)

Thank you for your interest in contributing! This is an **open-core** project:
- **Core CRM**: MIT license (free forever)
- **Enterprise features**: Commercial license
- **Integrations**: Open-source

---

## How to Contribute

### 1. Fork & Clone
```bash
git fork https://github.com/chzchzchzchz/AI-CRM.git
git clone https://github.com/YOUR_USERNAME/AI-CRM.git
cd AI-CRM
```

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Development Setup
```bash
pnpm install
cp .env.example .env
# Edit .env with your API keys
pnpm dev
```

### 4. Make Changes
- Follow existing code style (Prettier + ESLint configs included)
- Add tests if adding new features
- Update documentation if needed

### 5. Test Your Changes
```bash
pnpm type-check
pnpm lint
pnpm test  # if tests exist
```

### 6. Commit & Push
```bash
git add -A
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

### 7. Open a Pull Request
- Use the PR template
- Link any related issues
- Describe what you changed and why

---

## What We Need Help With

### 🔥 High Priority
- **New Integrations**: HubSpot, ZoomInfo, Apollo, Clearbit
- **Mobile App**: React Native (iOS/Android)
- **MCP Server**: Improvements, more endpoints
- **Multi-tenant**: SaaS mode for self-serve onboarding

### 🛠️ Technical Improvements
- **Performance**: Query optimization, caching layers
- **Security**: Penetration testing, audit reviews
- **Testing**: Unit tests, integration tests
- **Docs**: Video tutorials, API reference

### 🎨 UI/UX
- **Dark Mode**: Theme system
- **Mobile Responsive**: Improve small screen experience
- **Accessibility**: WCAG 2.1 AA compliance
- **Animations**: Smooth transitions, loading states

---

## Code Style

### TypeScript/JavaScript
- Use **TypeScript** for all new code
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names (no `x`, `temp`, etc.)
- Add JSDoc comments for functions

### React Components
- Use **functional components** + hooks
- Keep components small (<200 lines)
- Use Tailwind CSS for styling
- Add prop-types or TypeScript interfaces

### Server/API
- Use **parameterized queries** (never string concatenation)
- Add input validation on all endpoints
- Return proper HTTP status codes
- Log errors (but not sensitive data)

---

## Security Guidelines

### ⚠️ Critical Rules
1. **Never commit secrets** (API keys, passwords, tokens)
2. **Use parameterized SQL queries** (no SQL injection)
3. **Sanitize user input** (no XSS)
4. **Check auth on all API routes**
5. **Use HTTPS in production**

### Reporting Security Issues
**DO NOT open public issues for security vulnerabilities.**

Email: mohssinechazi@gmail.com (PGP key available)

We'll respond within 24 hours and credit you in the security advisory.

---

## Community

### Discussions
Use [GitHub Discussions](https://github.com/chzchzchzchz/AI-CRM/discussions) for:
- Questions about setup
- Ideas for new features
- Show & tell (how you're using TargetDash)

### Issues
Use [GitHub Issues](https://github.com/chzchzchzchz/AI-CRM/issues) for:
- Bug reports (use the bug template)
- Feature requests (use the feature template)
- Technical debt

---

## License Agreement

By contributing, you agree that:
- Your contributions will be licensed under **MIT License** (for core code)
- You have the right to submit the contribution
- You grant the project perpetual, worldwide, non-exclusive rights to use your contribution

---

## Recognition

Contributors will be:
- Added to `CONTRIBUTORS.md`
- Mentioned in release notes (for significant contributions)
- Eligible for swag (stickers, t-shirts) once we launch the merch store

---

## Questions?

Open a [GitHub issue](https://github.com/chzchzchzchz/AI-CRM/issues) or a
[discussion](https://github.com/chzchzchzchz/AI-CRM/discussions).

**Thanks for contributing to TargetDash!** ⭐
