const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const originalDateNow = Date.now;
let routeHandler;
let assetData;

const fakeExpress = {
  Router() {
    return {
      get(path, handler) {
        if (path === "/:id") routeHandler = handler;
      }
    };
  }
};

const fakeDb = {
  collection() {
    return {
      doc() {
        return {
          get: async () => ({
            id: "test-asset",
            exists: true,
            data: () => assetData
          })
        };
      }
    };
  }
};

async function renderAsset(data) {
  assetData = data;
  let html = "";
  let statusCode = 200;
  const headers = {};

  const res = {
    set(values) {
      Object.assign(headers, values);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    send(body) {
      html = body;
      return this;
    }
  };

  await routeHandler({ params: { id: "test-asset" } }, res);
  return { html, statusCode, headers };
}

async function main() {
  Module._load = function (request, parent, isMain) {
    if (request === "express") return fakeExpress;
    if (request === "../config/firebase") return { db: fakeDb };
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve("./src/routes/publicAssets")];
  require("./src/routes/publicAssets");

  assert.equal(typeof routeHandler, "function", "QR route registered");

  const maliciousName = '<img src=x onerror="alert(1)">';
  const maliciousType = "<script>alert(2)</script>";

  const result = await renderAsset({
    name: maliciousName,
    assetCode: "TEST-001",
    status: 'ASSIGNED"><script>alert(3)</script>',
    type: maliciousType,
    department: "Test Department",
    ward: "Test Ward",
    value: 987654321,
    custodian: "PRIVATE-CUSTODIAN-TEST",
    location: "PRIVATE-LOCATION-TEST",
    acquisitionDate: { _seconds: 1736899200 }
  });

  assert.equal(result.statusCode, 200);

  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(result.headers["X-Frame-Options"], "DENY");
  assert.equal(result.headers["Referrer-Policy"], "no-referrer");
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(
    result.headers["Content-Security-Policy"],
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );

  assert.ok(result.html.includes(
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
  ));
  assert.ok(result.html.includes(
    "&lt;script&gt;alert(2)&lt;/script&gt;"
  ));
  assert.ok(result.html.includes('class="badge unassigned"'));
  assert.ok(!result.html.includes(maliciousName));
  assert.ok(!result.html.includes(maliciousType));
  assert.ok(!result.html.includes("PRIVATE-CUSTODIAN-TEST"));
  assert.ok(!result.html.includes("PRIVATE-LOCATION-TEST"));
  assert.ok(!result.html.includes("987654321"));
  console.log("PASS: HTML escaping, safe status, and privacy");

  const noDate = await renderAsset({
    name: "Date Test",
    status: "ASSIGNED",
    acquisitionDate: null
  });
  assert.ok(noDate.html.includes(">N/A</span>"));
  console.log("PASS: missing acquisition date");

  const invalidDate = await renderAsset({
    name: "Date Test",
    status: "ASSIGNED",
    acquisitionDate: { _seconds: "invalid" }
  });
  assert.ok(invalidDate.html.includes(">N/A</span>"));
  assert.ok(!invalidDate.html.includes("Invalid Date"));
  console.log("PASS: malformed acquisition date");

  const validDate = await renderAsset({
    name: "Date Test",
    status: "ASSIGNED",
    acquisitionDate: { _seconds: 1736899200 }
  });
  assert.ok(!validDate.html.includes("Invalid Date"));
  console.log("PASS: valid Firestore-style date");

  const missingAsset = {
    collection() {
      return {
        doc() {
          return {
            get: async () => ({ exists: false })
          };
        }
      };
    }
  };

  const beforeMissingTest = fakeDb.collection;
  fakeDb.collection = missingAsset.collection;

  try {
    const missing = await renderAsset({});
    assert.equal(missing.statusCode, 404);
    assert.ok(missing.html.includes("Asset Not Found"));
    console.log("PASS: missing asset returns 404");
  } finally {
    fakeDb.collection = beforeMissingTest;
  }

  console.log("All public QR regression tests passed.");
}

main()
  .catch((error) => {
    console.error("FAIL:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    Module._load = originalLoad;
    Date.now = originalDateNow;
  });
