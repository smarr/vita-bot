/**
 * The common `.github/config.yml` configuration file.
 */
export interface Configuration {
  "vita-bot": BotConfig;
}

export interface BotConfig {
  bot: BotDetails;
  "update-branches": { [branchPattern: string]: UpdateBranchConfig };
  "update-submodules": { [submodulePath: string]: UpdateSubmoduleConfig };
}

/** Details to identify the bot, for instance in Git commits. */
export interface BotDetails {
  /** Used as author and committer name for git. */
  name: string;

  /** Used as author and committer email for git. */
  email: string;
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
