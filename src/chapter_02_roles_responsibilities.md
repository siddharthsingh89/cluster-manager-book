# Chapter 2 - Roles & Responsibilities

In the previous chapter, we understood *why* a cluster manager exists.
Now we’ll explore **what it actually does** - the concrete roles it plays and the responsibilities it shoulders in a distributed database.

Every cluster manager, regardless of implementation, acts as the **coordination brain** for the system - managing cluster metadata, orchestrating membership, ensuring fault recovery, and exposing APIs for other layers (query, storage, or admin tools).

This chapter dissects those responsibilities and explains *how they fit together*.

---

## 2.1 The Role of a Cluster Manager in the System

At a high level, the cluster manager has three key roles:

| Role             | Description                                                                                               | Analogy                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Coordinator**  | Maintains global cluster state and ensures nodes agree on who’s leading and what configuration to follow. | Air traffic controller    |
| **Orchestrator** | Executes operational workflows: adding/removing nodes, balancing replicas, triggering recovery.           | Conductor of an orchestra |
| **Observer**     | Continuously monitors node health and performance, reacting to failures or anomalies.                     | Heart monitor             |

These three roles - **coordinate, orchestrate, observe** - form the behavioral triad of every cluster manager.

---

## 2.2 Core Responsibilities

Let’s examine each key responsibility in detail.

### 1. Membership Management

Tracks which nodes are part of the cluster and their current states:

* Joining, Active, Leaving, or Failed.
* Assigns unique IDs and maintains cluster topology metadata.
* Handles node discovery using static configuration, DNS, or gossip.

In large clusters, this module is the foundation of all coordination - if membership is wrong, every higher-level operation becomes inconsistent.

---

### 2. Leadership and Election

Ensures there’s always a single, authoritative leader for each replicated group or global configuration.
Leaders make write decisions and coordinate with followers for consensus.

Common approaches:

* **Centralized manager** (e.g., TiDB’s Placement Driver)
* **Distributed consensus** (e.g., Raft groups where each region elects a leader)
* **Gossip + hinted handoff** (Cassandra-style eventually consistent leadership)

The cluster manager either *performs* leader election or *delegates* it to a consensus library.

---

### 3. Configuration Management

Distributes and synchronizes configuration across nodes:

* Cluster topology, replication factors, sharding policies, versioning.
* Maintains **versioned configs** to avoid drift.
* Supports safe rollouts and live reconfigurations.

Configuration management ensures that all nodes agree on “the plan” even if the physical environment is constantly changing.

---

### 4. Health Monitoring

Monitors node liveness using:

* Heartbeats (push or pull)
* Lease renewal
* Latency and timeout thresholds

If a node fails to respond within a lease window, it’s marked as *suspect* or *failed*, triggering recovery or replica reassignment.
Health monitoring is the **eyes and ears** of the control plane.

---

### 5. Rebalancing and Topology Changes

When nodes join or leave, data must move:

* Add node → redistribute shards evenly.
* Remove node → reassign replicas to maintain redundancy.
* Handle partial failures gracefully without destabilizing the cluster.

A good cluster manager performs rebalancing gradually and with backpressure control to avoid overwhelming the network or storage layer.

---

### 6. Metadata Management

Stores all cluster-related metadata - membership, shard placements, configuration, epochs, and leadership mappings.
Usually backed by a **strongly consistent store** like Etcd, Zookeeper, or an internal Raft log.

This metadata acts as the *source of truth* for all coordination activities.

---

### 7. Failure Detection and Recovery

When something breaks, the cluster manager coordinates recovery:

* Detects unresponsive nodes.
* Initiates leader failover or replica promotion.
* Triggers resynchronization for recovered nodes.

These workflows need to be idempotent and deterministic - ensuring that partial retries don’t create chaos.

---

### 8. Coordination APIs and Observability

Exposes APIs for:

* Query layer to discover nodes and leaders.
* Storage layer to get placement and replication info.
* Admins or operators for monitoring and control.

In modern systems, this is often implemented as a **gRPC or REST API layer** exposing real-time cluster metadata.

---

## 2.3 Putting It Together - Control Flow Overview

Here’s a simplified diagram showing how the cluster manager interacts with data nodes and clients:

```text
              +-----------------------------+
              |      Cluster Manager        |
              |-----------------------------|
              | Membership Manager          |
              | Leader Election Service     |
              | Config & Metadata Store     |
              | Health Monitor              |
              | Rebalancer / Orchestrator   |
              +-------------+---------------+
                            |
       +--------------------+--------------------+
       |                    |                    |
       v                    v                    v
   +--------+           +--------+           +--------+
   | Node A |           | Node B |           | Node C |
   +--------+           +--------+           +--------+
      ^                      ^                    ^
      |                      |                    |
      +---------- Query / Client Requests ---------+
```

* The **Cluster Manager** observes nodes, coordinates changes, and issues control commands.
* The **Nodes** execute actual storage/query tasks and periodically report health.
* The **Clients** interact primarily with the data plane but indirectly depend on the cluster manager for routing and metadata.

---

## 2.4 Role Boundaries and Separation of Concerns

A frequent architectural mistake is letting the cluster manager do *too much*.
It should **not**:

* Execute user queries.
* Handle WAL or data I/O.
* Manage internal caches or indexes.

Its domain is **coordination and metadata**, not data path execution.

Keeping boundaries clear allows independent scaling - the data plane can scale horizontally, while the control plane remains small but reliable.

---

## 2.5 Responsibilities by Lifecycle Stage

| Stage            | Cluster Manager’s Role                                    |
| ---------------- | --------------------------------------------------------- |
| **Startup**      | Initializes metadata, elects leaders, registers nodes.    |
| **Steady-State** | Maintains heartbeats, monitors health, balances load.     |
| **Failure**      | Detects failure, promotes replicas, updates membership.   |
| **Scaling**      | Adds/removes nodes, redistributes data safely.            |
| **Upgrade**      | Coordinates rolling restarts and config version upgrades. |

This lifecycle-centric view emphasizes that the cluster manager is not static - it’s an **active participant** in the cluster’s evolution.

---

## 2.6 Patterns of Responsibility Delegation

Different databases distribute these responsibilities differently:

| Pattern                       | Example                    | Description                                               |
| ----------------------------- | -------------------------- | --------------------------------------------------------- |
| **Centralized Control Plane** | TiDB PD, Kubernetes Master | Dedicated manager process handles global coordination.    |
| **Distributed Control Plane** | Cassandra, Dynamo          | Each node participates in gossip-based coordination.      |
| **Hybrid**                    | CockroachDB                | Nodes form a Raft-backed metadata group (shared control). |

Each pattern has trade-offs in simplicity, fault-tolerance, and scalability - which we’ll explore later in the comparative survey.

---

## 2.7 Summary

The cluster manager’s job is not glamorous - it doesn’t execute queries or store data - but without it, a distributed database cannot function coherently.
It’s the *decision-maker*, *referee*, and *health monitor* rolled into one.

It maintains global truth while everything beneath it changes.

---

## Challenge Problems - Think Like a Cluster Designer

### **1. Role Overlap Scenario**

If the cluster manager also stored small configuration tables in its metadata store (like a “user_roles” table), what potential risks or coupling problems might this introduce?

---

### **2. Split-Responsibility Design**

Imagine a design where each data node runs its own “mini cluster manager.”
How would you keep their metadata views consistent?
What kind of protocol or pattern would you use?

---

### **3. Failure Cascade**

Suppose the health monitoring system marks a node as “failed,” but the node was just slow due to GC pauses.
What impact could this have, and how could you mitigate false positives?

---

 *Try diagramming your answers or reasoning through timing sequences - it helps clarify how control-plane decisions ripple through the data plane.*

---