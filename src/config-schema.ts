/**
 * The common `.github/config.yml` configuration file.
 */
export interface Configuration {
  "vita-bot": BotConfig;
}

export interface BotConfig {
  /** Tasks to update branches. */
  "update-branches": { [branchPattern: string]: UpdateBranchConfig };

  /** Tasks to update submodules. */
  "update-submodules": { [submodulePath: string]: UpdateSubmoduleConfig };

  /**
   * For submodule updates, this is the branch they should be applied on.
   * This is also going to be the branch, against which pull requests will be created.
   */
  "target-branch": string;
}

/**
 * Details to identify the bot, for instance in Git commits.
 * This data is stored in the package.json.
 */
export interface BotDetails {
  /** Used as author and committer name for git. */
  name: string;

  /** Used as author and committer email for git. */
  email: string;

  /** GitHub user id corresponding to the bot. */
  userId: string;

  /**
   * Branches to be queried for bot configurations.
   * The branches will be queried in order and the first found config is used.
   */
  "config-branches": string[];
}

/** Defines a task to update branches in the given git repository. */
export interface UpdateBranchConfig {
  /** URL of the upstream repo. */
  url: string;

  /** Branch in the upstream repo. */
  branch: string;

  /** If update is possible as fast-forward: "push" will try to simply push the update. */
  "fast-forward"?: "push";

  /** After a successful rebase, create a tag based on the given pattern. */
  tags: string;
}

/** Defines a task to update the submodule of the given git repository. */
export interface UpdateSubmoduleConfig {
  /** The branch that is checked for updates. */
  branch: string;
}
