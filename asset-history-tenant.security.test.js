const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
let assetData;
let assetExists;
let auditQueryCount;
let assetReadCount;

const fakeDb = {
  collection(name) {
    return {
      doc(id) {
        return {
          collectionName: name,
          id,
          async get() {
            if (name !== "assets") {
              throw new Error(`Unexpected document read: ${name}`);
            }
            assetReadCount++;
            return {
              exists: assetExists,
              id,
              data: () => assetData
            };
          }
        };
      },
      where(field, operator, value) {
        assert.equal(name, "asset_audit");
        auditQueryCount++;
        assert.equal(field, "assetId");
        assert.equal(operator, "==");
        return {
          async get() {
            return {
              docs: [{
                id: "audit-1",
                data: () => ({
                  assetId: value,
                  orgId: "org-1",
                  timestamp: { _seconds: 10 }
                })
              }]
            };
          }
        };
      }
    };
  }
};

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function main() {
  Module._load = function (request, parent, isMain) {
    if (request === "../config/firebase") {
      return { db: fakeDb, admin: {} };
    }
    if (request === "../services/assetCodeGenerator") {
      return () => "TEST-CODE";
    }
    if (request === "./notificationController") {
      return { createNotification: async () => {} };
    }
    if (request === "../utils/cache") {
      return { delPrefix: () => {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve("./src/controllers/assetController");
    delete require.cache[controllerPath];
    const { getAssetHistory } = require(controllerPath);

    async function invoke(data, exists, user, id = "asset-1") {
      assetData = data;
      assetExists = exists;
      auditQueryCount = 0;
      assetReadCount = 0;

      const req = { params: { id }, user };
      const res = makeResponse();
      await getAssetHistory(req, res);
      return res;
    }

    const tenantA = { userId: "user-a", role: "admin", orgId: "org-1" };

    let res = await invoke({ orgId: "org-2" }, true, tenantA);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Asset not found");
    assert.equal(assetReadCount, 1);
    assert.equal(auditQueryCount, 0);
    console.log("PASS: foreign-tenant asset rejected before audit query");

    res = await invoke(undefined, false, tenantA);
    assert.equal(res.statusCode, 404);
    assert.equal(auditQueryCount, 0);
    console.log("PASS: missing asset rejected before audit query");

    res = await invoke({ orgId: "org-1" }, true, tenantA);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
    assert.equal(auditQueryCount, 1);
    console.log("PASS: same-tenant asset history remains accessible");

    console.log("\n3/3 asset-history tenant security tests passed.");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
