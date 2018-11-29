import { GitOps } from "../src/git-ops";

import { expect } from "chai";
import { existsSync, readFileSync } from "fs";

import yaml from "js-yaml";
import git from "simple-git/promise";
import { Repository } from "../src/repository";
import {
  createMainRepo, createDownstreamRepo, GIT_MAIN_REPO,
  BRANCH_NO_CONFLICT, BRANCH_UPSTREAM, BRANCH_CONFLICT, GIT_DOWNSTREAM_REPO,
  FILE1, REPO_BASE
} from "./test-repos";
import { Configuration, Rebase } from "../src/config-schema";

describe("Rebase Branch Automatically", function() {
  before(async function() {
    await createMainRepo();
    await createDownstreamRepo();
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
  let graal: Rebase;

  before(async function() {
    const config: Configuration = yaml.safeLoad(
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
  let withoutConflicts: Rebase;
  let withConflicts: Rebase;

  before(async function() {
    const config: Configuration = yaml.safeLoad(
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
