# CustomDocs — SaaS Workflow & Enterprise Document Management System (EDMS)

CustomDocs is a secure, multi-tenant Enterprise Document Management System built to handle dynamic corporate document lifecycles, structured review-approval workflows, and strict cryptographic identity governance. Designed for organizations requiring granular access control, clear compliance logging, and real-time project management tracking.



---

## 🚀 Key Features

### 📦 1. Advanced Document & Template Lifecycle
* **State Management:** Complete transition workflow tracking documents through *Drafts*, *Pending Review*, *Published Documents*, and *Old Archives*.
* **Template Blueprint Engine:** Create and reuse standard corporate templates with distinct review pipelines before internal deployment.

### 🔐 2. Granular Role-Based Access Control (RBAC)
* Hierarchical authentication bound to specific **Organization IDs**, **Departments**, and **Site Locations**.
* Distinct functional permissions separating generic *Users*, *Editors*, *Site Managers*, and *Template Approvers*.

### 📊 3. Enterprise Operations & Governance
* **Comprehensive Audit Trail:** Real-time compliance logging tracking user actions, critical state mutations, and system modifications.
* **Task Queuing:** High-priority task board with dynamic status hydration, active deadlines, and real-time team collaboration metrics.
* **Metadata Insights:** Integrated tracking calendar alongside automated timeline feeds rendering live session activity.

### 🛡️ 4. Robust Security & Account Infrastructure
* Stateless session authorization secured via **JSON Web Tokens (JWT)**.
* Multi-step credential mutation featuring cryptographic verification and instant server-side token revocation to enforce immediate logouts.
* Isolated profile environment facilitating dynamic avatar provisioning and real-time system state synchronization.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Ant Design (AntD), Axios, React Router, Context API
* **Backend:** Node.js, Express.js, JWT (JsonWebToken), Bcrypt
* **Database:** MySQL (Relational Schema optimized for operational speed)
* **Hosting Platforms:** GitHub, Render (Decoupled Web Service + Static Site)

---

## 📂 Project Architecture

```text
form-project-main/
├── backend/
│   ├── server.js               # Main Express engine & API routes
│   ├── .env                    # Environment configurations (Protected)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/         # Modular UI Components (AuthCard, UserProfile)
    │   ├── utils/              # Helper modules (editorLogger, referenceUtils)
    │   ├── App.js              # Core React routing & state orchestration
    │   └── index.js
    └── package.json
