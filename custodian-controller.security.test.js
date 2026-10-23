const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let assetData;
let userData;
let custodyRecords;
let batchCreations;
let batchCommits;
let batchOperations;
let auditWrites;
let cacheInvalidations;
let notificationCalls;
let generatedId;

const timestamp = { seconds: 1234567890 };

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
            id: id || `${name}-generated-${++generatedId}`
          };

          if (name === "assets") {
            ref.get = async () => ({
              exists: Boolean(assetData),
              data: () => assetData
            });
          }

          if (name === "users") {
            ref.get = async () => ({
              exists: Boolean(userData[id]),
              data: () => userData[id]
            });
          }

          return ref;
        },

        where(field, operator, value) {
          const filters = [{ field, operator, value }];
          return {
            where(nextField, nextOperator, nextValue) {
              filters.push({
                field: nextField,
                operator: nextOperator,
                value: nextValue
              });
              return this;
            },
            async get() {
              const docs = custodyRecords
                .filter(record => filters.every(filter =>
                  filter.operator === "==" &&
                  record.data[filter.field] === filter.value
                ))
                .map(record => ({
                  id: record.ref.id,
                  ref: record.ref,
                  data: () => record.data
                }));
              return { docs };
            }
          };
        },

        async add(data) {
          auditWrites += 1;
          return { id: `${name}-audit-${auditWrites}`, data };
        }
      };
    },

    batch() {
      batchCreations += 1;
      const pending = [];

      return {
        set(ref, data) {
          pending.push({ type: "set", ref, data });
        },
        update(ref, data) {
          pending.push({ type: "update", ref, data });
        },
        async commit() {
          batchCommits += 1;
          batchOperations.push(...pending);
          for (const operation of pending) {
            if (operation.type === "update" && operation.ref.recordData) {
              Object.assign(operation.ref.recordData, operation.data);
            }
          }
        }
      };
    }
  }
};

const fakeCache = {
  delPrefix(prefix) {
    cacheInvalidations.push(prefix);
  }
};

function addCustodyRecord(data) {
  const record = { data, ref: null };
  record.ref = {
    collectionName: "asset_custody_logs",
    id: `custody-${custodyRecords.length + 1}`,
    recordData: data
  };
  custodyRecords.push(record);
  return record;
}

function reset(asset) {
  assetData = asset;
  custodyRecords = [];
  userData = {
    "same-org": {
      orgId: "org-1",
      name: "Jane Wanjiku",
      userStatus: "active"
    },
    "other-org": {
      orgId: "org-2",
      name: "John Kamau",
      userStatus: "active"
    }
  };
  batchCreations = 0;
  batchCommits = 0;
  batchOperations = [];
  auditWrites = 0;
  cacheInvalidations = [];
  notificationCalls = 0;
  generatedId = 0;
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

async function invoke(handler, body) {
  const req = {
    params: { id: "asset-1" },
    user: {
      userId: "manager-1",
      name: "Test Manager",
      role: "manager",
      orgId: "org-1"
    },
    body
  };

  const res = makeResponse();
  await handler(req, res);
  return res;
}

function assertNoWrites() {
  assert.equal(batchCreations, 0, "No batch should be created");
  assert.equal(batchCommits, 0, "No batch should be committed");
  assert.equal(batchOperations.length, 0, "No batch writes should occur");
  assert.equal(auditWrites, 0, "No audit event should be written");
  assert.equal(cacheInvalidations.length, 0, "Cache should not be invalidated");
  assert.equal(notificationCalls, 0, "No notification should be sent");
}

async function main() {
  let assignCustodian;
  let releaseCustodian;
  let getCustodyLog;
  let reallocateCustodian;
  let checkOut;

  Module._load = function (request, parent, isMain) {
    if (request === "../config/firebase") return fakeFirebase;
    if (request === "../utils/cache") return fakeCache;
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
    const custodyPath = require.resolve("./src/controllers/custodyController");
    const checkoutPath = require.resolve("./src/controllers/checkInOutController");
    delete require.cache[custodyPath];
    delete require.cache[checkoutPath];

    ({
      assignCustodian,
      releaseCustodian,
      getCustodyLog,
      reallocateCustodian
    } = require(custodyPath));
    ({ checkOut } = require(checkoutPath));

    const cases = [
      {
        name: "assignment",
        handler: assignCustodian,
        body: {
          custodianId: "other-org",
          custodianName: "John Kamau",
          purpose: "Testing"
        },
        asset: { orgId: "org-1", status: "UNASSIGNED" }
      },
      {
        name: "reallocation",
        handler: reallocateCustodian,
        body: {
          newCustodianId: "other-org",
          newCustodianName: "John Kamau",
          reason: "Testing"
        },
        asset: {
          orgId: "org-1",
          status: "ASSIGNED",
          custodian: "Previous Custodian",
          custodianId: "old-user"
        }
      },
      {
        name: "checkout",
        handler: checkOut,
        body: {
          custodianId: "other-org",
          custodianName: "John Kamau",
          purpose: "Testing"
        },
        asset: {
          orgId: "org-1",
          status: "UNASSIGNED",
          name: "Test Asset",
          department: "ICT",
          checkedOut: false
        }
      }
    ];

    for (const test of cases) {
      reset(test.asset);
      const res = await invoke(test.handler, test.body);

      assert.equal(res.statusCode, 400, `${test.name}: expected HTTP 400`);
      assert.equal(res.body.success, false);
      assertNoWrites();
      console.log(`PASS: ${test.name} rejects cross-org custodian without writes`);
    }

    const validCases = [
      {
        name: "assignment",
        handler: assignCustodian,
        body: {
          custodianId: "same-org",
          custodianName: "Jane Wanjiku",
          purpose: "Valid assignment"
        },
        asset: { orgId: "org-1", status: "UNASSIGNED" }
      },
      {
        name: "reallocation",
        handler: reallocateCustodian,
        body: {
          newCustodianId: "same-org",
          newCustodianName: "Jane Wanjiku",
          reason: "Valid reallocation"
        },
        asset: {
          orgId: "org-1",
          status: "ASSIGNED",
          custodian: "Previous Custodian",
          custodianId: "old-user"
        }
      },
      {
        name: "checkout",
        handler: checkOut,
        body: {
          custodianId: "same-org",
          custodianName: "Jane Wanjiku",
          purpose: "Valid checkout"
        },
        asset: {
          orgId: "org-1",
          status: "UNASSIGNED",
          name: "Test Asset",
          department: "ICT",
          checkedOut: false
        }
      }
    ];

    for (const test of validCases) {
      reset(test.asset);
      const res = await invoke(test.handler, test.body);

      assert.equal(res.statusCode, 200, `${test.name}: expected HTTP 200`);
      assert.equal(res.body.success, true);
      assert.equal(batchCreations, 1);
      assert.equal(batchCommits, 1);
      assert.ok(batchOperations.length >= 2);
      assert.equal(auditWrites, 1);

      if (test.name === "checkout") {
        assert.equal(notificationCalls, 1);
      } else {
        assert.deepEqual(cacheInvalidations, ["summary:org-1"]);
      }

      console.log(`PASS: ${test.name} accepts same-org custodian`);
    }

    for (const test of [
    {
      name: "assignment",
      handler: assignCustodian,
      body: {
        custodianId: "same-org",
        custodianName: "Jane Wanjiku",
        purpose: "Tenant isolation test"
      },
      asset: { orgId: "org-1", status: "UNASSIGNED" }
    },
    {
      name: "reallocation",
      handler: reallocateCustodian,
      body: {
        newCustodianId: "same-org",
        newCustodianName: "Jane Wanjiku",
        reason: "Tenant isolation test"
      },
      asset: {
        orgId: "org-1",
        status: "ASSIGNED",
        custodian: "Previous Custodian",
        custodianId: "old-user"
      }
    }
  ]) {
    reset(test.asset);

    const sameOrg = addCustodyRecord({
      assetId: "asset-1",
      orgId: "org-1",
      endDate: null
    });
    const foreignOrg = addCustodyRecord({
      assetId: "asset-1",
      orgId: "org-2",
      endDate: null
    });

    const res = await invoke(test.handler, test.body);
    assert.equal(res.statusCode, 200, `${test.name}: expected HTTP 200`);
    assert.notEqual(sameOrg.data.endDate, null,
      `${test.name}: same-org custody record should close`);
    assert.equal(foreignOrg.data.endDate, null,
      `${test.name}: foreign-org custody record must remain open`);

    console.log(`PASS: ${test.name} preserves foreign-org custody record`);
  }

  reset({
  orgId: "org-1",
  status: "ASSIGNED",
  custodian: "Jane Wanjiku",
  custodianId: "same-org"
});

const releaseSameOrg = addCustodyRecord({
  assetId: "asset-1",
  orgId: "org-1",
  endDate: null
});

const releaseForeignOrg = addCustodyRecord({
  assetId: "asset-1",
  orgId: "org-2",
  endDate: null
});

const releaseRes = await invoke(releaseCustodian);

assert.equal(releaseRes.statusCode, 200, "release should succeed");
assert.notEqual(
  releaseSameOrg.data.endDate,
  null,
  "release should close same-org custody"
);
assert.equal(
  releaseForeignOrg.data.endDate,
  null,
  "release must not close foreign-org custody"
);

console.log("PASS: release preserves foreign-org custody record");

reset({ orgId: "org-1", status: "ASSIGNED" });

const historySameOrg = addCustodyRecord({
  assetId: "asset-1",
  orgId: "org-1",
  startDate: { _seconds: 2 },
  endDate: null,
  custodianName: "Jane Wanjiku"
});

addCustodyRecord({
  assetId: "asset-1",
  orgId: "org-2",
  startDate: { _seconds: 1 },
  endDate: null,
  custodianName: "John Kamau"
});

const historyRes = await invoke(getCustodyLog);

assert.equal(historyRes.statusCode, 200, "history request should succeed");
assert.equal(historyRes.body.count, 1, "history must exclude foreign-org custody records");
assert.equal(historyRes.body.data[0].id, historySameOrg.ref.id);
assert.equal(historyRes.body.data[0].orgId, "org-1");

console.log("PASS: custody history excludes foreign-org records");

console.log("\\n10/10 controller regression tests passed.");
  } finally {
    Module._load = originalLoad;
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
