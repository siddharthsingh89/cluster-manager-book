# **Chapter 3 - Core Concepts and Terminology**

Before we explore the design, implementation, and evolution of cluster managers, we need to establish a shared language. Cluster management systems build upon distributed systems theory, operating systems principles, and scheduling algorithms — each contributing its own terms and abstractions.
This chapter consolidates these into a concise but clear glossary of *core concepts* you’ll encounter throughout the book.

---

## 3.1 What Is a Cluster?

A **cluster** is a group of interconnected computers (often called *nodes*) that work together as a single logical system. Each node runs one or more components of the distributed application.
From the outside, the cluster appears as one unified service, but internally, coordination among nodes is crucial for consistency, availability, and performance.

**Example:**

* A Kubernetes cluster consists of multiple worker nodes managed by a control plane.
* A Hadoop cluster includes data nodes and a name node managing metadata.

---

## 3.2 Node

A **node** is an individual machine (physical or virtual) that participates in the cluster.
Nodes may serve different roles:

* **Master / Control Plane Node:** manages state, orchestrates workloads, monitors health.
* **Worker Node:** executes the actual workloads (containers, jobs, tasks).

Each node runs an agent or daemon that communicates with the cluster manager, reporting its resource availability and health.

---

## 3.3 Resource

**Resources** are the measurable compute capacities a node offers to the cluster — typically CPU cores, memory, disk, and network bandwidth.
Modern cluster managers use *resource abstraction* to enable fair and efficient scheduling.

For example:

* “This job needs 4 CPUs and 8GB RAM.”
* “This container requests a GPU and network bandwidth of 100Mbps.”

---

## 3.4 Scheduler

The **scheduler** is the component that decides *where* a workload should run.
It matches **resource offers** from nodes to **resource requests** from applications.
Schedulers can use various strategies:

* **Bin-packing:** maximize utilization by tightly fitting workloads.
* **Spread:** distribute workloads across nodes for fault tolerance.
* **Priority-based:** higher-priority jobs preempt or out-rank lower ones.

Schedulers operate on abstract representations of nodes and jobs, making them core to every cluster manager’s intelligence.

---

## 3.5 Task / Job / Workload

A **task** (or **job**, depending on the system) is the smallest unit of work submitted to the cluster.
Each task specifies:

* Resource requirements (CPU, memory, etc.)
* Execution logic (a binary, container, or script)
* Constraints (node affinity, region, etc.)

Tasks may be grouped into **applications**, **pods**, or **deployments**, depending on the system’s terminology.

---

## 3.6 Controller / Reconciler

A **controller** (sometimes called a **reconciler**) continuously drives the system from its *current state* toward the *desired state*.
The desired state is defined by user intent (e.g., “I want 3 replicas of this service”).
Controllers observe system changes and take corrective actions to maintain consistency.

This “**control loop**” model — *observe → compare → act* — is the backbone of systems like Kubernetes and Borg.

---

## 3.7 State and Metadata

The **cluster state** represents all active nodes, workloads, and their relationships.
It can be divided into:

* **Desired State:** What should be running.
* **Actual State:** What is currently running.

This state is typically stored in a **metadata store** (e.g., etcd, ZooKeeper, Consul).
Maintaining correctness and availability of this store is critical — it’s the cluster’s source of truth.

---

## 3.8 Control Plane vs. Data Plane

Every cluster manager is logically split into two layers:

* **Control Plane:**
  Handles decisions — scheduling, coordination, monitoring, and API handling.
  (e.g., Kubernetes API Server, BorgMaster)

* **Data Plane:**
  Executes workloads and handles data movement.
  (e.g., container runtime, task executor)

This separation allows for scalability, resilience, and clear responsibility boundaries.

---

## 3.9 Heartbeats and Health Checking

Nodes and tasks periodically send **heartbeats** to indicate liveness.
The manager uses these signals to detect failures and trigger recovery actions.
Common techniques:

* Timeouts for missed heartbeats.
* Active probing using health endpoints.
* Gossip-based failure detection (in decentralized systems).

---

## 3.10 Service Discovery

In a dynamic cluster, nodes and services appear and disappear frequently.
**Service discovery** enables clients and internal components to find where a service currently runs.
Techniques include:

* Central registry (like etcd, Consul)
* DNS-based discovery
* Gossip or peer-to-peer updates

---

## 3.11 High Availability (HA)

**High Availability** ensures that cluster management services themselves are fault-tolerant.
Typical strategies:

* Leader election for master components
* Replication of metadata
* Watchdog restarts and quorum mechanisms

Without HA, a cluster manager itself becomes a single point of failure.

---

## 3.12 Consensus

To maintain a consistent view of cluster state across multiple replicas, systems use **consensus algorithms** such as:

* **Raft**
* **Paxos**
* **ZAB (ZooKeeper Atomic Broadcast)**

Consensus ensures that all healthy control-plane replicas agree on decisions even if some fail or messages are delayed.

---

## 3.13 Scaling

Two forms of scaling matter:

* **Horizontal Scaling:** Add or remove nodes.
* **Vertical Scaling:** Increase node capacity (CPU/RAM).

Cluster managers must gracefully rebalance workloads and redistribute resources as capacity changes.

---

## 3.14 Resource Quota and Fairness

To prevent one user or service from monopolizing resources, systems define:

* **Quota:** The maximum resources a user or namespace can consume.
* **Fairness Policies:** Scheduling algorithms like DRF (Dominant Resource Fairness) ensure proportional sharing.

---

## 3.15 Event, Watch, and Notification

Cluster managers rely heavily on **event-driven design**.
Components subscribe to updates via *watch* mechanisms — receiving notifications whenever relevant state changes occur.
This decouples modules and keeps the system reactive.

---

## 3.16 Fault Tolerance and Recovery

Failures are expected, not exceptional.
Cluster managers must handle:

* **Node Failures:** reassign tasks.
* **Task Failures:** retry with backoff.
* **Manager Failures:** use replicated metadata and leader re-election.

Fault tolerance defines how *self-healing* a cluster is.

---

## 3.17 Multi-Tenancy

Many production clusters serve multiple teams or applications simultaneously.
**Multi-tenancy** introduces isolation mechanisms such as:

* Resource quotas per tenant
* Network segmentation
* Security contexts and namespaces

---

## 3.18 Logging, Metrics, and Observability

Visibility into the cluster’s behavior is crucial.
Managers expose:

* **Logs** for debugging
* **Metrics** for performance
* **Traces** for request flow analysis

These feed into monitoring systems (Prometheus, Grafana, ELK).

---

## 3.19 API and Declarative Configuration

Most modern systems adopt **declarative APIs** — you describe *what you want*, and the system figures out *how to achieve it*.
Example:

```yaml
replicas: 3
image: nginx:latest
```

Controllers and schedulers work to bring the actual state in line with this specification.

---

## 3.20 Summary

Cluster managers combine concepts from distributed systems, scheduling theory, and systems engineering.
They maintain a global view of distributed resources, enforce desired state, and ensure resilience against constant change and failure.
Understanding these terms is essential before exploring how real systems like Borg, Mesos, and Kubernetes implement them — and how you might design your own.

---

### **Exercises**

1. Define the difference between control plane and data plane.
2. Explain why heartbeats are important in cluster management.
3. What are the key properties of a consensus algorithm?
4. Why is a metadata store often considered the single source of truth?
5. Compare *bin-packing* vs. *spread* scheduling strategies.
6. How does the concept of “desired state” simplify cluster operations?
7. Explain how a reconciler loop works in simple terms.
8. What does “multi-tenancy” mean in a cluster manager context?
9. What happens if the control plane loses quorum in a consensus protocol?
10. Describe how you would detect and recover from a failed worker node.

---