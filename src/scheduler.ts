import Bottleneck from "bottleneck";
import {
  AppsListInstallationsResponseItem,
  AppsListInstallationReposForAuthenticatedUserResponse,
  AppsListInstallationReposForAuthenticatedUserResponseRepositoriesItem
} from "@octokit/rest";
import { Application } from "probot";

export interface GitHubRepository extends AppsListInstallationReposForAuthenticatedUserResponseRepositoriesItem { }
export interface GitHubInstallation extends AppsListInstallationsResponseItem { }

export interface SchedulerPayload {
  action: "repository";
  installation: GitHubInstallation;
  repository: GitHubRepository;
}

export class RepositoryScheduler {

  private readonly requestScheduler?: Bottleneck;
  private readonly app: Application;
  private readonly repositories: Map<GitHubInstallation, GitHubRepository[]>;

  private readonly checkInterval: number;

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
    this.repositories = new Map();
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

    const gotRepositories = this.requestRepositories();

    // execute once directly
    this.interval = false;
    this.lastIntervalId += 1;
    this.lastInterval = this.scheduleRepositories(gotRepositories, this.lastIntervalId);

    // but if we have a non-zero interval, then also register the interval
    if (this.checkInterval !== 0) {
      this.interval = setInterval(
        () => {
          if (this.completedInterval !== this.lastIntervalId) {
            // we skip this interval, another one is still going
            return;
          }
          this.lastIntervalId += 1;
          this.lastInterval = this.scheduleRepositories(gotRepositories, this.lastIntervalId);
        }, this.checkInterval);
    }
    return gotRepositories;
  }

  public stop() {
    if (this.interval !== false && this.interval !== undefined) {
      clearInterval(this.interval);
    }
  }

  private initApp() {
  }

  private async getInstallations(): Promise<GitHubInstallation[]> {
    const github = await this.app.auth();
    const request = github.apps.listInstallations({});

    const results: GitHubInstallation[] = [];

    await github.paginate(request, async (page) => {
      const installations: AppsListInstallationsResponseItem[] = (await page).data;
      for (const installation of installations) {
        results.push(installation);
      }
    });

    return Promise.resolve(results);
  }

  private async getRepositories(installation: AppsListInstallationsResponseItem): Promise<GitHubRepository[]> {
    const github = await this.app.auth(installation.id);

    const request = github.apps.listInstallationReposForAuthenticatedUser({ installation_id: installation.id });

    const results: GitHubRepository[] = [];
    await github.paginate(request, async (page) => {
      const response: AppsListInstallationReposForAuthenticatedUserResponse = (await page).data;
      for (const repo of response.repositories) {
        results.push(repo);
      }
    });

    return Promise.resolve(results);
  }

  private async requestRepositories(): Promise<Map<GitHubInstallation, GitHubRepository[]>> {
    const installations = await this.getInstallations();
    for (const inst of installations) {
      const repositories = await this.getRepositories(inst);
      this.repositories.set(inst, repositories);
    }

    return Promise.resolve(this.repositories);
  }

  private async scheduleRepositories(gotRepositories: Promise<any>, intervalId: number) {
    await gotRepositories;

    for (const [installation, repos] of this.repositories.entries()) {
      for (const repo of repos) {
        const payload: SchedulerPayload = {
          action: "repository",
          installation: installation,
          repository: repo
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
