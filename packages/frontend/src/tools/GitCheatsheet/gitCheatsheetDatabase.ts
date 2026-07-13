/**
 * gitCheatsheetDatabase — bundled Git command reference (no external dep).
 *
 * Covers the most useful everyday Git commands across eight categories:
 *   setup, branching, committing, merging, rebasing, stashing, remote, config
 *
 * Each entry carries the canonical command (with placeholders like
 * `<branch>`, `<file>`) and a concise one-line description. The database is
 * intentionally finite and human-curated — it favours the commands a
 * developer actually reaches for over exhaustive `git --help` prose.
 *
 * Placeholders use angle brackets (`<arg>`) for required arguments and square
 * brackets (`[arg]`) for optional ones, matching git's own man-page style.
 */

/** The eight cheatsheet categories (stable display order). */
export type GitCheatsheetCategory =
  | 'setup'
  | 'branching'
  | 'committing'
  | 'merging'
  | 'rebasing'
  | 'stashing'
  | 'remote'
  | 'config';

/** A single Git cheatsheet entry. */
export interface GitCheatsheetEntry {
  /** Stable unique id (used as v-for key). */
  id: string;
  /** The canonical command string, with placeholders. */
  command: string;
  /** One-sentence description of what the command does. */
  description: string;
  /** Category id. */
  category: GitCheatsheetCategory;
  /** Optional longer-form notes / example / caveat. */
  notes?: string;
}

/** Display order for categories (used by chips and grouping). */
export const GIT_CHEATSHEET_CATEGORIES: readonly GitCheatsheetCategory[] = [
  'setup',
  'branching',
  'committing',
  'merging',
  'rebasing',
  'stashing',
  'remote',
  'config',
];

/** Human-readable labels for each category. */
export const GIT_CHEATSHEET_CATEGORY_LABELS: Record<
  GitCheatsheetCategory,
  string
> = {
  setup: 'Setup',
  branching: 'Branching',
  committing: 'Committing',
  merging: 'Merging',
  rebasing: 'Rebasing',
  stashing: 'Stashing',
  remote: 'Remote',
  config: 'Config',
};

/** Source-of-truth table. Order is stable for deterministic rendering. */
export const GIT_CHEATSHEET_ENTRIES: readonly GitCheatsheetEntry[] = [
  /* ----------------------------- setup ----------------------------- */
  {
    id: 'setup-init',
    command: 'git init',
    description: 'Create an empty Git repository in the current directory.',
    category: 'setup',
    notes: 'Adds a `.git/` folder; safe to re-run.',
  },
  {
    id: 'setup-clone',
    command: 'git clone <url> [dir]',
    description: 'Clone a remote repository into a new local directory.',
    category: 'setup',
  },
  {
    id: 'setup-clone-shallow',
    command: 'git clone --depth 1 <url>',
    description: 'Shallow clone — only the latest commit (faster, less history).',
    category: 'setup',
  },
  {
    id: 'setup-status',
    command: 'git status',
    description: 'Show working-tree status (staged, modified, untracked files).',
    category: 'setup',
  },
  {
    id: 'setup-log',
    command: 'git log --oneline --graph --decorate',
    description: 'Compact one-line history graph with branch/tag decorations.',
    category: 'setup',
  },
  {
    id: 'setup-log-stat',
    command: 'git log -p <file>',
    description: 'Show commit history with full diffs for a single file.',
    category: 'setup',
  },
  {
    id: 'setup-diff',
    command: 'git diff',
    description: 'Show unstaged changes in the working tree.',
    category: 'setup',
  },
  {
    id: 'setup-diff-cached',
    command: 'git diff --cached',
    description: 'Show staged (cached) changes that will go into the next commit.',
    category: 'setup',
  },
  {
    id: 'setup-show',
    command: 'git show <commit>',
    description: 'Show details (metadata + diff) of a single commit.',
    category: 'setup',
  },
  {
    id: 'setup-blame',
    command: 'git blame <file>',
    description: 'Show which commit and author last modified each line of a file.',
    category: 'setup',
  },

  /* ----------------------------- branching ----------------------------- */
  {
    id: 'branch-list',
    command: 'git branch',
    description: 'List local branches (`*` marks the current branch).',
    category: 'branching',
  },
  {
    id: 'branch-list-all',
    command: 'git branch -a',
    description: 'List local and remote-tracking branches.',
    category: 'branching',
  },
  {
    id: 'branch-create',
    command: 'git branch <name>',
    description: 'Create a new branch pointing at the current HEAD (does not switch).',
    category: 'branching',
  },
  {
    id: 'branch-switch',
    command: 'git switch <branch>',
    description: 'Switch the working tree to an existing branch.',
    category: 'branching',
    notes: 'Modern replacement for `git checkout <branch>`.',
  },
  {
    id: 'branch-create-switch',
    command: 'git switch -c <name>',
    description: 'Create a new branch and switch to it in one step.',
    category: 'branching',
  },
  {
    id: 'branch-checkout',
    command: 'git checkout <branch>',
    description: 'Switch branches (legacy form; prefer `git switch`).',
    category: 'branching',
  },
  {
    id: 'branch-checkout-new',
    command: 'git checkout -b <name>',
    description: 'Create and switch to a new branch (legacy form).',
    category: 'branching',
  },
  {
    id: 'branch-rename',
    command: 'git branch -m <new-name>',
    description: 'Rename the current branch.',
    category: 'branching',
  },
  {
    id: 'branch-delete',
    command: 'git branch -d <name>',
    description: 'Delete a branch (fails if not merged; use `-D` to force).',
    category: 'branching',
  },
  {
    id: 'branch-track',
    command: 'git branch --set-upstream-to=<remote>/<branch>',
    description: 'Set the upstream tracking branch for the current branch.',
    category: 'branching',
  },

  /* ----------------------------- committing ----------------------------- */
  {
    id: 'commit-add',
    command: 'git add <file>',
    description: 'Stage a single file for the next commit.',
    category: 'committing',
  },
  {
    id: 'commit-add-all',
    command: 'git add -A',
    description: 'Stage all changes (new, modified, deleted) across the whole repo.',
    category: 'committing',
  },
  {
    id: 'commit-add-patch',
    command: 'git add -p',
    description: 'Interactively stage hunks of changes (patch mode).',
    category: 'committing',
  },
  {
    id: 'commit-commit',
    command: 'git commit -m "<message>"',
    description: 'Record staged changes with a commit message.',
    category: 'committing',
  },
  {
    id: 'commit-amend',
    command: 'git commit --amend',
    description: 'Modify the last commit (message and/or staged changes).',
    category: 'committing',
    notes: 'Avoid amending commits already pushed to a shared branch.',
  },
  {
    id: 'commit-amend-no-edit',
    command: 'git commit --amend --no-edit',
    description: 'Add staged changes to the last commit, keeping its message.',
    category: 'committing',
  },
  {
    id: 'commit-staged',
    command: 'git commit -am "<message>"',
    description: 'Stage all tracked modifications and commit in one step.',
    category: 'committing',
    notes: 'Does not stage new (untracked) files.',
  },
  {
    id: 'commit-reset-soft',
    command: 'git reset --soft HEAD~1',
    description: 'Undo the last commit, keeping changes staged.',
    category: 'committing',
  },
  {
    id: 'commit-reset-mixed',
    command: 'git reset HEAD~1',
    description: 'Undo the last commit, leaving changes unstaged (default).',
    category: 'committing',
  },
  {
    id: 'commit-revert',
    command: 'git revert <commit>',
    description: 'Create a new commit that undoes a previous commit.',
    category: 'committing',
    notes: 'Safe for shared history (no rewrite).',
  },

  /* ----------------------------- merging ----------------------------- */
  {
    id: 'merge-branch',
    command: 'git merge <branch>',
    description: 'Merge a branch into the current branch.',
    category: 'merging',
  },
  {
    id: 'merge-no-ff',
    command: 'git merge --no-ff <branch>',
    description: 'Force a merge commit even when a fast-forward is possible.',
    category: 'merging',
  },
  {
    id: 'merge-ff-only',
    command: 'git merge --ff-only <branch>',
    description: 'Merge only if it can fast-forward; otherwise abort.',
    category: 'merging',
  },
  {
    id: 'merge-squash',
    command: 'git merge --squash <branch>',
    description: 'Combine a branch\'s commits into one staged change (no commit yet).',
    category: 'merging',
  },
  {
    id: 'merge-abort',
    command: 'git merge --abort',
    description: 'Abort an in-progress merge and restore the pre-merge state.',
    category: 'merging',
  },
  {
    id: 'merge-conflict-status',
    command: 'git status',
    description: 'During a conflict, lists unmerged paths and next-step hints.',
    category: 'merging',
  },
  {
    id: 'merge-rerere',
    command: 'git rerere',
    description: 'Reuse recorded resolution — auto-apply previous conflict fixes.',
    category: 'merging',
    notes: 'Enable with `git config rerere.enabled true`.',
  },

  /* ----------------------------- rebasing ----------------------------- */
  {
    id: 'rebase-branch',
    command: 'git rebase <base>',
    description: 'Replay the current branch\'s commits on top of <base>.',
    category: 'rebasing',
    notes: 'Rewrites history; avoid on shared branches.',
  },
  {
    id: 'rebase-interactive',
    command: 'git rebase -i <base>',
    description: 'Interactively rebase: reorder, squash, edit, or drop commits.',
    category: 'rebasing',
  },
  {
    id: 'rebase-onto',
    command: 'git rebase --onto <new-base> <old-base> <branch>',
    description: 'Replay commits from <branch> skipping those on <old-base>.',
    category: 'rebasing',
  },
  {
    id: 'rebase-continue',
    command: 'git rebase --continue',
    description: 'Resume a rebase after resolving conflicts.',
    category: 'rebasing',
  },
  {
    id: 'rebase-abort',
    command: 'git rebase --abort',
    description: 'Abort an in-progress rebase and return to the original branch.',
    category: 'rebasing',
  },
  {
    id: 'rebase-skip',
    command: 'git rebase --skip',
    description: 'Skip the current conflicting commit and continue the rebase.',
    category: 'rebasing',
  },
  {
    id: 'rebase-autosquash',
    command: 'git rebase -i --autosquash <base>',
    description: 'Auto-arrange fixup!/squash! commits for interactive rebase.',
    category: 'rebasing',
  },

  /* ----------------------------- stashing ----------------------------- */
  {
    id: 'stash-push',
    command: 'git stash',
    description: 'Save uncommitted changes (staged + unstaged) and restore HEAD.',
    category: 'stashing',
  },
  {
    id: 'stash-push-message',
    command: 'git stash push -m "<message>"',
    description: 'Stash changes with a descriptive message.',
    category: 'stashing',
  },
  {
    id: 'stash-include-untracked',
    command: 'git stash -u',
    description: 'Stash untracked files in addition to tracked changes.',
    category: 'stashing',
  },
  {
    id: 'stash-list',
    command: 'git stash list',
    description: 'List all stashes (most recent is `stash@{0}`).',
    category: 'stashing',
  },
  {
    id: 'stash-pop',
    command: 'git stash pop',
    description: 'Apply the latest stash and drop it from the stack.',
    category: 'stashing',
  },
  {
    id: 'stash-apply',
    command: 'git stash apply [stash@{n}]',
    description: 'Apply a stash without removing it from the stack.',
    category: 'stashing',
  },
  {
    id: 'stash-drop',
    command: 'git stash drop [stash@{n}]',
    description: 'Delete a single stash entry from the stack.',
    category: 'stashing',
  },
  {
    id: 'stash-clear',
    command: 'git stash clear',
    description: 'Delete all stashes (irreversible).',
    category: 'stashing',
  },
  {
    id: 'stash-show',
    command: 'git stash show -p [stash@{n}]',
    description: 'Show the diff of a stash without applying it.',
    category: 'stashing',
  },

  /* ----------------------------- remote ----------------------------- */
  {
    id: 'remote-list',
    command: 'git remote -v',
    description: 'List remotes with their fetch/push URLs.',
    category: 'remote',
  },
  {
    id: 'remote-add',
    command: 'git remote add <name> <url>',
    description: 'Add a new remote repository.',
    category: 'remote',
  },
  {
    id: 'remote-remove',
    command: 'git remote remove <name>',
    description: 'Remove a remote and its tracking branches.',
    category: 'remote',
  },
  {
    id: 'remote-rename',
    command: 'git remote rename <old> <new>',
    description: 'Rename a remote.',
    category: 'remote',
  },
  {
    id: 'remote-fetch',
    command: 'git fetch [<remote>]',
    description: 'Download objects and refs from a remote without merging.',
    category: 'remote',
  },
  {
    id: 'remote-pull',
    command: 'git pull [<remote> <branch>]',
    description: 'Fetch and merge the remote branch into the current branch.',
    category: 'remote',
  },
  {
    id: 'remote-pull-rebase',
    command: 'git pull --rebase',
    description: 'Fetch and rebase the local branch on top of the remote branch.',
    category: 'remote',
  },
  {
    id: 'remote-push',
    command: 'git push [<remote> <branch>]',
    description: 'Upload local commits to the remote branch.',
    category: 'remote',
  },
  {
    id: 'remote-push-upstream',
    command: 'git push -u <remote> <branch>',
    description: 'Push and set the upstream tracking branch in one step.',
    category: 'remote',
  },
  {
    id: 'remote-push-force',
    command: 'git push --force-with-lease',
    description: 'Force push, but abort if the remote has new commits you lack.',
    category: 'remote',
    notes: 'Safer than `--force`; avoids overwriting others\' work.',
  },
  {
    id: 'remote-push-tags',
    command: 'git push --tags',
    description: 'Push all tags to the remote.',
    category: 'remote',
  },

  /* ----------------------------- config ----------------------------- */
  {
    id: 'config-set',
    command: 'git config --global user.name "<name>"',
    description: 'Set the global author name for all repositories.',
    category: 'config',
  },
  {
    id: 'config-set-email',
    command: 'git config --global user.email "<email>"',
    description: 'Set the global author email for all repositories.',
    category: 'config',
  },
  {
    id: 'config-list',
    command: 'git config --list',
    description: 'List all config values (system, global, local merged).',
    category: 'config',
  },
  {
    id: 'config-get',
    command: 'git config <key>',
    description: 'Read a single config value by its dotted key.',
    category: 'config',
  },
  {
    id: 'config-unset',
    command: 'git config --unset <key>',
    description: 'Remove a config value.',
    category: 'config',
  },
  {
    id: 'config-alias',
    command: 'git config --global alias.<name> "<command>"',
    description: 'Create a custom git alias (e.g. `alias.co checkout`).',
    category: 'config',
    notes: 'Use as `git <name>`; aliases can call shell with `!` prefix.',
  },
  {
    id: 'config-editor',
    command: 'git config --global core.editor "<editor>"',
    description: 'Set the default editor for commit messages and interactive rebase.',
    category: 'config',
  },
  {
    id: 'config-pull-rebase',
    command: 'git config --global pull.rebase true',
    description: 'Make `git pull` rebase by default instead of merging.',
    category: 'config',
  },
  {
    id: 'config-credential-helper',
    command: 'git config --global credential.helper store',
    description: 'Persist HTTPS credentials in plaintext (~/.git-credentials).',
    category: 'config',
    notes: 'Prefer `osxkeychain` (macOS) or `manager` (Windows) for security.',
  },
  {
    id: 'config-init-default-branch',
    command: 'git config --global init.defaultBranch main',
    description: 'Set the default branch name for new repositories.',
    category: 'config',
  },
];

/** Per-category counts (precomputed for the chip badges). */
export const GIT_CHEATSHEET_COUNTS: Readonly<Record<GitCheatsheetCategory, number>> =
  GIT_CHEATSHEET_CATEGORIES.reduce(
    (acc, c) => {
      acc[c] = GIT_CHEATSHEET_ENTRIES.filter((e) => e.category === c).length;
      return acc;
    },
    {} as Record<GitCheatsheetCategory, number>,
  );

/** Total entry count. */
export const GIT_CHEATSHEET_TOTAL = GIT_CHEATSHEET_ENTRIES.length;

/** Approximate bundled database size in bytes (for metadata display). */
export const DATABASE_SIZE_BYTES = GIT_CHEATSHEET_ENTRIES.reduce(
  (n, e) =>
    n +
    e.id.length +
    e.command.length +
    e.description.length +
    (e.notes?.length ?? 0),
  0,
);
