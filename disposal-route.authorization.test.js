const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const Module = require("node:module");
const path = require("node:path");

const testSecret = "test-only-disposal-route-secret-2026";
process.env.JWT_SECRET = testSecret;

const originalLoad = Module._load;
const firebasePath = require.resolve("./src/config/firebase");
const controllerPath = require.resolve("./src/controllers/disposalController");

let controllerReached = false;

const fakeController = {
  disposeAsset(req, res) {
    controllerReached = true;
    return res.status(200).json({
      success: true,
      message: "Mock disposal handler reached",
      role: req.user.role,
    });
  },
  getAssetDisposal(req, res) {
    return res.status(200).json({ success: true });
  },
  getOrgDisposals(req, res) {
    return res.status(200).json({ success: true });
  },
  getDisposalMethods(req, res) {
    return res.status(200).json({ success: true });
  },
};

Module._load = function (request, parent, isMain) {
  if (
    parent &&
    parent.filename === firebasePath &&
    request === "firebase-admin"
  ) {
    throw new Error("Firebase SDK must not load in this test");
  }

  if (
    parent &&
    parent.filename === controllerPath &&
    request === "../config/firebase"
  ) {
    return {
      db: {},
      admin: { firestore: { Timestamp: { now: () => new Date() } } },
    };
  }

  if (
    parent &&
    parent.filename === require.resolve("./src/routes/disposals") &&
    request === "../controllers/disposalController"
  ) {
    return fakeController;
  }

  return originalLoad.apply(this, arguments);
};

const cases = [];

function makeToken(role) {
  return jwt.sign(
    {
      userId: `test-${role}`,
      name: `Test ${role}`,
      role,
      orgId: "test-org",
    },
    testSecret,
    { expiresIn: "5m" }
  );
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/api/disposals", require("./src/routes/disposals"));

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function check(name, token, expectedStatus, shouldReachController) {
    controllerReached = false;

    try {
      const headers = {};
      if (token !== null) headers.authorization = token;

      const response = await fetch(
        `${base}/api/disposals/test-asset/dispose`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method: "TRANSFER",
            reason: "Authorization regression test",
          }),
        }
      );

      const body = await response.json();
      assert.equal(response.status, expectedStatus, name);
      assert.equal(controllerReached, shouldReachController, name);

      if (shouldReachController) {
        assert.equal(body.success, true);
        assert.equal(body.role, "admin");
      }

      cases.push(`PASS: ${name}`);
    } catch (error) {
      cases.push(`FAIL: ${name} — ${error.message}`);
    }
  }

  try {
    await check("missing token returns 401", null, 401, false);
    await check("invalid token returns 401", "Bearer invalid-token", 401, false);
    await check("viewer cannot dispose assets", `Bearer ${makeToken("viewer")}`, 403, false);
    await check("manager cannot dispose assets", `Bearer ${makeToken("manager")}`, 403, false);
    await check("super-admin cannot dispose assets", `Bearer ${makeToken("super-admin")}`, 403, false);
    await check("admin reaches disposal handler", `Bearer ${makeToken("admin")}`, 200, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Module._load = originalLoad;
  }

  console.log("\n===== DISPOSAL ROUTE AUTHORIZATION TESTS =====");
  cases.forEach((result) => console.log(result));

  const failures = cases.filter((result) => result.startsWith("FAIL:"));
  console.log(`\n${cases.length - failures.length}/${cases.length} tests passed`);

  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  Module._load = originalLoad;
  console.error("Test setup failed:", error);
  process.exitCode = 1;
});
