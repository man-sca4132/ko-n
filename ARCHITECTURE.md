# EMMS BET v2 Architecture

This is a development/sandbox prototype. It is not a production real-money gambling system.

## Production layers
Browser → API → authentication → wallet ledger → betting → KYC/responsible gambling → admin → payment adapters.

## Recommended database tables
users, roles, sessions, kyc_profiles, kyc_documents, responsible_limits, self_exclusions, wallets, wallet_ledger_entries, bets, events, markets, odds, deposits, withdrawals, payment_webhooks, admin_actions, audit_logs.

## Wallet
Production should use an append-only double-entry ledger, unique transaction IDs, idempotency keys, provider references and immutable audit logs. Do not rely on a mutable balance as the sole financial record.

## Payments
Implement M-Pesa and Airtel Money behind server-side provider adapters. Keep credentials and secrets off the frontend. Verify webhooks and make payment operations idempotent.

## KYC / responsible gambling
Use compliant identity verification, age checks, secure document handling, betting/deposit limits, self-exclusion, cooling-off/account-closure controls and monitoring appropriate to the jurisdiction.

## Admin
Use strong authentication, MFA, role-based access, least privilege, audit logs and controlled KYC/withdrawal workflows.

## Launch gate
Before accepting real-money wagers or payments, complete the applicable Kenyan licensing/regulatory requirements, payment-provider onboarding, KYC/AML controls, security testing, responsible-gambling controls and reporting/tax obligations. Do not enable production payments by merely changing a configuration flag.
