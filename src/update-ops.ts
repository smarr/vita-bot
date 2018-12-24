import { bot } from "./config";
import { UpdateBranchConfig, BotDetails, UpdateSubmoduleConfig } from "./config-schema";
import { GitOps, RebaseResult, LogEntry } from "./git-ops";
import { readData, withData } from "./issue-metadata";

import { PullRequestsListResponseItem, PullRequestsListParams, PullRequestsCreateParams, IssuesCreateCommentParams } from "@octokit/rest";
import { CommitSummary } from "simple-git/promise";
import { GitHubAPI } from "probot/lib/github";

/** The standard git upstream remote name. */
const UPSTREAM_REMOTE = "upstream";

export interface UpdateBranchResult {
  success: boolean;
  fastForward: boolean;
  rebase: RebaseResult;
  heads: {
    beforeUpdate: LogEntry,
    upstream: LogEntry,
    afterUpdate: LogEntry
  };
}

/** Information meant for human interaction. */
export interface UpdateSubmoduleReport {
  previousDate: string;
  upstreamDate: string;
  forced: boolean;
  submodule: {
    updateUrl: string;
    updateBranch: string;
    path: string;
  };
}

export interface UpdateSubmoduleResult {
  success: boolean;
  forced: boolean;
  heads: {
    beforeUpdate: LogEntry,
    afterUpdate: LogEntry
  };
  /** Information meant for human interaction. */
  reportInfo: UpdateSubmoduleReport;
}

class GitUpdateTask {
  private readonly repoUrl: string;

  protected readonly repoBranch: string;
  protected readonly repoPath: string;
  protected readonly bot: BotDetails;
  protected readonly repo: GitOps;

  constructor(repoUrl: string, repoBranch: string, repoPath: string, bot: BotDetails) {
    this.repoUrl = repoUrl;
    this.repoBranch = repoBranch;
    this.repoPath = repoPath;
    this.bot = bot;

    this.repo = new GitOps(repoPath, bot.name, bot.email);
  }

  protected async ensureRepoIsAvailable() {
    return this.repo.cloneOrUpdate(this.repoUrl, this.repoBranch);
  }
}

export class UpdateBranch extends GitUpdateTask {
  private readonly config: UpdateBranchConfig;

  private updateResult?: UpdateBranchResult;

  constructor(repoUrl: string, repoBranch: string, repoPath: string,
    config: UpdateBranchConfig, bot: BotDetails) {
    super(repoUrl, repoBranch, repoPath, bot);
    this.config = config;
  }

  public async performUpdate(): Promise<UpdateBranchResult> {
    await this.ensureRepoIsAvailable();
    await this.repo.ensureRemote(UPSTREAM_REMOTE, this.config.url);
    await this.repo.fetch(UPSTREAM_REMOTE, this.config.branch);

    const preUpdateHead = await this.repo.getHead(this.repoBranch);
    const remoteHead = await this.repo.getHead(UPSTREAM_REMOTE, this.config.branch);
    const result = await this.repo.rebase(this.repoBranch, UPSTREAM_REMOTE + "/" + this.config.branch);
    const postUpdateHead = await this.repo.getHead();

    const isFastForward = preUpdateHead.commitHash === postUpdateHead.commitHash;

    this.updateResult = {
      success: result.success,
      fastForward: isFastForward,
      rebase: result,
      heads: {
        beforeUpdate: preUpdateHead,
        upstream: remoteHead,
        afterUpdate: postUpdateHead
      }
    };

    return Promise.resolve(this.updateResult);
  }
}

export class UpdateSubmodule extends GitUpdateTask {
  private readonly submodulePath: string;
  private readonly config: UpdateSubmoduleConfig;

  private subRepo?: GitOps;
  private updateResult?: UpdateSubmoduleResult;

  constructor(repoUrl: string, repoBranch: string, repoPath: string,
    submodulePath: string, config: UpdateSubmoduleConfig, bot: BotDetails) {
    super(repoUrl, repoBranch, repoPath, bot);

    this.submodulePath = submodulePath;
    this.config = config;

    this.subRepo = undefined;
  }

  protected async updateSubmodule(): Promise<UpdateSubmoduleResult> {
    await this.ensureRepoIsAvailable();
    await this.repo.submoduleUpdate(this.submodulePath);

    if (this.subRepo === undefined) {
      this.subRepo = new GitOps(
        this.repoPath + "/" + this.submodulePath,
        this.bot.name, this.bot.email);
    }

    const preUpdateHead = await this.subRepo.getHead();

    let postUpdateHead: LogEntry;
    let updateWasForced = false;

    try {
      await this.subRepo.fastForward("origin", this.config.branch);
      postUpdateHead = await this.subRepo.getHead();
    } catch (e) {
      if (e.message.includes("Not possible to fast-forward")) {
        // fast forward failed, try a forced update to latest head
        await this.subRepo.forceUpdate("origin", this.config.branch);
        updateWasForced = true;
        postUpdateHead = await this.subRepo.getHead();
      } else {
        throw e;
      }
    }

    const updateHadEffect = preUpdateHead.commitHash !== postUpdateHead.commitHash;
    const url = await this.repo.getSubmoduleUrl(this.submodulePath);

    this.updateResult = {
      success: updateHadEffect,
      forced: updateWasForced,
      heads: {
        beforeUpdate: preUpdateHead,
        afterUpdate: postUpdateHead
      },
      reportInfo: {
        previousDate: preUpdateHead.committerDate,
        upstreamDate: postUpdateHead.committerDate,
        forced: updateWasForced,
        submodule: {
          updateUrl: url,
          updateBranch: this.config.branch,
          path: this.submodulePath
        }
      }
    };

    return Promise.resolve(this.updateResult);
  }

  protected async commitUpdate(): Promise<CommitSummary> {
    if (this.updateResult === undefined) {
      throw new Error("commitUpdate() should only be called after successful update");
    }

    const info = this.updateResult.reportInfo;

    let msg = `Update submodule ${info.submodule.path}

    Previous version from: ${info.previousDate}
    Current version from:  ${info.upstreamDate}

    Updated based on: ${info.submodule.updateUrl}
    Using branch:     ${info.submodule.updateBranch}\n`;

    if (info.forced) {
      msg += "\n\nThis update conflicted with the previous version and was forced.\n";
    }

    return this.repo.commit(this.submodulePath, msg);
  }

  public async performUpdate(): Promise<UpdateSubmoduleResult> {
    const result = this.updateSubmodule();
    const r = await result;

    if (r.success) {
      await this.commitUpdate();
    }

    return result;
  }
}

export type UpdateMetadata = SubmoduleMetadata | BranchMetadata;

export interface SubmoduleMetadata {
  type: "submodule";
  submodulePath: string;
}

export interface BranchMetadata {
  type: "branch";
}

export interface UpdateResult {
  updatedExisting: boolean;
  newId?: number;

  existingId?: number;
  commentId?: number;
}

export class GitHubSubmoduleUpdate {
  private readonly github: GitHubAPI;
  private readonly owner: string;
  private readonly repo: string;
  private readonly updateReport: UpdateSubmoduleReport;
  private readonly prBranch: string;
  private readonly targetBranch: string;

  constructor(github: GitHubAPI, owner: string,
    repo: string, updateReport: UpdateSubmoduleReport, prBranch: string,
    targetBranch: string) {
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.updateReport = updateReport;
    this.prBranch = prBranch;
    this.targetBranch = targetBranch;
  }

  private async findPullRequest(): Promise<PullRequestsListResponseItem | null> {
    const search: PullRequestsListParams = {
      owner: this.owner,
      repo: this.repo,
      head: bot.userId,
      state: "open",
    };

    let result: PullRequestsListResponseItem | null = null;

    const request = this.github.pullRequests.list(search);
    await this.github.paginate(request, async (page, done) => {
      const pullRequests: PullRequestsListResponseItem[] = (await page).data;

      for (const pr of pullRequests) {
        const data: UpdateMetadata = readData(pr.body);
        if (data !== null) {
          switch (data.type) {
            case "submodule": {
              if (data.submodulePath === this.updateReport.submodule.path) {
                result = pr;

                if (done) { done(); }
                break;
              }
            }
            default: {}
          }
        }
      }
    });

    return Promise.resolve(result);
  }

  public async proposeUpdate(): Promise<UpdateResult> {
    const pr = await this.findPullRequest();
    if (pr === null) {
      let msg = `This PR changes ${this.updateReport.submodule.path} as follows:

Previous version from: ${this.updateReport.previousDate}
Current version from:  ${this.updateReport.upstreamDate}

Updated based on: ${this.updateReport.submodule.updateUrl}
Using branch:     ${this.updateReport.submodule.updateBranch}
`;

      if (this.updateReport.forced) {
        msg += "\n\n:warning: This update conflicted with the previous version and was forced.\n";
      }

      const metadata: SubmoduleMetadata = {
        type: "submodule",
        submodulePath: this.updateReport.submodule.path
      };
      msg = withData(msg, metadata);

      const request: PullRequestsCreateParams = {
        owner: this.owner,
        repo: this.repo,
        title: `Update submodule ${this.updateReport.submodule.path}`,
        head: `${this.owner}/${this.prBranch}`,
        base: `${this.owner}/${this.targetBranch}`,
        body: msg,
        maintainer_can_modify: true
      };
      const prResult = await this.github.pullRequests.create(request);

      const result: UpdateResult = {
        updatedExisting: false,
        newId: prResult.data.number
      };
      return Promise.resolve(result);
    } else {
      const request: IssuesCreateCommentParams = {
        owner: this.owner,
        repo: this.repo,
        number: pr.number,
        body: "TODO"
      };
      const cmtResult = await this.github.issues.createComment(request);
      const result: UpdateResult = {
        updatedExisting: true,
        existingId: pr.number,
        commentId: cmtResult.data.id
      };
      return Promise.resolve(result);
    }
  }
}
