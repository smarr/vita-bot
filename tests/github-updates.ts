import { expect } from "chai";
import { GitHubAPI } from "probot/lib/github";
import { GitHubSubmoduleUpdate, UpdateResult, SubmoduleMetadata, UpdateSubmoduleReport } from "../src/update-ops";
import nock, { disableNetConnect, Scope } from "nock";
import { readData, withData } from "../src/issue-metadata";

const EXISTING_ISSUE_ID = 41;
const NEW_ISSUE_ID = 42;
const SUBMODULE_PATH = "libs/truffle";

const UPDATE_SUBMODULE_REPORT: UpdateSubmoduleReport = {
  previousDate: "prev-date",
  upstreamDate: "up-date",
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

const GITHUB_API = "https://api.github.com";
const github = GitHubAPI();

describe("GitHub interaction", function() {

  describe("Submodule Update", function() {
    let updater: GitHubSubmoduleUpdate;
    let updateResult: UpdateResult;
    let createPost: Scope;
    let createBody: any;

    describe("First update", function() {
      before(async function() {
        nock(GITHUB_API)
          .get("/repos/smarr/SOMns/pulls?head=vita-bot&state=open")
          .reply(200, []);

        createPost = nock(GITHUB_API)
          .post("/repos/smarr/SOMns/pulls",
            function(body: any) {
              createBody = body;
              return true; })
          .reply(201, {
            "url": GITHUB_API + "/repos/smarr/SOMns/pulls/" + NEW_ISSUE_ID,
            "id": 1,
            "number": NEW_ISSUE_ID,
            "state": "open",
            "title": "new-feature",
          });

        updater = new GitHubSubmoduleUpdate(github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "vita/libs-truffle/prev-date", "dev");
        updateResult = await updater.proposeUpdate();
      });

      it("should check whether PR exists and not find any open one", function() {
        expect(updateResult.updatedExisting).to.be.false;
        expect(updateResult.existingId).to.be.undefined;
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
              "body": withData("Please pull these awesome changes\n", SUBMODULE_META)
            }
          ]);

        createPost = nock(GITHUB_API)
          .post("/repos/smarr/SOMns/issues/" + EXISTING_ISSUE_ID + "/comments")
          .reply(201, {
            "id": COMMENT_ID,
            "body": "TODO",
            "created_at": "2011-04-14T16:00:49Z"
          });

        updater = new GitHubSubmoduleUpdate(github, "smarr", "SOMns", UPDATE_SUBMODULE_REPORT, "vita/libs-truffle/prev-date", "dev");
        updateResult = await updater.proposeUpdate();
      });

      it("should check whether PR exists and find an open one", function() {
        expect(updateResult.updatedExisting).to.be.true;
        expect(updateResult.existingId).to.equal(EXISTING_ISSUE_ID);
      });

      it("should update PR with an update comment", function() {
        expect(createPost.isDone()).to.be.true;
        expect(updateResult.commentId).to.equal(COMMENT_ID);
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
