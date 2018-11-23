import { rmdirSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { chdir } from "process";

const GIT_WORK_FOLDER = ".test";
const TEST_TEXT = "1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n";

const FILE1 = "file-1";
const FILE2 = "file-2";

const BRANCH_CONFLICT = "replaced";
const BRANCH_NO_CONFLICT = "partial";
const BRANCH_UPSTREAM = "extended";
const BRANCH_ROOT = "root-master";

import git from "simple-git/promise";

describe("Rebase Branch Automatically", function() {
  before(async function() {
    if (existsSync(GIT_WORK_FOLDER)) {
      rmdirSync(GIT_WORK_FOLDER);
    }

    mkdirSync(GIT_WORK_FOLDER);
    chdir(GIT_WORK_FOLDER);

    const repo = git();
    await repo.init();

    writeFileSync(FILE1, TEST_TEXT);
    writeFileSync(FILE2, TEST_TEXT);
    await repo.add(FILE1);
    await repo.add(FILE2);
    await repo.commit("Initial Commit");
    await repo.branch([BRANCH_ROOT]);

    writeFileSync(FILE1, TEST_TEXT + TEST_TEXT);
    await repo.add(FILE1);
    await repo.commit("Extend " + FILE1);

    writeFileSync(FILE1, TEST_TEXT + TEST_TEXT + TEST_TEXT);
    await repo.add(FILE1);
    await repo.commit(`Extend ${FILE1} more`);
    // the branch representing upstream development
    await repo.branch([BRANCH_UPSTREAM]);

    // a branch representing local development that will cause a conflict
    await repo.checkoutBranch(BRANCH_CONFLICT, BRANCH_ROOT);
    writeFileSync(FILE1, "replaced");
    await repo.add(FILE1);
    await repo.commit("Replaced " + FILE1);

    // a branch representing local development that won't cause a conflict
    await repo.checkoutBranch(BRANCH_NO_CONFLICT, BRANCH_ROOT);
    writeFileSync(FILE1, TEST_TEXT + TEST_TEXT.substring(0, TEST_TEXT.length / 2));
    await repo.add(FILE1);
    await repo.commit("Partial extension of " + FILE1);
  });

  it("basic test", async function() {
    //
  });
});
