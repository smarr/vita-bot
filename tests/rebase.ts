import { GitOps } from "../src/git-ops";

import { expect } from "chai";
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { chdir } from "process";

import yaml from "js-yaml";
import rimraf from "rimraf";
import git from "simple-git/promise";
import { Repository } from "../src/repository";

const GIT_MAIN_REPO = ".upstream";
const GIT_DOWNSTREAM_REPO = ".downstream";

const TEST_TEXT = "1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n";

const FILE1 = "file-1";
const FILE2 = "file-2";

const BRANCH_CONFLICT = "replaced";
const BRANCH_NO_CONFLICT = "partial";
const BRANCH_UPSTREAM = "extended";
const BRANCH_ROOT = "root-master";

const REPO_BASE = ".base";

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

describe("Rebase Branch Automatically", function() {
  before(async function() {
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

    if (existsSync(GIT_DOWNSTREAM_REPO)) {
      rimraf.sync(GIT_DOWNSTREAM_REPO);
    }

    // create downstream repo with both branches, with and without conflict
    const repo = git();
    await repo.clone(GIT_MAIN_REPO, GIT_DOWNSTREAM_REPO, ["-b", BRANCH_CONFLICT]);
    const downstream = git(GIT_DOWNSTREAM_REPO);
    await downstream.fetch("origin", BRANCH_NO_CONFLICT);
    await downstream.branch([BRANCH_NO_CONFLICT, "origin/" + BRANCH_NO_CONFLICT]);
  });

  it("branch without conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO);
    const result = await repo.rebase(BRANCH_NO_CONFLICT, BRANCH_UPSTREAM);
    expect(result.success).to.be.true;
  });

  it("branch with conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO);
    const result = await repo.rebase(BRANCH_CONFLICT, BRANCH_UPSTREAM);

    expect(result.success).to.be.false;
    expect(result.conflicts).to.be.an("array").that.includes(FILE1);
  });

  describe("Remote upstream repo", function() {
    it("fetch upstream branch and try rebase", async function() {
      const repo = new GitOps(GIT_DOWNSTREAM_REPO);

      await repo.fetch(GIT_MAIN_REPO);
      const result = await repo.rebase(BRANCH_CONFLICT, "origin/" + BRANCH_UPSTREAM);

      expect(result.success).to.be.false;
      expect(result.conflicts).to.be.an("array").that.includes(FILE1);
    });
  });
});

describe("Rebase based on goal.yml", function() {
  let graal: any;

  before(async function() {
    const config = yaml.safeLoad(
      readFileSync(__dirname + "/../../tests/goal.yml", "utf-8"));
    graal = config["rebase-on-upstream"]["graal"];
  });

  it("checkout repo and branch", async function() {
    const repo = new Repository(REPO_BASE + "/graal", graal);
    await repo.clone();

    expect(existsSync(REPO_BASE + "/graal" + "/README.md")).to.be.true;
  });

  it("fetch from upstream", async function() {
    const repo = new Repository(REPO_BASE + "/graal", graal);
    await repo.fetchUpstream();

    const repoTest = git(REPO_BASE + "/graal");
    await repoTest.fetch("upstream", graal.upstream.branch);
    const rev = await repoTest.revparse(["upstream/" + graal.upstream.branch]);
    expect(rev).to.be.a("string").that.has.lengthOf(41);
  });

  it("rebase on upstream", async function() {
    const repo = new Repository(REPO_BASE + "/graal", graal);
    const result = await repo.rebaseOnUpstream();

    expect(result.success).to.be.false;
    expect(result.conflicts).to.be.an("array");
  });
});

describe("Rebase based on test.yml", function() {
  let withoutConflicts: any;
  let withConflicts: any;

  before(async function() {
    const config = yaml.safeLoad(
      readFileSync(__dirname + "/../../tests/test.yml", "utf-8"));
    withoutConflicts = config["rebase-on-upstream"]["without-conflicts"];
    withConflicts = config["rebase-on-upstream"]["with-conflicts"];
  });

  it("rebase without conflicts", async function() {
    const repo = new Repository(REPO_BASE + "/without-conflicts", withoutConflicts);
    await repo.clone();
    await repo.fetchUpstream();
    const result = await repo.rebaseOnUpstream();

    expect(result.success).to.be.true;
    expect(result.conflicts).to.be.undefined;
  });

  it("rebase with conflicts", async function() {
    const repo = new Repository(REPO_BASE + "/with-conflicts", withConflicts);
    await repo.clone();
    await repo.fetchUpstream();
    const result = await repo.rebaseOnUpstream();

    expect(result.success).to.be.false;
    expect(result.conflicts).to.be.an("array");
    expect(result.conflicts).includes(FILE1);
  });
});
