# Vita, The Gardener

Vita is a GitHub bot that helps maintaining larger projects, upstream
dependencies, and generally supports keeping branches up-to-date.

Vita is useful for projects that rebase branches regularly on top of a
development branch. It offers maintainers of branches to rebase them when the
development branch is updated.

This can be useful for feature branches, and it is of great help when maintaining
patches on top of an upstream repository, for which the patches are regularly
rebased on top of the latest version.

## Features (Goals)

- [ ] check whether a branch can be rebased on top of another.
      Report conflicting files or perform rebase.

- [ ] after an update to the designated development branch check all pull
      requests. Use the checks API to create a check for being on top of
      the development branch. Provide an action to rebase on top of the branch.

- [ ] for branches without associated pull requests, offer a rebase or leave
      an outdated note on the first commit in the branch

- [ ] support configuration and blacklisting of branches

- [ ] support creation of tags for previous version of rebased branches.
      This is useful to keep old versions of branches available that are
      patches on top of an upstream repo.

- [ ] handle situations gracefully where the user did not respond to a rebase
      request

- [ ] create PRs on repo that uses a patch-on-upstream repo as submodules to
      automatically update them. Interpret CI status and existing PRs.
      Do not create new one if there is already one.
      Instead, update the existing PR, if possible (rebase succeeds).
      Create tag in patch-on-upstream repo only if rebased version was merged
      into using repo.
