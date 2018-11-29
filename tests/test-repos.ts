import { writeFileSync, existsSync, mkdirSync } from "fs";
import git from "simple-git/promise";
import rimraf = require("rimraf");
import { chdir } from "process";

export const GIT_MAIN_REPO = ".upstream";
export const GIT_DOWNSTREAM_REPO = ".downstream";
export const GIT_SUBMODULE_REPO = ".with-submodule";

export const TEST_TEXT = "1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n";

export const FILE1 = "file-1";
export const FILE2 = "file-2";

export const BRANCH_CONFLICT = "replaced";
export const BRANCH_NO_CONFLICT = "partial";
export const BRANCH_UPSTREAM = "extended";
export const BRANCH_ROOT = "root-master";

export const REPO_BASE = ".base";

async function populateMainRepo() {
  const repo = git();
  await repo.init();

  writeFileSync(FILE1, TEST_TEXT);
  writeFileSync(FILE2, TEST_TEXT);
  await repo.add(FILE1);
  await repo.add(FILE2);
  await repo.commit("Initial Commit");
  await repo.branch([BRANCH_ROOT]);

  writeFileSync(FILE1, TEST_TEXT + TEST_TEXT);
  await repo.add(FILE1);
  await repo.commit("Extend " + FILE1);

  writeFileSync(FILE1, TEST_TEXT + TEST_TEXT + TEST_TEXT);
  await repo.add(FILE1);
  await repo.commit(`Extend ${FILE1} more`);

  // the branch representing upstream development
  await repo.branch([BRANCH_UPSTREAM]);

  // a branch representing local development that will cause a conflict
  await repo.checkoutBranch(BRANCH_CONFLICT, BRANCH_ROOT);
  writeFileSync(FILE1, "replaced");
  await repo.add(FILE1);
  await repo.commit("Replaced " + FILE1);

  // a branch representing local development that won't cause a conflict
  await repo.checkoutBranch(BRANCH_NO_CONFLICT, BRANCH_ROOT);
  writeFileSync(FILE1, TEST_TEXT + TEST_TEXT.substring(0, TEST_TEXT.length / 2));
  await repo.add(FILE1);
  await repo.commit("Partial extension of " + FILE1);
}

export async function createMainRepo() {
  if (existsSync(GIT_MAIN_REPO)) {
    rimraf.sync(GIT_MAIN_REPO);
  }

  mkdirSync(GIT_MAIN_REPO);
  chdir(GIT_MAIN_REPO);

  try {
    await populateMainRepo();
  } finally {
    chdir("..");
  }
}

/**
 * Create downstream repo with both branches, with and without conflict.
 */
export async function createDownstreamRepo() {
  if (existsSync(GIT_DOWNSTREAM_REPO)) {
    rimraf.sync(GIT_DOWNSTREAM_REPO);
  }

  const repo = git();
  await repo.clone(GIT_MAIN_REPO, GIT_DOWNSTREAM_REPO, ["-b", BRANCH_CONFLICT]);
  const downstream = git(GIT_DOWNSTREAM_REPO);
  await downstream.fetch("origin", BRANCH_NO_CONFLICT);
  await downstream.branch([BRANCH_NO_CONFLICT, "origin/" + BRANCH_NO_CONFLICT]);
}