# Releasing `@apito-io/js-admin-sdk`

## One-time setup

1. **GitHub repository**  
   Use `https://github.com/apito-io/js-admin-sdk` so tags and Actions match `package.json` `repository.url`.

2. **npm organization**  
   Ensure the `@apito-io` scope exists on npm and your account can publish to it.

3. **GitHub secret `NPM_TOKEN`**  
   In the repo: **Settings → Secrets and variables → Actions → New repository secret**  
   - Name: `NPM_TOKEN`  
   - Value: an npm automation token with publish rights for `@apito-io`  
   The workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs on `push` of tags `v*`, then runs tests, builds, `npm publish`, and creates a GitHub Release.

4. **Branch protection (optional)**  
   Require the PR CI job to pass before merging to `main` / `master`.

## Webhooks and automation

- **No custom webhook is required** for npm publish: pushing tag `v1.2.3` triggers the workflow, which publishes to the npm registry using `NPM_TOKEN`.
- **npm ↔ GitHub**: In npm package settings you can connect the GitHub repo for provenance and “Trusted Publisher” (OIDC) later to reduce long-lived tokens; until then, `NPM_TOKEN` is the same model as [`js-plugin-build-sdk`](https://github.com/apito-io/js-plugin-build-sdk).
- **Dependabot** is enabled via [`.github/dependabot.yml`](.github/dependabot.yml) for weekly dependency PRs.

## Cut a release

```bash
chmod +x release.sh
./release.sh 2.0.0 "chore: release 2.0.0"
```

Or manually: update `package.json` / `src/version.ts`, commit, then:

```bash
git tag v2.0.0
git push && git push --tags
```

Ensure the tag version matches `package.json` (the workflow aligns them if needed).
