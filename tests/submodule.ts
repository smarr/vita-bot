import { createRepoWithSubmodules, FILE1, expectConflict, REPO_BASE } from "./test-repos";

import { GitOps } from "../src/git-ops";
import { UpdateSubmodule } from "../src/config-schema";

import { expect } from "chai";

import { Repository } from "../src/repository";

const configuration: { [key: string]: UpdateSubmodule } = loadTestConfig(
  __dirname + "/../../tests/test.yml")["update-submodule"];

describe("Update submodule, without touching main repo", function() {
  before(async function() {
    await ensureRepoWithSubmodules();
  });

  it("update submodule simply with a fast forward", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-fast-forward"];

    const repo = new GitOps(updateConfig.repo.url + "/" + updateConfig.submodule.path);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expect(result.success).to.be.true;
  });

  it("update submodule with simple rebase", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-without-conflict"];

    const repo = new GitOps(updateConfig.repo.url + "/" + updateConfig.submodule.path);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expect(result.success).to.be.true;
  });

  // TODO: do I need to be able to distinguish fast-forward from rebase?
  //       I think so, because it implies whether I need to create tags, and stuff
  it("update submodule but fail with conflict", async function() {
    const updateConfig: UpdateSubmodule = configuration["submodule-with-conflict"];

    const repo = new GitOps(updateConfig.repo.url + "/" + updateConfig.submodule.path);
    await repo.ensureRemote("upstream", updateConfig.submodule.upstream.url);
    await repo.fetch("upstream", updateConfig.submodule.upstream.branch);

    const result = await repo.rebase(updateConfig.submodule.repo.branch, "upstream/" + updateConfig.submodule.upstream.branch);
    expectConflict(result);
  });
});
