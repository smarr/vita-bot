
/**
 * A repository and a specific update task associated with it.
 *
 * The main responsibility of `Repository` is to provide the operations
 * to perform the desired updates.
 */
export class Repository {

  public async commitSubmodule() {
    if (this.updateResult === undefined) {
      throw new Error("commitSubmodule() used before updateSubmodule().");
    }

    if (this.updateResult.success === false) {
      throw new Error("commitSubmodule() should only be used when update was successful.");
    }

    const prevDate = this.updateResult.heads.beforeUpdate.date;
    const upstreamDate = this.updateResult.heads.upstream.date;
    return this.createSubmoduleCommit(prevDate, upstreamDate, this.updateResult.fastForward);
  }

  protected async createSubmoduleCommit(prevDate: string, upstreamDate: string, fastForward: boolean) {
    if (!this.subRepo) {
      throw new Error("commitSubmodule() used before updateSubmodule().");
    }

    const name = this.config.submodule.path;

    let msg = `Update submodule ${name}

Previous version from: ${prevDate}
Current version from:  ${upstreamDate}

Updated based on: ${this.config.submodule.upstream.url}
Using branch:     ${this.config.submodule.upstream.branch}`;

    if (fastForward) {
      msg += "\n\nThis update was a simple fast-forward.";
    } else {
      msg += "\n\nThis update was a rebase without conflicts.";
    }

    return this.repo.commit(this.config.submodule.path, msg);
  }
}
