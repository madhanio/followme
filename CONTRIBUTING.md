# Contributing to FollowMe

First off, thank you for considering contributing to FollowMe! We welcome contributions from developers, designers, and open-source enthusiasts.

---

## Repository Architecture

This repository is organized into distinct, modular components:

```
followme/
├── landing/       # Marketing & documentation landing page (Next.js 15, Framer Motion, Tailwind v4)
├── dashboard/     # Authenticated user management console (Next.js 15, Supabase auth & actions)
├── demo/          # Client-side interactive sandbox simulation (deployed at followme-demo.vercel.app)
├── worker/        # Autonomous Node.js discovery service, GitHub API scanner, & NVIDIA NIM evaluator
└── .github/       # Automated CRON schedulers, CI quality checks, and issue templates
```

---

## Local Development Setup

### Prerequisites
- **Node.js**: v20 or higher
- **npm** or **pnpm**
- **Git**

### 1. Landing Page
```bash
cd landing
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the landing page locally.

### 2. Demo Dashboard
```bash
cd demo
# Serves static assets on public/
```

### 3. User Console (Dashboard)
```bash
cd dashboard
npm install
cp .env.example .env.local
npm run dev
```

---

## Development Guidelines

1. **Keep Secrets Safe**: NEVER commit API keys, GitHub tokens, or database connection strings.
2. **Component Isolation**: Changes to `landing/` should not alter `dashboard/` or `demo/` dependencies.
3. **Responsive & Accessible**: Ensure animations and layouts are tested on both mobile and desktop viewports.
4. **Build Verification**: Before submitting a PR, always verify that your changes build without errors:
   ```bash
   cd landing && npm run build
   ```

---

## Submitting Pull Requests

1. **Fork** the repository and create your feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. **Commit** your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat(landing): add interactive feature"
   ```
3. **Push** to your fork:
   ```bash
   git push origin feat/my-new-feature
   ```
4. Open a **Pull Request** against `main`. Our automated GitHub Actions CI will verify your build!

---

## Code of Conduct

Be kind, respectful, and collaborative. We are here to help builders grow organically.
