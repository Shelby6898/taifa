const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
let orgQuery = null;
let allQueryCount = 0;
let orgDocs = [];
let allDocs = [];

const fakeDb = {
  collection(name) {
    assert.equal(name, "asset_disposals");

    return {
      where(field, operator, value) {
        orgQuery = { field, operator, value };
        return {
          async get() {
            return { docs: orgDocs };
          }
        };
      },
      async get() {
        allQueryCount++;
        return { docs: allDocs };
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

function doc(id, data) {
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
        admin: {
          firestore: { Timestamp: { now: () => ({ seconds: 1 }) } }
        }
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
    const path = require.resolve("./src/controllers/disposalController");
    delete require.cache[path];
    const { getOrgDisposals } = require(path);

    orgDocs = [
      doc("d1", {
        orgId: "org-1",
        method: "TRANSFER",
        valueAtDisposal: 100,
        proceedsAmount: 20,
        disposedAt: { _seconds: 20 }
      })
    ];

    allDocs = [
      ...orgDocs,
      doc("d2", {
        orgId: "org-2",
        method: "SALE",
        valueAtDisposal: 200,
        proceedsAmount: 50,
        disposedAt: { _seconds: 10 }
      })
    ];

    orgQuery = null;
    allQueryCount = 0;

    let res = makeResponse();
    await getOrgDisposals(
      { user: { role: "admin", orgId: "org-1" } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(orgQuery, {
      field: "orgId",
      operator: "==",
      value: "org-1"
    });
    assert.equal(res.body.count, 1);
    assert.deepEqual(res.body.data.map(d => d.orgId), ["org-1"]);
    assert.equal(allQueryCount, 0);
    console.log("PASS: admin reads only their own organization's disposals");

    orgQuery = null;
    allQueryCount = 0;

    res = makeResponse();
    await getOrgDisposals(
      { user: { role: "super-admin", orgId: null } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(allQueryCount, 1);
    assert.equal(res.body.count, 2);
    assert.deepEqual(
      res.body.data.map(d => d.orgId).sort(),
      ["org-1", "org-2"]
    );
    assert.equal(res.body.summary.totalValueDisposed, 300);
    assert.equal(res.body.summary.totalProceeds, 70);
    console.log("PASS: super-admin reads disposals across organizations");

    console.log("\n2/2 organization-wide disposal read tests passed.");
  } finally {
    Module._load = originalLoad;
    delete require.cache[
      require.resolve("./src/controllers/disposalController")
    ];
  }
}

main().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
