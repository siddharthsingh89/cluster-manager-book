# **Chapter 5 – Consistency Models & Guarantees**

> “Consistency is not about making everything correct instantly - it’s about agreeing on what correctness means.”
> - Werner Vogels (CTO, Amazon)

In distributed systems, *consistency* defines what different nodes can “see” and when they agree on shared state.
Cluster managers constantly face the challenge of synchronizing metadata and workload states across unreliable nodes and networks.
This chapter explores how different **consistency models** define trade-offs between correctness, latency, and availability.

---

## 5.1 What Is Consistency?

At its core, **consistency** describes how up-to-date and synchronized data appears to users across replicas in a distributed system.

In a perfectly consistent system:

* All clients see the same data, regardless of which replica they read from.
* Once a write completes, all subsequent reads reflect that write.

In practice, however, achieving perfect consistency across machines is impossible under network partitions.
Different systems make **different promises** - called *consistency models*.

---

## 5.2 Strong vs. Weak Consistency

Let’s begin with the two ends of the spectrum.

### **Strong Consistency**

Every read returns the most recent write for a given data item.

**Example:**
In **etcd**, once a value is updated and the update is committed by a quorum of Raft nodes, all future reads return that updated value.

**Guarantee:**
Clients observe a single, linear timeline of updates.

**Downside:**
Higher latency - writes must propagate to a quorum before succeeding.

---

### **Weak Consistency**

Reads may return stale data temporarily.
The system *eventually* becomes consistent once updates propagate.

**Example:**
In **Cassandra** (with low consistency level like `ONE`), a write to one replica may not immediately be visible to others.

**Guarantee:**
Eventually, all replicas converge to the same value (eventual consistency).
This sacrifices immediacy for higher availability and lower latency.

---

## 5.3 The Spectrum of Consistency Models

Between strong and weak consistency lie many intermediate models.
Each offers different trade-offs between performance and correctness.

---

### **1. Linearizability (Strongest Guarantee)**

All operations appear to occur *instantaneously* at some point between their invocation and response.
If one client writes a value, every other client reading afterward sees that value.

**Example:**

* **etcd** and **ZooKeeper** (both CP systems) guarantee linearizable reads after a quorum commit.
* **Raft** and **Paxos** protocols enforce linearizability through ordered log replication.

**Visualization:**

```
Time →
Client1: Write(A=1) --- done
Client2:        Read(A) → 1
```

---

### **2. Sequential Consistency**

All nodes see operations in the same order, but not necessarily in real-time order.
The system enforces a single global sequence of updates, but delays may exist.

**Example:**

* **Amazon Dynamo**’s replicated store guarantees sequential consistency for a given key.
* Useful for systems where causality matters more than real-time synchronization.

---

### **3. Causal Consistency**

If one operation *causally depends* on another, the system preserves that order; otherwise, they can appear in any order.

**Example:**
If Alice posts a message and Bob replies to it, everyone will see Alice’s post before Bob’s reply - even if they’re in different replicas.

**Used In:**

* **Bayou**, **COPS**, and **Orleans** actor systems.
* Modern CRDT-based (Conflict-Free Replicated Data Type) systems.

---

### **4. Read-Your-Writes Consistency**

A client always sees the results of its own writes, even if other replicas lag.

**Example:**
In **Kubernetes**, when a user creates a Pod, the API immediately reflects that Pod in `kubectl get pods`, even if the scheduler hasn’t yet placed it.

---

### **5. Monotonic Reads**

A client’s reads never move backward in time - once you see an update, you won’t later see an older version.

**Example:**
In replicated metadata stores, once you read version 5 of a config, you’ll never get version 4 in a later query.

---

### **6. Eventual Consistency (Weakest Model)**

Given enough time without new updates, all replicas converge to the same state.

**Example:**

* **DNS** records
* **Amazon S3** (eventual consistency for overwrite and delete in some regions)
* **Cassandra** when consistency level < quorum.

**Guarantee:**
No consistency during updates, but convergence afterward.

---

## 5.4 Consistency in Control Planes

Cluster managers often maintain a **control plane datastore** - e.g., etcd in Kubernetes - that must be consistent enough for coordination decisions.

### **etcd (Kubernetes)**

* Uses **Raft consensus** to replicate state.
* Guarantees **linearizable reads/writes** for control-plane objects.
* Ensures safe leader election and consistent Pod metadata.

### **ZooKeeper (Hadoop, Kafka)**

* Uses **ZAB (ZooKeeper Atomic Broadcast)** for consistent updates.
* Guarantees ordered writes and atomic view changes.

### **Mesos**

* Uses replicated **log-based state machine** for consistent task tracking.

These systems choose strong consistency for **control data**, even if that means momentary unavailability during leader transitions.

---

## 5.5 Consistency in Data Planes

While control planes favor **strong consistency**, data planes often prefer **availability**.

**Example:**

* Kubernetes nodes continue running existing Pods even if the API server is temporarily unavailable.
* Cassandra or Kafka clusters allow writes to partial replicas for low latency.
* HDFS clients read from nearest replicas for throughput.

This division reflects a common design philosophy:

> **Control plane = CP system** (safety first)
> **Data plane = AP system** (liveness first)

---

## 5.6 Quorum and Tunable Consistency

Many systems allow **configurable consistency** through *quorum-based replication*.

For a cluster with `N` replicas:

* **W** = number of nodes that must acknowledge a write.
* **R** = number of nodes that must participate in a read.
* If **W + R > N**, strong consistency is achieved.

**Example:**
Cassandra:

* With `N=3`, choosing `W=2`, `R=2` ensures at least one overlapping replica has the latest data.
* With `W=1`, `R=1`, consistency weakens, but latency improves.

This *tunable consistency* allows administrators to balance performance and correctness per workload.

---

## 5.7 Consistency vs. Availability in Real Systems

| System                   | Consistency           | Availability               | Notes                                 |
| ------------------------ | --------------------- | -------------------------- | ------------------------------------- |
| **etcd / ZooKeeper**     | Strong (linearizable) | Low during leader failover | CP systems                            |
| **Cassandra / DynamoDB** | Eventual / Tunable    | High                       | AP systems                            |
| **Kafka**                | Sequential            | High                       | Replicated log, leader-based          |
| **HDFS**                 | Sequential (per file) | High                       | Client always writes through NameNode |
| **Kubernetes API**       | Linearizable          | Moderate                   | Uses etcd underneath                  |
| **Redis Cluster**        | Eventual              | High                       | Primary-replica async replication     |

---

## 5.8 Observability of Consistency

Consistency bugs are notoriously hard to diagnose.
Cluster managers use mechanisms to *observe or enforce order*:

* **Versioning / Resource Versions:** (e.g., etcd’s `mod_revision` or Kubernetes’ `resourceVersion` fields)
* **Monotonic Watches:** Watch streams ensure ordered events.
* **Leases / Locks:** Ensure single writer semantics.
* **Leader Election:** Guarantees one authoritative decision-maker at any time.

---

## 5.9 Real-World Examples of Consistency Trade-offs

### **1. Kubernetes**

* API server ensures linearizable writes via etcd.
* Node agents operate with cached states - temporarily inconsistent.
* Result: strong global correctness, local flexibility.

### **2. Cassandra**

* Offers tunable consistency: users pick how many replicas to read/write from.
* Eventual consistency ensures global convergence, but not instant correctness.

### **3. Kafka**

* Producers write to a leader replica; followers replicate asynchronously.
* Guarantees ordering per partition but not across partitions.
* Ensures sequential consistency for stream processing.

---

## 5.10 Summary

Consistency models shape how distributed systems **behave under concurrency and failure**.
From **strong** (linearizability) to **weak** (eventual consistency), each model reflects a balance between latency, throughput, and correctness.

Cluster managers, by design, often mix them:

* Strong consistency for coordination and metadata.
* Eventual consistency for runtime states and workload reporting.

Understanding these trade-offs helps us reason about correctness in systems where absolute agreement is impossible - but *predictable behavior* is still achievable.

---

### **Exercises**

1. Define strong consistency and eventual consistency with examples.
2. What is the difference between linearizability and sequential consistency?
3. Why do most cluster managers use strong consistency in control planes but weak consistency in data planes?
4. Explain quorum-based consistency using an example with N=5 nodes.
5. What guarantees does Kubernetes etcd provide?
6. How does causal consistency differ from sequential consistency?
7. Why might an application choose read-your-writes consistency over linearizability?
8. Describe a real-world scenario where eventual consistency is acceptable.
9. In Cassandra, what happens if W + R ≤ N?
10. What is tunable consistency and why is it useful in large distributed systems?

---