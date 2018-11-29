import { createRepoWithSubmodules } from "./test-repos";

import { GitOps } from "../src/git-ops";
import { Configuration, User } from "../src/config-schema";

import { expect } from "chai";
import { readFileSync } from "fs";
import yaml from "js-yaml";

describe("Update submodule", function() {
  let configuration: { [key: string]: User };

  before(async function() {
    await createRepoWithSubmodules();

    const config: Configuration = yaml.safeLoad(
      readFileSync(__dirname + "/../../tests/test.yml", "utf-8"));
    configuration = config["downstream-users"];
  });

  it("update submodule simply with a fast forward", async function() {
    const updateConfig: User = configuration["submodule-fast-forward"];

    const repo = new GitOps(updateConfig.repo.url + "/" + updateConfig.submodule);
    await repo.ensureRemote("upstream", updateConfig.upstream.url);
    await repo.fetch("upstream", updateConfig.upstream.branch);

    const result = await repo.rebase(updateConfig.repo.branch, "upstream/" + updateConfig.upstream.branch);
    expect(result.success).to.be.true;
  });
});
