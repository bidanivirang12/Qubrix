# ADR-0011: Open decisions and proposed defaults

- **Status:** Proposed defaults; owner decisions required
- **Date:** 2026-10-12

These defaults are for implementation planning only. Each row **needs owner decision** before production rollout. They are not a regulatory or contractual retention determination and must be reconciled with customer agreements, applicable law, legal holds, cost, and operational evidence.

| Decision | Proposed default | Decision status | Decision owner |
|---|---|---|---|
| Event, verification, assessment, and finding retention | Retain online for 365 days, then purge tenant-scoped records unless a configured hold applies; preserve only separately approved audit metadata as required. | **needs owner decision** | Project owner, with legal/privacy review |
| Audit-record retention | Retain for 365 days as a starting operational default; extend only after legal, contractual, and business requirements are confirmed. | **needs owner decision** | Project owner, with legal/privacy review |
| Backup retention | Encrypted backups retained for 35 days, with deletion/purge state reconciled after restore and holds preventing purge. | **needs owner decision** | Project owner and database/operations owner |
| Replay freshness window | 30 days, matching the current proposed maximum event ingestion age; retain nonce/event replay markers at least through that window. | **needs owner decision** | Project owner and security owner |
| Rate-limit quotas | Initial testable defaults: SERVICE event ingestion 60 requests/minute per organization and principal; crypto endpoints 10/minute per principal; human reads 120/minute and human writes 30/minute per principal. Configure by route class and adjust using observed load/abuse data. | **needs owner decision** | Project owner and service operations owner |
| Maximum request body | 1 MiB per request, enforced at ingress and again by the API before parsing. | **needs owner decision** | Project owner and service operations owner |
| JWKS cache lifetime | Cache trusted issuer JWKS for 300 seconds, with bounded refresh behavior on an unknown key. | **needs owner decision** | Project owner and identity-provider owner |
| JWT clock-skew leeway | Allow 60 seconds for `nbf` and `exp` claim comparisons. | **needs owner decision** | Project owner and identity-provider owner |
| Signed-message timestamp skew | Accept signed-message timestamps within 300 seconds of server time; reject outside the tolerance and apply replay handling separately. | **needs owner decision** | Project owner and security owner |
| JWT signing algorithm allowlist | Start with `RS256` and `ES256`; never accept `none` or fall back to an algorithm not explicitly configured. | **needs owner decision** | Project owner and identity-provider owner |
| Production KMS/HSM provider | Keep the provider adapter vendor-neutral; default to a managed external KMS/HSM with non-exportable keys in each deployment environment. Do not enable a development/software key provider in production. Select a named provider only after deployment, availability, region, key-policy, and cost requirements are known. | **needs owner decision** | Project owner and key-management owner |

No proposed value is approved for production until the named owner records the decision, rationale, and any superseding constraints in an ADR and updates the related API, data-model, security, and operational documentation.
