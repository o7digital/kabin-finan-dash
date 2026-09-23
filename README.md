# Kabin Financial — démo fonctionnelle

Interface premium en espagnol avec API Node séparée. Tous les véhicules, prix,
taux et résultats sont fictifs et signalés comme tels.

## Lancer la démo

Prérequis : Node.js 20 ou plus récent.

```bash
npm start
```

Ouvrir <http://127.0.0.1:4173>. Les propositions et documents sont conservés
dans `backend/data/proposals.json`, y compris après rechargement ou redémarrage.

Commandes utiles :

```bash
npm run check   # syntaxe JavaScript
npm test        # API, persistance, documents et CRM simulé
npm run build   # paquet autonome dans dist/
```

## Architecture

- `frontend/` : interface vanilla responsive, calculs illustratifs et repli
  `localStorage` clairement affiché si l'API locale est indisponible.
- `backend/` : API HTTP, validation et stockage JSON atomique sans dépendance.
- `docs/crm-integration.md` : contrat relevé en lecture seule dans la PR CRM #3.

## Sécurité CRM

Le CRM est verrouillé en simulation. `/api/crm/preview` prépare le payload de
`POST /api/kabin/applications`; `/api/crm/simulate` confirme qu'aucun appel réseau
n'a été effectué. Le serveur refuse tout `CRM_MODE` différent de
`simulation`, `simulate` ou `mock`.

La PR CRM actuelle exige un JWT tenant-scoped et ne couvre pas les documents,
la mensualité, le consentement ni l'idempotence. Ces points doivent être résolus
dans un environnement de test avant d'envisager une écriture réelle.
