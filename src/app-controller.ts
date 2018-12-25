import { getProjectConfig, bot } from "./config";
import { GithubWorkingCopy } from "./github";
import { SchedulerPayload } from "./scheduler";
import { UpdateSubmodule, GitHubSubmoduleUpdate } from "./update-ops";

import { normalize } from "path";
import { Context } from "probot";

export const REPO_ROOT = normalize(`${__dirname}/../../.base/working-copies`);

export async function doUpdates(context: Context) {
  const payload: SchedulerPayload = context.payload;

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const repoUrl = payload.repository.clone_url;

  const config = await getProjectConfig(context.github, owner, repo);
  if (config === null) {
    return;
  }

  for (const submodulePath in config["update-submodules"]) {
    const submodule = config["update-submodules"][submodulePath];

    const githubCopy = new GithubWorkingCopy(owner, repo, context.github);
    const workingCopy = await githubCopy.ensureCopyInBotUser();

    const updateSubmodule = new UpdateSubmodule(repoUrl, config["target-branch"],
      REPO_ROOT + "/" + workingCopy.repo, submodulePath, submodule, bot);
    const gitUpdateResult = await updateSubmodule.performUpdate();

    if (gitUpdateResult.success) {
      const githubUpdate = new GitHubSubmoduleUpdate(context.github, owner,
        repo, gitUpdateResult.reportInfo, config["target-branch"]);
      const existingBranch = await githubUpdate.findExistingPullRequest();

      const branchName = existingBranch === null ?
        await githubUpdate.getBranchName(workingCopy) : existingBranch;

      console.log("about to push branch");
      console.assert(workingCopy.cloneUrl !== undefined && workingCopy.cloneUrl !== null);
      await updateSubmodule.pushBranch(branchName, workingCopy.cloneUrl);

      await githubUpdate.proposeUpdate(branchName);
    } else {
      throw new Error("Not yet implemented the case to report failing update");
    }
  }

  for (const branch in config["update-branches"]) {
    throw new Error("Not yet implemented support for updating branches. branch: " + branch);
  }
}
