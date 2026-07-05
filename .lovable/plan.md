# Plan d'optimisation AfriFlow

Ce plan couvre les 11 chantiers demandés. Vu l'ampleur, je propose de **livrer en 3 vagues** pour garder chaque livraison vérifiable. Confirme l'ordre ou ajuste.

## Vague 1 — Règles métier critiques (paiements & crédits)

### 1. Crédits d'appel (minutes incluses vs add-on)
- Le modèle `phone_wallets` distingue déjà `included_*` et `extra_seconds` → la logique de consommation existe.
- **Bouton "Recharger" conditionnel** : afficher uniquement si `includedMinutesRemaining ≤ 20` dans `WalletMinutesCard.tsx` et dashboard.
- **TopUpDialog** : ajouter affichage du prix double (XOF + ≈ EUR) — déjà partiellement fait.
- Copywriting carte : "Il vous reste X minutes incluses. Évitez toute interruption…"

### 2. Liens de paiement
- **Limite 500 €/jour** : nouvelle fonction SQL `daily_payment_amount(user_id)` + check dans `createPaymentLink` (conversion devise via `fx_rates`). Message d'erreur dédié.
- **Lien sur facture déjà payée** : dans `payments.tsx`, masquer "Générer un lien" quand `status='paid'`, afficher message + bouton "Créer une nouvelle demande".

### 3. Restrictions d'appels par pays
- Ajouter `allowed_call_countries` (TEXT[]) sur `phone_wallets` ou dérivé du plan.
- Dans `consumeCallMinutes` + UI composeur : bloquer si pays non inclus, afficher message + CTA "Voir les offres".

## Vague 2 — UX & onboarding

### 7+8. Numéro offert & activation
- Renommer "Obtenir un numéro" → "Activer mon numéro" partout.
- Carte onboarding dashboard vide (3 ✓ bullets).
- Flow 3 étapes : pays (FR/BE/DE/CA) → numéros disponibles → activation → badge "Essai offert · 10 min · expire le …".

### 6. Badge Bêta dashboard
- Badge "Bêta privée" + tooltip "Dépôts Mobile Money traités en <10 min".

### 9. Pagination 10/page
- `crm.tsx`, `payments.tsx`, `phone.tsx` (logs), dashboard transactions : composant `Pagination` shadcn déjà dispo.

### 4. Audit mobile
- Passe responsive sur : dashboard, phone composer, modales (TopUp, KYC), tables (→ cards en mobile), navigation, landing, pricing.
- Tests viewport 375/414 px.

## Vague 3 — Notifications, renouvellement & admin

### 5. Renouvellement abonnement (J-3, J-1, J0)
- Cron quotidien `/api/public/hooks/subscription-reminders` → enqueue emails + flag pour bannière in-app.
- Templates `subscription-expiring-3d`, `subscription-expiring-1d`, `subscription-expired`.
- Popup bloquante quand `plan_status='RESTRICTED'` (composant existe : `RestrictedOverlay`) → vérifier copy + CTA direct vers checkout MoMo.

### 10. Notifications paiement (in-app + email)
- Table `in_app_notifications` (user_id, type, title, body, read_at, metadata).
- Trigger sur webhook Stripe payé → notif "Paiement reçu" + email.
- Trigger sur payout "Marquer comme envoyé" → notif "Dépôt effectué" + email (existe déjà, à vérifier).
- Composant timeline statuts sur historique transactions.
- Bell/dropdown notifications dans le header.

### 11. Dashboard Admin payouts
- Route `/_authenticated/admin/payouts` (gate via `has_role('admin')`).
- Liste payouts avec colonnes demandées, filtres (statut), recherche (email/numéro), actions (Voir, Marquer envoyé/échoué, Note, Relancer).
- Stats du jour (transactions, collecté, reversé, commissions).
- Notification admin (email + in-app) sur nouveau payout en attente.
- Auto-création ligne `payouts` sur webhook Stripe `payment_intent.succeeded` (existe partiellement via `payout-simulator` — à brancher sur le vrai webhook).

### KYC simplification
- Retirer champ "justificatif de domicile" du formulaire `kyc.tsx` et du storage upload (garder pièce d'identité).

---

## Détails techniques clés

**Migrations SQL** :
1. `daily_payment_amount` function + index sur `payment_links(user_id, created_at)`.
2. `allowed_call_countries TEXT[]` sur `phone_wallets` (défaut selon plan).
3. `in_app_notifications` table + RLS + GRANTs + realtime publication.
4. Vue/RPC stats admin payouts.
5. `user_roles` + `has_role` (si absent — vérifier).

**Sécurité (findings actifs)** — fixés dans cette vague :
- `minute_transactions` : retirer policy INSERT user, restreindre service_role.
- `phone_wallets` : restreindre UPDATE/INSERT à service_role, garder SELECT user.
- `realtime.messages` : ajouter RLS scopée par topic/auth.uid().

**Côté code** :
- Tous les writes wallet/minutes passent déjà par server functions avec `requireSupabaseAuth` → compatible avec restriction service_role (utiliser `supabaseAdmin` côté serveur).
- `payment-link.functions.ts` : ajouter check 500€/jour avec conversion FX.
- Bell notifications : subscribe realtime `in_app_notifications` filtré par user_id.

---

## Question avant exécution

Vu la taille (≈ 30-40 fichiers, 4-5 migrations), je propose de **commencer par la Vague 1** (règles métier paiements + crédits + sécurité findings) puis enchaîner Vague 2 et 3 dans les messages suivants. Tu valides cet ordre ou tu préfères un autre découpage (ex : tout admin d'abord) ?