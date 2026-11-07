/**
 * Publish the game to GitHub Pages: builds, then pushes dist/ to the `gh-pages` branch.
 * Usage: npm run deploy
 */
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();

run('npm run build');
// GitHub Pages runs Jekyll by default, which hides some files; this turns it off.
writeFileSync('dist/.nojekyll', '');
rmSync('dist/.git', { recursive: true, force: true });
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run('git -c user.name="Bloomora Deploy" -c user.email="deploy@bloomora.local" commit -q -m "Deploy Bloomora"', 'dist');
run(`git push -f -q "${remote}" gh-pages`, 'dist');
rmSync('dist/.git', { recursive: true, force: true });
console.log('\nDeployed! It can take a minute for GitHub Pages to update.');
