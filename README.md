# 🏛️ Taifa County Asset Management System

A web-based asset management platform built for county governments in Kenya. Taifa helps county officers track, manage, and report on government assets across departments and wards — replacing manual registers with a secure, role-based digital system accessible from any device.

---

## 🚀 Live Features

| Feature | Description |
|--------|-------------|
| 🔐 Authentication | JWT-based login with encrypted passwords |
| 👥 Role-Based Access | Admin, Manager, Viewer with different permissions |
| 🏢 Department Isolation | Officers see only their department's assets |
| 📦 Asset Management | Create, edit, delete, restore assets with auto-generated codes |
| 📱 QR Code Generation | Each asset gets a scannable QR code for physical tagging |
| 🔄 Transfers | Transfer assets between departments with full audit trail |
| 🔧 Maintenance Tracking | Schedule, track and complete maintenance jobs |
| 📉 Depreciation Tracking | Automatic straight-line depreciation with year-by-year breakdown |
| 📋 Reports | Summary, by ward, by department, by type — export to PDF or Excel |
| 🔔 Notifications | Real-time alerts when assets are transferred |
| 👤 User Profile | View and edit profile, change password |

---

## 🛠️ Technology Stack

### Frontend
- **React.js** — User interface
- **React Router** — Navigation
- **Recharts** — Charts and graphs
- **qrcode.react** — QR code generation
- **jsPDF** — PDF export
- **SheetJS** — Excel export
- **Axios** — API requests

### Backend
- **Node.js + Express.js** — REST API
- **Firebase Firestore** — Cloud database
- **JWT** — Authentication tokens
- **bcryptjs** — Password hashing

---

## 📁 Project Structure

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- Firebase project with Firestore enabled
- A `.env` file with your credentials

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
```

Add your `serviceAccountKey.json` from Firebase Console.

### 5. Start the backend
```bash
node server.js
```

### 6. Start the frontend
```bash
cd taifa-dashboard
npm start
```

The app will be available at `http://localhost:3001`

---

## 🔑 Default Admin Account

After setup, create your first admin:
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@taifa.go.ke","password":"admin123","role":"admin"}'
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register user |
| GET | `/api/auth/profile` | Get profile |
| GET | `/api/assets` | List assets |
| POST | `/api/assets` | Create asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| GET | `/api/transfers` | List transfers |
| POST | `/api/transfers` | Transfer asset |
| GET | `/api/maintenance` | List maintenance |
| POST | `/api/maintenance` | Schedule maintenance |
| GET | `/api/depreciation` | Depreciation report |
| GET | `/api/reports/summary` | Summary report |
| GET | `/api/reports/audit` | Audit log |
| GET | `/api/notifications` | Get notifications |

---

## 👥 User Roles

| Role | Assets | Maintenance | Transfers | Reports | Users |
|------|--------|-------------|-----------|---------|-------|
| Admin | All depts ✅ | All depts ✅ | ✅ | ✅ | ✅ |
| Manager | Own dept ✅ | Own dept ✅ | ✅ | ✅ | ❌ |
| Viewer | Own dept 👁️ | Own dept 👁️ | ❌ | ❌ | ❌ |

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

- All routes protected with JWT authentication
- Role and department checks enforced server-side
- Passwords hashed with bcrypt (10 rounds)
- Soft delete — assets never permanently lost
- Full audit trail on every asset action

---

## 📱 Mobile Friendly

Fully responsive design optimized for Android and iOS browsers. Built and tested primarily on mobile.

---

## 👨‍💻 Author

**Elphaz Shelby** — [@Shelby6898](https://github.com/Shelby6898)

Built for county government asset management in Kenya 🇰🇪

---

*Taifa — Swahili for "Nation"*
