import { Configuration } from "../src/config-schema";

import { expect } from "chai";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { chdir } from "process";
import rimraf from "rimraf";
import git from "simple-git/promise";
import { normalize } from "path";

import yaml from "js-yaml";

export const REPO_BASE = normalize(`${__dirname}/../../.base`);

export const GIT_MAIN_REPO = `${REPO_BASE}/upstream`;
export const GIT_DOWNSTREAM_REPO = `${REPO_BASE}/downstream`;
export const GIT_SUBMODULE_REPO = `${REPO_BASE}/with-submodule`;

export const TEST_TEXT = "1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n";

export const FILE1 = "file-1";
export const FILE2 = "file-2";

export const BRANCH_CONFLICT = "replaced";
export const BRANCH_NO_CONFLICT = "partial";
export const BRANCH_UPSTREAM = "extended";
export const BRANCH_ROOT = "root-master";

export function loadTestConfig(path: string): Configuration {
  const content = readFileSync(path, { encoding: "utf-8"});

  const re = new RegExp(/\$BASE\$/g);
  const contentWithRepoBase = content.replace(re, REPO_BASE);
  return yaml.safeLoad(contentWithRepoBase);
}

export function expectConflict(result: { success: boolean; msg: string; conflicts?: string[] | undefined; }) {
  expect(result.success).to.be.false;
  expect(result.conflicts).to.be.an("array");
  expect(result.conflicts).to.include(FILE1);
  expect(result.conflicts).to.have.lengthOf(1);
}

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

  mkdirSync(GIT_MAIN_REPO, { recursive: true });
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

async function populateRepoWithSubmodules() {
  const repo = git();
  await repo.init();

  writeFileSync(FILE1, TEST_TEXT);
  await repo.add(FILE1);
  await repo.commit("Initial Commit");
  await repo.subModule(["add", "-b", BRANCH_CONFLICT, GIT_MAIN_REPO, "with-conflict"]);
  await repo.subModule(["add", "-b", BRANCH_NO_CONFLICT, GIT_MAIN_REPO, "without-conflict"]);
  await repo.subModule(["add", "-b", BRANCH_ROOT, GIT_MAIN_REPO, "fast-forward"]);
  await repo.commit("Added submodules");
}

export async function createRepoWithSubmodules() {
  if (existsSync(GIT_SUBMODULE_REPO)) {
    rimraf.sync(GIT_SUBMODULE_REPO);
  }

  mkdirSync(GIT_SUBMODULE_REPO, { recursive: true });
  chdir(GIT_SUBMODULE_REPO);

  try {
    await populateRepoWithSubmodules();
  } finally {
    chdir("..");
  }
}
