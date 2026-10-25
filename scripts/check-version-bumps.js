const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const gitExecutable =
  process.platform === 'win32' ? String.raw`C:\Program Files\Git\cmd\git.exe` : '/usr/bin/git';

const [baseSha, headSha] = process.argv.slice(2);

if (!baseSha || !headSha || /^0+$/.test(baseSha)) {
  console.info('Unable to determine the base and head commits for version validation.');
  process.exit(1);
}

const parseVersion = version => {
  const d = String.raw`(0|[1-9]\d*)`;
  const alfanum = String.raw`([0-9a-z-]+(?:\.[0-9a-z-]+)*)`;
  const match = version.match(
    new RegExp(String.raw`^${d}\.${d}\.${d}(?:-${alfanum})?(?:\+${alfanum})?$`, 'i'),
  );

  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const prerelease = match[4]?.split('.') ?? [];

  for (const identifier of prerelease) {
    const hasLeadingZero =
      /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0');

    if (hasLeadingZero) {
      throw new Error(`Invalid semantic version: ${version}`);
    }
  }

  return {
    core: match.slice(1, 4).map(BigInt),
    prerelease,
  };
};

const comparePrereleaseIdentifiers = (left, right) => {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const difference = BigInt(left) - BigInt(right);
    if (difference === 0n) {
      return 0;
    }
    return difference < 0n ? -1 : 1;
  }

  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }

  if (left !== right) {
    return left < right ? -1 : 1;
  }

  return 0;
};

const comparePrerelease = (left, right) => {
  if (left.length === 0 || right.length === 0) {
    if (left.length === right.length) {
      return 0;
    }
    return left.length === 0 ? 1 : -1;
  }

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = comparePrereleaseIdentifiers(left[index], right[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return Math.sign(left.length - right.length);
};

const compareVersions = (leftVersion, rightVersion) => {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] < right.core[index] ? -1 : 1;
    }
  }

  return comparePrerelease(left.prerelease, right.prerelease);
};

const changedFiles = execFileSync(
  gitExecutable,
  ['diff', '--name-only', `${baseSha}...${headSha}`],
  { encoding: 'utf8' },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

const packages = ['client', 'server'];
let failed = false;

for (const packageName of packages) {
  if (changedFiles.some(file => file.startsWith(`${packageName}/`))) {
    const basePackageJson = execFileSync(
      gitExecutable,
      ['show', `${baseSha}:${packageName}/package.json`],
      { encoding: 'utf8' },
    );
    const previousVersion = JSON.parse(basePackageJson).version;
    const currentVersion = JSON.parse(readFileSync(`${packageName}/package.json`, 'utf8')).version;

    if (
      typeof previousVersion !== 'string' ||
      typeof currentVersion !== 'string' ||
      compareVersions(currentVersion, previousVersion) <= 0
    ) {
      console.info(
        `${packageName}/ changed, but its package.json version was not increased ` +
          `(${previousVersion ?? 'missing'} -> ${currentVersion ?? 'missing'}).`,
      );
      failed = true;
    } else {
      console.info(`${packageName}/ version increased: ${previousVersion} -> ${currentVersion}.`);
    }
  } else {
    console.info(`No ${packageName} changes; version bump not required.`);
  }
}

if (failed) {
  process.exit(1);
}
