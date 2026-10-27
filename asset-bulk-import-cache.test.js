const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let commitCalls;
let failCommitAt;
let failNotification;
let committedBatchSizes;
let cacheInvalidations;
let nextDocId;

const fakeCache = {
  delPrefix(prefix) {
    cacheInvalidations.push(prefix);
  }
};

const fakeAdmin = {
  firestore: {
    Timestamp: {
      now: () => ({ seconds: 123 }),
      fromDate: (date) => ({ date })
    }
  }
};

const fakeDb = {
  collection(name) {
    if (name === "assets") {
      return {
        doc() {
          return { id: `asset-${++nextDocId}` };
        }
      };
    }

    if (name === "asset_audit") {
      return {
        async add() {
          return { id: "audit-1" };
        }
      };
    }

    throw new Error(`Unexpected collection: ${name}`);
  },

  batch() {
    const operations = [];

    return {
      set(ref, data) {
        operations.push({ ref, data });
      },

      async commit() {
        commitCalls++;

        if (commitCalls === failCommitAt) {
          throw new Error(`Simulated commit failure ${commitCalls}`);
        }

        committedBatchSizes.push(operations.length);
      }
    };
  }
};

const fakeFirebase = {
  db: fakeDb,
  admin: fakeAdmin
};

function makeSheet(assetCount) {
  const headers = [
    "type",
    "name",
    "ward",
    "department",
    "value"
  ];

  return {
    rowCount: assetCount + 1,

    getRow(rowNumber) {
      if (rowNumber === 1) {
        return {
          eachCell(callback) {
            headers.forEach((value, index) => {
              callback({ value }, index + 1);
            });
          }
        };
      }

      const values = [
        "Equipment",
        `Asset ${rowNumber - 1}`,
        "Ward 1",
        "Revenue",
        100
      ];

      return {
        getCell(columnNumber) {
          return { value: values[columnNumber - 1] ?? null };
        }
      };
    }
  };
}

let assetCountForWorkbook = 1;

class FakeWorkbook {
  constructor() {
    this.worksheets = [makeSheet(assetCountForWorkbook)];
    this.xlsx = {
      async load() {}
    };
  }
}

Module._load = function (request, parent, isMain) {
  if (request === "../config/firebase") return fakeFirebase;
  if (request === "../utils/cache") return fakeCache;
  if (request === "../services/assetCodeGenerator") {
    return () => "TEST-ASSET-CODE";
  }
  if (request === "./notificationController") {
    return {
      createNotification: async () => {
        if (failNotification) {
          throw new Error("Simulated notification failure");
        }
      }
    };
  }
  if (request === "exceljs") {
    return { Workbook: FakeWorkbook };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const controllerPath = require.resolve("./src/controllers/assetController");
delete require.cache[controllerPath];

const { bulkImportAssets } = require(controllerPath);

function reset(assetCount, failingCommit = null, notificationFailure = false) {
  assetCountForWorkbook = assetCount;
  commitCalls = 0;
  failCommitAt = failingCommit;
  failNotification = notificationFailure;
  committedBatchSizes = [];
  cacheInvalidations = [];
  nextDocId = 0;
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

async function runImport(assetCount, failingCommit = null, notificationFailure = false) {
  reset(assetCount, failingCommit, notificationFailure);

  const req = {
    file: { buffer: Buffer.from("mock-workbook") },
    user: {
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
      name: "Test Admin"
    }
  };

  const res = makeResponse();
  await bulkImportAssets(req, res);

  return res;
}

async function main() {
  const originalConsoleError = console.error;

  try {
    // Case 1: The final, partial batch succeeds.
    let res = await runImport(3);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.imported, 3);
    assert.deepEqual(committedBatchSizes, [3]);
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin"
    ]);
    console.log("PASS: successful final batch invalidates both summaries");

    // Case 2: 400 assets in the first batch, 1 in the final batch.
    res = await runImport(401);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.imported, 401);
    assert.deepEqual(committedBatchSizes, [400, 1]);
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin",
      "summary:org-1",
      "summary:super-admin"
    ]);
    console.log("PASS: both successful batches invalidate both summaries");

    // Case 3: The first commit fails; it must not invalidate either summary.
    console.error = () => {};
    res = await runImport(401, 1);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.assetsCommitted, 0);
    assert.equal(res.body.workflowCompleted, false);
    assert.equal(commitCalls, 1);
    assert.deepEqual(committedBatchSizes, []);
    assert.deepEqual(cacheInvalidations, []);
    console.log("PASS: failed first commit reports zero committed assets and does not invalidate summaries");

    // Case 4: First batch commits, but the second batch fails.
    console.error = () => {};
    res = await runImport(401, 2);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.assetsCommitted, 400);
    assert.equal(res.body.workflowCompleted, false);
    assert.equal(commitCalls, 2);
    assert.deepEqual(committedBatchSizes, [400]);
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin"
    ]);
    console.log("PASS: earlier committed batch invalidates summaries when a later batch fails");

    // Case 5: Assets commit successfully, but notification creation fails.
    console.error = () => {};
    res = await runImport(3, null, true);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.assetsCommitted, 3);
    assert.equal(res.body.workflowCompleted, false);
    assert.deepEqual(committedBatchSizes, [3]);
    assert.deepEqual(cacheInvalidations, [
      "summary:org-1",
      "summary:super-admin"
    ]);
    console.log("PASS: notification failure reports all committed assets and preserves cache invalidation");

    console.log("\nAll bulk-import cache regression tests passed.");
  } finally {
    console.error = originalConsoleError;
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
