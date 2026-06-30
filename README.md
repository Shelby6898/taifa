# 🏛️ Taifatech — Multi-Tenant Asset Management Platform

A cloud-based, multi-tenant asset management platform. Taifatech helps organisations — county governments, universities, NGOs, hospitals, and private companies — track, manage, and report on physical assets across departments and locations, replacing manual registers with a secure, role-based digital system accessible from any device.

**Live system:** https://taifatech.org

Built and aligned with the asset management specification provided by TransNzoia County (CPA Emmanuel Wafula, Chief Officer Finance).

---

## 🚀 Live Features

| Feature | Description |
|--------|-------------|
| 🔐 Authentication | JWT-based login with bcrypt-hashed passwords, 15-minute auto-logout |
| 📱 Two-Factor Authentication | Optional SMS-based OTP login via Africa's Talking |
| 🏢 Multi-Tenancy | One deployment securely serves many organisations, each with isolated data |
| 🧩 Configurable Terminology | Each org sets its own "Ward/Campus/Branch" and "Department/Faculty" labels |
| 👥 Role-Based Access | Super Admin, Admin, Manager, Viewer with different scopes of access and dashboard views |
| ♻️ Asset Lifecycle | Five-state model: NEW → UNASSIGNED → ASSIGNED → MAINTENANCE → DISPOSED |
| 📦 Asset Management | Create, edit, delete, restore assets with auto-generated codes |
| 📥 Bulk Import | Upload an Excel file to import hundreds of assets in one go |
| 🛰️ IFMIS Intake | Secure endpoint receiving new asset records directly from IFMIS on procurement |
| 📱 QR Code Generation | Each asset gets a scannable QR code for physical tagging |
| 👤 Custody Log | Full chronological history of every custodian an asset has ever had |
| 🔁 Reallocation | Move an asset directly between custodians in a single atomic action |
| 📤 Check-In / Check-Out | Track short-term asset use with expected return dates |
| 🚨 Missing / Inactive Flags | Flag assets not located during verification or no longer in use |
| ⏸️ Activate / Deactivate | Temporarily withdraw an asset from use without disposing it |
| 💰 Asset Valuation | Manual valuation by a valuator plus a daily automated revaluation job |
| 🗂️ Asset Categories | Org-defined depreciation/appreciation rates by class and category |
| 📉 Depreciation Tracking | Automatic straight-line depreciation/appreciation with year-by-year breakdown |
| 🗑️ Disposal Module | Nine-method formal disposal process (tender, auction, trade-in, destruction, etc.) |
| 📋 Asset Requests | Any staff member can request an asset; managers approve and assign |
| 📎 Document Attachments | Attach PDFs, images and documents to acquisitions, disposals, valuations |
| 🔄 Transfers | Request/approve workflow for moving assets between departments or locations |
| 🔧 Maintenance Tracking | Schedule, track and complete maintenance jobs |
| 📋 Reports | Summary, by location, by department, by type — export to PDF or Excel |
| 🎫 Taifa Helpdesk | Built-in ICT support ticketing with SLA tracking |
| 🔔 Notifications | Real-time alerts for transfers, maintenance, requests, and bulk imports |
| 🕵️ Audit Trails | Every asset, ticket, and user change logged with who/what/when |
| 💾 Automated Backups | Daily scheduled backup of all organisations' data |
| 🛡️ Super Admin Oversight | Platform-wide read-only visibility; cannot write to tenant data |
| 🔑 Forgot / Reset Password | Secure email-based password reset with SHA-256 tokens, 30-min expiry |
| 🖼️ Organisation Logo | Upload a branded logo per org; appears in sidebar, dashboard, and all exported PDFs |
| 🌐 Landing Page | Public welcome page at taifatech.org with Sign In entry point |

---

## 🛠️ Technology Stack

### Frontend
- **React.js** — User interface
- **React Router** — Navigation (entry point: `App.js`)
- **Recharts** — Charts and graphs
- **qrcode.react** — QR code generation
- **jsPDF** — PDF export
- **SheetJS / ExcelJS** — Excel import/export
- **Axios** — API requests

### Backend
- **Node.js + Express.js** — REST API
- **Firebase Firestore** — Cloud database (multi-tenant data model)
- **Firebase Authentication (Admin SDK)** — Identity layer behind login
- **JWT** — Session tokens (role, department, orgId)
- **bcryptjs** — Password hashing
- **PDFKit** — Server-side PDF generation (audit logs, reports, ticket exports)
- **Resend** — Transactional email (password reset, notifications)
- **Africa's Talking** — SMS delivery for 2FA one-time passcodes
- **crypto (Node built-in)** — SHA-256 hashing for password reset tokens and OTPs

### Infrastructure
- **Render** — Hosting (free tier, WEB_CONCURRENCY=1)
- **Custom domain** — taifatech.org with managed SSL
- **Firestore Security Rules** — Deny-all for direct client access (see [Security](#-security))
- **cron-job.org** — Triggers the daily automated backup and daily valuation endpoints
- **In-Memory Cache** — Server-side caching layer (single-process; Redis upgrade path documented)

---

## 🏢 Multi-Tenancy

Taifatech serves multiple independent organisations from a single deployment:

- Every organisation has its own users, assets, departments/units, and locations — completely isolated from other organisations at the data layer (every record carries an `orgId`, and every query/write is scoped to it).
- Each organisation configures its own terminology. A county might use "Ward" and "Department"; a university might use "Campus" and "Faculty". Configurable from **Org Settings**.
- Each organisation can upload a **branded logo** that appears across the sidebar, dashboard welcome screen, and all exported PDFs.
- Each organisation defines its own **asset categories** and depreciation/appreciation rates, independent of other tenants.
- New organisations are onboarded by a **Super Admin** via the **Organizations** page, which creates the org and its first admin account in one step.
- The Super Admin role is intentionally **read-only** across tenant data.

---

## ♻️ Asset Lifecycle Model

Every asset moves through a defined set of states:

```
NEW ──▶ UNASSIGNED ──▶ ASSIGNED ──▶ MAINTENANCE
              ▲             │
              └── released ─┘
                             │
                       DEACTIVATED ◀──▶ (reactivate)
                             │
                          DISPOSED (terminal)
```

- **NEW** — just entered the register, typically via IFMIS intake
- **UNASSIGNED** — no current custodian
- **ASSIGNED** — has an active custodian; can be reallocated directly to another custodian
- **MAINTENANCE** — under repair or servicing
- **DEACTIVATED** — temporarily withdrawn from use (e.g. pending audit) without being disposed
- **DISPOSED** — terminal; cannot be restored. Reached only via the formal Disposal Module

Every status change, custody assignment, valuation, check-in/out, and disposal writes to a permanent **audit log** (`asset_audit`) and, where relevant, to a dedicated history collection (`asset_custody_logs`, `asset_valuation_logs`, `asset_disposals`).

---

## 📁 Project Structure

```
taifa/
├── server.js                  # Express app entrypoint
├── firestore.rules            # Firestore security rules (deny-all for clients)
├── firestore.indexes.json     # Firestore composite indexes
├── firebase.json              # Firebase CLI config
├── scripts/
│   ├── migrate-multi-tenant.js
│   └── clean-demo-data.js     # Resets database to a clean state for demos
├── src/
│   ├── config/                # Firebase Admin SDK init
│   ├── controllers/
│   │   ├── assetController.js
│   │   ├── custodyController.js
│   │   ├── valuationController.js
│   │   ├── categoryController.js
│   │   ├── disposalController.js
│   │   ├── ifmisController.js
│   │   ├── checkInOutController.js
│   │   ├── assetRequestController.js
│   │   ├── documentController.js
│   │   ├── otpController.js
│   │   ├── depreciationController.js
│   │   ├── reportController.js
│   │   ├── auth/authController.js
│   │   └── ...
│   ├── middleware/             # authenticate, authorizeRoles, authorizeWrite
│   └── routes/                 # One file per resource, mirrors controllers above
└── taifa-dashboard/            # React frontend
    └── src/
        ├── pages/
        │   ├── Assets.js, Categories.jsx, Disposals.jsx, CheckInOut.jsx
        │   ├── AssetRequests.jsx, Profile.js, Users.jsx
        │   ├── Dashboard.jsx, DashboardHome.jsx, Login.jsx
        │   ├── ForgotPassword.jsx, ResetPassword.jsx, Welcome.jsx
        │   └── ...
        ├── hooks/               # useOrg, useInactivityLogout
        └── components/          # ProtectedRoute, Sidebar, etc.
```

> **Note:** `App.js` is the true webpack router entry point. `App.jsx` (a former duplicate) was removed after it was found to cause silent routing failures.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- A Firebase project with Firestore enabled
- An Africa's Talking account (for SMS/2FA) — sandbox works for development
- Firebase CLI (`npm install -g firebase-tools`) if you intend to deploy Firestore rules

### 1. Clone the repository
```bash
git clone https://github.com/Shelby6898/taifa.git
cd taifa
```

### 2. Install backend dependencies
```bash
npm install
```

### 3. Install frontend dependencies
```bash
cd taifa-dashboard
npm install
cd ..
```

### 4. Configure environment variables
Create a `.env` file in the root:
```env
PORT=4000
JWT_SECRET=your_jwt_secret_key
BACKUP_SECRET=your_backup_secret_key
IFMIS_SECRET=your_ifmis_shared_secret
BASE_URL=http://localhost:4000
RESEND_API_KEY=your_resend_api_key
AT_API_KEY=your_africas_talking_api_key
AT_USERNAME=your_africas_talking_username
```

Add your `serviceAccountKey.json` from the Firebase Console (Project Settings → Service Accounts).

### 5. Deploy Firestore rules and indexes
```bash
firebase login
firebase use --add        # select your Firebase project
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 6. Start the backend
```bash
node server.js
```

### 7. Start the frontend
```bash
cd taifa-dashboard
npm start
```

The app will be available at `http://localhost:3001`.

---

## 🏁 First-Time Data Setup

If this is a brand-new Firestore project (no organisations yet):
```bash
node scripts/migrate-multi-tenant.js
```
This creates a default organisation, tags any existing data with its `orgId`, and prints a generated Super Admin email/password — save it immediately, it is only shown once.

To reset all transactional data while keeping a defined set of user accounts (useful before a demo):
```bash
node scripts/clean-demo-data.js
```
Edit the `KEEP_USERS` array at the top of the script to control which accounts survive the cleanup.

---

## 🌐 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/auth/login` | Standard login |
| POST | `/api/otp/login` | 2FA login, step 1 — sends SMS code |
| POST | `/api/otp/verify-login` | 2FA login, step 2 — verifies code, issues token |
| POST | `/api/auth/forgot-password` | Request a password reset email |
| GET / PATCH | `/api/auth/users/:id` `/status` | Manage users and their status |
| GET | `/api/assets` | List assets (org/role scoped) |
| POST | `/api/assets` | Create asset manually |
| POST | `/api/assets/:id/custodian` | Assign custodian |
| DELETE | `/api/assets/:id/custodian` | Release custodian |
| POST | `/api/assets/:id/reallocate` | Move custody directly to a new custodian |
| POST | `/api/assets/:id/deactivate` `/activate` | Temporarily withdraw/restore an asset |
| GET | `/api/assets/:id/custody-log` | Full custody history |
| POST | `/api/checkinout/:id/checkout` `/checkin` | Short-term check-out/in |
| POST | `/api/checkinout/:id/flag-missing` | Flag asset as missing |
| POST | `/api/ifmis/intake` | Receive a new asset from IFMIS |
| GET / POST | `/api/categories` | Asset categories and depreciation rates |
| GET | `/api/depreciation` | Depreciation/appreciation report |
| POST | `/api/depreciation/:id/valuations` | Record a manual valuation |
| POST | `/api/disposals/:id/dispose` | Dispose an asset |
| GET | `/api/disposals` | Org-wide disposal log |
| POST | `/api/asset-requests` | Raise an asset request |
| PATCH | `/api/asset-requests/:id/approve` `/reject` | Manager/admin decision on a request |
| POST | `/api/documents/:id/documents` | Attach a document to an asset |
| GET | `/api/reports/summary` | Role-aware dashboard summary |
| GET | `/api/reports/audit` | Asset audit log |
| GET | `/api/tickets` | Taifa Helpdesk tickets |
| POST | `/api/backup` | Trigger a manual backup *(requires BACKUP_SECRET)* |

---

## 👥 User Roles

| Role | Scope | Assets | Custody/Disposal | Requests | Reports | Users | Organizations |
|------|-------|--------|-------------------|----------|---------|-------|----------------|
| Super Admin | Platform-wide | 👁️ read-only, all orgs | 👁️ read-only | 👁️ read-only | 👁️ read-only | 👁️ read-only | ✅ full control |
| Admin | Own organisation | ✅ all depts | ✅ full control incl. disposal | ✅ approve/reject | ✅ | ✅ | ✅ own org settings |
| Manager | Own department | ✅ own dept | ✅ assign/checkout/reallocate | ✅ approve/reject (own dept) | ✅ own dept | ❌ | ❌ |
| Viewer | Assigned records | 👁️ assigned only | ❌ | ✅ raise requests only | ❌ | ❌ | ❌ |

Dashboard statistics shown also differ by role — see [Dashboard](#-dashboard) below.

---

## 📊 Dashboard

The dashboard summary is role-aware:

- **Administrator** sees the full statistics grid: Total, Assigned, Unassigned, Maintenance, Disposed, Checked Out, 🚨 Missing, NEW (IFMIS), Original Value and Current Value.
- **Manager** sees the same grid scoped to their own department, with disposal and missing-asset figures hidden as these sit outside a manager's authority.
- **Viewer** sees a simple message stating how many assets are currently assigned to them, with a link to the Assets page, rather than organisation-wide statistics.

---

## 📊 Default Depreciation Rates (fallback only)

Org-defined **Asset Categories** are now the primary source of depreciation/appreciation rates. The following rates are used only as a fallback for assets with no category linked:

| Asset Type | Rate/Year | Useful Life |
|------------|-----------|-------------|
| ICT Equipment | 33.3% | 3 years |
| Vehicle | 25% | 4 years |
| Machinery | 15% | ~7 years |
| Furniture | 10% | 10 years |
| Building | 2.5% | 40 years |
| Land | 0% | Never |

---

## 🗑️ Disposal Methods

Disposal is a terminal action reachable only through the Disposal Module:

`TRANSFER` · `LEASING` · `TRANSFER_TO_OTHER_AUTHORITY` · `SALE_BY_TENDER` · `SALE_BY_PUBLIC_AUCTION` · `TRADE_IN` · `BURNING` · `DESTRUCTION` · `CANCELLATION`

Every disposal requires a method and a reason, optionally captures proceeds and an approver, and is permanently recorded in `asset_disposals` alongside the asset's value at the time of disposal.

---

## 🛰️ IFMIS Integration

Taifatech does not handle procurement. When a purchase is finalised on Kenya's IFMIS, the asset record is posted directly to `POST /api/ifmis/intake`, secured by a shared `x-ifmis-secret` header — no user login required. The asset enters with status `NEW`, carrying purchase order number, supplier, invoice number and acquisition date, ready for assignment.

Historical and pre-IFMIS assets are captured through the existing **Bulk Import** facility as a one-time migration, not through ongoing manual entry.

---

## 📱 QR Code Scanning

Every asset is assigned a downloadable QR code for physical tagging. Scanning the code with any phone camera opens a public, no-login asset record page at `https://taifatech.org/assets/view/:assetId`, showing the asset's name, code, live status, type, department, ward, value, current custodian, location, and acquisition date.

- QR codes encode the production domain (`taifatech.org`), not a local development address, so they work correctly once printed and stuck onto physical assets.
- The public view requires no authentication, making it suitable for field staff, auditors, or the general public verifying a county asset.
- Status badges on the scanned page reflect the live asset state — green for ASSIGNED, amber for MAINTENANCE, grey for UNASSIGNED, and red for DISPOSED.
- The backend route (`src/routes/publicAssets.js`) reads directly from Firestore at scan time, so the information shown is always current, not a static snapshot taken when the tag was printed.

---

## 🔒 Security

- **Tenant isolation** — every record is tagged with an `orgId`; all reads/writes are scoped to the requesting user's organisation.
- **Authentication** — JWT-based sessions, bcrypt password hashing (10 rounds), 15-minute inactivity auto-logout.
- **Two-factor authentication** — optional SMS OTP login; codes are SHA-256 hashed, single-use, expire in 5 minutes, and are rate-limited to 5 requests per 15 minutes.
- **Login hardening** — failed login attempts are tracked per user; accounts auto-block after 5 consecutive failures and require admin intervention to unblock.
- **Authorisation** — role and department checks enforced server-side on every route, via `authorizeRoles` (read access) and `authorizeWrite` (excludes Super Admin from all write operations on tenant data).
- **Password reset hardening** — reset tokens are SHA-256 hashed before storage, expire after 30 minutes, are single-use, and always return generic responses to prevent account enumeration.
- **IFMIS intake security** — protected by a separate shared secret distinct from user authentication, allowing system-to-system integration without exposing user credentials.
- **Firestore Security Rules** — `firestore.rules` denies all direct client access (`allow read, write: if false`).
- **Audit trails** — every asset, custody, valuation, disposal, and user action is logged with who made the change, when, and the before/after state.
- **Disposal is terminal** — once disposed, an asset cannot be restored or reassigned, preserving the integrity of the asset register for audit purposes.
- **Automated backups** — a scheduled job exports all collections daily to a timestamped Firestore backup record.

See the project's documentation set (Data Security & Compliance document, System Update & Feature Documentation) for the full write-up.

---

## ⚡ Performance & Scaling

- **Current capacity** — load tested at 100 concurrent requests; comfortably supports ~50–70 simultaneous active users on the free tier.
- **Bottleneck** — bcrypt CPU cost under high concurrent login load; event loop saturation at extreme concurrency.
- **Scaling path** — replace in-memory cache with Redis, increase `WEB_CONCURRENCY` above 1 on a paid Render tier, and move bcrypt to a worker thread pool.

---

## 📱 Mobile Friendly

Fully responsive design optimized for Android and iOS browsers. Built and tested entirely on mobile (Termux) — backend, frontend, and infrastructure all developed from an Android device.

---

## 👨‍💻 Author

**Elphaz Shelby** — [@Shelby6898](https://github.com/Shelby6898)

Built for county government asset management in Kenya 🇰🇪 — now evolved into a multi-tenant platform for any organisation, with a feature set aligned to the TransNzoia County asset management specification.

---

*Taifa — Swahili for "Nation"*
