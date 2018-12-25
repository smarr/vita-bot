import { doUpdates } from "./app-controller";
import { RepositoryScheduler } from "./scheduler";

import { Application } from "probot";

export = (app: Application) => {
  // TODO, make the parameters here configurable
  const updater = new RepositoryScheduler(app, 0, 0);
  updater.start();

  app.on("schedule.repository", async function(context) {
    return doUpdates(context);
  });
};
