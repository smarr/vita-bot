import createApp from "../src/app";
import { REPO_ROOT } from "../src/app-controller";
import { bot } from "../src/config";
import { GitOps } from "../src/git-ops";

import { RSA_KEY, GITHUB_API } from "./test-data";
import { TEST_BOT, expectAuthorInfo, REPO_BASE, GIT_SUBMODULE_REPO, ensureRepoWithSubmodules, SUBMODULE_UPDATE, GIT_SUBMODULE_REPO_NAME, PUSH_REPO, ensureRepoForPushes, ensureRepoDoesNotExist } from "./test-repos";

import { expect } from "chai";
import nock, { disableNetConnect, Scope } from "nock";
import { Probot } from "probot";

// TODO: this should be the most high-level integration test, simply verifying
//       whether the high-level scenarios work as intended

// TODO: this should not test all the various scenarios, and the explosion of their
//       combinations

const REPO_OWNER = TEST_BOT.userId;
const REPO_NAME = GIT_SUBMODULE_REPO_NAME;
const SUBMODULE_PATH = SUBMODULE_UPDATE;
const TEST_ORIGINAL_CLONE_PATH = GIT_SUBMODULE_REPO;
const TEST_BOT_REMOTE_PATH = PUSH_REPO;

const REPO_DEF = {
  "id": 2222,
  "name": REPO_NAME,
  "clone_url": TEST_ORIGINAL_CLONE_PATH,
  "owner": {
    login: REPO_OWNER
  }
};

disableNetConnect();

describe("Updates triggered by scheduler", function() {

  describe("Updating a submodule", function() {
    let workingCopyRequest: Scope;
    let createPrRequest: Scope;

    before(async function() {
      let allCompletedResolver: () => void;
      const allCompleted = new Promise((resolve, reject) => { allCompletedResolver = resolve; });
      const finalRequestFakeHeader = {
        "X-All-Requests-Completed": () => allCompletedResolver()
      };
      await ensureRepoWithSubmodules();
      await ensureRepoForPushes();
      ensureRepoDoesNotExist(REPO_ROOT);

      nock(GITHUB_API)
        .get("/app/installations")
        .reply(200, [{
          "id": 100,
          "app_id": 111,
          "target_id": 112,
          "target_type": "Organization"
        }]);
      nock(GITHUB_API)
        .post("/app/installations/100/access_tokens")
        .reply(201, {
          "token": "v1.1f699f1069f60xxx",
          "expires_at": "2016-07-11T22:14:10Z"
        });
      nock(GITHUB_API)
        .get("/user/installations/100/repositories")
        .reply(200, {
            "total_count": 1,
            "repositories": [REPO_DEF]
          });
      nock(GITHUB_API)
        .get("/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/.github/config.yml?ref=dev")
        .reply(200, {
          "name": "config.yml",
          "path": ".github/config.yml",
          "type": "file",
          "content": Buffer.from(`
target-branch: master
update-submodules:
  ${SUBMODULE_PATH}:
    branch: master
`).toString("base64"),
          "encoding": "base64"
        });
      nock(GITHUB_API)
        .get(`/repos/${REPO_OWNER}/${REPO_NAME}`)
        .reply(200, REPO_DEF);
      workingCopyRequest = nock(GITHUB_API)
        .get(`/repos/${bot.userId}/${REPO_NAME}`)
        .reply(200, {
          "name": REPO_NAME,
          "fork": true,
          "clone_url": TEST_BOT_REMOTE_PATH,
          "source": {
            "name": REPO_NAME,
            "owner": {
              "login": REPO_OWNER
            }
          }
        });
      nock(GITHUB_API)
        .get(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?head=vita-bot&state=open`)
        .reply(200, []);
      nock(GITHUB_API)
        .get(`/repos/${bot.userId}/${REPO_NAME}/branches`)
        .reply(200, []);
      createPrRequest = nock(GITHUB_API)
        .post(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`)
        .reply(201, {
          "number": 1
        }, finalRequestFakeHeader);

      const probot: Probot = new Probot({cert: RSA_KEY});
      probot.load(createApp);
      await allCompleted;
    });

    let commitHash: string;
    it("should update the repo by creating a commit", async function() {
      const repoPath = REPO_ROOT + "/" + REPO_NAME;
      const repo = new GitOps(repoPath, TEST_BOT.name, TEST_BOT.email);

      const head = await repo.getHead();
      commitHash = head.commitHash;

      expectAuthorInfo(head, bot);
      expect(head.subject).contain("Update submodule " + SUBMODULE_PATH);
    });

    it("should use working copy fork on github", function() {
      expect(workingCopyRequest.isDone()).to.be.true;
    });

    it("should push the changes", async function() {
      const repo = new GitOps(TEST_BOT_REMOTE_PATH, TEST_BOT.name, TEST_BOT.email);
      const hasBranch = await repo.hasBranch("update-" + SUBMODULE_PATH);

      expect(hasBranch).to.be.true;

      const head = (await repo.log(1, "update-" + SUBMODULE_PATH))[0];

      expect(head.subject).contain("Update submodule " + SUBMODULE_PATH);
      expect(head.commitHash).to.equal(commitHash);
    });

    it("should create a pull request on user repo", function() {
      expect(createPrRequest.isDone());
    });
  });

  describe.skip("without update available", function() {
    it.skip("should get expected repo", function() {

    });

    it.skip("should try update, and find no changes necessary", function() {

    });

    it.skip("should be done, and not perform further operations", function() {

    });
  });

  describe.skip("with a conflicting change", function() {

  });
});
