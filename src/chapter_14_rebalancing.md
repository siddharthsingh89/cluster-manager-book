## **Chapter 14 - Rebalancing & Data Movement**

### **Overview**

In a distributed database, data is partitioned across multiple nodes for scalability and fault tolerance. Over time, workloads evolve - nodes are added or removed, partitions grow unevenly, or hotspots emerge. **Rebalancing** is the process of redistributing data across nodes to restore balance and optimize performance. It ensures that each node holds a fair share of data, serves proportional load, and maintains replication guarantees.

Data movement is at the heart of rebalancing. It involves migrating partitions, replicas, or ranges from one node to another while preserving consistency, availability, and performance.

This chapter explores **why** rebalancing is needed, **how** it is performed, and **strategies** to do it efficiently in a distributed database.

---

### **14.1 Motivation for Rebalancing**

Rebalancing is triggered by a few common scenarios:

1. **Cluster Expansion or Contraction**

   * **Scale-out:** Adding new nodes to handle increased data or query load.
   * **Scale-in:** Removing nodes to save cost or handle failures.

2. **Skewed Data Growth**
   Some partitions may grow faster due to application behavior, user popularity, or key distribution bias (e.g., time-based keys).

3. **Uneven Replica Placement**
   Replication factor changes or failed reassignments may leave replicas unevenly distributed.

4. **Hotspot Mitigation**
   A few partitions or ranges become "hot" and cause throughput bottlenecks. Splitting and reassigning such partitions helps even out the load.

5. **Hardware or Node Failures**
   Replacement of failed nodes often requires reassigning lost replicas or resynchronizing partitions.

---

### **14.2 Rebalancing Goals**

A well-designed rebalancing mechanism aims to achieve the following:

* **Fairness:** Uniform data and request distribution across nodes.
* **Minimal Disruption:** Avoid query latency spikes during data movement.
* **Consistency:** Ensure data correctness across replicas during transfer.
* **Incrementality:** Migrate gradually without overloading the network.
* **Predictability:** Produce deterministic results even under concurrent operations.
* **Locality Preservation:** Avoid unnecessary movement when nodes are already near-optimal.

---

### **14.3 Key Concepts**

#### **(a) Logical vs Physical Rebalancing**

* **Logical rebalancing:** Changes the metadata (partition ownership, routing tables) without physically moving much data - often used in consistent hashing-based systems.
* **Physical rebalancing:** Requires actual data transfer between nodes, typically when using range-based sharding or uneven partition growth.

#### **(b) Partition Ownership**

Each partition has a logical “owner.” Ownership changes require a **handover protocol**:

1. Source node sends data to target.
2. Target validates and applies.
3. Ownership metadata is updated in the control plane.

#### **(c) Replica Role Changes**

In replicated systems, replicas may change roles:

* Secondary → Primary (leadership transfer)
* Primary → Secondary (demotion during scale-out)
  This may happen alongside rebalancing to reduce network load.

---

### **14.4 Rebalancing Strategies**

#### **1. Consistent Hashing-Based Rebalancing**

Used in systems like Cassandra and DynamoDB.

* The keyspace is a ring of hash values.
* Each node is responsible for a range of hashes.
* When a node is added, it “takes over” a slice of hash ranges.
* Only **O(1/N)** of data is moved, minimizing disruption.

**Advantages:**

* Minimal movement when nodes join/leave.
* Decentralized management.

**Disadvantages:**

* Hard to handle hotspots caused by non-uniform key distribution.
* Balancing may not be perfect.

**Optimization:**
Use *virtual nodes (vnodes)* to fine-tune balance. Each node holds multiple smaller ranges, allowing smoother reassignments.

---

#### **2. Range-Based Rebalancing**

Used in systems like Spanner, YugabyteDB, and CockroachDB.

* Data is divided into **key ranges (spans)**.
* Each range can be split or merged dynamically.
* When imbalance is detected, a background process moves ranges.

**Steps:**

1. Detect skew (based on size, load, or latency).
2. Select ranges to move.
3. Initiate a **replica add → catch-up → promote → remove** sequence.

**Example:**
CockroachDB’s **Replicate Queue** continuously evaluates range stats and triggers rebalancing decisions asynchronously.

---

#### **3. Workload-Aware Rebalancing**

Traditional systems balance data size, but modern systems balance **load** (QPS, write rate, latency).
Example strategies:

* Move read-heavy ranges to lightly loaded nodes.
* Split high-write partitions.
* Use **observed metrics** to decide migrations.

---

#### **4. Controlled Data Movement**

To avoid instability, systems **throttle** migration:

* Limit concurrent moves per node.
* Restrict network bandwidth for transfers.
* Prioritize moves by urgency (e.g., fixing under-replicated ranges before performance optimization).

---

### **14.5 Metadata and Coordination**

Rebalancing requires coordination between **control plane** and **data plane** components.

| Component                         | Responsibility                                              |
| --------------------------------- | ----------------------------------------------------------- |
| **Controller / Balancer Service** | Computes new placement plans and triggers data movement.    |
| **Storage Nodes**                 | Execute actual replica movement (copy, catch-up, validate). |
| **Metadata Store**                | Tracks ownership and range mappings.                        |

**Coordination Flow Example:**

1. Controller computes new plan.
2. Source and destination nodes stream data.
3. New replica catches up via log replication.
4. Controller updates routing metadata atomically.

Consistency of metadata updates is crucial - many systems use **Raft** or **Paxos** for this.

---

### **14.6 Algorithms and Heuristics**

1. **Greedy Rebalancing**

   * Iteratively moves data from most loaded node to least loaded one.
   * Fast, simple, but can oscillate if not damped.

2. **Cost-Based Optimization**

   * Models the system as a weighted graph.
   * Uses heuristics or simulated annealing to find a near-optimal migration plan minimizing “movement cost.”

3. **Incremental Balancing**

   * Makes small, continuous adjustments instead of large periodic ones.
   * Reduces shock load.

4. **Leader-Aware Rebalancing**

   * Considers leadership distribution in Raft/Paxos groups to avoid overloading a few nodes with leader responsibilities.

---

### **14.7 Ensuring Safety and Consistency**

Rebalancing touches live data - mistakes can corrupt or lose it. Systems ensure safety through:

* **Dual Ownership Prevention:** No two nodes should simultaneously act as owner.
* **Quorum-Based Updates:** Use majority agreement before accepting new ownership.
* **Checksums / Snapshots:** Validate data integrity post-transfer.
* **Versioned Metadata:** Clients always see a consistent routing map, avoiding stale reads.

---

### **14.8 Case Studies**

#### **Cassandra**

* Uses consistent hashing with vnodes.
* Node addition involves “streaming” token ranges.
* Load balancing can be automated or operator-triggered.

#### **CockroachDB**

* Uses Raft groups per range.
* Rebalancer operates continuously.
* Balancing considers replica count, range size, and QPS metrics.

#### **TiDB**

* Placement Driver (PD) schedules balance.
* Uses region (range) splitting and merging.
* Tracks store capacity, IO rate, and leader distribution.

#### **Spanner**

* Moves ranges lazily using background copy + atomic metadata switch.
* Integrates with leader election to avoid simultaneous movement and leadership churn.

---

### **14.9 Challenges and Trade-offs**

| Challenge                  | Description                                               | Trade-off                               |
| -------------------------- | --------------------------------------------------------- | --------------------------------------- |
| **Data Movement Overhead** | High I/O and network load during rebalance                | Throttle vs. Convergence Speed          |
| **Staleness During Move**  | Reads during migration may see outdated data              | Sync checkpoints or dual serving        |
| **Concurrent Operations**  | Conflicts between rebalancing and other maintenance tasks | Requires fine-grained scheduling        |
| **Hotspot Dynamics**       | Continuous load change makes static balance ineffective   | Adaptive or workload-driven rebalancing |

---

### **14.10 Exercises**

1. Explain how consistent hashing minimizes data movement during rebalancing.
2. Design a protocol for safely transferring a partition’s ownership between two nodes using Raft.
3. Suppose one node is overloaded. Outline a heuristic to decide which partitions to move and where.
4. What are the trade-offs between data size-based and QPS-based balancing?
5. Describe how range-splitting helps in hotspot mitigation.
6. Why should rebalance operations be throttled?
7. Compare leader-aware balancing vs. data-only balancing.
8. Implement a simulation for greedy rebalancing of N partitions across M nodes.
9. Discuss how metadata consistency impacts client routing during rebalancing.
10. Suggest improvements to avoid oscillations during load-based rebalancing.

---

## **14.12 Rebalancing Strategy for Our System**

Our distributed database follows a **hybrid range-partitioned architecture** with replication and leader-based consistency. Each partition (or *shard*) is a self-contained Raft group responsible for a contiguous key range. The system’s control plane tracks placement and orchestrates rebalancing, while data nodes handle actual movement through a coordinated streaming protocol.

### **14.12.1 Design Objectives**

Our rebalance strategy focuses on five core goals:

1. **Workload-Aware Balance:** Optimize not just for storage utilization, but also for query throughput and latency.
2. **Incremental Movement:** Rebalance continuously and gradually rather than in large disruptive bursts.
3. **Replica Safety:** Maintain quorum consistency during movement to ensure no data loss or double ownership.
4. **Deterministic Metadata Updates:** All ownership and replica role transitions are atomic and versioned.
5. **Leadership Distribution:** Spread Raft group leaders evenly across nodes to avoid leader hotspots.

---

### **14.12.2 Triggering Conditions**

Rebalancing is triggered by **cluster state changes** or **runtime metrics**, such as:

| Trigger          | Description                                                         |
| ---------------- | ------------------------------------------------------------------- |
| Node Join        | A new node has registered and is underutilized.                     |
| Node Leave       | A node has been decommissioned or marked unhealthy.                 |
| Range Growth     | A partition exceeds size or QPS thresholds.                         |
| Load Imbalance   | Average CPU, memory, or IOPS deviate beyond tolerance (e.g., ±20%). |
| Replication Skew | Replica placement violates zone or rack constraints.                |

The **Placement Controller** periodically runs a **Balancing Loop**, collecting stats from all nodes and computing target placements.

---

### **14.12.3 Balancing Algorithm**

We use a **two-tiered balancing heuristic**:

#### **Step 1: Placement Scoring**

Each node is assigned a *balance score*:

[
score = w_1 \times \text{storage_util} + w_2 \times \text{cpu_util} + w_3 \times \text{leader_count} + w_4 \times \text{replica_diversity_penalty}
]

Where:

* (w_1, w_2, w_3, w_4) are tunable weights.
* Lower scores indicate lighter load or better placement.

#### **Step 2: Candidate Selection**

For each partition:

1. Compute current owner’s score and average cluster score.
2. If deviation exceeds a threshold, mark it for migration.
3. Choose target node(s) with minimal score that satisfy zone/rack constraints.
4. Plan the replica add → catch-up → promote → remove workflow.

The goal is to maintain an approximately uniform *score distribution* across nodes while minimizing movement cost.

---

### **14.12.4 Rebalance Execution Pipeline**

Each migration proceeds through a **four-phase pipeline**, orchestrated by the control plane:

| Phase              | Action                  | Description                                                            |
| ------------------ | ----------------------- | ---------------------------------------------------------------------- |
| **1. Replica Add** | `AddReplica(target)`    | Create a new replica on the destination node and start streaming data. |
| **2. Catch-Up**    | `SyncLogs()`            | Apply log entries until the replica reaches current commit index.      |
| **3. Role Switch** | `PromoteReplica()`      | Promote target to voter; demote old replica to learner.                |
| **4. Cleanup**     | `RemoveReplica(source)` | Delete redundant replica after confirmation and checkpoint validation. |

Each transition is recorded as a versioned **Placement Event** in the metadata store (etcd or Raft group). This ensures that clients always see a consistent routing view.

---

### **14.12.5 Throttling and Safety**

Rebalance operations are **rate-limited** to maintain cluster stability:

* **MaxConcurrentMovesPerNode:** e.g., 2 active migrations.
* **MaxNetworkUsagePercent:** e.g., <30% reserved for rebalance traffic.
* **MinReplicaAvailability:** At least `RF - 1` replicas must remain live before moving the last copy.

Safety invariants:

* No two nodes ever act as *primary owner* concurrently.
* Quorum is preserved during every step.
* Data integrity verified via incremental checksums.

---

### **14.12.6 Hotspot Detection and Range Splitting**

The rebalancer also monitors per-range QPS and write amplification metrics.
If a range becomes a hotspot:

1. It is **split** into two smaller ranges (via key boundary division).
2. The new sub-ranges are independently placed, potentially on different nodes.
3. The metadata layer updates the key-to-range mapping atomically.

This enables **horizontal range scaling** without full-table rebalancing.

---

### **14.12.7 Background Operation**

The rebalance loop runs as a **background service** within the control plane, executing every few minutes or upon major events. It operates under a feedback-controlled model:

```
while true:
    metrics = collect_cluster_stats()
    plan = compute_rebalance_plan(metrics)
    if plan.is_nonempty():
        execute_plan(plan)
    sleep(REBALANCE_INTERVAL)
```

This design ensures continuous, adaptive equilibrium - the system remains balanced even as workloads evolve dynamically.

---

### **14.12.8 Fault Tolerance and Rollback**

If a rebalance operation fails midway (e.g., due to node crash or network partition):

* The control plane detects timeout and rolls back metadata to the last consistent state.
* Partially copied replicas are marked as “incomplete” and cleaned up asynchronously.
* Reattempts are rate-limited to prevent cascading retries.

This guarantees **idempotency** - the same rebalance plan can safely be retried.

---

### **14.12.9 Example Scenario**

Let’s consider a simple case with **six nodes (A–F)** and **replication factor 3**.

* Node E joins with zero load.
* Nodes A and B are 30% overloaded.

**Rebalance Plan:**

1. Move 2 partitions (P7, P9) from A → E.
2. Move 1 partition (P3) from B → F (leader change included).
3. Adjust leadership distribution so each node leads ~16% of partitions.

After execution, cluster utilization normalizes within ±5% deviation, with no read/write interruptions.

---

### **14.12.10 Summary**

Our system’s rebalance strategy emphasizes **steady, safe, and workload-aware** redistribution.
By integrating:

* range-based movement,
* load scoring,
* leadership awareness, and
* controlled throttling,

we achieve a self-healing balance loop capable of adapting to both data growth and dynamic workloads.

Future versions will integrate **predictive rebalancing** using historical access trends - allowing the system to *anticipate* hotspots before they occur.

---
