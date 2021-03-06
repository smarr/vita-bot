import { bot } from "./config";

import {
  ReposGetResponse, ReposCreateForkParams, ReposListForOrgParams,
  ReposListForOrgResponseItem, AppsListInstallationsResponseItem,
  AppsListReposResponse,
  AppsListReposResponseRepositoriesItem
} from "@octokit/rest";
import { Application } from "probot";
import { GitHubAPI } from "probot/lib/github";

export interface GitHubRepository extends AppsListReposResponseRepositoriesItem { }
export interface GitHubInstallation extends AppsListInstallationsResponseItem { }

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
    const request = github.apps.listInstallations({});

    const results: GitHubInstallation[] = [];

    await github.paginate(request, async (page) => {
      const installations: AppsListInstallationsResponseItem[] = (await page).data;
      for (const installation of installations) {
        if (installation.account.login === bot.userId) {
          this.botInstallationResolver(installation);
        }
        results.push(installation);
      }
    });

    return Promise.resolve(results);
  }

  private async getRepositories(installation: GitHubInstallation): Promise<GitHubRepository[]> {
    const github = await this.app.auth(installation.id);

    const request = github.apps.listRepos({});

    const results: GitHubRepository[] = [];
    await github.paginate(request, async (page) => {
      const response: AppsListReposResponse = (await page).data;
      for (const repo of response.repositories) {
        results.push(repo);
      }
    });

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

  private async getRepo(owner: string, repo: string, github: GitHubAPI): Promise<ReposGetResponse | null> {
    try {
      const result = await github.repos.get({ owner: owner, repo: repo });
      return Promise.resolve(result.data);
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

  private async findRepoWithSuffix(sourceOwner: string, sourceRepo: string): Promise<ReposGetResponse | null> {
    const params: ReposListForOrgParams = {
      org: bot.userId,
      type: "forks"
    };

    let result: ReposGetResponse | null = null;

    const request = this.botGitHub.repos.listForOrg(params);
    await this.botGitHub.paginate(request, async (page, done) => {
      const repos: ReposListForOrgResponseItem[] = (await page).data;

      for (const repo of repos) {
        if (repo.name.startsWith(this.repo) && repo.name !== this.repo) {
          const repoDetails = <ReposGetResponse> await this.getRepo(bot.userId, repo.name, this.botGitHub);
          if (repoDetails.source.name === sourceRepo && repoDetails.source.owner.login === sourceOwner) {
            result = repoDetails;

            if (done) { done(); }
            break;
          }
        }
      }
    });

    return Promise.resolve(result);
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
