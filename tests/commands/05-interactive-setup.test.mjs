import test from "node:test";

import {
  assertInteractiveHostSelection,
  assertInteractiveLifecycleMenus
} from "./interactive.mjs";

test("interactive setup selects supported hosts", async () => {
  await assertInteractiveHostSelection();
});

test("interactive lifecycle menus preserve safe actions", async () => {
  await assertInteractiveLifecycleMenus();
});
