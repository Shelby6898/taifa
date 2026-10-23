const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let assetData;
let assetExists;
let transactionError;
let retryWithDisposedAsset;
let transactionAttempts;
let operations;
let custodyDocs;
let custodyQueries;
let generatedId;
let disposeAsset;
let cacheInvalidations;

const timestamp = { seconds: 1234567890 };

const fakeAdmin = {
  firestore: {
    Timestamp: {
      now: () => timestamp
    }
  }
};

function makeRef(collectionName, id) {
  return { collectionName, id };
}

const fakeDb = {
  collection(name) {
    return {
      doc(id) {
        generatedId += 1;
        return makeRef(name, id || `${name}-generated-${generatedId}`);
      },
      where(field, operator, value) {
        const query = {
          collectionName: name,
          filters: [{ field, operator, value }],
          where(nextField, nextOperator, nextValue) {
            this.filters.push({
              field: nextField,
              operator: nextOperator,
              value: nextValue
            });
            return this;
          }
        };
        return query;
      }
    };
  },

  async runTransaction(callback) {
    transactionAttempts += 1;
    const pending = [];
    const transaction = {
      async get(ref) {
        if (ref.collectionName === "assets") {
          return {
            exists: assetExists,
            id: ref.id,
            data: () => assetData
          };
        }

        if (ref.collectionName === "asset_custody_logs") {
          custodyQueries.push(ref);
          return { docs: custodyDocs };
        }

        throw new Error(`Unexpected transaction read: ${ref.collectionName}`);
      },
      update(ref, data) {
        pending.push({ type: "update", ref, data });
      },
      set(ref, data) {
        pending.push({ type: "set", ref, data });
      }
    };

    const result = await callback(transaction);

    if (transactionError) {
      throw transactionError;
    }

    if (retryWithDisposedAsset && transactionAttempts === 1) {
      // Simulate a conflict: discard attempt 1 writes and retry with
      // the asset now disposed.
      assetData = { ...assetData, status: "DISPOSED" };
      return this.runTransaction(callback);
    }

    operations.push(...pending);
    return result;
  }
};

function reset(data, exists = true) {
  assetData = data;
  assetExists = exists;
  transactionError = null;
  retryWithDisposedAsset = false;
  transactionAttempts = 0;
  operations = [];
  custodyQueries = [];
  generatedId = 0;
  cacheInvalidations = [];

  custodyDocs = [
    {
      ref: makeRef("asset_custody_logs", "custody-same-org"),
      data: () => ({ orgId: "org-1" })
    },
    {
      ref: makeRef("asset_custody_logs", "custody-foreign-org"),
      data: () => ({ orgId: "org-2" })
    },
    {
      ref: makeRef("asset_custody_logs", "custody-missing-org"),
      data: () => ({})
    }
  ];
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

async function callDispose({
  id = "asset-123",
  orgId = "org-1",
  role = "admin",
  body = {}
} = {}) {
  const req = {
    params: { id },
    user: {
      role,
      orgId,
      userId: "test-user",
      name: "Test User"
    },
    body: {
      method: "TRANSFER",
      reason: "End-of-life transfer",
      ...body
    }
  };

  const res = makeResponse();
  await disposeAsset(req, res);
  return res;
}

async function main() {
  Module._load = function (request, parent, isMain) {
    if (request === "../config/firebase") {
      return { db: fakeDb, admin: fakeAdmin };
    }

    if (request === "../utils/cache") {
      return {
        delPrefix(prefix) {
          cacheInvalidations.push(prefix);
        }
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve(
      "./src/controllers/disposalController"
    );
    delete require.cache[controllerPath];

    disposeAsset = require(controllerPath).disposeAsset;
    assert.equal(typeof disposeAsset, "function");

    // 1. Successful disposal writes all records in one transaction.
    reset({
      orgId: "org-1",
      status: "ASSIGNED",
      name: "Test asset",
      assetCode: "AST-001",
      custodian: "Test custodian",
      currentValue: 5000
    });

    let res = await callDispose();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.method, "TRANSFER");
    assert.equal(operations.length, 4);
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin"
    ]);

    const assetUpdate = operations.find(
      op => op.type === "update" &&
        op.ref.collectionName === "assets"
    );
    const disposal = operations.find(
      op => op.type === "set" &&
        op.ref.collectionName === "asset_disposals"
    );
    const audit = operations.find(
      op => op.type === "set" &&
        op.ref.collectionName === "asset_audit"
    );
    const custodyUpdates = operations.filter(
      op => op.type === "update" &&
        op.ref.collectionName === "asset_custody_logs"
    );

    assert.ok(assetUpdate);
    assert.ok(disposal);
    assert.ok(audit);
    assert.equal(custodyUpdates.length, 1);
    assert.equal(custodyUpdates[0].ref.id, "custody-same-org");

    assert.equal(custodyQueries.length, 1);
    assert.ok(
      custodyQueries[0].filters.some(
        filter => filter.field === "orgId" &&
          filter.operator === "==" &&
          filter.value === "org-1"
      ),
      "custody query must be scoped to the asset organization"
    );

    assert.equal(assetUpdate.data.status, "DISPOSED");
    assert.equal(assetUpdate.data.previousStatus, "ASSIGNED");
    assert.equal(assetUpdate.data.custodian, null);

    assert.equal(disposal.data.assetId, "asset-123");
    assert.equal(disposal.data.orgId, "org-1");
    assert.equal(disposal.data.previousStatus, "ASSIGNED");
    assert.equal(disposal.data.proceedsAmount, 0);

    assert.equal(audit.data.action, "disposed");
    assert.equal(audit.data.orgId, "org-1");
    assert.equal(audit.data.oldData.status, "ASSIGNED");
    assert.equal(audit.data.newData.status, "DISPOSED");

    for (const op of custodyUpdates) {
      assert.equal(op.data.endDate, timestamp);
    }

    console.log("PASS: disposal, custody closures and audit commit together");

    // 2. A valid decimal proceeds amount is stored as a number.
    reset({
      orgId: "org-1",
      status: "ASSIGNED",
      currentValue: 5000
    });
    res = await callDispose({ body: { proceedsAmount: "250.50" } });

    assert.equal(res.statusCode, 200);
    const decimalDisposal = operations.find(
      op => op.type === "set" &&
        op.ref.collectionName === "asset_disposals"
    );
    assert.ok(decimalDisposal);
    assert.equal(decimalDisposal.data.proceedsAmount, 250.5);
    assert.equal(typeof decimalDisposal.data.proceedsAmount, "number");

    console.log("PASS: valid decimal proceeds are stored as a number");

    // 2. Missing asset is rejected without writes.
    reset(null, false);
    res = await callDispose();

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Asset not found");
    assert.equal(operations.length, 0);

    console.log("PASS: missing asset is rejected without writes");

    // 3. Cross-organization asset remains hidden.
    reset({ orgId: "another-org", status: "ASSIGNED" });
    res = await callDispose();

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Asset not found");
    assert.equal(operations.length, 0);

    console.log("PASS: cross-organization disposal is rejected");

    // 4. Super-admin cannot dispose assets, even across organizations.
reset({
  orgId: "another-org",
  status: "UNASSIGNED",
  name: "Other organisation asset"
});

res = await callDispose({ role: "super-admin" });
assert.equal(res.statusCode, 403);
assert.equal(res.body.success, false);
assert.match(res.body.message, /organization admin/i);
assert.equal(transactionAttempts, 0);
assert.equal(operations.length, 0);
console.log("PASS: super-admin disposal is rejected without writes");

// 4b. Managers cannot dispose assets through direct controller calls.
reset({ orgId: "org-1", status: "ASSIGNED", name: "Test asset" });
res = await callDispose({ role: "manager" });
assert.equal(res.statusCode, 403);
assert.equal(res.body.success, false);
assert.equal(transactionAttempts, 0);
assert.equal(operations.length, 0);
console.log("PASS: manager disposal is rejected without writes");

// 4c. A missing role is also rejected before database operations.
reset({ orgId: "org-1", status: "ASSIGNED", name: "Test asset" });
const req = {
  params: { id: "asset-123" },
  user: { orgId: "org-1", userId: "test-user" },
  body: { method: "TRANSFER", reason: "End-of-life transfer" }
};
const missingRoleRes = makeResponse();
await disposeAsset(req, missingRoleRes);
assert.equal(missingRoleRes.statusCode, 403);
assert.equal(missingRoleRes.body.success, false);
assert.equal(transactionAttempts, 0);
assert.equal(operations.length, 0);
console.log("PASS: missing role is rejected without writes");

// 5. Already-disposed asset cannot be disposed again.
    reset({ orgId: "org-1", status: "DISPOSED" });
    res = await callDispose();

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /already disposed/i);
    assert.equal(operations.length, 0);

    console.log("PASS: already-disposed asset is rejected");

    // 6. Invalid method is rejected without starting a transaction.
    reset({ orgId: "org-1", status: "ASSIGNED" });
    res = await callDispose({ body: { method: "INVALID" } });

    assert.equal(res.statusCode, 400);
    assert.equal(operations.length, 0);

    console.log("PASS: invalid disposal method is rejected");

    // 7. Invalid proceeds amounts are rejected before a transaction.
    for (const invalidAmount of [
      -1,
      "-1",
      "not-a-number",
      "Infinity",
      Infinity,
      -Infinity,
      NaN
    ]) {
      reset({ orgId: "org-1", status: "ASSIGNED" });
      res = await callDispose({
        body: { proceedsAmount: invalidAmount }
      });

      assert.equal(
        res.statusCode,
        400,
        `Expected HTTP 400 for proceedsAmount=${String(invalidAmount)}`
      );
      assert.equal(operations.length, 0);
      assert.equal(transactionAttempts, 0);
    }

    console.log("PASS: invalid proceeds amounts are rejected");

    // 8. Transaction failure must not report success or retain writes.
    reset({
      orgId: "org-1",
      status: "ASSIGNED",
      name: "Test asset"
    });
    transactionError = new Error("simulated transaction failure");

    res = await callDispose();

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(
      res.body.message,
      "simulated transaction failure"
    );
    assert.equal(operations.length, 0);
    assert.deepEqual(cacheInvalidations, []);

    console.log("PASS: transaction failure does not report success");

    // 9. A retry sees the asset as disposed and commits no duplicate writes.
    reset({
      orgId: "org-1",
      status: "ASSIGNED",
      name: "Retry test asset",
      assetCode: "AST-RETRY"
    });
    retryWithDisposedAsset = true;

    res = await callDispose();

    assert.equal(transactionAttempts, 2);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already disposed/i);
    assert.equal(operations.length, 0);

    console.log("PASS: retry rejects an asset disposed before the second attempt");
    console.log("All asset disposal regression tests passed.");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
