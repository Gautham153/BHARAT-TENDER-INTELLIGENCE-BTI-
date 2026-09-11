// Bharat Tender Intelligence (BTI) — Serverless Architecture Blueprint
// Consolidating Phase 1+ backend boundaries to 4 clean serverless endpoints

export interface ServerlessEndpointContract {
  endpoint: string;
  method?: string;
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE')[];
  description: string;
  scope: 'Public' | 'Government' | 'Agency';
}

export const FUTURE_SERVERLESS_ENDPOINTS: ServerlessEndpointContract[] = [
  {
    endpoint: '/api/auth',
    method: 'POST',
    methods: ['POST'],
    description: 'Firebase Auth token verification, RBAC role claims & session management',
    scope: 'Public',
  },
  {
    endpoint: '/api/data',
    method: 'GET, POST, PUT',
    methods: ['GET', 'POST', 'PUT'],
    description: 'Firestore CRUD for tenders, proposals, projects, audits, & public aggregations',
    scope: 'Government',
  },
  {
    endpoint: '/api/ai',
    method: 'POST',
    methods: ['POST'],
    description: 'Gemini 2.5/Flash & custom ML model inference for anomaly detection & document OCR',
    scope: 'Government',
  },
  {
    endpoint: '/api/verification',
    method: 'POST',
    methods: ['POST'],
    description: 'GST / PAN / e-Tender external registry verification bridge',
    scope: 'Agency',
  },
];

export const FUTURE_API_ENDPOINTS = FUTURE_SERVERLESS_ENDPOINTS;
