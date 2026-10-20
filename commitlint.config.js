// Conventional Commits com os escopos do projeto (docs/05-fluxo-github.md §3).
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'refactor', 'test']],
    'scope-enum': [2, 'always', ['api', 'web', 'publico', 'contracts', 'ui', 'db', 'ci', 'docs']],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
  },
};
