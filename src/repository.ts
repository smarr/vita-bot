import { GitOps } from "./git-ops";
import { existsSync, mkdirSync } from "fs";

export class Repository {
  private readonly repo: GitOps;
  private readonly config: any;
  private readonly basePath: string;

  constructor(basePath: string, config: any) {
    this.basePath = basePath;
    this.config = config;

    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true });
    }
    this.repo = new GitOps(basePath);
  }

  public async clone(): Promise<void> {
    if (!(await this.repo.isValidRepository())) {
      await this.repo.clone(this.config.repo.url, this.config.repo.branch);
      return Promise.resolve();
    } else {
      return Promise.resolve();
    }
  }

  public async fetchUpstream(): Promise<void> {
    await this.repo.ensureRemote("upstream", this.config.upstream.url);
    await this.repo.fetch("upstream", this.config.upstream.branch);
  }

  public async rebaseOnUpstream(): Promise<{ success: boolean, msg: string, conflicts?: string[] }> {
    return this.repo.rebase(
      this.config.repo.branch, "upstream/" + this.config.upstream.branch);
  }
}
