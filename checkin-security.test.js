const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

const timestamp = { seconds: 1234567890 };
const custodyRecords = [
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-same-org" },
    data() {
      return { assetId: "asset-1", orgId: "org-1", endDate: null };
    }
  },
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-other-org" },
    data() {
      return { assetId: "asset-1", orgId: "org-2", endDate: null };
    }
  },
  {
    ref: { collectionName: "asset_custody_logs", id: "custody-missing-org" },
    data() {
      return { assetId: "asset-1", endDate: null };
    }
  }
];

const assetData = {
  orgId: "org-1",
  name: "Test Asset",
  department: "ICT",
  status: "ASSIGNED",
  custodian: "Jane Wanjiku",
  custodianId: "same-org",
  checkedOut: true
};

const batchOperations = [];
let auditWrites = 0;
let notificationCalls = 0;

const fakeFirebase = {
  admin: {
    firestore: {
      Timestamp: {
        now: () => timestamp
      }
    }
  },
  db: {
    collection(name) {
      return {
        doc(id) {
          const ref = {
            collectionName: name,
            id
          };

          if (name === "assets") {
            ref.get = async () => ({
              exists: true,
              data: () => assetData
            });
          }

          return ref;
        },

        where() {
          return {
            where() {
              return this;
            },
            get: async () => ({
              docs: custodyRecords
            })
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

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controllerPath = require.resolve(
      "./src/controllers/checkInOutController"
    );
    delete require.cache[controllerPath];

    const { checkIn } = require(controllerPath);

    const req = {
      params: { id: "asset-1" },
      body: { condition: "GOOD", notes: "Returned to store" },
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

    await checkIn(req, res);

    assert.equal(res.statusCode, 200, "Check-in should succeed");
    assert.equal(res.body.success, true);

    const updatedCustodyIds = batchOperations
      .filter(
        operation =>
          operation.ref.collectionName === "asset_custody_logs"
      )
      .map(operation => operation.ref.id)
      .sort();

    assert.deepEqual(
      updatedCustodyIds,
      ["custody-same-org"],
      "Check-in must update only custody records belonging to the asset's organization"
    );

    assert(
      batchOperations.some(
        operation =>
          operation.ref.collectionName === "assets" &&
          operation.ref.id === "asset-1" &&
          operation.data.checkedOut === false
      ),
      "The asset should be marked as checked in"
    );

    assert.equal(auditWrites, 1, "One audit event should be written");
    assert.equal(notificationCalls, 1, "One notification should be sent");

    console.log("PASS: check-in succeeds for the asset's organization");
    console.log("PASS: same-org open custody record is closed");
    console.log("PASS: foreign-org custody record is not modified");
    console.log("PASS: asset check-in, audit, and notification are preserved");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
