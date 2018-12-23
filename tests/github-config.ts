import { getProjectConfig, bot } from "../src/config";
import { BotConfig } from "../src/config-schema";

import { expect } from "chai";
import { GitHubAPI } from "probot/lib/github";
import nock, { disableNetConnect } from "nock";

const github = GitHubAPI();
const GITHUB_API = "https://api.github.com";

const TEST_BASIC_YAML = `
update-branches:
  partial:
    url: $BASE$/upstream
    branch: extended
  root-master:
    url: $BASE$/upstream
    branch: extended
  debugger/master:
    url: origin
    branch: master
update-submodules:
  libs/truffle:
    branch: debugger/master
  has-conflict:
    branch: extended
  has-update:
    branch: extended
`;

const TEST_MIXED_YAML = TEST_BASIC_YAML + `
test: "some text"
update-foo: [ 3, 4, 3, 2 ]
submodules:
  baz: foo
`;

disableNetConnect();

describe("GitHub configuration access", function() {
  describe("Reading of project configuration from .github/config.yml", function() {
    let config: BotConfig;

    before(async function() {
      nock(GITHUB_API)
          .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
          .reply(200, {
            "name": "config.yml",
            "path": ".github/config.yml",
            "type": "file",
            "content": Buffer.from(TEST_BASIC_YAML).toString("base64"),
            "encoding": "base64"
          });
      config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");
    });

    it("Should be able to read basic config from file in repo", function() {
      expect(config).is.not.null;
    });

    it("Should get submodule update configuration", function() {
      expect(config["update-submodules"]).to.be.an("object");
      const cfg = config["update-submodules"]["libs/truffle"];
      expect(cfg.branch).to.equal("debugger/master");
    });

    it("Should get branch update configuration", function() {
      expect(config["update-branches"]).to.be.an("object");
      const cfg = config["update-branches"]["debugger/master"];
      expect(cfg.branch).to.equal("master");
    });
  });

  describe("Reading of project configuration from shared .github/config.yml", function() {
    let config: BotConfig;

    before(async function() {
      nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
        .reply(200, {
          "name": "config.yml",
          "path": ".github/config.yml",
          "type": "file",
          "content": Buffer.from(TEST_MIXED_YAML).toString("base64"),
          "encoding": "base64"
        });
      config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");
    });

    it("Should be resilient to other configuration data in file", function() {
      expect(config).is.not.null;
      expect(config["update-submodules"]).to.be.an("object");
      expect(config["update-branches"]).to.be.an("object");

      let cfg: any = config;
      expect(cfg).to.haveOwnProperty("test");
      expect(cfg).to.haveOwnProperty("update-foo");
      expect(cfg).to.haveOwnProperty("submodules");
    });
  });

  describe("Support configuration search on common branches", function() {
    it("Should find config on master branch", async function() {
      bot["config-branches"] = ["dev", "master"];

      const devRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
        .reply(404, {
            "message": "Not Found",
            "documentation_url": "https://developer.github.com/v3/repos/contents/#get-contents"
          });
      const masterRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=master")
        .reply(200, {
          "name": "config.yml",
          "path": ".github/config.yml",
          "type": "file",
          "content": Buffer.from(TEST_BASIC_YAML).toString("base64"),
          "encoding": "base64"
        });
      const config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");

      expect(devRq.isDone()).to.be.true;
      expect(masterRq.isDone()).to.be.true;

      expect(config).is.not.null;
      expect(config["update-submodules"]).to.be.an("object");
      expect(config["update-branches"]).to.be.an("object");
    });

    it("Should find config on dev branch", async function() {
      bot["config-branches"] = ["dev", "master"];

      const devRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
        .reply(200, {
          "name": "config.yml",
          "path": ".github/config.yml",
          "type": "file",
          "content": Buffer.from(TEST_BASIC_YAML).toString("base64"),
          "encoding": "base64"
        });
      const config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");

      expect(devRq.isDone()).to.be.true;

      expect(config).is.not.null;
      expect(config["update-submodules"]).to.be.an("object");
      expect(config["update-branches"]).to.be.an("object");
    });

    it("Should find config on other branches named in package.json", async function() {
      bot["config-branches"] = ["dev", "master", "foobar"];

      const devRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
        .reply(404, {
            "message": "Not Found",
            "documentation_url": "https://developer.github.com/v3/repos/contents/#get-contents"
          });
      const masterRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=master")
        .reply(404, {
            "message": "Not Found",
            "documentation_url": "https://developer.github.com/v3/repos/contents/#get-contents"
          });
      const foobarRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=foobar")
        .reply(200, {
          "name": "config.yml",
          "path": ".github/config.yml",
          "type": "file",
          "content": Buffer.from(TEST_BASIC_YAML).toString("base64"),
          "encoding": "base64"
        });
      const config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");

      expect(devRq.isDone()).to.be.true;
      expect(masterRq.isDone()).to.be.true;
      expect(foobarRq.isDone()).to.be.true;

      expect(config).is.not.null;
      expect(config["update-submodules"]).to.be.an("object");
      expect(config["update-branches"]).to.be.an("object");
    });

    it("Should return null if no config is found", async function() {
      bot["config-branches"] = ["dev", "master"];

      const devRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=dev")
        .reply(404, {
            "message": "Not Found",
            "documentation_url": "https://developer.github.com/v3/repos/contents/#get-contents"
          });
      const masterRq = nock(GITHUB_API)
        .get("/repos/smarr/SOMns/contents/.github/config.yml?ref=master")
        .reply(404, {
            "message": "Not Found",
            "documentation_url": "https://developer.github.com/v3/repos/contents/#get-contents"
          });

      const config = <BotConfig> await getProjectConfig(github, "smarr", "SOMns");

      expect(devRq.isDone()).to.be.true;
      expect(masterRq.isDone()).to.be.true;

      expect(config).is.null;
    });
  });
});
