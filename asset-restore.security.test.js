const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let assetData;
let assetExists;
let transactionError;
let operations;
let cacheInvalidations;

const timestamp = { seconds: 1234567890 };

const fakeAdmin = {
  firestore: {
    Timestamp: {
      now: () => timestamp
    }
  }
};

const fakeCache = {
  delPrefix(prefix) {
    cacheInvalidations.push(prefix);
  }
};

const fakeDb = {
  collection(name) {
    return {
      doc(id) {
        return {
          id: id || "generated-audit-id",
          collectionName: name
        };
      }
    };
  },

  async runTransaction(callback) {
    if (transactionError) throw transactionError;

    const pendingOperations = [];

    const transaction = {
      async get(ref) {
        assert.equal(ref.collectionName, "assets");

        return {
          exists: assetExists,
          id: ref.id,
          data: () => assetData
        };
      },

      update(ref, data) {
        pendingOperations.push({
          type: "update",
          ref,
          data
        });
      },

      set(ref, data) {
        pendingOperations.push({
          type: "set",
          ref,
          data
        });
      }
    };

    const result = await callback(transaction);

    // Simulate committing only after the callback completes successfully.
    operations.push(...pendingOperations);
    return result;
  }
};

const fakeFirebase = {
  db: fakeDb,
  admin: fakeAdmin
};

function reset(data, exists = true) {
  assetData = data;
  assetExists = exists;
  transactionError = null;
  operations = [];
  cacheInvalidations = [];
}

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

async function callRestore(assetId = "asset-123", orgId = "org-1") {
  const req = {
    params: { id: assetId },
    user: {
      role: "admin",
      orgId,
      userId: "test-user"
    }
  };

  const res = makeResponse();
  await restoreAsset(req, res);
  return res;
}

let restoreAsset;

async function main() {
  Module._load = function (request, parent, isMain) {
    if (request === "../config/firebase") return fakeFirebase;

    if (request === "./notificationController") {
      return { createNotification: async () => {} };
    }

    if (request === "../services/assetCodeGenerator") {
      return () => "TEST-ASSET-CODE";
    }

    if (request === "../utils/cache") return fakeCache;

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve("./src/controllers/assetController");
    delete require.cache[controllerPath];
    restoreAsset = require(controllerPath).restoreAsset;

    assert.equal(typeof restoreAsset, "function");

    // 1. Successful restore updates the asset and creates its audit event.
    reset({
      orgId: "org-1",
      status: "ASSIGNED",
      name: "Test asset",
      custodian: "Test custodian"
    });

    let res = await callRestore();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.assetId, "asset-123");
    assert.equal(operations.length, 2);

    const update = operations.find(op => op.type === "update");
    const audit = operations.find(op => op.type === "set");

    assert.ok(update);
    assert.ok(audit);
    assert.equal(update.ref.collectionName, "assets");
    assert.deepEqual(update.data, {
      status: "UNASSIGNED",
      previousStatus: "ASSIGNED",
      statusReason: null,
      updatedAt: timestamp
    });

    assert.equal(audit.ref.collectionName, "asset_audit");
    assert.equal(audit.data.action, "restored");
    assert.equal(audit.data.assetId, "asset-123");
    assert.equal(audit.data.orgId, "org-1");
    assert.equal(audit.data.changedBy, "test-user");
    assert.equal(audit.data.oldData.status, "ASSIGNED");
    assert.equal(audit.data.newData.status, "UNASSIGNED");
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin"
    ]);

    console.log("PASS: successful restore updates asset and audits atomically");

    // 2. Missing asset returns 404 without writes.
    reset(null, false);
    res = await callRestore();

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Asset not found");
    assert.equal(operations.length, 0);
    assert.equal(cacheInvalidations.length, 0);

    console.log("PASS: missing asset is not modified");

    // 3. Cross-organization asset remains hidden.
    reset({ orgId: "another-org", status: "ASSIGNED" });
    res = await callRestore("asset-123", "org-1");

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Asset not found");
    assert.equal(operations.length, 0);
    assert.equal(cacheInvalidations.length, 0);

    console.log("PASS: cross-organization restore is rejected");

    // 4. Disposed asset cannot be restored.
    reset({ orgId: "org-1", status: "DISPOSED" });
    res = await callRestore();

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /already disposed/i);
    assert.equal(operations.length, 0);
    assert.equal(cacheInvalidations.length, 0);

    console.log("PASS: disposed asset is not restored");

    // 5. Transaction failure returns 500 and does not invalidate cache.
    reset({ orgId: "org-1", status: "ASSIGNED" });
    transactionError = new Error("simulated transaction failure");
    res = await callRestore();

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "simulated transaction failure");
    assert.equal(operations.length, 0);
    assert.equal(cacheInvalidations.length, 0);

    console.log("PASS: transaction failure does not report success");
    console.log("All asset restore regression tests passed.");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
