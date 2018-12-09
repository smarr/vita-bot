import {
  GIT_MAIN_REPO, BRANCH_NO_CONFLICT, BRANCH_UPSTREAM, BRANCH_CONFLICT,
  GIT_DOWNSTREAM_REPO, REPO_BASE, expectConflict, ensureMainRepo, ensureDownstreamRepo, BRANCH_ROOT, loadTestConfig
} from "./test-repos";

import { GitOps } from "../src/git-ops";

import { expect } from "chai";
import { existsSync } from "fs";
import rimraf = require("rimraf");
import { UpdateBranchConfig } from "../src/config-schema";
import { UpdateBranch } from "../src/update-ops";

const config = loadTestConfig(__dirname + "/../../tests/test.yml");

describe("Update Branches Automatically, possibly requiring rebase", function() {
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

  it("fetch upstream branch and try rebase", async function() {
    const repo = new GitOps(GIT_DOWNSTREAM_REPO, config.bot.name, config.bot.email);

    await repo.fetch(GIT_MAIN_REPO);
    const result = await repo.rebase(BRANCH_CONFLICT, "origin/" + BRANCH_UPSTREAM);

    expectConflict(result);
  });
});

describe("Rebase based on test.yml", function() {
  const withoutConflicts = config["update-branches.without-conflicts"];
  const withConflicts = config["update-branches.with-conflicts"];
  const fastForward = config["update-branches.fast-forward"];

  it("rebase without conflicts", async function() {
    const repoPath = REPO_BASE + "/without-conflicts";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const upstreamDetails: UpdateBranchConfig = withoutConflicts["update-branches"][BRANCH_NO_CONFLICT];
    const updater = new UpdateBranch(
      withoutConflicts["test-repo"].url, BRANCH_NO_CONFLICT,
      repoPath, upstreamDetails, config.bot);
    const result = await updater.performUpdate();

    expect(result.success).to.be.true;
    expect(result.rebase.conflicts).to.be.undefined;
  });

  it("rebase with conflicts", async function() {
    const repoPath = REPO_BASE + "/with-conflicts";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const upstreamDetails: UpdateBranchConfig = withConflicts["update-branches"][BRANCH_CONFLICT];
    const updater = new UpdateBranch(
      withConflicts["test-repo"].url, BRANCH_CONFLICT,
      repoPath, upstreamDetails, config.bot);
    const result = await updater.performUpdate();

    expectConflict(result.rebase);
  });

  it("fast forward", async function() {
    const repoPath = REPO_BASE + "/fast-forward";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const upstreamDetails: UpdateBranchConfig = fastForward["update-branches"][BRANCH_ROOT];

    const updater = new UpdateBranch(
      fastForward["test-repo"].url, BRANCH_ROOT,
      repoPath, upstreamDetails, config.bot);
    const result = await updater.performUpdate();

    expect(result.success).to.be.true;
    expect(result.rebase.conflicts).to.be.undefined;
  });
});
