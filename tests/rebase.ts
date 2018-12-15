import {
  GIT_MAIN_REPO, BRANCH_NO_CONFLICT, BRANCH_UPSTREAM, BRANCH_CONFLICT,
  GIT_DOWNSTREAM_REPO, REPO_BASE, expectConflict, ensureMainRepo, ensureDownstreamRepo, BRANCH_ROOT, loadTestConfig, ensureRepoDoesNotExist, expectAuthorInfo, expectCommitterInfo, TEST_BOT
} from "./test-repos";

import { bot } from "../src/config";
import { GitOps } from "../src/git-ops";

import { expect } from "chai";
import { UpdateBranchConfig } from "../src/config-schema";
import { UpdateBranch } from "../src/update-ops";

const config = loadTestConfig(__dirname + "/../../tests/test.yml");

describe("Update Branches Automatically, possibly requiring rebase", function() {
  before(async function() {
    await ensureMainRepo();
    await ensureDownstreamRepo();
  });

  it("branch without conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO, bot.name, bot.email);
    const result = await repo.rebase(BRANCH_NO_CONFLICT, BRANCH_UPSTREAM);
    expect(result.success).to.be.true;
  });

  it("branch with conflicts", async function() {
    const repo = new GitOps(GIT_MAIN_REPO, bot.name, bot.email);
    const result = await repo.rebase(BRANCH_CONFLICT, BRANCH_UPSTREAM);

    expectConflict(result);
  });

  it("fetch upstream branch and try rebase", async function() {
    const repo = new GitOps(GIT_DOWNSTREAM_REPO, bot.name, bot.email);

    await repo.fetch(GIT_MAIN_REPO);
    const result = await repo.rebase(BRANCH_CONFLICT, "origin/" + BRANCH_UPSTREAM);

    expectConflict(result);
  });
});

describe("Rebase using test.yml", function() {
  const withoutConflicts = config["update-branches.without-conflicts"];
  const withConflicts = config["update-branches.with-conflicts"];
  const fastForward = config["update-branches.fast-forward"];

  let repoPath: string;
  let updater: UpdateBranch;

  describe("without conflict", function() {
    before(function() {
      repoPath = REPO_BASE + "/without-conflicts";
      ensureRepoDoesNotExist(repoPath);
      const upstreamDetails: UpdateBranchConfig = withoutConflicts["update-branches"][BRANCH_NO_CONFLICT];
      updater = new UpdateBranch(
        withoutConflicts["test-repo"].url, BRANCH_NO_CONFLICT,
        repoPath, upstreamDetails, bot);
    });

    it("should succeed without conflicts", async function() {
      const result = await updater.performUpdate();

      expect(result.success).to.be.true;
      expect(result.rebase.conflicts).to.be.undefined;
    });

    let repo: GitOps;

    it("should not introduce new commits", async function() {
      repo = new GitOps(repoPath, "Rebase Test", "rebase@example.org");

      const log = await repo.log(100);
      expect(log).to.be.of.length(4);
      expect(log[0].subject).to.include("Partial extension");
    });

    it("should maintain author, only modify committer", async function() {
      const head = await repo.getHead();
      expectCommitterInfo(head, bot); // rebase changes the committer to the bot
      expectAuthorInfo(head, TEST_BOT); // author remains the TEST_BOT
    });
  });

  describe("with conflict", function() {
    before(function() {
      repoPath = REPO_BASE + "/with-conflicts";
      ensureRepoDoesNotExist(repoPath);
      const upstreamDetails: UpdateBranchConfig = withConflicts["update-branches"][BRANCH_CONFLICT];

      updater = new UpdateBranch(
        withConflicts["test-repo"].url, BRANCH_CONFLICT,
        repoPath, upstreamDetails, bot);
    });

    it("should fail with conflict", async function() {
      const result = await updater.performUpdate();
      expectConflict(result.rebase);
    });

    it("should not change the repo", async function() {
      const repo = new GitOps(repoPath, "Rebase Test", "rebase@example.org");

      const log = await repo.log(100);
      expect(log).to.be.of.length(2);
      expect(log[0].subject).to.include("Replaced");
    });
  });

  describe("with fast forward", function() {
    before(function() {
      repoPath = REPO_BASE + "/fast-forward";
      ensureRepoDoesNotExist(repoPath);
      const upstreamDetails: UpdateBranchConfig = fastForward["update-branches"][BRANCH_ROOT];
      updater = new UpdateBranch(
        fastForward["test-repo"].url, BRANCH_ROOT,
        repoPath, upstreamDetails, bot);
    });

    it("should succeed without conflicts", async function() {
      const result = await updater.performUpdate();

      expect(result.success).to.be.true;
      expect(result.rebase.conflicts).to.be.undefined;
    });

    let repo: GitOps;

    it("should not introduce new commits", async function() {
      repo = new GitOps(repoPath, "Rebase Test", "rebase@example.org");

      const log = await repo.log(100);
      expect(log).to.be.of.length(3);
      expect(log[0].subject).to.include("Extend file-1 more");
    });

    it("should maintain author and committer", async function() {
      const head = await repo.getHead();
      expectCommitterInfo(head, TEST_BOT);
      expectAuthorInfo(head, TEST_BOT);
    });
  });
});
