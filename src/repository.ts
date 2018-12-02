import { GitOps } from "./git-ops";
import { UpdateSubmodule, BotDetails } from "./config-schema";

const BOT_UPSTREAM_REMOTE = "vita-bot-upstream";
const ORIGIN_REMOTE = "origin";

/**
 * A repository and a specific update task associated with it.
 *
 * The main responsibility of `Repository` is to provide the operations
 * to perform the desired updates.
 */
export class Repository {
  private readonly repo: GitOps;
  private subRepo?: GitOps;

  private readonly config: UpdateSubmodule;
  private readonly bot: BotDetails;
  private readonly basePath: string;

  constructor(basePath: string, config: UpdateSubmodule, bot: BotDetails) {
    this.basePath = basePath;
    this.config = config;
    this.bot = bot;

    this.repo = new GitOps(basePath, bot.name, bot.email);
    this.subRepo = undefined;

    this.validateConfig();
  }

  private validateConfig() {
    if (!this.config.repo.branch) {
      throw new Error("Please specify explicitly which branch to use for " + this.config.repo.url);
    }
  }

  /**
   * Get latest version of the main repository and branch.
   *
   * The configured branch is checked out and the repo is ready for the update.
   */
  public async cloneOrUpdate(): Promise<void> {
    return this.repo.cloneOrUpdate(
      this.config.repo.url, this.config.repo.branch);
  }

  public async updateSubmodule(): Promise<{ success: boolean, msg: string, conflicts?: string[] }> {
    await this.repo.submoduleUpdate(this.config.submodule.path);

    if (this.subRepo === undefined) {
      this.subRepo = new GitOps(
        this.basePath + "/" + this.config.submodule.path,
        this.bot.name, this.bot.email);
    }

    const upstream = this.config.submodule.upstream;

    // since submodules don't track branches,
    // first we make sure we are on the configured branch
    await this.subRepo.fetch(ORIGIN_REMOTE);
    await this.subRepo.ensureBranch(ORIGIN_REMOTE, this.config.submodule.repo.branch);

    // and now we can fetch upstream
    await this.subRepo.ensureRemote(BOT_UPSTREAM_REMOTE, upstream.url);
    await this.subRepo.fetch(BOT_UPSTREAM_REMOTE, upstream.branch);

    const result = /* await */ this.subRepo.rebase(
      this.config.submodule.repo.branch, BOT_UPSTREAM_REMOTE + "/" + upstream.branch);
    return result;
  }

  protected async rebaseSubmoduleOnUpstream(): Promise<{ success: boolean, msg: string, conflicts?: string[] }> {
    throw new Error("Not yet implemented");
  }
}
