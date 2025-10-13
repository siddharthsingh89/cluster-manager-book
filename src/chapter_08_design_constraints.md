# **Chapter 8 - Design Constraints & Non-Functional Requirements (NFRs)**

Building a cluster manager isn’t just about functionality — it’s about **operating within real-world constraints** and **satisfying non-functional goals** like scalability, fault tolerance, and observability.
This chapter explores these **design boundaries and quality attributes** that shape every engineering decision in distributed control planes.

---

## **8.1. Why Constraints Matter**

Constraints define *the shape of your architecture*.
They restrict arbitrary design freedom and force trade-offs between performance, simplicity, and reliability.

> A perfect design in theory often fails in production because it ignores practical constraints — resource limits, network variability, or human operation.

Cluster managers are at the intersection of **systems, infrastructure, and human operations**.
They must behave predictably even when every assumption — about timing, load, or nodes — breaks.

---

## **8.2. Common Design Constraints**

### **1. Scale & Cardinality**

* Systems must handle **tens of thousands of nodes** and **hundreds of thousands of tasks**.
* Scheduler and control loops must scale horizontally or degrade gracefully.
* Metadata persistence (etcd, Zookeeper, Raft stores) must manage state without becoming a bottleneck.

**Example:**
Kubernetes uses watch-based caching (SharedInformer) to reduce API pressure, keeping load proportional to change rate rather than cluster size.

---

### **2. Heterogeneity**

* Clusters often mix **hardware generations**, **GPU/CPU types**, and **different runtime versions**.
* Scheduler must support heterogeneity-aware placement: e.g., “GPU nodes for training, CPU nodes for serving.”

**Example:**
Ray’s resource tags allow custom resource declarations (`"GPU": 2`, `"TPU": 1`).

---

### **3. Multi-tenancy & Isolation**

* Multiple teams or workloads share the same infrastructure.
* Must enforce:

  * **Quota isolation** (CPU/memory per tenant)
  * **Namespace-based policy enforcement**
  * **Security & access boundaries**

**Example:**
Kubernetes namespaces + RBAC model enforce both resource and identity isolation.

---

### **4. Resource Volatility**

* Nodes can fail, go offline, or be preempted (especially in cloud & spot markets).
* Control plane must tolerate churn:

  * Detect failure quickly.
  * Reconcile workloads automatically.
  * Maintain consistent view of desired vs. actual state.

**Example:**
Nomad’s clients automatically re-register and restore jobs after temporary disconnection.

---

### **5. Network Variability**

* Latency and partial partitions are common.
* Consensus protocols (Raft, Paxos) must handle leader reelection, delayed heartbeats, and duplicate messages.
* Control planes must not block user operations on transient network hiccups.

---

### **6. Security & Compliance**

* Enterprises impose constraints like:

  * Encryption in transit and at rest.
  * Authentication & authorization (RBAC, OIDC).
  * Audit trails.
* The control plane itself must resist malicious workloads or privilege escalation.

**Example:**
Kubernetes separates API authentication (via OIDC) from authorization (via RBAC, ABAC, or webhook).

---

### **7. Operator Complexity**

* Operators must understand and debug the system under pressure.
* Overly dynamic or opaque designs become unmanageable.
* **Observability and debuggability** become hard constraints.

**Example:**
Nomad’s minimal control plane makes it easier for small teams to operate than Kubernetes’ multi-component stack.

---

### **8. Consistency vs. Availability**

* Scheduler and control plane often face the CAP trade-off.
* Some components (state store) require strong consistency.
* Others (cache, informer) can accept eventual consistency for performance.

**Design Pattern:**
Use *strong consistency* for cluster metadata, and *eventual consistency* for workload states.

---

### **9. API Stability & Backward Compatibility**

* Once APIs are public (like Kubernetes CRDs), they become contractual.
* Backward-incompatible changes risk breaking production clusters.
* Versioning, deprecation policy, and API discovery are vital design constraints.

---

## **8.3. Non-Functional Requirements (NFRs)**

NFRs define *how* a system behaves rather than *what* it does.
Cluster managers must excel across multiple dimensions of quality attributes.

---

### **1. Scalability**

* Handle growth in:

  * **Nodes** → linear scaling of control plane.
  * **Pods / Tasks** → event-driven scheduling.
  * **Users / API requests** → caching, rate limiting, and sharding.
* Must maintain performance within predictable latency bounds.

**Kubernetes Example:**
Controller managers are horizontally scalable; each manages a subset of control loops.

---

### **2. Reliability & Fault Tolerance**

* System must tolerate node, process, and network failures.
* Key features:

  * Heartbeats and lease-based membership.
  * Automatic rescheduling.
  * Persistent state replication (Raft/Paxos).
* Recovery time objectives (RTO) define expected healing speed.

**Example:**
Borg reschedules tasks within seconds of node failure using checkpointed job state.

---

### **3. Availability**

* Control plane should be **highly available** through replication and failover.
* Even during leader election or partial failures, data plane should continue serving existing workloads.
* Stateless agents should survive control plane unavailability.

---

### **4. Performance & Efficiency**

* Minimize scheduling latency and API round trips.
* Avoid control plane “thundering herd” updates.
* Balance CPU utilization across nodes.
* Optimize watch and reconciliation frequency.

---

### **5. Observability**

* NFR that enables all others.
* Logs, metrics, traces, and events provide transparency.
* Key metrics: scheduler latency, reconciliation lag, etcd commit time, API QPS, queue lengths.
* Should support:

  * Structured logs
  * Metrics (Prometheus)
  * Tracing (OpenTelemetry)

---

### **6. Extensibility & Customizability**

* Must support adding new resource types, scheduling policies, and admission controls.
* API-driven extensibility prevents forking and keeps ecosystem healthy.
* Plugin-based models reduce maintenance cost.

---

### **7. Security**

* Authentication (who), authorization (what), admission control (how).
* Image scanning, runtime isolation, and secret management are essential.
* Multi-tenant RBAC + network segmentation are baseline requirements.

---

### **8. Maintainability**

* Code and system modularity.
* Testability of components (mocking schedulers, API fakes).
* CI/CD automation for updates and patching.

---

### **9. Auditability & Compliance**

* Actions must be traceable for compliance (SOC2, ISO, HIPAA).
* Every state change in the cluster must produce a corresponding audit record.

**Example:**
Kubernetes audit webhook logs every API request with actor identity and verb.

---

### **10. Interoperability**

* Must integrate with diverse ecosystems — storage, networking, monitoring.
* APIs and CRDs must be portable across clouds and vendors.
* Avoid vendor lock-in and encourage declarative definitions.

---

## **8.4. Design Tensions & Trade-offs**

Every NFR introduces competing pressures.
A good design balances rather than maximizes them.

| Tension                          | Description                           | Example Mitigation                              |
| -------------------------------- | ------------------------------------- | ----------------------------------------------- |
| **Performance vs. Consistency**  | Fast scheduling may skip global locks | Use optimistic concurrency (like Borg)          |
| **Simplicity vs. Extensibility** | Modular design adds cognitive load    | Keep extensibility via well-defined interfaces  |
| **Isolation vs. Utilization**    | Strong sandboxing reduces density     | Use cgroups, quotas, and overcommit heuristics  |
| **Availability vs. Safety**      | Strong consensus may block progress   | Use eventual consistency for non-critical state |
| **Security vs. Usability**       | Strict RBAC can hinder workflows      | Provide self-service namespaces and policies    |

---

## **8.5. Engineering Implications**

1. **Design modular subsystems early** — scheduling, control loops, storage.
2. **Separate read vs. write paths** for scalability.
3. **Cache aggressively but reconcile deterministically.**
4. **Instrument everything** — unknown failures are the real failures.
5. **Document operational assumptions** — humans are part of the system.
6. **Plan for evolution** — clusters live for years; APIs must survive multiple versions.

---

## **8.6. Summary**

Designing a cluster manager is as much about managing *non-functional complexity* as functional correctness.
You can always add features later — but fixing poor **scalability, availability, or observability** after deployment is exponentially harder.

> “Non-functional requirements are the real architecture.”

---

## **8.7. Exercises & Challenges**

1. **Explain:** Why is observability considered a non-functional requirement but critical to reliability?
2. **Design:** Propose a scalable API rate-limiting design for a cluster manager with 10,000 nodes.
3. **Compare:** How do Raft and Paxos support reliability and availability differently?
4. **Evaluate:** Which constraint — heterogeneity, isolation, or scale — most affects scheduling performance?
5. **Challenge:** Design a policy-driven multi-tenant isolation model balancing fairness and utilization.
6. **Discuss:** Why is simplicity itself a form of reliability in distributed systems?
7. **Implement:** Simulate a control loop that reconciles desired vs. actual state with exponential backoff after failure.
8. **Thought Exercise:** If observability systems fail, how would you debug a cluster manager itself?

---