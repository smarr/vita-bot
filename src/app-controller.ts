import { getProjectConfig, bot, getConfigFromYaml } from "./config";
import { isBotConfig } from "./config-schema";
import { GithubWorkingCopy, GithubInstallations } from "./github";
import { SchedulerPayload } from "./scheduler";
import { UpdateSubmodule, GitHubSubmoduleUpdate } from "./update-ops";

import bodyParser from "body-parser";
import { Response, Request } from "express";
import { normalize } from "path";
import { Context, Application } from "probot";

export const REPO_ROOT = normalize(`${__dirname}/../../.base/working-copies`);

export function setupWebInterface(app: Application) {
  const router = app.route("/vita-bot");

  // Add a new route
  router.get("/", (_req: Request, res: Response) => {
    res.type("html");
    res.send("Vita Bot is running: " + new Date().toUTCString());
  });

  router.get("/repos", async (_req: Request, res: Response) => {
    let msg = `<html><body><h1>Current installations (${new Date().toUTCString()}):</h1>`;

    const installations = new GithubInstallations(app);
    const result = await installations.requestRepositories();

    for (const [inst, repos] of result.entries()) {
      msg += `Installation: <a href="${inst.html_url}">${inst.account.login}</a>`;
      msg += `<ul>`;
      for (const repo of repos) {
        msg += `<li><a href="${repo.url}">${repo.name}</a> (<a href="/vita-bot/config/${inst.id}/${repo.full_name}">config</a>)</li>`;
      }
      msg += `</ul>`;
    }

    res.type("html");

    msg += `</body></html>`;
    res.send(msg);
  });

  router.get("/config/:inst/:owner/:repo", async (req: Request, res: Response) => {
    res.type("html");
    const config = await getProjectConfig(await app.auth(req.params.inst), req.params.owner, req.params.repo);

    const valid = isBotConfig(config);

    let msg = `<html><body><h1>Configuration for ${req.params.owner}/${req.params.repo} (${new Date().toUTCString()}):</h1>`;

    msg += `<h2>Valid: ${valid}</h2>`;
    msg += `<code><pre>${JSON.stringify(config)}</pre></code>`;

    msg += `<a href="/viva-bot/validate">Validation Form to verify config format</a>`;

    msg += `</body></html>`;

    res.send(msg);
  });

  router.get("/validate", (req: Request, res: Response) => {
    res.type("html");
    res.send(`<html><body><h1>Validate Configuration (${new Date().toUTCString()})</h1>
    <form action="" method="post">
    <textarea name="config"></textarea>
    <input type="submit">
    </form>
    </body></html>`);
  });

  router.use(bodyParser.urlencoded({ extended: false }));
  router.post("/validate", (req: Request, res: Response) => {
    res.type("html");

    const config = getConfigFromYaml(req.body.config);
    const result = isBotConfig(config);

    let msg = `<html><body><h1>Validate Configuration (${new Date().toUTCString()})</h1>
    <h2>Result: ${result}</h2>
    <form action="" method="post">
    <textarea name="config">${req.body.config}</textarea>
    <input type="submit">
    </form>
    </body></html>`;
    res.send(msg);
  });
}

export async function doUpdates(context: Context) {
  const payload: SchedulerPayload = context.payload;

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const cloneUrl = payload.repository.clone_url;

  const config = await getProjectConfig(context.github, owner, repo);
  if (config === null) {
    return;
  }

  for (const submodulePath in config["update-submodules"]) {
    const submodule = config["update-submodules"][submodulePath];

    const githubCopy = new GithubWorkingCopy(owner, repo, context.github);
    const workingCopy = await githubCopy.ensureCopyInBotUser();

    const updateSubmodule = new UpdateSubmodule(cloneUrl, config["target-branch"],
      REPO_ROOT + "/" + workingCopy.repo, submodulePath, submodule, bot);
    const gitUpdateResult = await updateSubmodule.performUpdate();

    if (gitUpdateResult.success) {
      const githubUpdate = new GitHubSubmoduleUpdate(context.github, owner,
        repo, gitUpdateResult.reportInfo, config["target-branch"]);
      const existingBranch = await githubUpdate.findExistingPullRequest();

      const branchName = existingBranch === null ?
        await githubUpdate.getBranchName(workingCopy) : existingBranch;

      await updateSubmodule.pushBranch(branchName, workingCopy.sshUrl);

      await githubUpdate.proposeUpdate(branchName);
    } else {
      throw new Error("Not yet implemented the case to report failing update");
    }
  }

  for (const branch in config["update-branches"]) {
    throw new Error("Not yet implemented support for updating branches. branch: " + branch);
  }
}
