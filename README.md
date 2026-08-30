# Bharat Tender Intelligence (BTI)

> **AI-Powered Monitoring, Statutory Integrity & Tender Intelligence Platform for the MPLAD Ecosystem**  
> *Developed for the Smart India Hackathon (SIH) — Public Procurement & Infrastructure Governance Track*

---

## 1. Overview

**Bharat Tender Intelligence (BTI)** is an institutional governance and procurement intelligence platform engineered to bring radical transparency, algorithmic collusion detection, and milestone-linked fiscal accountability to India's Member of Parliament Local Area Development Scheme (MPLADS) and public infrastructure contracts.

BTI establishes an interconnected digital ecosystem uniting **Citizens**, **District Collectors / Nodal Officers**, and **Executing Agencies / Contractors** under a single statutory verification framework.

---

## 2. Problem Being Addressed

Public infrastructure procurement under MPLADS faces systemic operational challenges:
- **Collusive Bidding & Cartelization**: Synchronized bid submissions, rotational tendering, and hidden agency networks.
- **Verification Bottlenecks**: Manual document verification resulting in delayed tendering cycles and ghost contractor risks.
- **Opaque Fund Utilization**: Disconnect between physical project ground reality and milestone disbursement tranches.
- **Citizen Information Asymmetry**: Limited public visibility into local constituency works, sanctions, and contractor performance.

BTI solves these challenges by combining rigorous Role-Based Access Control (RBAC), statutory entity verification (GSTIN/PAN), milestone-gated fund disbursements, and proactive risk indexing.

---

## 3. Key Portals & Workspaces

### 🏛️ Citizen Transparency Portal (`/`, `/map`, `/transparency`)
- **Constituency Project Mapping**: Interactive geographic explorer detailing sanctioned works across districts.
- **Statutory Transparency Registry**: Searchable repository of public tenders, work orders, allocated budgets, and milestone records.
- **Open Audit Data**: Track sanctioned allocations against actual ground progress.

### 🛡️ Government Intelligence Portal (`/government/*`)
- **Nodal Officer Command Center**: Executive KPI monitoring, high-risk tender alerts, and anomaly indicators.
- **Tender Lifecycle Management**: Publish statutory tenders, review proposals, and evaluate contractor eligibility.
- **Forensic Risk & Investigation Registry**: Collusion indicators, price variance tracking, and bid clustering analytics.
- **Audit Trails & Security Controls**: Immutable activity logs, role management, and cryptographic compliance checks.

### 🏢 Agency / Contractor Workspace (`/agency/*`)
- **Statutory Onboarding**: 3-step agency registration with 15-character GSTIN structure validation and statutory declarations.
- **Proposal Workbench**: Active tender discovery, technical bid compilation, and compliance tracking.
- **Milestone & Disbursement Tracker**: Geo-tagged work completion proof submissions and tranche release statuses.
- **Institutional Compliance Health**: Verification status monitoring and statutory credentials portfolio.

---

## 4. Current Implementation Status

| Phase | Scope & Status | Description |
| :--- | :--- | :--- |
| **Phase 0** | **Complete & Locked** | Design system, token taxonomy, high-density dashboard layouts, interactive mapping, charts, and public portals. |
| **Phase 1A** | **Complete** | Authentication UI, statutory registration flow, GSTIN format validator, protected route boundaries, and access denial gates. |
| **Phase 1B** | **Complete** | Firebase Authentication integration, Cloud Firestore profile persistence (`/users/{uid}`), persistent RBAC, default-deny security rules, and Vercel compatibility. |
| **Phase 2** | *Upcoming Roadmap* | Real-time GST API verification, live tender workflow engine, proposal submission pipeline, and automated milestone tracking. |
| **Phase 3** | *Upcoming Roadmap* | Server-side Gemini AI risk analytics, bidding pattern anomaly detection, and automated forensic reporting. |

---

## 5. Technology Stack

- **Frontend Core**: [React 18+](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Build System & Tooling**: [Vite](https://vitejs.dev/) with native ES module compilation
- **Styling & Design System**: [Tailwind CSS](https://tailwindcss.com/) with national governance palette and high-contrast typography
- **Authentication**: [Firebase Authentication](https://firebase.google.com/products/auth) (Email & Password provider)
- **Database & Profile Storage**: [Cloud Firestore](https://firebase.google.com/products/firestore) (Partitioned user profiles under `/users/{uid}`)
- **Animation & Transitions**: Motion layout engine with `prefers-reduced-motion` compliance
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment**: [Vercel](https://vercel.com/) (Hobby / Serverless compatible)

---

## 6. Authentication & RBAC Architecture

BTI enforces strict separation of concerns across identity, profile, and authorization:

```
                      +-----------------------------+
                      |   Firebase Authentication   |
                      |   (Identity & Credentials)  |
                      +--------------+--------------+
                                     | UID
                                     v
                      +-----------------------------+
                      |    Firestore Profile Layer  |
                      |        (/users/{uid})       |
                      +--------------+--------------+
                                     | Authoritative Role
                                     v
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
    +-------------------------+             +-------------------------+
    |   Government Clearance  |             |     Agency Clearance    |
    |   (/government/*)       |             |     (/agency/*)         |
    +-------------------------+             +-------------------------+
```

### Security Directives
1. **No Client Role Promotion**: User roles (`government`, `agency`, `public`) and verification statuses are authoritatively stored in Cloud Firestore. Roles cannot be modified from client-side state, URL params, or email domains.
2. **Controlled Government Access**: Government credentials cannot be created via public registration. Government accounts are provisioned directly by nodal administration.
3. **Agency Default Status**: Newly registered agencies default strictly to `pending` verification status with `verified: false`.
4. **Default-Deny Firestore Rules**: Firestore security rules block all unauthenticated operations and enforce strict owner-only access for profiles.

---

## 7. Demonstration & Evaluator Mode

For SIH evaluators and offline testing, BTI includes isolated demonstration profiles accessible via the login interface and the floating **Demo Switcher**:

- **Nodal Officer (Government)**: `alok.verma@gov.in` (Dr. Alok Verma, IAS — District Magistrate)
- **Verified Contractor (Agency)**: `rajesh@vikramadityainfra.in` (Er. Rajesh V. Sharma — Vikramaditya Infrastructure)
- **Pending Agency (Applicant)**: `contact@apexbuildtech.in` (Apex BuildTech Enterprises — Verification Pending)

> **Isolation Notice**: Evaluator demo authentication is strictly isolated in development state and never bypasses Cloud Firestore security rules in production.

---

## 8. Current Synthetic Data Disclaimer

> **IMPORTANT DISCLAIMER FOR EVALUATORS**:  
> All tender listings, bidder entities, contractor records, financial disbursements, and risk metrics currently rendered in the platform are **demonstration synthetic datasets** curated for architectural simulation and SIH evaluation.  
> 
> - External GST Suvidha Provider (GSP) API verification and live Government of India NIC databases are scheduled for Phase 2 integration.
> - Server-side Gemini AI anomaly detection and machine learning scoring will be attached in Phase 3.

---

## 9. Environment Variables

Create a `.env` file in the root directory (or configure Vercel Project Settings) with the following parameters:

```env
# Cloud Run / Host Service URL
APP_URL="http://localhost:3000"

# Firebase Web Client Configuration
VITE_FIREBASE_API_KEY="your-firebase-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
VITE_FIREBASE_APP_ID="your-firebase-app-id"
```

> **Security Note**: Never commit actual secrets or private service account credentials to GitHub. Frontend client variables use the `VITE_` prefix and are safe for web distribution.

---

## 10. Local Development

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### Setup Steps
```bash
# 1. Clone repository
git clone https://github.com/your-org/bharat-tender-intelligence.git
cd bharat-tender-intelligence

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start local development server (binds to http://localhost:3000)
npm run dev
```

---

## 11. Build & Validation

Run the statutory code verification pipeline before pushing changes or deploying:

```bash
# Run TypeScript compilation and strict lint checks
npm run lint

# Build production bundle with Vite and static asset optimization
npm run build
```

---

## 12. Future Roadmap

- **Phase 2 — Statutory Integrations & Tender Workflow**:
  - Live GSTIN verification via GSP API endpoints.
  - End-to-end tender creation, e-publishing, and encrypted bid submission.
  - Multi-stage proposal evaluation and e-procurement audit trails.
- **Phase 3 — AI Intelligence & Anomaly Scoring**:
  - Server-side Gemini 2.5 Pro tender document summarization and compliance matrix generation.
  - Graph-based cartel detection analyzing shared directors, IP submissions, and bidding patterns.
  - Geospatial satellite milestone verification and computer vision progress validation.
- **Phase 4 — Pilot Deployment**:
  - Rollout across pilot parliamentary constituencies under MoSPI nodal guidelines.

---

## License & Compliance
Governed under the Smart India Hackathon statutory development guidelines. Developed with standard public procurement security compliance principles.
