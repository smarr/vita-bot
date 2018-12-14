import { BotDetails } from "./config-schema";

import { readFileSync, realpathSync } from "fs";

const pkg = readFileSync(__dirname + "/../../package.json", { encoding: "utf-8" });
export const bot: BotDetails = JSON.parse(pkg)["vita-bot"];
