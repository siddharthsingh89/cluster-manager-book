Perfect direction. 👌

Let’s now **adapt Chapter 10 – High-Level Architecture Choices** fully into the **context of a distributed database**, while keeping it beginner-friendly.
This version will show how cluster management principles map directly to how databases like **CockroachDB, YugabyteDB, TiDB, or Spanner** organize their control and data planes.

---

# **Chapter 10 – High-Level Architecture Choices (in the Context of a Distributed Database)**

In the previous chapter, we identified *what* the cluster manager must achieve: reliability, scalability, and availability.
Now we’ll explore *how to design it* — specifically, how a **distributed database** structures its architecture to achieve those goals.

Unlike a generic scheduler (like Kubernetes), a **distributed database** cluster manager is responsible not just for resources, but for **data correctness, consistency, and replication**.
This adds new dimensions to architecture:

* How metadata and data layers interact.
* How replicas are placed, balanced, and repaired.
* How control is coordinated across many nodes that each hold part of the data.

---

## **10.1 Why Architecture Matters for Distributed Databases**

The architecture defines how the database behaves under load, failure, and scale.

A good architecture should make it easy to:

* Add or remove nodes without downtime.
* Keep replicas consistent and available.
* Recover from crashes automatically.
* Support strong or eventual consistency as needed.

It’s the invisible framework that turns a collection of machines into a single, logical database.

---

## **10.2 Major Building Blocks**

A distributed database typically consists of the following layers:

| Layer                 | Description                                                                         | Example Components                           |
| --------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| **SQL / Query Layer** | Parses queries, plans execution, routes to correct data partitions.                 | SQL gateway, router, planner                 |
| **Control Plane**     | Manages cluster metadata, node membership, and coordination.                        | Placement service, Raft leader, meta service |
| **Data Plane**        | Stores and replicates data across nodes.                                            | Storage engines, Raft followers              |
| **Metadata Store**    | Strongly consistent source of truth for cluster configuration and tablet locations. | etcd, internal meta-table, Raft group 0      |
| **Management Plane**  | Provides admin APIs, dashboards, and monitoring for operators.                      | Admin UI, CLI, Prometheus                    |

---

## **10.3 Centralized vs. Decentralized Control**

### **Centralized Control**

Some systems maintain a *single metadata master* or *coordinator* responsible for global decisions — like assigning shards or managing schema updates.

**Examples:**

* Early versions of HDFS (NameNode)
* TiDB’s Placement Driver (PD)
* Spanner’s Master and directory hierarchies

**Pros:**

* Simpler metadata management
* Global view of cluster topology
* Easier transaction coordination

**Cons:**

* Scalability bottleneck if unsharded
* Requires robust failover and replication

**Best for:** Clusters with strong consistency and global schema coordination needs.

---

### **Decentralized / Consensus-Based Control**

Here, metadata and decisions are replicated across multiple nodes using consensus protocols like **Raft** or **Paxos**.
There’s no single permanent master — leadership is ephemeral and re-elected automatically.

**Examples:**

* CockroachDB (meta ranges + Raft consensus)
* YugabyteDB (per-tablet Raft groups)

**Pros:**

* No single point of failure
* Metadata and data evolve together
* Enables elastic scaling

**Cons:**

* Complex coordination during rebalancing
* Metadata lookup overhead

**Best for:** Geo-distributed systems prioritizing availability and resilience.

---

## **10.4 Monolithic vs. Modular Services**

### **Monolithic Architecture**

All database logic (SQL, metadata, replication, storage) runs in a single process per node.

**Example:**
CockroachDB and YugabyteDB run as a single binary where each node participates in SQL, Raft consensus, and storage.

**Pros:**

* Simplified deployment
* Co-located execution improves performance
* Easier to maintain consistency between layers

**Cons:**

* Harder to scale individual layers independently
* Larger codebase, more complex upgrades

---

### **Modular / Service-Oriented Architecture**

Components like query processing, metadata management, and storage run as distinct services, often communicating over gRPC.

**Examples:**
TiDB splits the architecture into:

* TiDB servers (SQL layer)
* TiKV servers (storage layer)
* PD servers (metadata and placement)

**Pros:**

* Clear separation of responsibilities
* Independent scaling and upgrades
* Easier to reason about boundaries and APIs

**Cons:**

* Higher inter-service latency
* More operational complexity

---

## **10.5 Control Flow in Distributed Databases**

### **1. Query Flow (User Path)**

1. The client connects to any SQL node or proxy.
2. The SQL layer parses and plans the query.
3. It looks up the location of required data ranges in the metadata service.
4. The query is executed by contacting relevant data replicas (via Raft or similar).
5. Results are aggregated and returned to the client.

This path emphasizes **low latency** and **read/write coordination**.

---

### **2. Control Flow (Cluster Path)**

In parallel, the control plane performs:

* Node health checks.
* Replica placement and rebalancing.
* Configuration propagation.
* Failure detection and recovery.
* Leadership elections for Raft groups.

This path emphasizes **reliability and automation**.

---

## **10.6 Data & Metadata Flow**

Distributed databases usually maintain **two types of state**:

| Type                | Characteristics                                | Example Storage                                      |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| **Metadata State**  | Cluster topology, shard locations, schema info | Stored in a small, highly consistent Raft group      |
| **User Data State** | Application tables and indexes                 | Partitioned into shards/tablets, replicated via Raft |

**Design principle:**
Metadata moves less frequently than user data, so it’s safe to keep metadata strongly consistent while allowing more flexible policies for user data.

---

Sure — here’s **that section rewritten for a distributed database context**, focusing on architecture diagram, our design choice, and exercises:

---

## **10.7 Architecture Diagram**

Below is a conceptual architecture of a **distributed database cluster** with a **centralized control plane** coordinating decentralized data nodes.

```
                          ┌──────────────────────────────┐
                          │     Management Plane          │
                          │ ──────────────────────────── │
                          │  • Admin Console / CLI        │
                          │  • Monitoring & Backup Tools  │
                          │  • Policy & Configuration UI  │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌──────────────────────────────┐
                          │       Control Plane           │
                          │ ──────────────────────────── │
                          │  • Cluster Manager / Master   │
                          │  • Metadata Catalog            │
                          │  • Placement & Balancer        │
                          │  • Replication Controller      │
                          │  • Coordination Store (Raft)   │
                          └───────────────┬───────────────┘
                                          │
                   ┌──────────────────────┼──────────────────────┐
                   ▼                      ▼                      ▼
        ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
        │   Data Node A      │   │   Data Node B      │   │   Data Node C      │
        │ ───────────────── │   │ ───────────────── │   │ ───────────────── │
        │  • Storage Engine  │   │  • Storage Engine  │   │  • Storage Engine  │
        │  • Replication     │   │  • Replication     │   │  • Replication     │
        │  • Query Executor  │   │  • Query Executor  │   │  • Query Executor  │
        │  • Local WAL/Cache │   │  • Local WAL/Cache │   │  • Local WAL/Cache │
        └───────────────────┘   └───────────────────┘   └───────────────────┘
```

### **How It Works**

* **Management Plane** — interfaces for operators and administrators: cluster setup, scaling, and monitoring.
* **Control Plane** — the “brain” that tracks metadata (like tablet or shard locations), decides where replicas live, and orchestrates rebalancing.
* **Data Nodes** — store and serve actual data, execute queries, and replicate logs.
* **Coordination Store (Raft/etcd/ZooKeeper)** — ensures consistent metadata view across control plane replicas.

This architecture separates **control from data** — allowing independent scaling, clearer fault domains, and simpler recovery logic.

---

## **10.8 Our Architecture Choice**

For our distributed database, we’ll use a **centralized control plane with decentralized data nodes**.

| **Aspect**        | **Our Choice**                           | **Why It Matters**                                                  |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| **Control Plane** | Leader-based (Raft) control node(s)      | Ensures strong consistency for metadata (shard maps, replica state) |
| **Data Plane**    | Autonomous storage nodes                 | Enables scalability and parallel query execution                    |
| **Replication**   | Quorum-based (Raft or Paxos) per shard   | Fault-tolerant, consistent data replication                         |
| **Placement**     | Control plane decides primary & replicas | Central coordination ensures balance and durability                 |
| **Communication** | gRPC / RPC with heartbeats               | Reliable, structured communication                                  |
| **Failover**      | Leader election among control nodes      | Automatic failover keeps metadata always available                  |
| **Storage**       | Local WAL + SSTables                     | Durable, append-optimized storage on each node                      |
| **Discovery**     | Control plane maintains cluster map      | Simplifies node bootstrapping and rebalancing                       |

### **Why This Design Works**

* **Centralized metadata = simple correctness**
* **Decentralized data = scalable performance**
* **Asynchronous control = fault tolerance**

It also aligns with systems like **CockroachDB**, **YugabyteDB**, and **TiDB**, each balancing *strong consistency* with *elastic scalability*.

---

## **10.9 Exercises and Thought Questions**

1. **Metadata Split**
   Why is it risky to let every data node manage its own shard metadata?

   * What problems arise during rebalancing or recovery?

2. **Control Plane Failure**
   If the control node (leader) fails mid-placement, how can we avoid data loss or inconsistent assignment?

3. **Data Node Autonomy**
   What operations should a data node perform even if disconnected from the control plane?
   (Hint: local query reads, WAL replay, compaction.)

4. **Hybrid Design Exploration**
   Could a distributed database ever work *without* a dedicated control plane?

   * What trade-offs in consistency and convergence time would appear?

5. **Latency Awareness**
   Suppose your cluster spans multiple regions.

   * Would you colocate control nodes with data? Why or why not?

6. **Mini Project – Design a Mini-DB**
   Draw your own 5-node database cluster:

   * 1 control node
   * 4 data nodes
     Describe how a write flows through control → data nodes → replication → acknowledgment.

---

 **Summary**
We’ve now grounded our architecture in a **distributed database context** — where a **centralized metadata brain** coordinates **autonomous storage nodes**.
This design makes strong consistency achievable without giving up elasticity, forming the foundation for the next chapters on APIs, membership, placement, and replication.

---