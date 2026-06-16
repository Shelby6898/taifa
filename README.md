# 🏛️ Taifatech — Multi-Tenant Asset Management Platform

A cloud-based, multi-tenant asset management platform. Taifatech helps organisations — county governments, universities, NGOs, hospitals, and private companies — track, manage, and report on physical assets across departments and locations, replacing manual registers with a secure, role-based digital system accessible from any device.

**Live system:** https://taifatech.org

---

## 🚀 Live Features

| Feature | Description |
|--------|-------------|
| 🔐 Authentication | JWT-based login with bcrypt-hashed passwords, 15-minute auto-logout |
| 🏢 Multi-Tenancy | One deployment securely serves many organisations, each with isolated data |
| 🧩 Configurable Terminology | Each org sets its own "Ward/Campus/Branch" and "Department/Faculty" labels |
| 👥 Role-Based Access | Super Admin, Admin, Manager, Viewer with different scopes of access |
| 📦 Asset Management | Create, edit, delete, restore assets with auto-generated codes |
| 📥 Bulk Import | Upload an Excel file to import hundreds of assets in one go |
| 📱 QR Code Generation | Each asset gets a scannable QR code for physical tagging |
| 🔄 Transfers | Request/approve workflow for moving assets between departments or locations |
| 🔧 Maintenance Tracking | Schedule, track and complete maintenance jobs |
| 📉 Depreciation Tracking | Automatic straight-line depreciation with year-by-year breakdown |
| 📋 Reports | Summary, by location, by department, by type — export to PDF or Excel |
| 🎫 Taifa Helpdesk | Built-in ICT support ticketing with SLA tracking |
| 🔔 Notifications | Real-time alerts for transfers, maintenance, and bulk imports |
| 🕵️ Audit Trails | Every asset, ticket, and user change logged with who/what/when |
| 💾 Automated Backups | Daily scheduled backup of all organisations' data |
| 🛡️ Super Admin Oversight | Platform-wide read-only visibility; cannot write to tenant data |

---

## 🛠️ Technology Stack

### Frontend
- **React.js** — User interface
- **React Router** — Navigation
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

### Infrastructure
- **Render** — Hosting
- **Custom domain** — taifatech.org with managed SSL
- **Firestore Security Rules** — Deny-all for direct client access (see [Security](#-security))
- **cron-job.org** — Triggers the daily automated backup endpoint

---

## 🏢 Multi-Tenancy

Taifatech serves multiple independent organisations from a single deployment:

- Every organisation has its own users, assets, departments/units, and locations — completely isolated from other organisations at the data layer (every record carries an `orgId`, and every query/write is scoped to it).
- Each organisation configures its own terminology. A county might use "Ward" and "Department"; a university might use "Campus" and "Faculty". Configurable from **Org Settings**.
- New organisations are onboarded by a **Super Admin** via the **Organizations** page, which creates the org and its first admin account in one step.
- The Super Admin role is intentionally **read-only** across tenant data — it can view any organisation's records for support purposes but cannot create, edit, or delete them. Only that organisation's own Admins can do that.

---

## 📁 Project Structure

```
taifa/
├── server.js                  # Express app entrypoint
├── firestore.rules            # Firestore security rules (deny-all for clients)
├── firestore.indexes.json     # Firestore composite indexes
├── firebase.json              # Firebase CLI config
├── scripts/                   # One-off migration scripts
├── src/
│   ├── config/                # Firebase Admin SDK init
│   ├── controllers/           # Business logic (assets, transfers, orgs, etc.)
│   ├── middleware/             # authenticate, authorizeRoles, authorizeWrite
│   └── routes/                # Express route definitions
└── taifa-dashboard/           # React frontend
    └── src/
        ├── pages/             # Dashboard, Assets, Transfers, Org Settings, etc.
        ├── hooks/             # useOrg, useInactivityLogout
        └── components/        # Shared UI (ProtectedRoute, etc.)
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- A Firebase project with Firestore enabled
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
BASE_URL=http://localhost:4000
```

Add your `serviceAccountKey.json` from the Firebase Console (Project Settings → Service Accounts).

### 5. Deploy Firestore rules (one-time, or after any change to firestore.rules)
```bash
firebase login
firebase use --add        # select your Firebase project
firebase deploy --only firestore:rules
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

If this is a brand-new Firestore project (no organisations yet), run the multi-tenant migration script to create your first organisation and a Super Admin account:

```bash
node scripts/migrate-multi-tenant.js
```

This creates a default organisation, tags any existing data with its `orgId`, and prints a generated Super Admin email/password — save that password immediately, as it is only shown once.

To create an org's first **Admin** account directly (rather than via the Super Admin's Organizations page):
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Authorization: Bearer <a-valid-admin-or-superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.org","password":"changeme123","role":"admin"}'
```

---

## 🌐 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register user *(admin/super-admin only)* |
| GET | `/api/auth/profile` | Get profile |
| GET | `/api/organizations` | List organisations *(super-admin only)* |
| POST | `/api/organizations` | Create organisation *(super-admin only)* |
| GET / PUT | `/api/organizations/mine` | View/update own organisation settings |
| GET | `/api/assets` | List assets *(org-scoped)* |
| POST | `/api/assets` | Create asset |
| POST | `/api/assets/bulk-import` | Bulk import assets from Excel |
| GET | `/api/transfers` | List transfers |
| POST | `/api/transfers` | Request a transfer |
| PATCH | `/api/transfers/:id/approve` | Approve a transfer |
| GET | `/api/maintenance` | List maintenance records |
| GET | `/api/depreciation` | Depreciation report |
| GET | `/api/reports/summary` | Summary report |
| GET | `/api/reports/audit` | Asset audit log |
| GET | `/api/tickets` | Taifa Helpdesk tickets |
| GET | `/api/notifications` | Get notifications |
| POST | `/api/backup` | Trigger a manual backup *(requires BACKUP_SECRET)* |

---

## 👥 User Roles

| Role | Scope | Assets | Transfers | Maintenance | Reports | Users | Organizations |
|------|-------|--------|-----------|-------------|---------|-------|----------------|
| Super Admin | Platform-wide | 👁️ read-only, all orgs | 👁️ read-only | 👁️ read-only | 👁️ read-only | 👁️ read-only | ✅ full control |
| Admin | Own organisation | ✅ all depts | ✅ approve/deny | ✅ all depts | ✅ | ✅ | ✅ own org settings |
| Manager | Own department | ✅ own dept | ✅ request | ✅ own dept | ✅ own dept | ❌ | ❌ |
| Viewer | Assigned records | 👁️ assigned only | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📊 Depreciation Rates

| Asset Type | Rate/Year | Useful Life |
|------------|-----------|-------------|
| ICT Equipment | 33.3% | 3 years |
| Vehicle | 25% | 4 years |
| Machinery | 15% | ~7 years |
| Furniture | 10% | 10 years |
| Building | 2.5% | 40 years |
| Land | 0% | Never |

---

## 🔒 Security

- **Tenant isolation** — every record is tagged with an `orgId`; all reads/writes are scoped to the requesting user's organisation.
- **Authentication** — JWT-based sessions, bcrypt password hashing (10 rounds), 15-minute inactivity auto-logout.
- **Authorisation** — role and department checks enforced server-side on every route, via `authorizeRoles` (read access) and `authorizeWrite` (excludes Super Admin from all write operations on tenant data).
- **Firestore Security Rules** — `firestore.rules` denies all direct client access (`allow read, write: if false`). The backend's Firebase Admin SDK bypasses this by design; the rule exists to block any direct use of the public client config from outside the API.
- **Audit trails** — every asset, ticket, and user action is logged with who made the change, when, and (for assets) the before/after state.
- **Soft delete** — assets are never permanently lost; deleted assets can be restored.
- **Automated backups** — a scheduled job exports all collections daily to a timestamped Firestore backup record.

See the project's documentation set (Data Security & Compliance document) for the full write-up.

---

## 📱 Mobile Friendly

Fully responsive design optimized for Android and iOS browsers. Built and tested primarily on mobile (Termux).

---

## 👨‍💻 Author

**Elphaz Shelby** — [@Shelby6898](https://github.com/Shelby6898)

Built for county government asset management in Kenya 🇰🇪 — now evolved into a multi-tenant platform for any organisation.

---

*Taifa — Swahili for "Nation"*
