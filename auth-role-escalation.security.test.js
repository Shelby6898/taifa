const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const Module = require("node:module");

const testSecret = "test-only-role-security-secret-2026";
process.env.JWT_SECRET = testSecret;

const originalLoad = Module._load;
const firebasePath = require.resolve("./src/config/firebase");
const controllerPath = require.resolve("./src/controllers/auth/authController");
const routesPath = require.resolve("./src/routes/auth");

const testFirestoreTimestamp = {
  toDate: () => new Date("2026-10-23T00:00:00.000Z"),
};

const users = new Map([
  ["tenant-user", {
    name: "Tenant User",
    email: "tenant@example.test",
    passwordHash: "unused",
    role: "viewer",
    department: "ICT",
    orgId: "org-a",
    userStatus: "active",
  }],
  ["other-org-user", {
    name: "Other Organization User",
    email: "other@example.test",
    passwordHash: "unused",
    role: "viewer",
    department: "ICT",
    orgId: "org-b",
    userStatus: "active",
  }],
]);

const auditEntries = [];
let writes = 0;
let nextId = 1;

const timestamp = {
  now: () => ({
    toDate: () => new Date(),
  }),
};


function makeSnapshot(id, data) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
  };
}

const fakeDb = {
  collection(name) {
    if (name === "users") {
      return {
        where(field, operator, value) {
          assert.equal(operator, "==");
          return {
            async get() {
              const docs = [...users.entries()]
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => makeSnapshot(id, data));
              return { empty: docs.length === 0, docs };
            },
          };
        },

        async get() {
          return {
            docs: [...users.entries()].map(([id, data]) =>
              makeSnapshot(id, data)
            ),
          };
        },

        doc(id) {
          return {
            async get() {
              return makeSnapshot(id, users.get(id));
            },

            async update(changes) {
              writes++;
              const existing = users.get(id);
              if (!existing) throw new Error("User not found");
              users.set(id, { ...existing, ...changes });
            },

            async delete() {
              writes++;
              users.delete(id);
            },
          };
        },

        async add(data) {
          writes++;
          const id = `new-user-${nextId++}`;
          users.set(id, { ...data });
          return { id };
        },
      };
    }

    if (name === "user_audit") {
      return {
        async add(data) {
          writes++;
          auditEntries.push(data);
          return { id: `audit-${auditEntries.length}` };
        },
      };
    }

    throw new Error(`Unexpected collection in test: ${name}`);
  },
};

const fakeFirebase = {
  db: fakeDb,
  admin: {
    firestore: {
      Timestamp: timestamp,
    },
  },
};

Module._load = function (request, parent, isMain) {
  if (
    parent &&
    parent.filename === controllerPath &&
    request === "../../config/firebase"
  ) {
    return fakeFirebase;
  }

  if (
    parent &&
    parent.filename === controllerPath &&
    request === "../../services/email"
  ) {
    return { sendEmail: async () => ({ success: true }) };
  }

  if (
    parent &&
    parent.filename === firebasePath &&
    request === "firebase-admin"
  ) {
    throw new Error("Firebase SDK must not load in this test");
  }

  return originalLoad.apply(this, arguments);
};

function token(
  role,
  userId = `test-${role}`,
  orgId = "org-a",
  ...departmentArg
) {
  const claims = {
    userId,
    role,
    orgId,
    name: `Test ${role}`,
  };

  // Omitted department argument defaults to ICT.
  // Explicit undefined means intentionally omit the JWT claim.
  const department = departmentArg.length === 0
    ? "ICT"
    : departmentArg[0];

  if (department !== undefined) claims.department = department;

  return jwt.sign(claims, testSecret, { expiresIn: "5m" });
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("./src/routes/auth"));

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];

  async function request(name, method, path, role, body, expectedStatus, expectedWrites) {
    const beforeWrites = writes;

    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token(role)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body || {}),
      });

      const responseBody = await response.json();
      assert.equal(response.status, expectedStatus, name);
      assert.equal(writes - beforeWrites, expectedWrites, `${name}: write count`);

      results.push(`PASS: ${name}`);
      return responseBody;
    } catch (error) {
      results.push(`FAIL: ${name} — ${error.message}`);
      return null;
    }
  }

  try {
    await request(
      "registration rejects super-admin role",
      "POST", "/api/auth/register", "admin",
      { name: "Escalation", email: "escalate@example.test",
        password: "Test-Password-123!", role: "super-admin" },
      400, 0
    );

    await request(
      "registration rejects unknown role",
      "POST", "/api/auth/register", "admin",
      { name: "Unknown", email: "unknown@example.test",
        password: "Test-Password-123!", role: "owner" },
      400, 0
    );

    const registered = await request(
      "registration accepts viewer role",
      "POST", "/api/auth/register", "admin",
      { name: "New Viewer", email: "new-viewer@example.test",
        password: "Test-Password-123!", role: "viewer", department: "ICT" },
      201, 2
    );

    if (registered?.userId) {
      assert.equal(users.get(registered.userId)?.role, "viewer");
    } else {
      results.push("FAIL: registered user has expected viewer role");
    }

    await request(
      "update rejects super-admin promotion without writes",
      "PUT", "/api/auth/users/tenant-user", "admin",
      { role: "super-admin" },
      400, 0
    );

    await request(
      "update rejects unknown role without writes",
      "PUT", "/api/auth/users/tenant-user", "admin",
      { role: "owner" },
      400, 0
    );

    await request(
      "update rejects cross-organization user",
      "PUT", "/api/auth/users/other-org-user", "admin",
      { role: "manager" },
      404, 0
    );

    await request(
      "update accepts valid manager role",
      "PUT", "/api/auth/users/tenant-user", "admin",
      { role: "manager" },
      200, 2
    );

    assert.equal(users.get("tenant-user").role, "manager");

    await request(
      "super-admin cannot register through write route",
      "POST", "/api/auth/register", "super-admin",
      { name: "Blocked", email: "blocked@example.test",
        password: "Test-Password-123!", role: "viewer" },
      403, 0
    );

    // User-listing coverage: tenant, department, and oversight boundaries.
    users.set("finance-user", {
      name: "Finance User",
      email: "finance@example.test",
      passwordHash: "unused",
      role: "viewer",
      department: "Finance",
      orgId: "org-a",
      userStatus: "active",
    });

    async function listUsers(name, role, orgId, department, expectedEmails) {
      const response = await fetch(`${base}/api/auth/users`, {
        headers: { authorization: `Bearer ${token(role, `test-${name}`, orgId, department)}` },
      });
      const body = await response.json();

      assert.equal(
        response.status,
        200,
        `${name}: status; response body: ${JSON.stringify(body)}`
      );
      assert.deepEqual(
        body.data.map((user) => user.email).sort(),
        expectedEmails.slice().sort(),
        `${name}: visible users`
      );
      results.push(`PASS: ${name}`);
    }

    await listUsers(
      "admin sees only own organization",
      "admin", "org-a", "ICT",
      ["tenant@example.test", "finance@example.test", "new-viewer@example.test"]
    );

    await listUsers(
      "manager sees only own department",
      "manager", "org-a", "ICT",
      ["tenant@example.test", "new-viewer@example.test"]
    );

    await listUsers(
      "super-admin can see users across organizations",
      "super-admin", "org-a", "ICT",
      ["tenant@example.test", "other@example.test", "finance@example.test", "new-viewer@example.test"]
    );

    // Managers without a department must be denied user-list access.
    const missingDepartmentResponse = await fetch(`${base}/api/auth/users`, {
      headers: {
        authorization: `Bearer ${token(
          "manager", "test-manager-without-department", "org-a", undefined
        )}`,
      },
    });
    const missingDepartmentBody = await missingDepartmentResponse.json();

    assert.equal(
      missingDepartmentResponse.status,
      403,
      `manager without department: status; body: ${JSON.stringify(missingDepartmentBody)}`
    );
    assert.equal(
      missingDepartmentBody.message,
      "Manager department is required",
      "manager without department: error message"
    );
    results.push("PASS: manager without department is denied user listing");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Module._load = originalLoad;
  }

  console.log("\n===== AUTH ROLE-ESCALATION SECURITY TESTS =====");
  results.forEach((result) => console.log(result));
  const failures = results.filter((result) => result.startsWith("FAIL:"));
  console.log(`\n${results.length - failures.length}/${results.length} tests passed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  Module._load = originalLoad;
  console.error("Test setup failed:", error);
  process.exitCode = 1;
});
