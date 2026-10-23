const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
let documentData;
let documentExists = true;
let databaseError = null;
const headers = {};

const fakeDb = {
  collection(name) {
    assert.equal(name, "assets");
    return {
      doc(id) {
        return {
          async get() {
            if (databaseError) throw databaseError;
            return {
              id,
              exists: documentExists,
              data: () => documentData
            };
          }
        };
      }
    };
  }
};

Module._load = function (request, parent, isMain) {
  if (
    request === "../config/firebase" &&
    parent &&
    parent.filename.endsWith("/src/routes/publicAssets.js")
  ) {
    return { db: fakeDb };
  }
  return originalLoad.call(this, request, parent, isMain);
};

let handler;

try {
  const router = require("./src/routes/publicAssets");
  const layer = router.stack.find(
    (item) => item.route && item.route.path === "/:id"
  );
  assert.ok(layer, "public asset route must exist");
  handler = layer.route.stack[0].handle;
} finally {
  Module._load = originalLoad;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: "",
    headers: {},
    set(values) {
      Object.assign(this.headers, values);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    }
  };
}

async function request() {
  const res = makeResponse();
  await handler({ params: { id: "asset-test-1" } }, res);
  return res;
}

async function run() {
  documentExists = true;
  databaseError = null;
  documentData = {
    name: '<script>alert("xss")</script>',
    assetCode: 'A<&"1',
    status: '<img src=x onerror=alert(1)>',
    type: "Laptop & tablet",
    department: "Revenue <Admin>",
    ward: "Ward 'A'",
    custodian: "PRIVATE-CUSTODIAN-TEST",
    location: "PRIVATE-LOCATION-TEST",
    value: 987654321,
    acquisitionDate: { _seconds: 1704067200 }
  };

  const res = await request();

  assert.ok(!res.body.includes("PRIVATE-CUSTODIAN-TEST"));
  assert.ok(!res.body.includes("PRIVATE-LOCATION-TEST"));
  assert.ok(!res.body.includes("987654321"));
  console.log("PASS: public QR response excludes private custodian, location and value");

  assert.equal(res.statusCode, 200);
  for (const [key, value] of Object.entries({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  })) {
    assert.equal(res.headers[key], value, `header ${key}`);
  }
  console.log("PASS: public asset response sets security headers");

  assert.ok(res.body.includes("&lt;script&gt;"));
  assert.ok(!res.body.includes('<script>alert("xss")</script>'));
  assert.ok(res.body.includes("A&lt;&amp;&quot;1"));
  assert.ok(res.body.includes("Revenue &lt;Admin&gt;"));
  assert.ok(res.body.includes("Ward &#39;A&#39;"));
  console.log("PASS: database text is HTML-escaped");

  assert.ok(res.body.includes('class="badge unassigned"'));
  assert.ok(!res.body.includes('class="badge <img'));
  console.log("PASS: unexpected status cannot inject a CSS class");

  assert.ok(res.body.includes("01/01/2024"));
  console.log("PASS: Firestore seconds timestamp is rendered as a date");

  documentData = {
    name: "Safe Asset",
    status: "ASSIGNED",
    acquisitionDate: { _seconds: "invalid" }
  };
  const safe = await request();
  assert.ok(safe.body.includes('class="badge active"'));
  assert.ok(safe.body.includes(">N/A</span>"));
  console.log("PASS: valid status class and invalid date fallback");

  documentExists = false;
  const missing = await request();
  assert.equal(missing.statusCode, 404);
  assert.ok(missing.body.includes("Asset Not Found"));
  console.log("PASS: missing asset returns 404");

  documentExists = true;
  databaseError = new Error("simulated database failure");
  const failed = await request();
  assert.equal(failed.statusCode, 500);
  assert.ok(failed.body.includes("Error loading asset"));
  console.log("PASS: database error returns generic response");

  console.log("\nAll public asset security tests passed.");
}

run().catch((error) => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
