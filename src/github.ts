import { bot } from "./config";

import { ReposGetResponse, ReposCreateForkParams, ReposListForOrgParams, ReposListForOrgResponseItem } from "@octokit/rest";
import { GitHubAPI } from "probot/lib/github";

export interface WorkingCopyResult {
  existingFork: boolean;
  owner: string;
  repo: string;
}

export class GithubWorkingCopy {
  private readonly owner: string;
  private readonly repo: string;
  private readonly github: GitHubAPI;

  constructor(owner: string, repo: string, github: GitHubAPI) {
    this.owner = owner;
    this.repo = repo;
    this.github = github;
  }

  private async getRepo(owner: string, repo: string): Promise<ReposGetResponse | null> {
    try {
      const result = await this.github.repos.get({owner: owner, repo: repo});
      return Promise.resolve(result.data);
    } catch (e) {
      if (e.name === "HttpError" && e.code === 404) {
        return Promise.resolve(null);
      } else {
        throw e;
      }
    }
  }

  private async fork(owner: string, repo: string): Promise<string> {
    const params: ReposCreateForkParams = {
      owner: owner,
      repo: repo,
      organization: bot.userId
    };
    const response = await this.github.repos.createFork(params);
    return Promise.resolve(response.data.name);
  }

  private async findRepoWithSuffix(sourceOwner: string, sourceRepo: string): Promise<ReposGetResponse | null> {
    const params: ReposListForOrgParams = {
      org: bot.userId,
      type: "forks"
    };

    let result: ReposGetResponse | null = null;

    const request = this.github.repos.listForOrg(params);
    await this.github.paginate(request, async (page, done) => {
      const repos: ReposListForOrgResponseItem[] = (await page).data;

      for (const repo of repos) {
        if (repo.name.startsWith(this.repo) && repo.name !== this.repo) {
          const repoDetails = <ReposGetResponse> await this.getRepo(bot.userId, repo.name);
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

  public async ensureWorkingInBotUser(): Promise<WorkingCopyResult> {
    const targetRepo = await this.getRepo(this.owner, this.repo);

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
    const botRepo = await this.getRepo(bot.userId, this.repo);

    if (botRepo !== null && botRepo.fork && botRepo.source.owner.login === sourceOwner && botRepo.source.name) {
      // got a repo, with a common source
      return Promise.resolve({
        existingFork: true,
        owner: bot.userId,
        repo: this.repo
      });
    }

    if (botRepo !== null) {
      const result = await this.findRepoWithSuffix(sourceOwner, sourceRepo);
      if (result !== null) {
        return Promise.resolve({
          existingFork: true,
          owner: bot.userId,
          repo: result.name
        });
      }
    }

    const repoName = await this.fork(sourceOwner, sourceRepo);
    return Promise.resolve({
      existingFork: false,
      owner: bot.userId,
      repo: repoName
    });
  }
}