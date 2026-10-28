const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const timestamp = { seconds: 1234567890 };

const custodyRecords = [
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-same-org" },
    data: () => ({ assetId: "asset-1", orgId: "org-1", endDate: null })
  },
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-other-org" },
    data: () => ({ assetId: "asset-1", orgId: "org-2", endDate: null })
  },
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-missing-org" },
    data: () => ({ assetId: "asset-1", endDate: null })
  }
];

const assetData = {
  orgId: "org-1",
  name: "Test Asset",
  department: "ICT",
  status: "UNASSIGNED",
  checkedOut: false
};

const batchOperations = [];
let auditWrites = 0;
let notificationCalls = 0;
let newCustodyId = 0;

const fakeFirebase = {
  admin: {
    firestore: {
      Timestamp: {
        now: () => timestamp,
        fromDate: date => ({ date })
      }
    }
  },
  db: {
    collection(name) {
      return {
        doc(id) {
          const ref = {
            collectionName: name,
            id: id || `new-custody-${++newCustodyId}`
          };

          if (name === "assets") {
            ref.get = async () => ({
              exists: true,
              data: () => assetData
            });
          }

          if (name === "users") {
            ref.get = async () => ({
              exists: id === "user-same-org",
              data: () => ({
                orgId: "org-1",
                name: "Jane Wanjiku",
                userStatus: "active"
              })
            });
          }

          return ref;
        },

        where() {
          return {
            where() {
              return this;
            },
            get: async () => ({ docs: custodyRecords })
          };
        },

        async add(data) {
          auditWrites += 1;
          return { id: `audit-${auditWrites}`, data };
        }
      };
    },

    batch() {
      const pending = [];

      return {
        update(ref, data) {
          pending.push({ type: "update", ref, data });
        },
        set(ref, data) {
          pending.push({ type: "set", ref, data });
        },
        async commit() {
          batchOperations.push(...pending);
        }
      };
    }
  }
};

async function main() {
  Module._load = function (request, parent, isMain) {
    if (request === "../config/firebase") return fakeFirebase;

    if (request === "./notificationController") {
      return {
        createNotification: async () => {
          notificationCalls += 1;
        }
      };
    }

    if (request === "../utils/validateCustodian") {
      return async () => ({ ok: true });
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve(
      "./src/controllers/checkInOutController"
    );
    delete require.cache[controllerPath];

    const { checkOut } = require(controllerPath);

    const req = {
      params: { id: "asset-1" },
      body: {
        custodianId: "user-same-org",
        custodianName: "Jane Wanjiku"
      },
      user: {
        userId: "manager-1",
        name: "Test Manager",
        role: "manager",
        orgId: "org-1"
      }
    };

    const res = {
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

    await checkOut(req, res);

    assert.equal(res.statusCode, 200, "Checkout should succeed");
    assert.equal(res.body.success, true);

    const updatedCustodyIds = batchOperations
      .filter(operation =>
        operation.type === "update" &&
        operation.ref.collectionName === "asset_custody_logs"
      )
      .map(operation => operation.ref.id)
      .sort();

    assert.deepEqual(
      updatedCustodyIds,
      ["custody-same-org"],
      "Checkout must close only custody records belonging to the asset's organization"
    );

    assert(
      batchOperations.some(operation =>
        operation.type === "set" &&
        operation.ref.collectionName === "asset_custody_logs" &&
        operation.data.orgId === "org-1"
      ),
      "Checkout should create a new custody record for the asset's organization"
    );

    assert(
      batchOperations.some(operation =>
        operation.ref.collectionName === "assets" &&
        operation.ref.id === "asset-1" &&
        operation.data.checkedOut === true
      ),
      "Checkout should mark the asset as checked out"
    );

    assert.equal(auditWrites, 1, "One audit event should be written");
    assert.equal(notificationCalls, 1, "One notification should be sent");

    console.log("PASS: checkout completes and creates the new custody record");
    console.log("PASS: only same-org custody record is closed");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
