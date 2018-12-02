import {
  GIT_MAIN_REPO, BRANCH_NO_CONFLICT, BRANCH_UPSTREAM, BRANCH_CONFLICT,
  GIT_DOWNSTREAM_REPO, REPO_BASE, expectConflict, ensureMainRepo, ensureDownstreamRepo
} from "./test-repos";

import { Configuration, Submodule } from "../src/config-schema";
import { GitOps } from "../src/git-ops";

import { expect } from "chai";
import { readFileSync, existsSync } from "fs";
import yaml from "js-yaml";
import rimraf = require("rimraf");

const config: Configuration = yaml.safeLoad(
  readFileSync(__dirname + "/../../tests/test.yml", "utf-8"));

describe("Rebase Branch Automatically", function() {
  before(async function() {
    await ensureMainRepo();
    await ensureDownstreamRepo();
  });

  it("branch without conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO, config.bot.name, config.bot.email);
    const result = await repo.rebase(BRANCH_NO_CONFLICT, BRANCH_UPSTREAM);
    expect(result.success).to.be.true;
  });

  it("branch with conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO, config.bot.name, config.bot.email);
    const result = await repo.rebase(BRANCH_CONFLICT, BRANCH_UPSTREAM);

    expectConflict(result);
  });

  describe("Remote upstream repo", function() {
    it("fetch upstream branch and try rebase", async function() {
      const repo = new GitOps(GIT_DOWNSTREAM_REPO, config.bot.name, config.bot.email);

      await repo.fetch(GIT_MAIN_REPO);
      const result = await repo.rebase(BRANCH_CONFLICT, "origin/" + BRANCH_UPSTREAM);

      expectConflict(result);
    });
  });
});

describe("Rebase based on test.yml", function() {
  let withoutConflicts: Submodule;
  let withConflicts: Submodule;

  before(async function() {
    withoutConflicts = config["update-submodule"]["basic-without-conflicts"].submodule;
    withConflicts = config["update-submodule"]["basic-with-conflicts"].submodule;
  });

  it("rebase without conflicts", async function() {
    if (existsSync(REPO_BASE + "/without-conflicts")) {
      rimraf.sync(REPO_BASE + "/without-conflicts");
    }

    const repo = new GitOps(REPO_BASE + "/without-conflicts", config.bot.name, config.bot.email);
    await repo.cloneOrUpdate(withoutConflicts.repo.url, withoutConflicts.repo.branch);
    await repo.ensureRemote("upstream", withoutConflicts.upstream.url);
    await repo.fetch("upstream", withoutConflicts.upstream.branch);
    const result = await repo.rebase(withoutConflicts.repo.branch, "upstream/" + withoutConflicts.upstream.branch);

    expect(result.success).to.be.true;
    expect(result.conflicts).to.be.undefined;
  });

  it("rebase with conflicts", async function() {
    if (existsSync(REPO_BASE + "/with-conflicts")) {
      rimraf.sync(REPO_BASE + "/with-conflicts");
    }

    const repo = new GitOps(REPO_BASE + "/with-conflicts", config.bot.name, config.bot.email);
    await repo.cloneOrUpdate(withConflicts.repo.url, withConflicts.repo.branch);
    await repo.ensureRemote("upstream", withConflicts.upstream.url);
    await repo.fetch("upstream", withConflicts.upstream.branch);
    const result = await repo.rebase(withConflicts.repo.branch, "upstream/" + withConflicts.upstream.branch);

    expectConflict(result);
  });
});
