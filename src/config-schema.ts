/**
 * The configuration for what the vita-bot is supposed to do.
 */
export interface Configuration {
  github: GitHub;
  "update-submodule": { [key: string]: UpdateSubmodule };
}

export interface GitHub {
  user: string;
}

/** Defines a task to update the submodule of the given git repository. */
export interface UpdateSubmodule {
  /** The repository to be updated. */
  repo: Repo;

  /** The submodule to be updated. */
  submodule: Submodule;

  /** The repository used for creating pull requests against the `repo`. */
  workRepo?: Repo;
}

/** The git repository and its relevant branch. */
export interface Repo {
  /** The URL used to access a git repository. */
  url: string;

  /** The name of the relevant branch in the repository. */
  branch: string;
}

/** The submodule that is to be updated. */
export interface Submodule {
  /** The path of the submodule from the root of the repository. */
  path: string;
  tags: string;

  /**
   * The working repository to be used for the submodule.
   * It may be different from the repository configured in git.
   */
  repo: Repo;

  /** The upstream repository for the submodule on which to base changes. */
  upstream: Repo;
}
