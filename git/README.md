# Git Fundamentals - Commands and Conflicts

This README is a short, practical guide to common Git commands, merge conflicts, and best practices.

## Contents

- [Core Commands](#core-commands)
- [Branching](#branching)
- [Merge Conflicts](#merge-conflicts)
- [Incoming vs Current Changes](#incoming-vs-current-changes)
- [Rebase vs Merge](#rebase-vs-merge)
- [Best Practices](#best-practices)

## Core Commands

- `git status` - show working tree status
- `git add <file>` - stage changes
- `git add .` - stage all changes
- `git commit -m "message"` - commit staged changes
- `git log --oneline --graph --decorate` - compact history
- `git diff` - show unstaged changes
- `git diff --staged` - show staged changes
- `git restore <file>` - discard unstaged changes
- `git restore --staged <file>` - unstage
- `git stash` - save work temporarily
- `git stash pop` - apply last stash
- `git fetch` - update remote refs
- `git pull` - fetch + merge
- `git push` - send commits to remote

## Example Outputs (What You Actually See)

### `git status`

```text
On branch feature/login
Your branch is ahead of 'origin/feature/login' by 1 commit.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  modified:   src/app.js

Untracked files:
  (use "git add <file>..." to include in what will be committed)
  notes.txt
```

How to read it:
- **Local** branch: `feature/login`
- **Remote** branch: `origin/feature/login`
- **Ahead by 1** = local has a commit not pushed yet

Status lines explained:
- **Changes not staged for commit** = modified files that are not added yet (not ready to commit).
- **Untracked files** = new files Git does not track yet (need `git add`).
- **Tracked but modified** = file was tracked (maybe even staged before), then changed again. It is now unstaged until you `git add` again.

Example:
1. `git add README.md` (file is staged)
2. Edit `README.md` again
3. Now it shows as **tracked but modified** (needs another `git add`)

## Local vs Remote Branch (Plain Meaning)

- **Local branch**: the branch on your computer.
- **Remote branch**: the branch on GitHub (shown as `origin/<branch>`).

Ahead/behind:
- **Ahead by N**: you have N commits not pushed yet.
- **Behind by N**: GitHub has N commits you don’t have.
- **Ahead and behind**: both sides changed, you must pull and resolve.

## Example: Local Branch Until You Push

- You create `feature/working-branch` and do not push it.
  - Local branch exists.
  - Remote branch does **not** exist yet.

- After you run:
  `git push -u origin feature/working-branch`
  - A remote branch appears as `origin/feature/working-branch`.

Meaning: `origin/` is just the remote name. It shows up after you push.

### `git log --oneline --graph --decorate`

```text
* 9f1a2b3 (HEAD -> feature/login) Add login form
* 4c8d7e1 (origin/main, main) Add navbar
* a1b2c3d Initial commit
```

How to read it:
- `HEAD -> feature/login` = your current local branch
- `origin/main` = last fetched state of the remote main
- If your branch is ahead of `origin/feature/login`, it is **not pushed yet**

**Note:** `--oneline`, `--graph`, and `--decorate` are Git log options (**flags**) that change how the log is displayed.

## Why You Saw Decorations Without `--decorate`

Some Git setups auto‑decorate logs by default.

Example:
```text
46fc05f (HEAD -> main, origin/main) Add SQL commands...
```

Meaning:
- `HEAD -> main` = your current local branch
- `origin/main` = remote branch
- Both labels on the same commit = local and remote are in sync

`--decorate` is just a command‑line flag that forces labels to show. If your Git is configured with `log.decorate=auto`, you will see labels even without `--decorate`.

### `git diff` (unstaged changes)

```text
diff --git a/src/app.js b/src/app.js
index 1234567..89abcde 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,3 @@
 console.log('hello');
+console.log('new line');
```

`git diff` shows:
- Tracked but **unstaged** changes.
- It does **not** show untracked files.


### `git diff --staged` (staged changes)

```text
diff --git a/src/app.js b/src/app.js
index 1234567..89abcde 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,3 @@
 console.log('hello');
+console.log('new line');
```

`git diff --staged` shows:
- **Staged** changes ready to commit.
- It compares the staging area to the last commit (`HEAD`).

## Symbols Next To Files (VS Code Source Control)

- `U` = Untracked file
- `M` = Modified
- `A` = Added (staged)
- `D` = Deleted
- `R` = Renamed

## Branching

- `git branch` - list branches
- `git branch <name>` - create branch
- `git checkout <name>` - switch branch (classic)
- `git checkout -b <name>` - create + switch (classic)
- `git switch <name>` - switch branch (new)
- `git switch -c <name>` - create + switch

Key difference:
- `checkout` is older and does many things (switch branches, restore files).
- `switch` is newer and only for branches, so it is safer and clearer.

Important notes:
- `git checkout <branch>` switches branches. Git blocks the switch if it would overwrite your local changes.
- If there is no conflict, your uncommitted changes can follow you into the other branch.
- `git checkout -- <file>` discards local changes in that file (restores from last commit).

## Merge Conflicts

A merge conflict happens when two branches change the same lines in a file and Git can’t decide which to keep.

### How To Resolve (Simple Steps)

1. Run `git status` to see conflicted files.
2. Open the file and look for conflict markers:

```text
<<<<<<< HEAD
your changes
=======
other changes
>>>>>>> branch-name
```

3. Decide what to keep:
   - Keep your changes
   - Keep their changes
   - Combine both
4. Remove the conflict markers and save the file.
5. `git add <file>`
6. `git commit`

## Incoming vs Current Changes

When a conflict shows in your editor:

- **Current changes** (or **ours**) = your branch (what you have locally).
- **Incoming changes** (or **theirs**) = the branch you’re merging in.

Use this to decide:
- Take **current** if you want to keep your local work.
- Take **incoming** if you want to accept the other branch.
- Take **both** if you want to combine them.

## Conflict Markers (Which Is Yours vs Main)

Given this conflict header:

```text
<<<<<<< HEAD (Current Change)
```

- **Current / ours / HEAD** = your local branch changes
- **Incoming / theirs** = the branch you are merging (often `main`)

If you are merging `main` into your feature branch:
- **Current** = your feature work
- **Incoming** = `main` changes

If you are on `main` and merging a feature branch:
- **Current** = `main`
- **Incoming** = feature branch

## Rebase vs Merge

### Merge

Creates a merge commit that combines two branches.

Example:

```bash
git checkout main
git merge feature
```

History stays as a true record with a merge commit.

### Rebase

Moves your feature commits on top of the latest main branch.

Example:

```bash
git checkout feature
git rebase main
```

History becomes linear, but commits are rewritten.

### When to use which

- **Merge**: safest for shared branches, preserves history.
- **Rebase**: clean history for local branches before PR.

## Best Practices

- Commit small, focused changes.
- Write clear commit messages.
- Pull before you start work.
- Don’t rebase shared branches.
- Resolve conflicts locally before pushing.
- Use feature branches for new work.
- Protect `main` with PRs and required checks.

## How To Reduce Merge Conflicts

- Rebase daily to keep your branch close to `main`.
- Merge early so branches don’t drift.
- Keep branches short‑lived.
- Split big files into smaller modules.
- Coordinate when multiple people edit the same file.

What “Rebase daily, merge early” means:
- **Rebase daily**: update your feature branch with the latest `main` every day.
- **Merge early**: merge small changes sooner instead of waiting for huge batches.
