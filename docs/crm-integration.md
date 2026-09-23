# Préparation de l'intégration CRM Kabin

Cette note décrit le contrat observé en lecture seule dans la
[PR `crm-suites-o7#3`](https://github.com/o7digital/crm-suites-o7/pull/3), au commit
`a635302f0e93ecf5f1039fb14088ac99ef8fa479` le 23 septembre 2026.

La démonstration n'appelle jamais le CRM. Les routes locales `/api/crm/preview`
et `/api/crm/simulate` produisent uniquement un aperçu en mémoire. Aucun secret,
jeton ou URL de production n'est nécessaire ou accepté.

## Contrat observé

Le CRM expose un catalogue public en lecture seule :

- `GET /api/kabin/catalogue`
- seuls les véhicules `PUBLISHED` du tenant configuré sont renvoyés ;
- `KABIN_TENANT_ID` doit être défini côté CRM.

La création d'une demande est protégée par JWT et par le tenant de l'utilisateur :

- `POST /api/kabin/applications`
- `Authorization: Bearer <JWT>`

Payload préparé par la démo :

```json
{
  "name": "Mariana Torres",
  "email": "mariana@example.test",
  "phone": "+52 55 0000 0000",
  "company": null,
  "vehicleId": null,
  "amountMxn": 2250000,
  "downPercent": 25,
  "termMonths": 48,
  "annualRate": 17.5,
  "message": "Propuesta local KF-DEMO-…; blindaje y mensualidad sin campo CRM dedicado."
}
```

`vehicleId` reste `null` tant que le véhicule sélectionné ne vient pas du catalogue
CRM. Un identifiant local ne doit pas être envoyé au CRM.

## Données non couvertes par la PR

La PR ne prévoit pas encore de champs dédiés pour :

- le statut de chaque document ;
- plusieurs offres ou organismes financiers ;
- la mensualité calculée ;
- un identifiant externe de proposition ;
- le choix explicite du blindage sur la demande ;
- le consentement et l'idempotence.

La démo conserve ces données dans son propre stockage. Un résumé lisible est placé
dans `message` uniquement pour visualiser le transfert possible.

## Points à confirmer avant toute activation réelle

1. Appliquer la migration Kabin et confirmer le tenant CRM.
2. Définir la sémantique de `amountMxn` : investissement total ou montant financé.
3. Choisir un mécanisme serveur-à-serveur. Un endpoint dédié avec secret limité et
   clé d'idempotence est préférable à un JWT d'utilisateur longue durée.
4. Ajouter consentement, politique de conservation, limitation de débit et
   stratégie documentaire.
5. Tester uniquement dans un tenant et un environnement non productifs avant toute
   autorisation d'écriture.

Sources : [contrôleur Kabin](https://github.com/o7digital/crm-suites-o7/blob/a635302f0e93ecf5f1039fb14088ac99ef8fa479/api/src/kabin/kabin.controller.ts),
[service Kabin](https://github.com/o7digital/crm-suites-o7/blob/a635302f0e93ecf5f1039fb14088ac99ef8fa479/api/src/kabin/kabin.service.ts),
[schéma Prisma](https://github.com/o7digital/crm-suites-o7/blob/a635302f0e93ecf5f1039fb14088ac99ef8fa479/api/prisma/schema.prisma).
