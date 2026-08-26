/**
 * Preflight Node version check.
 *
 * Deliberately plain, dependency-free JavaScript rather than TypeScript,
 * because its whole job is to run on the *wrong* Node version and still produce
 * a useful message. Wrangler's own error tells you to go install a version
 * manager; this one tells you the right version is already here.
 */
const REQUIRED_MAJOR = 22;

const current = process.versions.node;
const major = Number(current.split('.')[0]);

if (major >= REQUIRED_MAJOR) {
  process.exit(0);
}

const ESC = String.fromCharCode(27);
const red = (s) => `${ESC}[31m${s}${ESC}[0m`;
const bold = (s) => `${ESC}[1m${s}${ESC}[0m`;

console.error(`
${red(`This project needs Node ${REQUIRED_MAJOR}+. You are on ${current}.`)}

The right version is pinned in .nvmrc and is most likely already installed.
From this directory, run:

    ${bold('nvm use')}

then re-run your command. To switch automatically in new shells, add to ~/.zshrc:

    ${bold('autoload -U add-zsh-hook')}
    ${bold("load-nvmrc() { [ -f .nvmrc ] && nvm use --silent; }")}
    ${bold('add-zsh-hook chpwd load-nvmrc')}

If nvm reports that the version is missing, install it with:

    ${bold('nvm install')}
`);
process.exit(1);
