import { expect } from "chai";
import { GitHubAPI } from "probot/lib/github";
import { GitHubSubmoduleUpdate, UpdateResult, SubmoduleMetadata, UpdateSubmoduleReport } from "../src/update-ops";
import nock, { disableNetConnect, Scope } from "nock";
import { readData, withData } from "../src/issue-metadata";
import { GITHUB_API } from "./test-data";
import { TEST_BOT } from "./test-repos";
import { GithubRepo } from "../src/github";

// TODO: somewhere else, we need to test that things are pushed into the right
//       place, before this github interaction takes places: see update-pushes.ts

const EXISTING_ISSUE_ID = 41;
const NEW_ISSUE_ID = 42;
const SUBMODULE_PATH = "libs/truffle";

const UPDATE_SUBMODULE_REPORT: UpdateSubmoduleReport = {
  previousDate: "2018-12-01 15:12:34 +0100",
  upstreamDate: "2018-12-10 15:12:34 +0100",
  forced: true,
  submodule: {
    path: SUBMODULE_PATH,
    updateBranch: "master",
    updateUrl: "http://upstream.example.org"
  }
};

const SUBMODULE_META: SubmoduleMetadata = {
  type: "submodule",
  submodulePath: SUBMODULE_PATH
};

const COMMENT_ID = 666;

disableNetConnect();

const github = GitHubAPI();

describe("GitHub interaction", function() {
  after(function() {
    nock.cleanAll();
  });

  describe("Submodule Update", function() {
    let updater: GitHubSubmoduleUpdate;
    let updateResult: UpdateResult;
    let createPost: Scope;
    let createBody: any;
    let existingBranchName: string | null;

    describe("First update", function() {
      before(async function() {
        nock(GITHUB_API)
          .get("/repos/smarr/SOMns/pulls?head=vita-bot&state=open")
          .reply(200, []);

        createPost = nock(GITHUB_API)
          .post("/repos/smarr/SOMns/pulls",
            function(body: any) {
              createBody = body;
              return true;
            })
          .reply(201, {
            "url": GITHUB_API + "/repos/smarr/SOMns/pulls/" + NEW_ISSUE_ID,
            "id": 1,
            "number": NEW_ISSUE_ID,
            "state": "open",
            "title": "new-feature",
          });

        updater = new GitHubSubmoduleUpdate(github, github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "dev");
        existingBranchName = await updater.findExistingPullRequest();
        updateResult = await updater.proposeUpdate("vita/libs-truffle/prev-date");
      });

      it("should check whether PR exists and not find any open one", function() {
        expect(updateResult.updatedExisting).to.be.false;
        expect(updateResult.existingId).to.be.undefined;
        expect(existingBranchName).to.be.null;
      });

      it("should create PR", function() {
        expect(createPost.isDone()).to.be.true;
        expect(updateResult.newId).to.equal(NEW_ISSUE_ID);
      });

      it("should be created with metadata", function() {
        const metaData: SubmoduleMetadata = readData(createBody.body);
        expect(metaData).to.not.be.null;
        expect(metaData.type).to.equal("submodule");
        expect(metaData.submodulePath).to.equal(SUBMODULE_PATH);
      });
    });

    describe("Update with existing PR", function() {
      before(async function() {
        nock(GITHUB_API)
          .get("/repos/smarr/SOMns/pulls?head=vita-bot&state=open")
          .reply(200, [
            {
              "url": GITHUB_API + "/repos/smarr/SOMns/pulls/1347",
              "id": 1,
              "number": EXISTING_ISSUE_ID,
              "state": "open",
              "title": "new-feature",
              "user": {
                "login": "vita-bot",
                "id": 1,
                "type": "Bot",
              },
              "body": withData("Please pull these awesome changes\n", SUBMODULE_META),
              "head": {
                "ref": "vita/libs-truffle/prev-date"
              }
            }
          ]);

        createPost = nock(GITHUB_API)
          .post("/repos/smarr/SOMns/issues/" + EXISTING_ISSUE_ID + "/comments")
          .reply(201, {
            "id": COMMENT_ID,
            "body": "TODO",
            "created_at": "2011-04-14T16:00:49Z"
          });

        updater = new GitHubSubmoduleUpdate(github, github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "dev");
        existingBranchName = await updater.findExistingPullRequest();
        updateResult = await updater.proposeUpdate("vita/libs-truffle/prev-date");
      });

      it("should check whether PR exists and find an open one", function() {
        expect(updateResult.updatedExisting).to.be.true;
        expect(updateResult.existingId).to.equal(EXISTING_ISSUE_ID);
        expect(existingBranchName).to.equal("vita/libs-truffle/prev-date");
      });

      it("should update PR with an update comment", function() {
        expect(createPost.isDone()).to.be.true;
        expect(updateResult.commentId).to.equal(COMMENT_ID);
      });
    });
  });

  describe("getBranchName", function() {
    const repo: GithubRepo = { owner: TEST_BOT.userId, repo: "SOMns" };

    let updater: GitHubSubmoduleUpdate;
    describe("Branch with name exists", function() {
      before(function() {
        nock(GITHUB_API)
          .get("/repos/" + TEST_BOT.userId + "/SOMns/branches")
          .reply(200, [
            { name: "update-libs-truffle" },
            { name: "update-libs-truffle-2018-12-10" },
            { name: "update-libs-truffle-2018-12-10-1" },
          ]);
        updater = new GitHubSubmoduleUpdate(github, github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "dev");
      });

      it("should get a name that's not yet in use", async function() {
        const name = await updater.getBranchName(repo);
        expect(name).is.equal("update-libs-truffle-2018-12-10-2");
      });
    });

    describe("Branch with name does not exist", function() {
      before(function() {
        nock(GITHUB_API)
          .get("/repos/" + TEST_BOT.userId + "/SOMns/branches")
          .reply(200, []);
        updater = new GitHubSubmoduleUpdate(github, github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "dev");
      });

      it("should simply give a suitable branch name", async function() {
        const name = await updater.getBranchName(repo);
        expect(name).is.equal("update-libs-truffle");
      });
    });
  });

  describe("Branch update", function() {
    describe("Failed update without open PR or issue", function() {
      it.skip("should update search for issue and PR, but not find one", function() {

      });

      it.skip("should open an issue, and report conflicts", function() {

      });
    });

    describe("Failed update with open PR", function() {
      it.skip("should search for issue and PR, and find PR", function() {

      });

      it.skip("should update PR with an update comment", function() {

      });
    });

    describe("Failed update with open issue", function() {
      it.skip("should search for issue and PR, and find issue", function() {

      });

      it.skip("should update issue with an update comment", function() {

      });
    });
  });
});
