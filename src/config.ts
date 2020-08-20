import { BotDetails, BotConfig } from "./config-schema";

import { readFileSync } from "fs";
import yaml from "js-yaml";
import { GitHubAPI } from "probot/lib/github";
import { ReposGetContentsParams, ReposGetContentsResponse } from "./github";

const pkg = readFileSync(__dirname + "/../../package.json", { encoding: "utf-8" });
export const bot: BotDetails = JSON.parse(pkg)["vita-bot"];

export function getConfigFromYaml(data: string): BotConfig {
  const config: BotConfig = <BotConfig> yaml.safeLoad(data);
  return config;
}

async function getConfig(github: GitHubAPI, owner: string,
  repo: string, branch: string): Promise<BotConfig | null> {
  const params: ReposGetContentsParams = {
    owner: owner,
    repo: repo,
    path: ".github/config.yml",
    ref: branch
  };

  try {
    const response = <ReposGetContentsResponse> <any> await github.repos.getContents(params);

    if (response.data.type !== "file") {
      return Promise.resolve(null);
    }

    if (response.data.encoding !== "base64") {
      throw new Error(`Unsupported file encoding: ${response.data.encoding}`);
    }

    const data = Buffer.from(response.data.content, "base64").toString();
    const config = getConfigFromYaml(data);
    return Promise.resolve(config);

  } catch (e) {
    if (e.name === "HttpError" && e.code === 404) {
      return Promise.resolve(null);
    } else {
      throw e;
    }
  }
}

export async function getProjectConfig(github: GitHubAPI, owner: string, repo: string): Promise<BotConfig | null> {
  for (const branch of bot["config-branches"]) {
    const config = await getConfig(github, owner, repo, branch);
    if (config !== null) {
      return Promise.resolve(config);
    }
  }

  return Promise.resolve(null);
}
