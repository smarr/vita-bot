import { GitOps } from "./git-ops";
import { UpdateSubmodule } from "./config-schema";

const BOT_UPSTREAM = "vita-bot-upstream";

/**
 * A repository and a specific update task associated with it.
 *
 * The main responsibility of `Repository` is to provide the operations
 * to perform the desired updates.
 */
export class Repository {
  private readonly repo: GitOps;
  private readonly config: UpdateSubmodule;
  private readonly basePath: string;

  constructor(basePath: string, config: UpdateSubmodule) {
    this.basePath = basePath;
    this.config = config;

    this.repo = new GitOps(basePath);
  }

  /**
   * Get latest version of the main repository and branch.
   */
  public async cloneOrUpdate(): Promise<void> {
    return this.repo.cloneOrUpdate(
      this.config.repo.url, this.config.repo.branch);
  }

  public async updateSubmodule(): Promise<void> {
    throw new Error("Not yet implemented");
  }

  public async fetchSubmoduleUpstream(): Promise<void> {
    throw new Error("Not yet implemented");
  }

  public async rebaseSubmoduleOnUpstream(): Promise<{ success: boolean, msg: string, conflicts?: string[] }> {
    throw new Error("Not yet implemented");
  }
}
