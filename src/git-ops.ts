import git, { SimpleGit } from "simple-git/promise";
import { existsSync } from "fs";

export class GitOps {
  private static readonly FAILED_MERGE_ERR = "Failed to merge";

  private readonly repo: SimpleGit;

  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.repo = git(basePath);
  }

  public async fetch(remoteName: string, branch?: string) {
    return this.repo.fetch(remoteName, branch);
  }

  public async isValidRepository(): Promise<boolean> {
    if (!existsSync(this.basePath + "/.git")) {
      return Promise.resolve(false);
    }

    const result = await this.repo.revparse(["--is-inside-work-tree"]);
    return Promise.resolve(result.trim() === "true");
  }

  public async clone(url: string, branch: string): Promise<string> {
    return this.repo.clone(url, ".", ["-b", branch]); // "." implies the basePath
  }

  public async rebase(branch: string, ontoUpstream: string): Promise<{ success: boolean, msg: string, conflicts?: string[] }> {
    await this.repo.checkout(branch);

    try {
      const rebaseResult = await this.repo.rebase([ontoUpstream]);
      return Promise.resolve({
        success: true, msg: rebaseResult
      });
    } catch (e) {
      if (e.message.includes(GitOps.FAILED_MERGE_ERR)) {
        const conflicts = await this.repo.diff(["--name-only", "--diff-filter=U"]);
        const conflictedFiles = conflicts.trim().split("\n");
        await this.repo.rebase(["--abort"]);
        return Promise.resolve({
          success: false, msg: e.message, conflicts: conflictedFiles
        });
      } else {
        throw e;
      }
    }
  }

  /**
   * Ensure the remote with the given name refers to the given url.
   * If already present, it will be replaced.
   */
  public async ensureRemote(name: string, url: string) {
    const remotes = await this.repo.getRemotes(true);

    let found = false;
    for (const r of remotes) {
      if (r.name === name) {
        if (r.refs.fetch === url) {
          found = true;
        } else {
          await this.repo.removeRemote(name);
        }
        break;
      }
    }

    if (!found) {
      await this.repo.addRemote(name, url);
    }
  }
}
