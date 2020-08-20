import { bot } from "./config";

import { Application } from "probot";
import { GitHubAPI } from "probot/lib/github";
import { RestEndpointMethodTypes } from "@octokit/rest";

type GitHubInstallationData = RestEndpointMethodTypes["apps"]["listInstallations"]["response"]["data"];
export type GitHubInstallation = RestEndpointMethodTypes["apps"]["listInstallations"]["response"]["data"][0];
type GitHubRepositoryData = RestEndpointMethodTypes["apps"]["listReposAccessibleToInstallation"]["response"]["data"];
export type GitHubRepository = RestEndpointMethodTypes["apps"]["listReposAccessibleToInstallation"]["response"]["data"]["repositories"][0];

type ReposListForOrgParams = RestEndpointMethodTypes["repos"]["listForOrg"]["parameters"];
type ListForOrgData = RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"];

type ReposCreateForkParams = RestEndpointMethodTypes["repos"]["createFork"]["parameters"];

type ReposGetResponseData = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];

export type ReposGetContentsParams = RestEndpointMethodTypes["repos"]["getContent"]["parameters"];
export type ReposGetContentsResponse = RestEndpointMethodTypes["repos"]["getContent"]["response"];

export type IssuesCreateCommentParams = RestEndpointMethodTypes["issues"]["createComment"]["parameters"];

export type ReposListBranchesResponseItem = RestEndpointMethodTypes["repos"]["listBranches"]["response"]["data"][0];

export type PullRequestsCreateParams = RestEndpointMethodTypes["pulls"]["create"]["parameters"];

export type PullRequestsListParams = RestEndpointMethodTypes["pulls"]["list"]["parameters"];
export type PullRequestsListResponseItem = RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][0];

export interface GithubRepo {
  owner: string;
  repo: string;
  cloneUrl?: string;
}

export interface WorkingCopyResult extends GithubRepo {
  existingFork: boolean;
  cloneUrl: string;
  sshUrl: string;
}

export class GithubInstallations {

  private readonly app: Application;

  private readonly repositories: Promise<Map<GitHubInstallation, GitHubRepository[]>>;
  private repoResolver!: (value: Map<GitHubInstallation, GitHubRepository[]>) => void;

  private readonly botInstallation: Promise<GitHubInstallation>;
  private botInstallationResolver!: (value: GitHubInstallation) => void;

  private dataRequested = false;

  constructor(app: Application) {
    this.app = app;

    this.repositories = new Promise((resolve, _reject) => {
      this.repoResolver = resolve;
    });

    this.botInstallation = new Promise((resolve, _reject) => {
      this.botInstallationResolver = resolve;
    });
  }

  private async getInstallations(): Promise<GitHubInstallation[]> {
    const github = await this.app.auth();
    const options = github.apps.listInstallations.endpoint.merge({});
    const results: GitHubInstallation[] = [];

    for await (const page of github.paginate.iterator(options)) {
      for (const installation of page.data) {
        if (installation.account.login === bot.userId) {
          this.botInstallationResolver(installation);
        }
        results.push(installation);
      }
    }

    return Promise.resolve(results);
  }

  private async getRepositories(installation: GitHubInstallation): Promise<GitHubRepository[]> {
    const github = await this.app.auth(installation.id);
    const options = github.apps.listRepos.endpoint.merge({});
    const results: GitHubRepository[] = [];

    for await (const page of github.paginate.iterator(options)) {
      for (const repo of page.data) {
        results.push(repo);
      }
    }

    return Promise.resolve(results);
  }

  public async requestRepositories(): Promise<Map<GitHubInstallation, GitHubRepository[]>> {
    if (!this.dataRequested) {
      this.dataRequested = true;

      const installations = await this.getInstallations();

      const repositories: Map<GitHubInstallation, GitHubRepository[]> = new Map();
      for (const inst of installations) {
        const repos = await this.getRepositories(inst);
        repositories.set(inst, repos);
      }

      this.repoResolver(repositories);
    }

    return this.repositories;
  }

  public async getBotInstallation() {
    if (!this.dataRequested) {
      this.requestRepositories();
    }
    return this.botInstallation;
  }
}

export class GithubWorkingCopy {
  private readonly owner: string;
  private readonly repo: string;
  private readonly ownerGitHub: GitHubAPI;
  private readonly botGitHub: GitHubAPI;

  constructor(owner: string, repo: string, ownerGitHub: GitHubAPI, botGitHub: GitHubAPI) {
    this.owner = owner;
    this.repo = repo;
    this.ownerGitHub = ownerGitHub;
    this.botGitHub = botGitHub;
  }

  private async getRepo(owner: string, repo: string, github: GitHubAPI): Promise<ReposGetResponseData | null> {
    try {
      const result = await github.repos.get({ owner: owner, repo: repo });
      const data = <ReposGetResponseData> <any> result.data;
      return Promise.resolve(data);
    } catch (e) {
      if (e.name === "HttpError" && e.code === 404) {
        return Promise.resolve(null);
      } else {
        throw e;
      }
    }
  }

  private async fork(owner: string, repo: string): Promise<WorkingCopyResult> {
    const params: ReposCreateForkParams = {
      owner: owner,
      repo: repo,
      organization: bot.userId
    };
    const response = await this.botGitHub.repos.createFork(params);
    return Promise.resolve({
      existingFork: false,
      owner: bot.userId,
      repo: response.data.name,
      cloneUrl: response.data.clone_url,
      sshUrl: response.data.ssh_url
    });
  }

  private async findRepoWithSuffix(sourceOwner: string, sourceRepo: string): Promise<ReposGetResponseData | null> {
    const params: ReposListForOrgParams = {
      org: bot.userId,
      type: "forks"
    };

    const options = this.botGitHub.repos.listForOrg.endpoint.merge(params);

    for await (const page of this.botGitHub.paginate.iterator(options)) {
      for (const repo of page.data) {
        if (repo.name.startsWith(this.repo) && repo.name !== this.repo) {
          const repoDetails = <ReposGetResponseData> await this.getRepo(bot.userId, repo.name, this.botGitHub);
          if (repoDetails.source.name === sourceRepo && repoDetails.source.owner.login === sourceOwner) {
            return Promise.resolve(repoDetails);
          }
        }
      }
    }

    return Promise.resolve(null);
  }

  public async ensureCopyInBotUser(): Promise<WorkingCopyResult> {
    const targetRepo = await this.getRepo(this.owner, this.repo, this.ownerGitHub);

    if (targetRepo === null) {
      throw Error("Requested repository not found: " + this.owner + "/" + this.repo);
    }

    let sourceOwner: string;
    let sourceRepo: string;
    if (targetRepo.fork) {
      sourceOwner = targetRepo.source.owner.login;
      sourceRepo = targetRepo.source.name;
    } else {
      sourceOwner = this.owner;
      sourceRepo = this.repo;
    }
    const botRepo = await this.getRepo(bot.userId, this.repo, this.botGitHub);

    if (botRepo !== null && botRepo.fork && botRepo.source.owner.login === sourceOwner && botRepo.source.name) {
      // got a repo, with a common source
      return Promise.resolve({
        existingFork: true,
        owner: bot.userId,
        repo: this.repo,
        cloneUrl: botRepo.clone_url,
        sshUrl: botRepo.ssh_url
      });
    }

    if (botRepo !== null) {
      const result = await this.findRepoWithSuffix(sourceOwner, sourceRepo);
      if (result !== null) {
        return Promise.resolve({
          existingFork: true,
          owner: bot.userId,
          repo: result.name,
          cloneUrl: result.clone_url,
          sshUrl: result.ssh_url
        });
      }
    }

    return this.fork(sourceOwner, sourceRepo);
  }
}
