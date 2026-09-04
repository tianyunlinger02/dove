import test from "node:test";

import { assertSourceBuilds } from "./source-build.mjs";

test("source entrypoints bundle successfully", async () => {
  await assertSourceBuilds();
});
