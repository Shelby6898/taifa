const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("node:path");
const Module = require("node:module");

const testSecret = "test-only-login-secret-2026";
process.env.JWT_SECRET = testSecret;

const firebasePath = require.resolve("./src/config/firebase");
const originalLoad = Module._load;

const fakeUsers = {
  "test@example.com": {
    id: "test-user-1",
    name: "Test User",
    email: "test@example.com",
    passwordHash: bcrypt.hashSync("Correct-Test-Password-123!", 4),
    role: "viewer",
    department: "IT",
    orgId: "test-org",
    userStatus: "active",
    loginAttempts: 0
  },
  "disabled@example.com": {
    id: "disabled-user",
    name: "Disabled User",
    email: "disabled@example.com",
    passwordHash: bcrypt.hashSync("Correct-Test-Password-123!", 4),
    role: "viewer",
    department: "IT",
    orgId: "test-org",
    userStatus: "disabled",
    loginAttempts: 0
  },
  "lockout@example.com": {
    id: "lockout-user",
    name: "Lockout Test User",
    email: "lockout@example.com",
    passwordHash: bcrypt.hashSync("Correct-Test-Password-123!", 4),
    role: "viewer",
    department: "IT",
    orgId: "test-org",
    userStatus: "active",
    loginAttempts: 0
  }
};

const fakeDb = {
  collection(name) {
    assert.equal(name, "users");
    return {
      where(field, operator, value) {
        assert.equal(field, "email");
        assert.equal(operator, "==");
        return {
          async get() {
            const user = fakeUsers[value];
            return {
              empty: !user,
              docs: user ? [{
                id: user.id,
                data: () => user
              }] : []
            };
          }
        };
      },
      doc(id) {
        return {
          async get() {
            const user = Object.values(fakeUsers).find(u => u.id === id);
            return {
              id,
              exists: Boolean(user),
              data: () => user
            };
          },
          async update(changes) {
            const user = Object.values(fakeUsers).find(u => u.id === id);
            if (user) Object.assign(user, changes);
          }
        };
      }
    };
  }
};

const fakeFirebase = {
  db: fakeDb,
  admin: {
    firestore: {
      Timestamp: {
        now: () => ({ toDate: () => new Date() })
      }
    }
  }
};

Module._load = function(request, parent, isMain) {
  if (parent && parent.filename === firebasePath &&
      request === "firebase-admin") {
    throw new Error("Unexpected Firebase SDK load in login test");
  }
  if (request === "../../config/firebase" &&
      parent &&
      parent.filename.endsWith(path.join("auth", "authController.js"))) {
    return fakeFirebase;
  }
  if (request === "../../services/email" &&
      parent &&
      parent.filename.endsWith(path.join("auth", "authController.js"))) {
    return { sendEmail: async () => ({ success: true }) };
  }
  return originalLoad.apply(this, arguments);
};

const app = express();
app.use(express.json());
app.use("/api/auth", require("./src/routes/auth"));

const cases = [];

async function main() {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function check(name, email, password, expectedStatus) {
    try {
      const response = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const body = await response.json();
      assert.equal(response.status, expectedStatus);

      if (name === "valid credentials return verifiable JWT") {
        assert.equal(body.success, true);
        assert.ok(body.token);
        assert.equal(body.user.id, "test-user-1");
        const decoded = jwt.verify(body.token, testSecret);
        assert.equal(decoded.userId, "test-user-1");
        assert.equal(decoded.role, "viewer");
      }

      cases.push(`PASS: ${name}`);
    } catch (error) {
      cases.push(`FAIL: ${name} — ${error.message}`);
    }
  }

  try {
    await check(
      "unknown email returns 401",
      "missing@example.com",
      "Any-Test-Password",
      401
    );
    await check(
      "wrong password returns 401",
      "test@example.com",
      "Wrong-Test-Password",
      401
    );
    await check(
      "disabled account returns 403",
      "disabled@example.com",
      "Correct-Test-Password-123!",
      403
    );
    await check(
      "valid credentials return verifiable JWT",
      "test@example.com",
      "Correct-Test-Password-123!",
      200
    );

    const loginResponse = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "Correct-Test-Password-123!"
      })
    });
    const loginBody = await loginResponse.json();

    async function checkProfile(name, token, expectedStatus) {
      try {
        const headers = {};
        if (token !== null) headers.authorization = token;

        const response = await fetch(`${base}/api/auth/profile`, { headers });
        const body = await response.json();
        assert.equal(response.status, expectedStatus);

        if (name === "valid token returns matching profile") {
          assert.equal(body.success, true);
          assert.equal(body.data.id, "test-user-1");
          assert.equal(body.data.email, "test@example.com");
          assert.equal(body.data.role, "viewer");
        }

        cases.push(`PASS: ${name}`);
      } catch (error) {
        cases.push(`FAIL: ${name} — ${error.message}`);
      }
    }

    await checkProfile("profile rejects missing token", null, 401);
    await checkProfile(
      "profile rejects invalid token",
      "Bearer invalid-token",
      401
    );
    await checkProfile(
      "valid token returns matching profile",
      `Bearer ${loginBody.token}`,
      200
    );

    for (let attempt = 1; attempt <= 5; attempt++) {
      await check(
        `lockout attempt ${attempt} returns 401`,
        "lockout@example.com",
        "Wrong-Test-Password",
        401
      );
    }

    assert.equal(fakeUsers["lockout@example.com"].loginAttempts, 5);
    assert.equal(fakeUsers["lockout@example.com"].userStatus, "blocked");
    cases.push("PASS: fifth failure sets account status to blocked");

    await check(
      "subsequent blocked-account login returns 403",
      "lockout@example.com",
      "Correct-Test-Password-123!",
      403
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
    Module._load = originalLoad;
  }

  console.log("\n===== LOGIN ROUTE INTEGRATION TESTS =====");
  cases.forEach(result => console.log(result));
  const failures = cases.filter(result => result.startsWith("FAIL:"));
  console.log(`\n${cases.length - failures.length}/${cases.length} tests passed`);
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  Module._load = originalLoad;
  console.error(error);
  process.exitCode = 1;
});
