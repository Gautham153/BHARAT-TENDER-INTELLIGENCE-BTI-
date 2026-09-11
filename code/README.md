# Bharat Tender Intelligence (BTI)

> **Statutory Integrity, Tender Lifecycle Governance & Deterministic Procurement Intelligence for the MPLADS Ecosystem**  
> *Smart India Hackathon (SIH) — Public Procurement & Infrastructure Governance Track*

---

## 1. Overview

**Bharat Tender Intelligence (BTI)** is an institutional governance and public procurement intelligence platform engineered to bring radical transparency, deterministic compatibility matching, milestone-linked fiscal accountability, and immutable audit trails to India's Member of Parliament Local Area Development Scheme (MPLADS) and civil infrastructure works.

BTI provides an integrated digital ecosystem connecting **Citizens**, **District Collectors / Nodal Officers**, and **Executing Agencies / Contractors** under a single statutory verification framework.

---

## 2. Problem Being Addressed

Public infrastructure procurement under MPLADS faces systemic operational challenges:
- **Collusive Bidding & Opaque Eligibility**: Subcontractor obscurity, unverified contractor turnover, and misaligned project awards.
- **Verification Bottlenecks**: Manual document verification resulting in delayed tendering cycles and ghost contractor risks.
- **Opaque Fund Utilization**: Disconnect between physical ground execution and milestone disbursement tranches.
- **Citizen Information Asymmetry**: Limited public visibility into local constituency works, sanctions, and contractor performance.

BTI addresses these challenges by combining rigorous Role-Based Access Control (RBAC), statutory entity verification (GSTIN/PAN), deterministic contractor compatibility matching, milestone-gated fund disbursements, and append-only audit tracking.

---

## 3. Key Portals & Workspaces

### 🏛️ Citizen Transparency Portal (`/`, `/map`, `/transparency`)
- **Constituency Project Mapping**: Interactive geographic explorer detailing sanctioned works across districts.
- **Statutory Transparency Registry**: Searchable repository of public tenders, work orders, allocated budgets, and milestone records.
- **Open Audit Data**: Track sanctioned allocations against actual ground progress.

### 🛡️ Government Intelligence Portal (`/government/*`)
- **Nodal Officer Command Center**: Executive KPI monitoring, active tender tracking, and lifecycle administration.
- **Tender Lifecycle Management**: Create drafts, update specifications, publish e-tenders, close bidding windows, cancel with mandatory justification notes, and archive completed tenders.
- **Immutable Audit Trail**: Append-only event registry capturing all lifecycle actions (creation, publishing, updates, closures, cancellations) with actor ID and timestamp.
- **Forensic Risk & Investigation Registry**: Collusion indicators, price variance tracking, and bid clustering analytics.

### 🏢 Agency / Contractor Workspace (`/agency/*`)
- **Statutory Onboarding**: 3-step agency registration with 15-character GSTIN structure validation and statutory declarations.
- **Active Opportunity Discovery**: Filter, search, and explore active live tenders matching enterprise capabilities.
- **Deterministic Match Compatibility**: Inspectable 4-criteria compatibility score computed transparently against registered entity parameters.
- **Milestone & Disbursement Tracker**: Geo-tagged work completion proof submissions and tranche release statuses.
- **Institutional Compliance Health**: Verification status monitoring and statutory credentials portfolio.

---

## 4. Implementation Status Across Phases

| Phase | Status | Scope & Delivered Architecture |
| :--- | :--- | :--- |
| **Phase 0** | **Complete & Locked** | Core design system, tokens, high-density layouts, interactive maps, Recharts visualizers, and public transparency portal. |
| **Phase 1A** | **Complete & Locked** | Authentication UI, 3-step agency registration flow, GSTIN format validation, and route access boundaries. |
| **Phase 1B** | **Complete & Locked** | Firebase Authentication integration, Cloud Firestore user profiles (`/users/{uid}`), persistent RBAC, and default-deny security rules. |
| **Phase 2A** | **Complete & Locked** | Statutory Organization Model, 15-char GSTIN verification engine, verification status lifecycle (`unverified`, `pending`, `verified`, `rejected`), and VerificationGate. |
| **Phase 3A** | **Implemented — pending final manual verification** | Government Tender Lifecycle Engine: end-to-end Draft, Published (Live), Closed, Cancelled, and Archived states with state-machine transition guards, input validation, atomic writeBatch lifecycle mutations, and append-only audit event persistence. |
| **Phase 3B** | **Implemented — pending final manual verification** | Agency Tender Discovery, Opportunity Workbench, and 4-Criteria Immutable Deterministic Matching Model (35/25/20/20) with inspectable breakdown, zero-value protection, and statutory financial capacity calculations. |

---

## 5. Phase 3B: Deterministic Matching Engine

BTI features a **strictly deterministic, rule-based, and explainable** matching engine (`TenderMatchingService`) that evaluates enterprise compatibility without any machine learning models, probabilistic inference, or external LLM calls.

### The Four Major Deterministic Criteria (100 Points Total)

All weights are immutable constants defined in `BTI_DETERMINISTIC_WEIGHTS` summing to exactly 100 points:

1. **Sector & Category Alignment (35 Points)**:
   - Primary Sector Match: 25 pts (Contractor's registered business classification directly matches tender category)
   - Scope & Subcategory Alignment: 10 pts (Detailed procurement scope matches documented enterprise specializations)

2. **Geographic Jurisdiction (25 Points)**:
   - State Jurisdiction: 15 pts (Project location within contractor's registered home state)
   - District & Regional Base: 10 pts (Headquarters or operational presence within tender district)

3. **Operational Capabilities (20 Points)**:
   - Registered Technical Capabilities: 20 pts (Direct overlap between registered technical capabilities and project scope)
   - Registered Sector Baseline: 10 pts (Registered contractor classification aligned with tender category)

4. **Financial Capacity Ratio (20 Points)**:
   - Evaluated as: `Financial Capacity Ratio = Organization Annual Turnover ÷ Tender Estimated Value`
   - Explicit Deterministic Thresholds (for verified turnover):
     * **Ratio ≥ 3.0x**: 20 pts (Superior capacity: annual turnover exceeds 300% of tender value)
     * **Ratio ≥ 1.5x**: 15 pts (Strong capacity: annual turnover exceeds 150% of tender value)
     * **Ratio ≥ 1.0x**: 10 pts (Adequate capacity: annual turnover meets or exceeds 100% of tender value)
     * **Ratio ≥ 0.5x**: 5 pts (Marginal capacity: annual turnover covers 50%–99% of tender value)
     * **Ratio < 0.5x**: 0 pts (Insufficient capacity: annual turnover falls below 50% threshold)
   - **Statutory Financial Capacity Verification**:
     * If `financialCapacityVerified !== true`, turnover is treated as self-declared / unverified. Unverified turnover is awarded 0/20 pts with clear, transparent explanation distinguishing verified capacity from unverified declarations.
   - **Zero or Missing Tender Value Handling**:
     * If tender estimated value is ₹0, missing, or unavailable, BTI does NOT fabricate an artificial ratio (e.g. 3.0x) or award unearned points. The ratio is marked unavailable, division by zero is strictly prevented, and 0/20 pts is awarded with a transparent explanatory note.

### Pluggable Matching Architecture (`ITenderMatcher`)
The matching engine follows the Strategy pattern via the `ITenderMatcher` interface. The UI components (`TenderOpportunityCard`, `TenderMatchBadge`, `TenderMatchExplanation`) interact exclusively through the abstract `TenderMatchingService` facade. This ensures that any future ML/AI scoring engine can be introduced as a pluggable implementation without altering consumer components or UI contracts.

---

## 6. Security, Access Authorization & Lifecycle Visibility

### Strict Tender Lifecycle Transitions
The BTI state machine strictly enforces legal transitions across both application logic and Firestore security rules:
- `DRAFT` ➔ `PUBLISHED` / `LIVE` | `CANCELLED`
- `PUBLISHED` / `LIVE` ➔ `CLOSED` | `CANCELLED`
- `CLOSED` ➔ `UNDER_EVALUATION` | `ARCHIVED`
- `UNDER_EVALUATION` ➔ `AWARDED` | `CANCELLED`
- `AWARDED` ➔ `ARCHIVED`
- `CANCELLED` ➔ `ARCHIVED`
- `ARCHIVED` ➔ Terminal (no further transitions permitted)
Direct illegal jumps (e.g., `DRAFT` ➔ `AWARDED` or modifying closed tenders) are blocked.

### Agency Active-Tender Visibility Policy
To prevent premature or improper bidding and protect sensitive administrative workflows:
- **Agency users are strictly restricted to active, unexpired tender opportunities.**
- Only tenders with active status (`PUBLISHED`, `LIVE`, `Open`) whose `closingDate` has not expired can be queried or retrieved by agencies.
- `TenderService.getTenderById` and `TenderService.listTenders` reject/return `null` for non-active or expired tenders:
  * `DRAFT`
  * `CLOSED`
  * `UNDER_EVALUATION`
  * `AWARDED`
  * `CANCELLED`
  * `ARCHIVED`
  * Any tender where `now >= closingDate` (evaluated via `getEffectiveTenderStatus`)
- Government nodal officers retain full lifecycle visibility across all statuses.
- This visibility policy is enforced at both the application service layer (server-side Firestore queries) and authoritatively via Cloud Firestore security rules.

### Atomic Lifecycle & Audit Mutations (`writeBatch`)
- All tender lifecycle changes (`createTender`, `updateTenderDraft`, `publishTender`, `closeTender`, `cancelTender`, `archiveTender`) use Firestore `writeBatch` to commit the tender document state and corresponding audit event atomically.
- In authenticated sessions, authoritative writes must succeed; failures are not masked with fake local persistence.

### Immutable, Append-Only Audit Integrity
- Tender audit events are stored under the `/tenderEvents/{eventId}` collection.
- Audit events are strictly **append-only**: updates and deletions are blocked by security rules and service methods.
- Every lifecycle transition (`CREATED`, `UPDATED`, `PUBLISHED`, `CLOSED`, `CANCELLED`, `ARCHIVED`) records an authoritative audit event with actor identity, role, timestamp, and transition notes.
- Reading audit events in an authenticated session reads authoritatively from Firestore without falling back to synthetic local events.

---

## 7. Technology Stack

- **Frontend Core**: [React 18+](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Build System & Tooling**: [Vite](https://vitejs.dev/) with native ES module compilation
- **Styling & Design System**: [Tailwind CSS](https://tailwindcss.com/) with national governance palette and high-contrast typography
- **Authentication**: [Firebase Authentication](https://firebase.google.com/products/auth) (Email & Password provider)
- **Database**: [Cloud Firestore](https://firebase.google.com/products/firestore) (`/users/{uid}`, `/organizations/{orgId}`, `/tenders/{tenderId}`, `/tenderEvents/{eventId}`)
- **Animation & Transitions**: Motion layout engine with `prefers-reduced-motion` compliance
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 8. Local Development & Validation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### Setup Steps
```bash
# 1. Install dependencies
npm install

# 2. Start local development server (binds to http://localhost:3000)
npm run dev
```

### Verification Pipeline
```bash
# Run TypeScript compilation and strict lint checks
npm run lint

# Build production bundle with Vite
npm run build
```

---

## License & Compliance
Governed under the Smart India Hackathon statutory development guidelines. Engineered with standard public procurement security compliance and auditability principles.
