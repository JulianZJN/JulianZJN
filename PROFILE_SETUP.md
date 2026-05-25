# GitHub Profile Setup

This folder is a ready-to-publish GitHub profile README for `JulianZJN`.

## Publish

1. Create a public repository named exactly `JulianZJN`.
2. Put these files in that repository:
   - `README.md`
   - `assets/simpleicons-row.svg`
   - `assets/musing-card.svg`
   - `.github/workflows/snake.yml`
3. Commit and push to `main`.
4. Open the repository's **Actions** tab and run **Generate contribution snake** once.
5. Refresh `https://github.com/JulianZJN`.

## Optional polish

- Replace the `About Me` table with your real school, research direction, projects, and hobbies.
- Edit the `readme-typing-svg` lines in `README.md`.
- Update the `skillicons.dev` icon list to match your real stack.
- Replace `assets/musing-card.svg` with a theorem, quote, or project motto that feels more personal.

## Local publish commands

If the GitHub CLI is logged in, the whole publish flow can be done with:

```bash
gh repo create JulianZJN --public --description "My GitHub profile" --clone
cp README.md JulianZJN/
cp -R assets .github JulianZJN/
cd JulianZJN
git add README.md assets .github
git commit -m "Create GitHub profile README"
git push -u origin main
```
