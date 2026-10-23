const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let assetData;
let assetExists;
let disposalDocs;
let disposalQueries;

const fakeDb = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            assert.equal(name, "assets");
            return {
              exists: assetExists,
              id,
              data: () => assetData
            };
          }
        };
      },
      where(field, operator, value) {
        assert.equal(name, "asset_disposals");
        disposalQueries.push({ field, operator, value });

        return {
          where(nextField, nextOperator, nextValue) {
            disposalQueries.push({
              field: nextField,
              operator: nextOperator,
              value: nextValue
            });
            return this;
          },
          async get() {
            return { docs: disposalDocs };
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

function disposalDoc(id, data) {
  return { id, data: () => data };
}

async function main() {
  Module._load = function (request, parent, isMain) {
    if (
      request === "../config/firebase" &&
      parent?.filename.endsWith("/src/controllers/disposalController.js")
    ) {
      return {
        db: fakeDb,
        admin: { firestore: { Timestamp: { now: () => ({ seconds: 1 }) } } }
      };
    }

    if (
      request === "../utils/cache" &&
      parent?.filename.endsWith("/src/controllers/disposalController.js")
    ) {
      return { delPrefix() {} };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve("./src/controllers/disposalController");
    delete require.cache[controllerPath];

    const { getAssetDisposal, getOrgDisposals } = require(controllerPath);

    async function invokeAsset(data, exists, user, id = "asset-1") {
      assetData = data;
      assetExists = exists;
      disposalQueries = [];
      disposalDocs = [
        disposalDoc("disposal-a", {
          assetId: id,
          orgId: "org-1",
          method: "TRANSFER"
        })
      ];

      const req = { params: { id }, user };
      const res = makeResponse();
      await getAssetDisposal(req, res);
      return res;
    }

    const adminA = { role: "admin", orgId: "org-1" };
    const superAdmin = { role: "super-admin", orgId: null };

    let res = await invokeAsset({ orgId: "org-1" }, true, adminA);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
    assert.deepEqual(disposalQueries, [
      { field: "assetId", operator: "==", value: "asset-1" },
      { field: "orgId", operator: "==", value: "org-1" }
    ]);
    console.log("PASS: organization admin history query filters by asset and organization");

    res = await invokeAsset({ orgId: "org-2" }, true, adminA);
    assert.equal(res.statusCode, 404);
    assert.equal(disposalQueries.length, 0);
    console.log("PASS: cross-organization asset history is denied before disposal query");

    res = await invokeAsset(undefined, false, adminA);
    assert.equal(res.statusCode, 404);
    assert.equal(disposalQueries.length, 0);
    console.log("PASS: missing asset returns 404 without querying disposal records");

    res = await invokeAsset({ orgId: "org-2" }, true, superAdmin);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(disposalQueries, [
      { field: "assetId", operator: "==", value: "asset-1" }
    ]);
    console.log("PASS: super-admin history query allows cross-organization access");

    console.log("\n4/4 disposal read tenant tests passed.");
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve("./src/controllers/disposalController")];
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
