import { bot } from "../src/config";
import { UpdateSubmodule } from "../src/update-ops";

import { REPO_BASE, loadTestConfig, ensureRepoWithSubmodules, SUBMODULE_UPDATE, SUBMODULE_CONFLICT } from "./test-repos";

import { expect } from "chai";
import { existsSync } from "fs";
import rimraf = require("rimraf");

const testConfig = loadTestConfig(__dirname + "/../../tests/test.yml");
const updateAvailable = testConfig["update-submodule.update-available"];
const updateUnavailable = testConfig["update-submodule.update-unavailable"];
const updateConflicting = testConfig["update-submodule.update-conflicting"];

describe("Update submodule", function() {
  before(async function() {
    await ensureRepoWithSubmodules();
  });

  it("update submodule simply with a fast forward", async function() {
    const repoPath = REPO_BASE + "/submodule-fast-forward";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const update = new UpdateSubmodule(updateAvailable["test-repo"].url, "master",
      repoPath, SUBMODULE_UPDATE,
      updateAvailable["update-submodules"][SUBMODULE_UPDATE], bot);
    const result = await update.performUpdate();

    expect(result.success).to.be.true;
    expect(result.forced).to.be.false;
  });

  it("update submodule, no update available", async function() {
    const repoPath = REPO_BASE + "/submodule-no-update";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const update = new UpdateSubmodule(updateUnavailable["test-repo"].url, "master",
      repoPath, SUBMODULE_UPDATE,
      updateUnavailable["update-submodules"][SUBMODULE_UPDATE], bot);
    const result = await update.performUpdate();

    expect(result.success).to.be.false;
    expect(result.forced).to.be.false;
  });

  it("update submodule, update conflicting", async function() {
    const repoPath = REPO_BASE + "/submodule-conflict";
    if (existsSync(repoPath)) {
      rimraf.sync(repoPath);
    }

    const update = new UpdateSubmodule(updateConflicting["test-repo"].url, "master",
      repoPath, SUBMODULE_CONFLICT,
      updateConflicting["update-submodules"][SUBMODULE_CONFLICT], bot);
    const result = await update.performUpdate();

    expect(result.success, "Despite conflict, expect update to succeed").to.be.true;
    expect(result.forced, "Update was forced").to.be.true;
  });
});

