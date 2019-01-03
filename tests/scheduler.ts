import nock, { disableNetConnect } from "nock";
import { Application, Probot, Context } from "probot";
import { RepositoryScheduler } from "../src/scheduler";
import { expect } from "chai";
import { RSA_KEY, GITHUB_API } from "./test-data";
import { GitHubInstallation, GitHubRepository } from "../src/github";

disableNetConnect();

const installDetails = [
  {
    installId: 1,
    accountLogin: "github",
    accountId: 1,
    appId: 1,
    repos: [{ name: "test" }]
  },
  {
    installId: 2,
    accountLogin: "smarr",
    accountId: 2,
    appId: 1,
    repos: [{ name: "SOMns" }, { name: "truffle" }]
  },
  {
    installId: 3,
    accountLogin: "SOM-st",
    accountId: 3,
    appId: 1,
    repos: [{ name: "SOM" }]
  }
];

function createInstallations() {
  const installs: any[] = [];

  for (const d of installDetails) {
    installs.push({
      "id": d.installId,
      "account": {
        "login": d.accountLogin,
        "id": d.accountId,
        "url": GITHUB_API + "/orgs/github"
      },
      "app_id": d.appId,
      "target_id": d.appId,
      "target_type": "Organization"
    });
  }

  return installs;
}

let createUserReposCount = 0;

function createUserRepos() {
  const accountId = createUserReposCount;
  createUserReposCount += 1;
  if (createUserReposCount >= 3) { createUserReposCount = 0; }
  const instDetail = installDetails[accountId];

  const repoDetails: any[] = [];
  for (const repo of instDetail.repos) {
    const fullName = instDetail.accountLogin + "/" + repo.name;
    repoDetails.push({
      "id": 1296269,
      "name": repo.name,
      "full_name": fullName,
      "owner": {
        "login": instDetail.accountLogin,
        "id": instDetail.accountId,
        "type": "User",
        "site_admin": false
      },
      "private": false,
      "fork": true
    });
  }

  return {
    "total_count": repoDetails.length,
    "repositories": repoDetails
  };
}

function createTestApp(app: Application) {
  // no op
}

const probot: Probot = new Probot({ cert: RSA_KEY });
const app = probot.load(createTestApp);

const events: Context[] = [];
app.on("schedule", async ctx => {
  events.push(ctx);
});

async function timeout(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

describe("Scheduler", function() {

  before(function() {
    nock(GITHUB_API)
      .get("/app/installations")
      .times(3)
      .reply(200, createInstallations());

    nock(GITHUB_API)
      .post(/\/app\/installations\/\d+\/access_tokens/)
      .times(3 * 3)
      .reply(201, {
        "token": "v1.1f699f1069f60xxx",
        "expires_at": "2016-07-11T22:14:10Z"
      });

    nock(GITHUB_API)
      .get("/installation/repositories")
      .times(10 * 3)
      .reply(200, createUserRepos);
  });

  after(function() {
    nock.cleanAll();
  });

  let scheduler: RepositoryScheduler;
  let repos: Map<GitHubInstallation, GitHubRepository[]>;

  describe("basics", function() {
    before(async function() {
      scheduler = new RepositoryScheduler(app, 0, 0);
      repos = await scheduler.start();
    });

    it("should get the correct repositories", function() {
      expect(repos.size).to.equal(3);

      const [github, sMarr, somSt] = repos.entries();

      expect(github[0].account.login).to.equal("github");
      expect(github[0].account.id).to.equal(1);

      expect(github[1][0].full_name).to.equal("github/test");

      expect(sMarr[0].account.login).to.equal("smarr");
      expect(sMarr[0].account.id).to.equal(2);

      expect(sMarr[1][0].full_name).to.equal("smarr/SOMns");
      expect(sMarr[1][1].full_name).to.equal("smarr/truffle");

      expect(somSt[0].account.login).to.equal("SOM-st");
      expect(somSt[0].account.id).to.equal(3);

      expect(somSt[1][0].full_name).to.equal("SOM-st/SOM");
    });

    it("should schedule events for each repository", async function() {
      const intervalId = await scheduler.getLastInterval();
      expect(intervalId).to.equal(0);

      expect(events.length).to.equal(4);

      expect(events[0].payload.repository.repo).to.equal("test");
      expect(events[1].payload.repository.repo).to.equal("SOMns");
      expect(events[2].payload.repository.repo).to.equal("truffle");
      expect(events[3].payload.repository.repo).to.equal("SOM");
    });
  });

  describe("timing", function() {
    it("should not exceed requestsPerSecondRate", async function() {
      events.length = 0;

      scheduler = new RepositoryScheduler(app, 0, 1);

      repos = await scheduler.start();
      const startMilliseconds = Date.now();
      const intervalId = await scheduler.getLastInterval();
      const endMilliseconds = Date.now();

      expect(intervalId).to.equal(0);
      expect(endMilliseconds - startMilliseconds).to.be.greaterThan(4000 * 0.9);
      expect(events.length).to.equal(4);
    });

    it("should not exceed requestsPerSecondRate", async function() {
      events.length = 0;
      scheduler = new RepositoryScheduler(app, 1, 0.5);
      repos = await scheduler.start();
      const startMilliseconds = Date.now();
      const intervalId = await scheduler.getLastInterval();
      const endMilliseconds = Date.now();

      expect(intervalId).to.equal(0);
      expect(endMilliseconds - startMilliseconds).to.be.greaterThan(2000 * 0.9);

      await timeout(4000);
      scheduler.stop();

      await timeout(1000);

      const lastId = await scheduler.getLastInterval();
      expect(lastId).to.equal(2);

      expect(events.length).to.equal(4 * 3);
    });
  });
});
