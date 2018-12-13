import { bot } from "../src/config";
import { UpdateSubmodule } from "../src/update-ops";

import { REPO_BASE, loadTestConfig, ensureRepoWithSubmodules, SUBMODULE_UPDATE, SUBMODULE_CONFLICT, ensureRepoDoesNotExist } from "./test-repos";

import { expect } from "chai";

const testConfig = loadTestConfig(__dirname + "/../../tests/test.yml");
const updateAvailable = testConfig["update-submodule.update-available"];
const updateUnavailable = testConfig["update-submodule.update-unavailable"];
const updateConflicting = testConfig["update-submodule.update-conflicting"];

describe("Update submodule", function() {
  before(async function() {
    await ensureRepoWithSubmodules();
  });

  describe("with a fast forward change", function() {
    let update: UpdateSubmodule;
    let repoPath: string;

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
  });

  describe("without update available", async function() {
    let update: UpdateSubmodule;

    before(function() {
      const repoPath = REPO_BASE + "/submodule-no-update";
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


  });

  describe("with a conflicting change", function() {
    let update: UpdateSubmodule;

    before(function() {
      const repoPath = REPO_BASE + "/submodule-conflict";
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
  });
});

