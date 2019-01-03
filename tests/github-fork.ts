import { bot } from "../src/config";
import { GithubWorkingCopy, WorkingCopyResult } from "../src/github";

import { expect } from "chai";
import { GitHubAPI } from "probot/lib/github";
import nock, { disableNetConnect } from "nock";
import { GITHUB_API } from "./test-data";

const github = GitHubAPI();

disableNetConnect();

describe("Managed repositories need to be forked", function() {
  after(function() {
    nock.cleanAll();
  });

  let result: WorkingCopyResult;

  describe("No fork yet", function() {
    before(async function() {
      nock(GITHUB_API)
        .get("/repos/smarr/SOMns")
        .reply(200, {
          "name": "SOMns",
          "owner": {
            "login": "smarr"
          },
          "fork": false
        });
      nock(GITHUB_API)
        .get("/repos/vita-bot/SOMns")
        .reply(404, {
          "message": "Not Found",
          "documentation_url": "https://developer.github.com/v3/repos/#get"
        });
      nock(GITHUB_API)
        .post("/repos/smarr/SOMns/forks")
        .reply(202, {
          "name": "SOMns"
        });

      const workingCopy = new GithubWorkingCopy("smarr", "SOMns", github, github);
      result = await workingCopy.ensureCopyInBotUser();
    });

    it("Should not find a repo", function() {
      expect(result.existingFork).to.be.false;
    });

    it("Should create new fork", function() {
      expect(result.owner).is.equal(bot.userId);
      expect(result.repo).is.equal("SOMns");
    });
  });

  describe("Fork exists", function() {
    before(async function() {
      nock(GITHUB_API)
        .get("/repos/smarr/SOMns")
        .reply(200, {
          "name": "SOMns",
          "owner": {
            "login": "smarr"
          },
          "fork": false
        });
      nock(GITHUB_API)
        .get("/repos/vita-bot/SOMns")
        .reply(200, {
          "name": "SOMns",
          "fork": true,
          "source": {
            "name": "SOMns",
            "owner": {
              "login": "smarr"
            }
          }
        });

      const workingCopy = new GithubWorkingCopy("smarr", "SOMns", github, github);
      result = await workingCopy.ensureCopyInBotUser();
    });

    it("Should find the repo", function() {
      expect(result.existingFork).to.be.true;
      expect(result.owner).is.equal(bot.userId);
      expect(result.repo).is.equal("SOMns");
    });
  });

  describe("Name clashes", function() {
    describe("Fork with same name, but different origin. No other repo.", function() {
      before(async function() {
        nock(GITHUB_API)
          .get("/repos/smarr/SOMns")
          .reply(200, {
            "name": "SOMns",
            "owner": {
              "login": "smarr"
            },
            "fork": false
          });
        nock(GITHUB_API)
          .get("/repos/vita-bot/SOMns")
          .reply(200, {
            "name": "SOMns",
            "fork": true,
            "source": {
              owner: { login: "foobar" },
              name: "SOMns"
            }
          });
        nock(GITHUB_API)
          .get("/orgs/vita-bot/repos?type=forks")
          .reply(200, []);
        nock(GITHUB_API)
          .post("/repos/smarr/SOMns/forks")
          .reply(202, {
            "name": "SOMns-1"
          });

        const workingCopy = new GithubWorkingCopy("smarr", "SOMns", github, github);
        result = await workingCopy.ensureCopyInBotUser();
      });

      it("should create a new fork", function() {
        expect(result.existingFork).to.be.false;
        expect(result.owner).is.equal(bot.userId);
        expect(result.repo).is.equal("SOMns-1");
      });
    });

    describe("Fork with same name, but different origin. Fork existing.", function() {
      before(async function() {
        nock(GITHUB_API)
          .get("/repos/smarr/SOMns")
          .reply(200, {
            "name": "SOMns",
            "owner": {
              "login": "smarr"
            },
            "fork": false
          });
        nock(GITHUB_API)
          .get("/repos/vita-bot/SOMns")
          .reply(200, {
            "name": "SOMns",
            "fork": true,
            "source": {
              owner: { login: "foobar" },
              name: "SOMns"
            }
          });
        nock(GITHUB_API)
          .get("/orgs/vita-bot/repos?type=forks")
          .reply(200, [{ "name": "SOMns" }, { "name": "SOMns-1" }]);
        nock(GITHUB_API)
          .get("/repos/vita-bot/SOMns-1")
          .reply(200, {
            "name": "SOMns-1",
            "fork": true,
            "source": {
              owner: { login: "smarr" },
              name: "SOMns"
            }
          });

        const workingCopy = new GithubWorkingCopy("smarr", "SOMns", github, github);
        result = await workingCopy.ensureCopyInBotUser();
      });

      it("should create a new fork", function() {
        expect(result.existingFork).to.be.true;
        expect(result.owner).is.equal(bot.userId);
        expect(result.repo).is.equal("SOMns-1");
      });
    });
  });
});
