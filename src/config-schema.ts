export interface Configuration {
  github: GitHub;
  "rebase-on-upstream": { [key: string]: Rebase };
  "downstream-users": { [key: string]: User };
}

export interface Rebase {
  repo: Repo;
  upstream: Repo;
}

export interface Repo {
  url: string;
  branch: string;
}

export interface GitHub {
  user: string;
}

export interface User {
  repo: Repo;
  submodule: string;
  upstream: Repo;
}
