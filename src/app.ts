import { doUpdates, setupWebInterface } from "./app-controller";
import { RepositoryScheduler } from "./scheduler";

import { Application } from "probot";
import { GitHubAPI } from "probot/lib/github";

export = (app: Application) => {
  // TODO, make the parameters here configurable
  app.log.info("Starting Vita Bot");
  const updater = new RepositoryScheduler(app, 0, 0);

  app.log.info("Repository Task Scheduler initialized");

  if (process.env.PUSH_KEY === undefined) {
    throw new Error("Please configure a PUSH_KEY, a GitHub OAuth key, to be able to push updates to the bot repo");
  }

  setupWebInterface(app, updater, process.env.PUSH_KEY);
  app.log.info("Web Interface setup");

  let botGitHub: GitHubAPI | null = null;

  app.on("schedule.start", async function(context) {
    updater.start();
  });

  app.on("schedule.repository", async function(context) {
    if (botGitHub === null) {
      const botInst = await updater.getBotInstallation();
      botGitHub = await app.auth(botInst.id);
    }
    return doUpdates(context.payload.repository, context.github, botGitHub, process.env.PUSH_KEY!);
  });
};
