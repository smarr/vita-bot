import nock, { disableNetConnect } from "nock";
import { Application, Probot, Context } from "probot";
import { RepositoryScheduler, GitHubInstallation, GitHubRepository } from "../src/scheduler";
import { expect } from "chai";

disableNetConnect();

const GITHUB_API = "https://api.github.com";
const userInstallRegex = /\/user\/installations\/(\d+)\/repositories/;
const installDetails = [
  {
    installId: 1,
    accountLogin: "github",
    accountId: 1,
    appId: 1,
    repos: [ {name: "test"}]
  },
  {
    installId: 2,
    accountLogin: "smarr",
    accountId: 2,
    appId: 1,
    repos: [ {name: "SOMns"}, {name: "truffle"} ]
  },
  {
    installId: 3,
    accountLogin: "SOM-st",
    accountId: 3,
    appId: 1,
    repos: [ {name: "SOM"} ]
  }
];

function createInstallations() {

  const installs = [];

  for (const d of installDetails) {
    installs.push({
      "id": d.installId,
      "account": {
        "login": d.accountLogin,
        "id": d.accountId,
        "node_id": "MDEyOk9yZ2FuaXphdGlvbjE=",
        "url": GITHUB_API + "/orgs/github",
        "repos_url": GITHUB_API + "/orgs/github/repos",
        "events_url": GITHUB_API + "/orgs/github/events",
        "hooks_url": GITHUB_API + "/orgs/github/hooks",
        "issues_url": GITHUB_API + "/orgs/github/issues",
        "members_url": GITHUB_API + "/orgs/github/members{/member}",
        "public_members_url": GITHUB_API + "/orgs/github/public_members{/member}",
        "avatar_url": GITHUB_API + "/images/error/octocat_happy.gif",
        "description": "A great organization"
      },
      "access_tokens_url": GITHUB_API + "/installations/" + d.installId + "/access_tokens",
      "repositories_url": GITHUB_API + "/installation/repositories",
      "html_url": GITHUB_API + "/organizations/github/settings/installations/" + d.installId,
      "app_id": d.appId,
      "target_id": d.appId,
      "target_type": "Organization",
      "permissions": {
        "metadata": "read",
        "contents": "read",
        "issues": "write",
        "single_file": "write"
      },
      "events": [
        "push",
        "pull_request"
      ],
      "single_file_name": "config.yml",
      "repository_selection": "selected"
    });
  }

  return installs;
}

function createUserRepos(uri: string) {
  const match = userInstallRegex.exec(uri);
  if (match === null) {
    return {};
  }
  const accountId = parseInt(match[1]);
  const instDetail = installDetails[accountId - 1];

  const repoDetails = [];
  for (const repo of instDetail.repos) {
    const fullName = instDetail.accountLogin + "/" + repo.name;
    repoDetails.push({
      "id": 1296269,
      "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5",
      "name": repo.name,
      "full_name": fullName,
      "owner": {
        "login": instDetail.accountLogin,
        "id": instDetail.accountId,
        "node_id": "MDQ6VXNlcjE=",
        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        "gravatar_id": "",
        "url": GITHUB_API + "/users/" + instDetail.accountLogin,
        "html_url": "https://github.com/" + instDetail.accountLogin,
        "followers_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/followers",
        "following_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/following{/other_user}",
        "gists_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/gists{/gist_id}",
        "starred_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/starred{/owner}{/repo}",
        "subscriptions_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/subscriptions",
        "organizations_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/orgs",
        "repos_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/repos",
        "events_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/events{/privacy}",
        "received_events_url": GITHUB_API + "/users/" + instDetail.accountLogin + "/received_events",
        "type": "User",
        "site_admin": false
      },
      "private": false,
      "html_url": "https://github.com/" + fullName,
      "description": "This your first repo!",
      "fork": true,
      "url": GITHUB_API + "/repos/" + instDetail.accountLogin + "/" + repo.name,
      "archive_url": GITHUB_API + "/repos/" + fullName + "/{archive_format}{/ref}",
      "assignees_url": GITHUB_API + "/repos/" + fullName + "/assignees{/user}",
      "blobs_url": GITHUB_API + "/repos/" + fullName + "/git/blobs{/sha}",
      "branches_url": GITHUB_API + "/repos/" + fullName + "/branches{/branch}",
      "collaborators_url": GITHUB_API + "/repos/" + fullName + "/collaborators{/collaborator}",
      "comments_url": GITHUB_API + "/repos/" + fullName + "/comments{/number}",
      "commits_url": GITHUB_API + "/repos/" + fullName + "/commits{/sha}",
      "compare_url": GITHUB_API + "/repos/" + fullName + "/compare/{base}...{head}",
      "contents_url": GITHUB_API + "/repos/" + fullName + "/contents/{+path}",
      "contributors_url": GITHUB_API + "/repos/" + fullName + "/contributors",
      "deployments_url": GITHUB_API + "/repos/" + fullName + "/deployments",
      "downloads_url": GITHUB_API + "/repos/" + fullName + "/downloads",
      "events_url": GITHUB_API + "/repos/" + fullName + "/events",
      "forks_url": GITHUB_API + "/repos/" + fullName + "/forks",
      "git_commits_url": GITHUB_API + "/repos/" + fullName + "/git/commits{/sha}",
      "git_refs_url": GITHUB_API + "/repos/" + fullName + "/git/refs{/sha}",
      "git_tags_url": GITHUB_API + "/repos/" + fullName + "/git/tags{/sha}",
      "git_url": "git:github.com/" + fullName + ".git",
      "issue_comment_url": GITHUB_API + "/repos/" + fullName + "/issues/comments{/number}",
      "issue_events_url": GITHUB_API + "/repos/" + fullName + "/issues/events{/number}",
      "issues_url": GITHUB_API + "/repos/" + fullName + "/issues{/number}",
      "keys_url": GITHUB_API + "/repos/" + fullName + "/keys{/key_id}",
      "labels_url": GITHUB_API + "/repos/" + fullName + "/labels{/name}",
      "languages_url": GITHUB_API + "/repos/" + fullName + "/languages",
      "merges_url": GITHUB_API + "/repos/" + fullName + "/merges",
      "milestones_url": GITHUB_API + "/repos/" + fullName + "/milestones{/number}",
      "notifications_url": GITHUB_API + "/repos/" + fullName + "/notifications{?since,all,participating}",
      "pulls_url": GITHUB_API + "/repos/" + fullName + "/pulls{/number}",
      "releases_url": GITHUB_API + "/repos/" + fullName + "/releases{/id}",
      "ssh_url": "git@github.com:" + fullName + ".git",
      "stargazers_url": GITHUB_API + "/repos/" + fullName + "/stargazers",
      "statuses_url": GITHUB_API + "/repos/" + fullName + "/statuses/{sha}",
      "subscribers_url": GITHUB_API + "/repos/" + fullName + "/subscribers",
      "subscription_url": GITHUB_API + "/repos/" + fullName + "/subscription",
      "tags_url": GITHUB_API + "/repos/" + fullName + "/tags",
      "teams_url": GITHUB_API + "/repos/" + fullName + "/teams",
      "trees_url": GITHUB_API + "/repos/" + fullName + "/git/trees{/sha}",
      "clone_url": "https://github.com/" + fullName + ".git",
      "mirror_url": "git:git.example.com/" + fullName + "",
      "hooks_url": GITHUB_API + "/repos/" + fullName + "/hooks",
      "svn_url": "https://svn.github.com/" + fullName + "",
      "homepage": "https://github.com",
      "language": null,
      "forks_count": 9,
      "stargazers_count": 80,
      "watchers_count": 80,
      "size": 108,
      "default_branch": "master",
      "open_issues_count": 0,
      "topics": [
        "octocat",
        "atom",
        "electron",
        "API"
      ],
      "has_issues": true,
      "has_projects": true,
      "has_wiki": true,
      "has_pages": false,
      "has_downloads": true,
      "archived": false,
      "pushed_at": "2011-01-26T19:06:43Z",
      "created_at": "2011-01-26T19:01:12Z",
      "updated_at": "2011-01-26T19:14:43Z",
      "permissions": {
        "admin": false,
        "push": false,
        "pull": true
      },
      "allow_rebase_merge": true,
      "allow_squash_merge": true,
      "allow_merge_commit": true,
      "subscribers_count": 42,
      "network_count": 0
    });
  }

  return {
    "total_count": repoDetails.length,
    "repositories": repoDetails
  };
}

const appInstallations = nock(GITHUB_API)
  .get("/app/installations")
  .times(3)
  .reply(200, createInstallations());

const accessToken = nock(GITHUB_API)
  .post(/\/app\/installations\/\d+\/access_tokens/)
  .times(3 * 3)
  .reply(201, {
    "token": "v1.1f699f1069f60xxx",
    "expires_at": "2016-07-11T22:14:10Z"
  });


const userInstallationsRepos = nock(GITHUB_API)
  .get(userInstallRegex)
  .times(10 * 3)
  .reply(200, createUserRepos);

function createTestApp(app: Application) {
  // no op
}

const probot: Probot = new Probot({
  // this is a random key, just for test purposes. hasn't been used anywhere
  cert: `-----BEGIN RSA PRIVATE KEY-----
MIIBOQIBAAJBAI8e1xmJpqW8M+rY2NFg7JWUC5PdfKMaCPZFJoZ01RSLrVYK5qOV
K0P2kaM0Ml63B0HZtZUNw4Ahr1eRAg+klekCAwEAAQJAKhxF5/KzgOJeWERTj0+4
bM5xlaE+sfLQHj38duVbaL67rRMN1E8pQmmKtythKcGLNFsbKx7mb2N5632l993C
vQIhAMFrSDmGMZhXJrWBuH92UnXeVYIKnFpeB7wsQ9dtVNC3AiEAvW1fbTMYYnye
niLPPW1a9OgSlC/H2zI+/7qHLSLn7l8CIBGInSqBzLsno12u3b/IRR9kQVIhjhzv
Czp2tMuxoI+vAiBTwHfgoCa35MF8yYc3cZI1liYgvr9ueti/2IjLvBMvoQIgBZZ9
85Z8EpdNnk7zOxB10ak9W14PnznO5w5IR+c6HqA=
-----END RSA PRIVATE KEY-----`});

const app = probot.load(createTestApp);

let events: Context[] = [];
app.on("schedule", async ctx => {
  events.push(ctx);
});

async function timeout(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

describe("Scheduler", function() {

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

      expect(events[0].payload.repository.full_name).to.equal("github/test");
      expect(events[1].payload.repository.full_name).to.equal("smarr/SOMns");
      expect(events[2].payload.repository.full_name).to.equal("smarr/truffle");
      expect(events[3].payload.repository.full_name).to.equal("SOM-st/SOM");
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
