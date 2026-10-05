# EMMS BET — Production payment go-live checklist

This project now contains a server-side M-Pesa Daraja production connector, but the live-money switch is deliberately gated.

## 1. Regulatory gate

Before accepting real-money gambling in Kenya, complete the applicable Gambling Regulatory Authority licensing and operating requirements. The Gambling Control Act 2025 provides for online bookmaker licences, and the 2026 regulations govern licensing/conduct. Do not enable live wagering/payment collection before the required approvals are in place.

## 2. M-Pesa

Safaricom Daraja supports M-Pesa Express/STK Push, C2B and B2C. For production, obtain the appropriate live PayBill/Till/B2C arrangement and complete Daraja go-live. Configure the production credentials only as environment variables.

Required environment values are listed in `.env.example`.

## 3. Airtel Money

Obtain an approved Airtel Money merchant account and the production API contract/credentials. The adapter boundary is present in `payments/airtel.js`; do not guess production endpoint details.

## 4. Wallet ledger

Before live money is enabled, replace the prototype in-memory balance with a persistent append-only ledger and database transactions. Every provider callback must be idempotent and tied to an internal transaction ID.

## 5. Security

Use HTTPS, secure secrets management, admin MFA, rate limits, audit logging, webhook verification, database backups, monitoring and least-privilege service accounts.

## 6. Enablement

Only after the above is completed set:

REAL_MONEY_ENABLED=true
GAMBLING_LICENSE_CONFIRMED=true
PAYMENT_PROVIDER_APPROVED=true

These flags are intentionally separate so a developer cannot accidentally turn on live payments merely by changing the runtime environment.
