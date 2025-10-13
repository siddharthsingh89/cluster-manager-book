# **Chapter 7 - Comparative Survey**

This chapter performs a **comparative analysis of real-world cluster managers and orchestration systems** — identifying their architectural differences, scheduling models, fault tolerance techniques, and control plane designs.
By understanding their trade-offs, we can see how design choices align with workloads, organizational scale, and historical evolution.

---

## **7.1. Why a Comparative Survey Matters**

Distributed system design doesn’t exist in a vacuum.
Every cluster manager — from **Kubernetes** to **Mesos**, **Nomad**, or **Borg** — reflects a particular **set of assumptions**:

* Type of workloads (stateful vs. stateless)
* Resource heterogeneity
* Fault domains
* Latency tolerance
* Organizational maturity and operational practices

A comparative study helps us answer:

* How do different systems separate control and data planes?
* What are their scheduling strategies?
* How do they handle failures, scaling, and extensibility?
* What trade-offs were consciously made?

---

## **7.2. Systems Covered**

We’ll focus on five representative systems across eras and industries:

| System              | Origin                 | Era   | Focus                                              |
| ------------------- | ---------------------- | ----- | -------------------------------------------------- |
| **Borg**            | Google                 | 2003+ | Large-scale production workloads, internal only    |
| **Apache Mesos**    | UC Berkeley / Twitter  | 2010  | Multi-framework resource sharing                   |
| **Kubernetes**      | Google OSS             | 2014  | Declarative orchestration & cloud-native workloads |
| **HashiCorp Nomad** | HashiCorp              | 2015  | Simplicity, multi-environment (bare metal + cloud) |
| **Ray**             | UC Berkeley / Anyscale | 2018  | Distributed ML & data-intensive tasks              |

---

## **7.3. Architectural Overview**

| Aspect             | Borg                               | Mesos                     | Kubernetes                                  | Nomad                   | Ray                 |
| ------------------ | ---------------------------------- | ------------------------- | ------------------------------------------- | ----------------------- | ------------------- |
| **Control Plane**  | Centralized master with schedulers | Master with Mesos agents  | API Server + Controller Manager + Scheduler | Single leader with Raft | Head node           |
| **Data Plane**     | Borglets (node agents)             | Mesos agents              | Kubelet                                     | Nomad client            | Worker nodes        |
| **API Model**      | Proprietary                        | Framework-based (2-level) | Declarative (YAML)                          | Declarative (HCL / API) | Python API          |
| **Persistence**    | Paxos replicated store             | Zookeeper                 | etcd                                        | Raft                    | GCS/Redis/Pluggable |
| **Extensibility**  | Internal                           | Framework API             | CRDs & Operators                            | Plugins                 | Custom actor model  |
| **Workload Types** | Batch + long-running               | Multi-framework           | Containerized                               | Any binary              | ML actors / tasks   |

---

## **7.4. Scheduling Models**

Scheduling is a defining characteristic.

| System         | Scheduler Type                            | Decision Mode                | Notes                                 |
| -------------- | ----------------------------------------- | ---------------------------- | ------------------------------------- |
| **Borg**       | Monolithic centralized scheduler          | Optimistic & hierarchical    | Multi-pass with constraints           |
| **Mesos**      | Two-level (offers + framework schedulers) | Decentralized                | Each framework makes final choice     |
| **Kubernetes** | Single central scheduler (pluggable)      | Declarative binding          | Extensible via Scheduler Framework    |
| **Nomad**      | Centralized, parallel region schedulers   | Bin-packing + affinity rules | Simple and fast                       |
| **Ray**        | Decentralized task scheduler              | Work-stealing & actor model  | Optimized for latency-sensitive tasks |

### Key Observation

* Borg and Kubernetes optimize for **fairness + utilization**.
* Mesos optimizes for **sharing across frameworks**.
* Ray optimizes for **low-latency dynamic scheduling** in ML workflows.

---

## **7.5. Control Plane Designs**

The **control plane** defines system behavior, policy enforcement, and observability.

| System         | Control Plane Composition                       | Characteristics                                           |
| -------------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Borg**       | Monolithic master with RPC APIs                 | Internal, strong consistency                              |
| **Mesos**      | Master + Zookeeper                              | Two-level control (master + frameworks)                   |
| **Kubernetes** | API Server, Controller Manager, Scheduler, etcd | Layered and loosely coupled                               |
| **Nomad**      | Single Raft cluster                             | Simple design, high availability                          |
| **Ray**        | Head node + GCS                                 | Dynamic control, focuses on distributed computation graph |

Kubernetes evolved from Borg’s experience — but made a **clean separation of concerns**, exposing user-facing APIs and modular control loops instead of a single monolith.

---

## **7.6. Fault Tolerance & Recovery**

| System         | State Store       | Consensus Protocol | Failure Handling                           |
| -------------- | ----------------- | ------------------ | ------------------------------------------ |
| **Borg**       | Chubby (Paxos)    | Paxos              | Checkpointed job state, fast reschedule    |
| **Mesos**      | Zookeeper         | ZAB (Paxos-like)   | Failover master, agent reconnection        |
| **Kubernetes** | etcd              | Raft               | Stateful reconciliation loop               |
| **Nomad**      | Embedded Raft     | Raft               | Job retry and task promotion               |
| **Ray**        | GCS (Redis-based) | Custom             | Stateless recomputation and lineage replay |

> Note: The key difference is **state persistence**.
> Systems like Ray often recompute, while Kubernetes persists declarative state.

---

## **7.7. Workload & Resource Models**

| System         | Workload Types      | Resource Abstraction            |
| -------------- | ------------------- | ------------------------------- |
| **Borg**       | Jobs, tasks         | CPU, RAM, Disk, Quota           |
| **Mesos**      | Framework-defined   | Generic resources (offers)      |
| **Kubernetes** | Pods, Deployments   | CPU/memory requests, QoS        |
| **Nomad**      | Jobs, Groups, Tasks | Flexible resource sets          |
| **Ray**        | Actors, Tasks       | Custom resources (GPUs, memory) |

Kubernetes popularized **declarative resource requests**, balancing simplicity with scheduling efficiency.

---

## **7.8. Ecosystem and Extensibility**

| System         | Extensibility                    | Ecosystem Strength           |
| -------------- | -------------------------------- | ---------------------------- |
| **Borg**       | Closed                           | Internal only                |
| **Mesos**      | Frameworks (e.g., Spark, Aurora) | Declining                    |
| **Kubernetes** | CRDs, Operators, Webhooks        | Vast, open ecosystem         |
| **Nomad**      | Drivers, Integrations            | Moderate                     |
| **Ray**        | Python APIs, libraries           | Fast-growing in ML workloads |

The Kubernetes ecosystem dwarfs others in tooling, monitoring, networking, and extensibility — a major reason for its industry dominance.

---

## **7.9. Operational Complexity**

| System         | Ease of Setup       | Operational Complexity | Scaling Behavior             |
| -------------- | ------------------- | ---------------------- | ---------------------------- |
| **Borg**       | Internal tooling    | Very high              | Massive scale (100k+ nodes)  |
| **Mesos**      | Moderate            | Medium                 | Horizontally scalable        |
| **Kubernetes** | Medium              | High (many components) | Proven to thousands of nodes |
| **Nomad**      | Simple              | Low                    | Linear scaling               |
| **Ray**        | Easy (Python-first) | Low                    | Scales for ML workloads      |

Nomad is often praised for simplicity — Kubernetes for ecosystem — Borg for operational excellence.

---

## **7.10. Evolutionary Insights**

1. **Borg → Kubernetes**

   * Declarative model and reconciliation loops adopted from Borg’s lessons.
   * Kubernetes externalized the internal patterns for community use.

2. **Mesos → Decline**

   * Strong in theory, but fragmented by competing frameworks.
   * Kubernetes unified workloads under one API.

3. **Nomad → Pragmatic Simplicity**

   * Chose operational simplicity over ecosystem complexity.

4. **Ray → Specialized for AI**

   * Focused on distributed computation rather than general orchestration.

---

## **7.11. Comparative Takeaways**

| Category                        | Winner (Pragmatic) | Why                             |
| ------------------------------- | ------------------ | ------------------------------- |
| **Ecosystem & Adoption**        | Kubernetes         | Huge community & vendor support |
| **Simplicity**                  | Nomad              | Minimal moving parts            |
| **Scalability**                 | Borg               | Proven internal scale           |
| **Multi-framework flexibility** | Mesos              | Two-level model                 |
| **AI/ML native scheduling**     | Ray                | Dynamic actor-based             |

**Kubernetes** won the broad adoption war because it balanced *openness*, *API design*, and *ecosystem extensibility*.

---

## **7.12. Design Lessons for Future Cluster Managers**

1. **Expose clear declarative APIs**, not ad hoc RPCs.
2. **Keep control plane modular** — allow independent evolution.
3. **Design for failure** — recovery loops are more valuable than perfect prevention.
4. **Allow custom schedulers** — different workloads demand different trade-offs.
5. **Optimize for human operators** — clarity and visibility are critical.
6. **Ecosystem beats features** — extensibility ensures longevity.
7. **Integrate policy and governance early** — security, quotas, and audit must be native.

---

## **7.13. Exercises & Discussion**

1. **Explain** how the two-level scheduling model in Mesos differs from Kubernetes’ centralized approach.
2. **Discuss** why Kubernetes’ reconciliation loop design makes it resilient to control plane crashes.
3. **Compare** Borg and Kubernetes in terms of API philosophy.
4. **Which system would you choose** for large-scale ML pipelines and why?
5. **Identify** the advantages of Nomad’s simpler Raft-based control plane over Kubernetes’ multi-component setup.
6. **Design Challenge:** Sketch a hybrid cluster manager that blends Nomad’s simplicity with Kubernetes’ extensibility.
7. **Research Task:** Compare Ray’s actor model scheduling to Spark’s DAG scheduling.
8. **Thought Exercise:** If you were building a new cluster manager today, which architectural patterns would you borrow from which systems?

---