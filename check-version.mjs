// Fails when package.json, manifest.json and versions.json disagree about the
// version. CI runs it on every PR, so a bad bump fails before it can be released.
import { readFileSync } from 'node:fs';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const pkg = read('package.json');
const manifest = read('manifest.json');
const versions = read('versions.json');

const problems = [];
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
	problems.push(`manifest.json version "${manifest.version}" must be x.y.z with no "v" prefix.`);
}
if (pkg.version !== manifest.version) {
	problems.push(`package.json is ${pkg.version} but manifest.json is ${manifest.version}.`);
}
if (versions[manifest.version] !== manifest.minAppVersion) {
	problems.push(
		`versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}` +
			` (found ${versions[manifest.version] ?? 'no entry'}).`,
	);
}

if (problems.length > 0) {
	for (const problem of problems) console.error(problem);
	console.error('Bump with: npm version <patch|minor|major> --no-git-tag-version');
	process.exit(1);
}
console.log(`Version ${manifest.version} is consistent.`);
