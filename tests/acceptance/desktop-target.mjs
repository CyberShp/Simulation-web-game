import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Locate source or an unpacked desktop package, including recorded pre-migration bundles. */
export function desktopTarget(appPath) {
  let root = repositoryRoot, executable = null;
  if (appPath) {
    const supplied = path.resolve(appPath);
    if (supplied.endsWith('.app')) {
      root = path.join(supplied, 'Contents/Resources/app');
      const plist = readFileSync(path.join(supplied, 'Contents/Info.plist'), 'utf8');
      const name = plist.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
      if (!name) throw Error('Desktop bundle has no CFBundleExecutable');
      executable = path.join(supplied, 'Contents/MacOS', name);
    } else {
      const directory = statSync(supplied).isDirectory() ? supplied : path.dirname(supplied);
      root = path.join(directory, 'resources/app');
      if (!statSync(supplied).isDirectory()) executable = supplied;
      else {
        const candidates = readdirSync(directory).filter(name => process.platform === 'win32' ? name.endsWith('.exe') : !name.includes('.') && statSync(path.join(directory, name)).isFile());
        if (candidates.length !== 1) throw Error('Pass --app as the desktop executable when its directory contains multiple candidates');
        executable = path.join(directory, candidates[0]);
      }
    }
  }
  const current = existsSync(path.join(root, 'apps/courtyard/courtyard-host.cjs'));
  const sample = path.join(root, current ? 'apps/courtyard' : 'prototypes/pixel_scene_validation');
  if (!existsSync(path.join(sample, 'courtyard-host.cjs'))) throw Error(`Courtyard entry missing in ${root}`);
  return {
    root, sample,
    assets: current ? path.join(root, 'assets/courtyard') : path.join(sample, 'assets'),
    simulation: path.join(root, current ? 'src/simulation' : 'dist'),
    executable: executable || require('electron'),
    args: appPath ? [] : [path.join(sample, 'courtyard-host.cjs')],
  };
}
