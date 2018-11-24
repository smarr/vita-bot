import git, { SimpleGit } from "simple-git/promise";

export class GitOps {
  private static readonly FAILED_MERGE_ERR = "Failed to merge";

  private readonly repo: SimpleGit;

  constructor(basePath: string) {
    this.repo = git(basePath);
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
}
