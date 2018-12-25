import { bot } from "../src/config";
import { UpdateSubmodule } from "../src/update-ops";

import { REPO_BASE, loadTestConfig, ensureRepoWithSubmodules, SUBMODULE_UPDATE, SUBMODULE_CONFLICT, ensureRepoDoesNotExist, PUSH_REPO, PUSH_REPO_NON_EXISTING_BRANCH, PUSH_REPO_EXISTING_BRANCH, ensureRepoForPushes } from "./test-repos";

import { expect } from "chai";
import { GitOps } from "../src/git-ops";

const testConfig = loadTestConfig(__dirname + "/../../tests/test.yml");
const updateAvailable = testConfig["update-submodule.update-available"];
const updateUnavailable = testConfig["update-submodule.update-unavailable"];
const updateConflicting = testConfig["update-submodule.update-conflicting"];

describe("Update submodule", function() {
  let update: UpdateSubmodule;
  let repoPath: string;

  before(async function() {
    await ensureRepoWithSubmodules();
    await ensureRepoForPushes();
  });

  describe("with a fast forward change", function() {
    before(function() {
      repoPath = REPO_BASE + "/submodule-fast-forward";
      ensureRepoDoesNotExist(repoPath);

      update = new UpdateSubmodule(updateAvailable["test-repo"].url, "master",
        repoPath, SUBMODULE_UPDATE,
        updateAvailable["update-submodules"][SUBMODULE_UPDATE], bot);
    });

    it("should succeed", async function() {
      const result = await update.performUpdate();

      expect(result.success).to.be.true;
      expect(result.forced).to.be.false;
    });

    let commitHash: string;
    it("should commit the update", async function() {
      const repo = new GitOps(repoPath, bot.name, bot.email);
      const head = await repo.getHead();

      commitHash = head.commitHash;
      expect(head.authorName).to.equal(bot.name);
      expect(head.authorEmail).to.equal(bot.email);
      expect(head.subject).contains("Update submodule " + SUBMODULE_UPDATE);
    });

    it("should be able to push the change to empty repo", async function() {
      await update.pushBranch(PUSH_REPO_NON_EXISTING_BRANCH, PUSH_REPO);

      const repo = new GitOps(PUSH_REPO, bot.name, bot.email);
      const head = (await repo.log(1, PUSH_REPO_NON_EXISTING_BRANCH))[0];

      expect(head.commitHash).to.equal(commitHash);
    });

    it("should be able to force-push changes to repo with conflicting branch", async function() {
      await update.pushBranch(PUSH_REPO_EXISTING_BRANCH, PUSH_REPO);

      const repo = new GitOps(PUSH_REPO, bot.name, bot.email);
      const head = (await repo.log(1, PUSH_REPO_EXISTING_BRANCH))[0];

      expect(head.commitHash).to.equal(commitHash);
    });
  });

  describe("without update available", function() {
    before(function() {
      repoPath = REPO_BASE + "/submodule-no-update";
      ensureRepoDoesNotExist(repoPath);
      update = new UpdateSubmodule(updateUnavailable["test-repo"].url, "master",
        repoPath, SUBMODULE_UPDATE,
        updateUnavailable["update-submodules"][SUBMODULE_UPDATE], bot);
    });

    it("should fail", async function() {
      const result = await update.performUpdate();

      expect(result.success).to.be.false;
      expect(result.forced).to.be.false;
    });

    it("should not create a new commit", async function() {
      const repo = new GitOps(repoPath, bot.name, bot.email);
      const head = await repo.getHead();

      expect(head.authorName).not.to.equal(bot.name);
      expect(head.authorEmail).not.to.equal(bot.email);
      expect(head.subject).not.to.contain("Update submodule " + SUBMODULE_UPDATE);
    });
  });

  describe("with a conflicting change", function() {
    before(function() {
      repoPath = REPO_BASE + "/submodule-conflict";
      ensureRepoDoesNotExist(repoPath);
      update = new UpdateSubmodule(updateConflicting["test-repo"].url, "master",
        repoPath, SUBMODULE_CONFLICT,
        updateConflicting["update-submodules"][SUBMODULE_CONFLICT], bot);
    });

    it("should succeed and be forced", async function() {
      const result = await update.performUpdate();

      expect(result.success, "Despite conflict, expect update to succeed").to.be.true;
      expect(result.forced, "Update was forced").to.be.true;
    });

    it("should create a new commit", async function() {
      const repo = new GitOps(repoPath, bot.name, bot.email);
      const head = await repo.getHead();

      expect(head.authorName).to.equal(bot.name);
      expect(head.authorEmail).to.equal(bot.email);
      expect(head.subject).contains("Update submodule " + SUBMODULE_CONFLICT);
    });
  });
});
