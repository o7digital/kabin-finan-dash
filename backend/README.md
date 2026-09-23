# Backend de démonstration

API Node sans dépendance externe. Les propositions et leurs statuts documentaires
sont enregistrés dans `backend/data/proposals.json` avec remplacement atomique du
fichier.

Le connecteur CRM est volontairement limité à `preview` et `simulate`. Il ne
contient aucun appel réseau et refuse un `CRM_MODE` autre que simulation/mock.

Routes : `GET /api/health`, `GET /api/catalogue`, `GET/POST /api/proposals`,
`GET /api/proposals/:id`, `PATCH /api/proposals/:id/documents/:documentId`,
`POST /api/crm/preview` et `POST /api/crm/simulate`.
