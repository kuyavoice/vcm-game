// dist/ を gh-pages ブランチとして force push する（GitHub Pages 配信）。
// 使い方: npm run deploy   （build → push まで）
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
if (!existsSync(dist)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}
const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
const run = (cmd) => execSync(cmd, { cwd: dist, stdio: 'inherit', shell: true });

writeFileSync(resolve(dist, '.nojekyll'), '');
run('git init -q -b gh-pages');
run('git add -A');
run('git -c user.name=kuyavoice -c user.email=kuya1439@gmail.com commit -q -m "deploy"');
run(`git push -f "${remote}" gh-pages`);
execSync(process.platform === 'win32' ? 'rmdir /s /q .git' : 'rm -rf .git', { cwd: dist, shell: true });
console.log('deployed → https://kuyavoice.github.io/vcm-game/');
