import { ensureMainRepo, GIT_MAIN_REPO, expectAuthorInfo, TEST_BOT, expectCommitterInfo } from "./test-repos";
import { GitOps } from "../src/git-ops";

import { expect } from "chai";

describe("Git Operations", function() {
  let repo: GitOps;

  before(async function() {
    await ensureMainRepo();
    repo = new GitOps(GIT_MAIN_REPO, "Git Ops", "git-ops@example.org");
  });

  describe("git log", function() {
    it("getHead should report author and committer", async function() {
      const result = await repo.getHead();
      expectAuthorInfo(result, TEST_BOT);
      expectCommitterInfo(result, TEST_BOT);
    });

    it("log should return expected number of commits and the author/committer", async function() {
      const results = await repo.log(2);

      expect(results).to.be.an("Array").with.lengthOf(2);

      for (const r of results) {
        expectAuthorInfo(r, TEST_BOT);
        expectCommitterInfo(r, TEST_BOT);
      }
    });
  });
});
