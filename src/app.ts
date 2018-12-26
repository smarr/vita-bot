import { doUpdates, setupWebInterface } from "./app-controller";
import { RepositoryScheduler } from "./scheduler";

import { Application } from "probot";

export = (app: Application) => {
  // TODO, make the parameters here configurable
  app.log.info("Starting Vita Bot");
  const updater = new RepositoryScheduler(app, 0, 0);
  updater.start();

  app.log.info("Repository Task Scheduler initialized");

  setupWebInterface(app);
  app.log.info("Web Interface setup");

  app.on("schedule.repository", async function(context) {
    return doUpdates(context);
  });
};
