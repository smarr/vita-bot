import { expectConflict, REPO_BASE, loadTestConfig, ensureRepoWithSubmodules, ensureRepoDoesNotExist } from "./test-repos";

import { GitOps } from "../src/git-ops";
import { UpdateSubmodule } from "../src/config-schema";

import { expect } from "chai";

import { Repository } from "../src/repository";

const testConfig = loadTestConfig(__dirname + "/../../tests/test.yml");
const configuration: { [key: string]: UpdateSubmodule } = testConfig["update-submodule"];

describe("Update submodule, without touching main repo", function() {
  before(async function() {
    await ensureRepoWithSubmodules();
  });

  it("update submodule simply with a fast forward", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-fast-forward"];

    const repo = new GitOps(
      updateConfig.repo.url + "/" + updateConfig.submodule.path,
      testConfig.bot.name, testConfig.bot.email);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expect(result.success).to.be.true;
  });

  it("update submodule with simple rebase", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-without-conflict"];

    const repo = new GitOps(
      updateConfig.repo.url + "/" + updateConfig.submodule.path,
      testConfig.bot.name, testConfig.bot.email);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expect(result.success).to.be.true;
  });

  // TODO: do I need to be able to distinguish fast-forward from rebase?
  //       I think so, because it implies whether I need to create tags, and stuff
  it("update submodule but fail with conflict", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-with-conflict"];

    const repo = new GitOps(
      updateConfig.repo.url + "/" + updateConfig.submodule.path,
      testConfig.bot.name, testConfig.bot.email);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expectConflict(result);
  });
});

describe("Update submodule and update main repo", function() {
  before(async function() {
    await ensureRepoWithSubmodules();
  });

  it("update submodule simply with a fast forward", async function() {
    ensureRepoDoesNotExist(REPO_BASE + "/fast-forward");

    const repo = new Repository(
      REPO_BASE + "/fast-forward", configuration["submodule-fast-forward"],
      testConfig.bot);
    await repo.cloneOrUpdate();
    const result = await repo.updateSubmodule();
    expect(result.success).to.be.true;
    expect(result.fastForward).to.be.true;
    expect(result.heads.beforeUpdate.author_name).to.equal(testConfig.bot.name);
    expect(result.heads.beforeUpdate.author_email).to.equal(testConfig.bot.email);

    expect(result.heads.upstream.author_name).to.equal(testConfig.bot.name);
    expect(result.heads.upstream.author_email).to.equal(testConfig.bot.email);

    expect(result.heads.afterUpdate.author_name).to.equal(testConfig.bot.name);
    expect(result.heads.afterUpdate.author_email).to.equal(testConfig.bot.email);
  });
});

