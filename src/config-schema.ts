/**
 * The common `.github/config.yml` configuration file.
 */
export interface Configuration {
  "vita-bot": BotConfig;
}

export interface BotConfig extends BotBranchConfig, BotSubmoduleConfig { }

interface BotBranchConfig {
  /** Tasks to update branches. */
  "update-branches": { [branchPattern: string]: UpdateBranchConfig };
}

interface BotSubmoduleConfig {
  /** Tasks to update submodules. */
  "update-submodules": { [submodulePath: string]: UpdateSubmoduleConfig };

  /**
   * For submodule updates, this is the branch they should be applied on.
   * This is also going to be the branch, against which pull requests will be created.
   */
  "target-branch": string;
}

export function isBotConfig(val: any): boolean {
  if (val === undefined || val === null || typeof val !== "object") {
    return false;
  }

  let hasOne = false;
  let valid = true;
  if (val.hasOwnProperty("update-branches")) {
    hasOne = true;
    for (const key in val["update-branches"]) {
      valid = valid && isBranchConfig(val["update-branches"][key]);
      if (!valid) {
        break;
      }
    }
  }

  if (val.hasOwnProperty("update-submodules")) {
    hasOne = true;
    for (const key in val["update-submodules"]) {
      valid = valid && isSubmoduleConfig(val["update-submodules"][key]);
      if (!valid) {
        break;
      }
    }
  }

  return hasOne && valid;
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

  /** User id used for pushing to repositories. */
  gitUserId: string;

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

function isBranchConfig(val: any) {
  return val.hasOwnProperty("url") &&
    val.hasOwnProperty("branch") &&
    val.hasOwnProperty("tags");
}

/** Defines a task to update the submodule of the given git repository. */
export interface UpdateSubmoduleConfig {
  /** The branch that is checked for updates. */
  branch: string;
}

function isSubmoduleConfig(val: any) {
  return val.hasOwnProperty("branch");
}

