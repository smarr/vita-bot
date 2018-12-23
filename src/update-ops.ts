import { UpdateBranchConfig, BotDetails, UpdateSubmoduleConfig } from "./config-schema";
import { GitOps, RebaseResult, LogEntry } from "./git-ops";
import { CommitSummary } from "simple-git/promise";

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

class UpdateTask {
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

export class UpdateBranch extends UpdateTask {
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

export class UpdateSubmodule extends UpdateTask {
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
