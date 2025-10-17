# **Chapter 18 - Security & Multi-Tenant Isolation**

Security is not an afterthought in distributed database systems; it is woven through every layer - from authentication and access control to encryption, auditing, and tenant isolation. In this chapter, we will explore the principles, architecture, and implementation patterns that ensure secure data operations and strong separation between tenants in a shared infrastructure.

---

## **18.1 Goals of Security Architecture**

A secure distributed database must achieve the following objectives:

1. **Confidentiality** – Ensure data is visible only to authorized entities.
2. **Integrity** – Prevent unauthorized or accidental data modification.
3. **Availability** – Ensure the system remains accessible under attack or fault.
4. **Isolation** – Guarantee tenant-level separation in multi-tenant systems.
5. **Traceability** – Provide audit trails for all security-sensitive operations.

These objectives guide design choices across identity, access, encryption, and operational policies.

---

## **18.2 Identity & Authentication**

Every request in the system must be attributable to a **principal** - a user, service, or application identity. Authentication establishes this principal before any operation is permitted.

### **18.2.1 Authentication Mechanisms**

* **Token-Based (JWT/OAuth2):** Common in API-driven systems where statelessness and delegation are required.
* **Mutual TLS:** Used in service-to-service communication for strong cryptographic identity.
* **API Keys / Service Credentials:** Suitable for internal machine users, stored in secure vaults.
* **Federated Identity (OIDC/SAML):** Enables integration with enterprise SSO providers.

### **18.2.2 Service Identity Example**

```rust
struct ServiceIdentity {
    service_name: String,
    certificate: X509Cert,
    private_key: PrivateKey,
}

impl ServiceIdentity {
    fn sign_request(&self, req: &mut Request) {
        let signature = crypto::sign(req.body(), &self.private_key);
        req.headers.insert("X-Service-Signature", signature);
    }
}
```

This mechanism allows microservices in a distributed setup to mutually authenticate and establish trust boundaries.

---

## **18.3 Authorization & Access Control**

Once authenticated, the system must determine *what* a principal can do. This is governed by authorization rules.

### **18.3.1 Role-Based Access Control (RBAC)**

* **Roles:** Define sets of permissions.
* **Policies:** Bind users or services to roles.
* **Scopes:** Limit the permission to specific databases, tables, or keys.

Example:

```json
{
  "role": "reader",
  "permissions": ["SELECT"],
  "scope": "tenant:1234/database:analytics"
}
```

### **18.3.2 Attribute-Based Access Control (ABAC)**

Policies can use context:

* Time of access
* Network location
* Tenant ID
* Data classification (confidential, public)

Example Policy:

> “Allow SELECT only if `tenant_id` matches token and `data_label != confidential`.”

---

## **18.4 Encryption & Key Management**

Encryption protects data at rest, in transit, and sometimes even in use (via confidential computing).

### **18.4.1 Encryption in Transit**

* TLS 1.3 for client connections
* mTLS for service-to-service
* Strict certificate rotation policies

### **18.4.2 Encryption at Rest**

* Per-tenant keys derived from a Key Encryption Key (KEK)
* Key versioning for rotation
* Hardware-backed vaults (e.g., HSM or KMS)

Example pseudocode:

```rust
fn encrypt_with_tenant_key(tenant_id: &str, data: &[u8]) -> EncryptedBlob {
    let key = key_manager::fetch(tenant_id);
    aes_gcm::encrypt(&key, data)
}
```

### **18.4.3 Key Hierarchy**

```
Master Key (KMS)
    ├── Tenant Key 1 (T1)
    ├── Tenant Key 2 (T2)
    └── Log Key (system audit)
```

---

## **18.5 Multi-Tenant Isolation**

In a multi-tenant database, strong isolation ensures that no tenant can access or impact another tenant’s data, performance, or resources.

### **18.5.1 Isolation Models**

| Level    | Strategy                            | Description             |
| -------- | ----------------------------------- | ----------------------- |
| Logical  | Shared schema with tenant_id column | Fast but weak isolation |
| Database | Separate database per tenant        | Balanced trade-off      |
| Physical | Dedicated nodes per tenant          | Strongest isolation     |

### **18.5.2 Resource Quotas**

* **CPU/Memory limits per tenant**
* **I/O and storage throttling**
* **Connection pool limits**

```rust
fn enforce_quota(tenant_id: &str, resource: ResourceType) -> Result<()> {
    let quota = quota_manager::get(tenant_id, resource);
    if quota.is_exceeded() {
        return Err(Error::ResourceLimitExceeded);
    }
    Ok(())
}
```

### **18.5.3 Metadata Partitioning**

Metadata services (like placement or configuration registries) must maintain per-tenant namespaces.

Example:

```
/meta/tenant_1234/replicas
/meta/tenant_1234/config
/meta/tenant_5678/replicas
```

This avoids cross-tenant leaks and ensures control-plane operations are scoped correctly.

---

## **18.6 Auditing & Compliance**

All security events should be captured and stored in tamper-evident logs.

### **18.6.1 Audit Events**

* User login, token issuance, and expiry
* Data access and modifications
* Admin policy updates
* Key rotations

### **18.6.2 Immutable Audit Storage**

* Append-only event log
* Merkle-tree hash chain for tamper detection
* Write-once storage (e.g., WORM)

Example:

```rust
fn append_audit_log(event: AuditEvent) {
    let hash = hash_chain::link(event);
    audit_store.append(hash);
}
```

---

## **18.7 Threat Modeling & Attack Surfaces**

### **Common Threats**

| Threat              | Description                             | Mitigation                              |
| ------------------- | --------------------------------------- | --------------------------------------- |
| Unauthorized Access | Stolen tokens or leaked keys            | Short-lived tokens, mTLS, vault storage |
| Data Leakage        | Cross-tenant access or misconfiguration | Namespace isolation, policy enforcement |
| Replay Attacks      | Reuse of old signed requests            | Nonce + timestamp validation            |
| Insider Threats     | Privileged misuse                       | Immutable audit logs, four-eye review   |

---

## **18.8 Security Contracts**

### **API SecurityContract**

```rust
trait SecurityContract {
    fn authenticate(req: &Request) -> AuthPrincipal;
    fn authorize(principal: &AuthPrincipal, action: &str, resource: &str) -> bool;
    fn encrypt(data: &[u8], tenant_id: &str) -> Vec<u8>;
    fn audit(event: AuditEvent);
}
```

This contract can be implemented by the system’s **security middleware**, enforcing identity, access, and audit consistently across services.

---

## **18.9 Challenges & Exercises**

**Challenges**

1. Design a per-tenant key rotation protocol that avoids downtime.
2. Implement row-level access control using tenant_id + data_label attributes.
3. Model audit log integrity verification using Merkle chains.

**Exercises**

* Simulate token expiry and refresh workflow in a distributed cluster.
* Evaluate performance impact of encryption at rest for large datasets.

---

## **Summary**

Security and isolation are not features - they are foundational to trust in any distributed database. A robust security model provides guarantees that:

* Each tenant’s data remains private and controlled.
* Operations are accountable and traceable.
* Keys, tokens, and policies evolve safely without downtime.

In the next chapter, we will examine **Observability & Diagnostics**, exploring how telemetry, tracing, and logging can provide insights into the secure and efficient functioning of the entire distributed system.

---