const assert = require("node:assert/strict");
const validateCustodian = require("./src/utils/validateCustodian");

const users = {
  "user-same-org": {
    orgId: "org-1",
    name: "Jane Wanjiku",
    userStatus: "active"
  },
  "user-other-org": {
    orgId: "org-2",
    name: "John Kamau",
    userStatus: "active"
  },
  "user-inactive": {
    orgId: "org-1",
    name: "Inactive User",
    userStatus: "inactive"
  },
  "user-blocked": {
    orgId: "org-1",
    name: "Blocked User",
    userStatus: "blocked"
  },
  "user-legacy": {
    orgId: "org-1",
    name: "Legacy User"
  }
};

let userReads;

const fakeDb = {
  collection(name) {
    assert.equal(name, "users");

    return {
      doc(id) {
        return {
          async get() {
            userReads += 1;
            const user = users[id];

            return {
              exists: Boolean(user),
              data: () => user
            };
          }
        };
      }
    };
  }
};

const asset = { id: "asset-1", orgId: "org-1" };

async function check(name, fn) {
  await fn();
  console.log(`PASS: ${name}`);
}

async function main() {
  userReads = 0;
  await check("accepts active custodian in the same organization", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-same-org", "Jane Wanjiku"
    );
    assert.equal(result.ok, true);
  });

  await check("rejects a custodian from another organization", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-other-org", "John Kamau"
    );
    assert.equal(result.ok, false);
  });

  await check("rejects a nonexistent user", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "missing-user", "Unknown User"
    );
    assert.equal(result.ok, false);
  });

  await check("rejects an inactive user", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-inactive", "Inactive User"
    );
    assert.equal(result.ok, false);
  });

  await check("rejects a blocked user", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-blocked", "Blocked User"
    );
    assert.equal(result.ok, false);
  });

  await check("rejects a name that does not match the user profile", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-same-org", "Someone Else"
    );
    assert.equal(result.ok, false);
  });

  await check("accepts a legacy user with no status field", async () => {
    const result = await validateCustodian(
      fakeDb, asset, "user-legacy", "Legacy User"
    );
    assert.equal(result.ok, true);
  });

  await check("rejects an asset without an organization", async () => {
    const before = userReads;
    const result = await validateCustodian(
      fakeDb, { id: "asset-no-org" }, "user-same-org", "Jane Wanjiku"
    );
    assert.equal(result.ok, false);
    assert.equal(userReads, before, "Should reject before looking up a user");
  });

  await check("rejects a blank custodian name", async () => {
    const before = userReads;
    const result = await validateCustodian(
      fakeDb, asset, "user-same-org", "   "
    );
    assert.equal(result.ok, false);
    assert.equal(userReads, before, "Should reject before looking up a user");
  });

  console.log("\n9/9 validator security tests passed.");
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
