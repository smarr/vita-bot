import Bottleneck from "bottleneck";
import { Application } from "probot";
import { GithubInstallations, GitHubInstallation, GitHubRepository, WorkingCopyResult, GithubRepo } from "./github";

export interface SchedulerPayload {
  action: "repository";
  repository: GithubRepo;
}

export class RepositoryScheduler {

  private readonly requestScheduler?: Bottleneck;
  private readonly app: Application;

  private readonly checkInterval: number;

  private readonly installations: GithubInstallations;

  private interval?: NodeJS.Timeout | false;

  private lastIntervalId: number;
  private completedInterval: number;
  private lastInterval: Promise<number>;

  /**
   * @param app
   * @param checkInterval in seconds
   * @param requestsPerSecond in seconds
   */
  constructor(app: Application, checkInterval: number, requestsPerSecond: number) {
    this.app = app;
    this.installations = new GithubInstallations(app);
    this.checkInterval = checkInterval * 1000;

    this.lastIntervalId = -1;
    this.completedInterval = -1;
    this.lastInterval = Promise.resolve(-1);

    if (requestsPerSecond === 0) {
      this.requestScheduler = undefined;
    } else {
      this.requestScheduler = new Bottleneck({
        maxConcurrent: 1,
        reservoir: 0,
        reservoirRefreshAmount: Math.ceil(requestsPerSecond),
        reservoirRefreshInterval: requestsPerSecond * 1000
      });
    }

    this.initApp();
  }

  public getLastInterval(): Promise<number> {
    return this.lastInterval;
  }

  public async start(): Promise<Map<GitHubInstallation, GitHubRepository[]>> {
    if (this.interval !== undefined) {
      throw new Error("Scheduler.start() can only be executed once");
    }

    const repoPromise = this.installations.requestRepositories();

    // execute once directly
    this.interval = false;
    this.lastIntervalId += 1;
    this.lastInterval = this.scheduleRepositories(repoPromise, this.lastIntervalId);

    // but if we have a non-zero interval, then also register the interval
    if (this.checkInterval !== 0) {
      this.interval = setInterval(
        () => {
          if (this.completedInterval !== this.lastIntervalId) {
            // we skip this interval, another one is still going
            return;
          }
          this.lastIntervalId += 1;
          this.lastInterval = this.scheduleRepositories(repoPromise, this.lastIntervalId);
        }, this.checkInterval);
    }
    return repoPromise;
  }

  public stop() {
    if (this.interval !== false && this.interval !== undefined) {
      clearInterval(this.interval);
    }
  }

  private initApp() {

  }


  private async scheduleRepositories(repoPromise: Promise<Map<GitHubInstallation, GitHubRepository[]>>, intervalId: number) {
    const repositories = await repoPromise;

    for (const [_installation, repos] of repositories.entries()) {
      for (const repo of repos) {
        const payload: SchedulerPayload = {
          action: "repository",
          repository: {
            owner: repo.owner.login,
            repo: repo.name,
            cloneUrl: repo.clone_url
          }
        };
        const repoUpdateEvent = {
          name: "schedule",
          payload: payload
        };

        if (this.requestScheduler === undefined) {
          await this.app.receive(repoUpdateEvent);
        } else {
          await this.requestScheduler.schedule(
            () => this.app.receive(repoUpdateEvent));
        }
      }
    }

    this.completedInterval = intervalId;
    return Promise.resolve(intervalId);
  }
}
