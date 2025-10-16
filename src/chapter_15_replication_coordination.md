## **Chapter 15 - Replication Coordination**

### **Overview**

Replication is the foundation of reliability in distributed databases. It ensures that data remains **durable**, **available**, and **consistent** even when individual nodes fail.
But replication is not just about keeping multiple copies of data - it’s about **coordinating updates** across those copies to maintain a coherent global state.

Replication coordination refers to the mechanisms and protocols that manage:

* how replicas communicate,
* who decides the order of updates,
* how failures are detected and recovered, and
* how clients interact with the replicated system.

This chapter explores replication coordination in depth - from leader-based and leaderless designs to commit protocols, failover handling, and real-world examples.

---

### **15.1 Goals of Replication**

Replication coordination aims to achieve several core objectives:

| Goal             | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| **Durability**   | Data persists even if nodes crash or disks fail.                          |
| **Availability** | Read and write operations continue despite failures.                      |
| **Consistency**  | All replicas eventually agree on the same state.                          |
| **Performance**  | Writes commit efficiently without excessive coordination overhead.        |
| **Scalability**  | Adding replicas should improve fault tolerance, not introduce contention. |

Achieving all of these simultaneously is constrained by the **CAP theorem** - systems must trade between *consistency* and *availability* during partitions. Replication coordination determines where that trade-off is made.

---

### **15.2 Replica Roles**

Each replica can play different roles in a replication group:

* **Leader (Primary):**
  Coordinates writes, defines commit order, and propagates updates.
* **Follower (Secondary):**
  Receives updates from the leader and applies them in the same order.
* **Learner / Observer:**
  Non-voting replica used for replication to remote regions or read-only workloads.
* **Candidate:**
  A node attempting to become leader during election.

Role transitions occur dynamically - e.g., leader failure triggers a new election, or new replicas are promoted after catch-up.

---

### **15.3 Replication Models**

Replication coordination depends on the system’s underlying model:

#### **(a) Synchronous Replication**

* Write is acknowledged **after all replicas** confirm receipt.
* Guarantees strong consistency.
* High latency and risk of blocking if one replica is slow.
* Used in critical systems (e.g., Spanner, etcd).

#### **(b) Asynchronous Replication**

* Leader commits locally, then propagates updates later.
* Improves latency but risks data loss during failure.
* Used for cross-region or DR (disaster recovery) replicas.

#### **(c) Quorum-Based Replication**

* Write completes after a majority (quorum) of replicas acknowledge.
* Balances safety and availability.
* Foundation of Raft and Paxos protocols.

---

### **15.4 Coordination Protocols**

#### **(1) Raft Consensus**

Raft structures replication around a **single leader log**:

* All writes go through the leader.
* The leader appends the entry to its log and replicates to followers.
* Once a majority acknowledge, the entry is committed.
* Followers eventually apply committed entries to their state machine.

This ensures **linearizable consistency** and predictable failover semantics.

#### **(2) Paxos**

Paxos uses a more abstract two-phase consensus:

1. **Prepare Phase:** A proposer selects a proposal number and requests acceptance.
2. **Accept Phase:** Acceptors agree on a proposal and persist it.

Though conceptually elegant, Paxos is harder to implement cleanly.
Raft is typically preferred in production systems for its operational simplicity.

#### **(3) Primary-Backup**

Simpler form of leader-based replication:

* Primary processes writes and sends log updates to backups.
* Failover handled via external controller or heartbeats.
* Lacks formal consensus guarantees but sufficient for internal, tightly managed clusters.

#### **(4) Multi-Leader / Leaderless (Dynamo, Cassandra)**

In eventually consistent systems, any replica can accept writes:

* Writes tagged with **vector clocks** or **timestamps**.
* Conflicts resolved later via reconciliation logic.
* Prioritizes availability (AP systems under CAP).

---

### **15.5 Log Replication & Ordering**

At the heart of replication coordination is **log consistency**.

Every write operation becomes a **log entry**, identified by:

* **Index:** Position in the sequence.
* **Term / Epoch:** Logical leader generation.
* **Payload:** The actual user operation.

The log ensures **total ordering** of updates across replicas.

#### **Replication Workflow:**

1. **Client → Leader:**
   Write request arrives.
2. **Leader Append:**
   Leader appends entry to local log.
3. **Replication RPC:**
   Leader sends `AppendEntries` (Raft) or `ReplicateLog` RPCs to followers.
4. **Follower Ack:**
   Follower writes entry to disk and acknowledges.
5. **Leader Commit:**
   When quorum acks, the leader marks the entry committed.
6. **Apply:**
   Both leader and followers apply the entry to the state machine.

---

### **15.6 Leadership Coordination**

Leadership is crucial to replication stability.

#### **Leader Election**

Triggered when:

* Heartbeats from current leader stop.
* Term expiry or explicit resignation.

Election algorithm (Raft-style):

1. Each follower increments its term and becomes a **candidate**.
2. Candidate requests votes from peers.
3. Quorum response → becomes leader; otherwise retries.

#### **Leadership Transfer**

To minimize disruption during rebalancing:

* Leader voluntarily steps down (graceful transfer).
* Control plane selects a new leader from the healthiest follower.
* Clients are redirected automatically to the new leader.

#### **Leader Stickiness**

To avoid frequent churn, systems implement *minimum leadership duration* or hysteresis thresholds before re-election.

---

### **15.7 Failure Recovery**

Replication coordination must handle various failure modes:

| Failure               | Detection              | Recovery                         |
| --------------------- | ---------------------- | -------------------------------- |
| **Leader crash**      | Missing heartbeats     | Trigger election                 |
| **Follower lag**      | Replication offset gap | Catch-up via log replay          |
| **Network partition** | Missed quorum          | Degrade to read-only or minority |
| **Disk failure**      | I/O errors             | Replace replica and re-sync      |
| **Data corruption**   | Checksum mismatch      | Snapshot restore                 |

Recovery always ensures **monotonic log progress** - replicas never roll back to an earlier committed state.

---

### **15.8 Log Catch-up and Snapshotting**

When a new replica joins or a lagging follower rejoins, it must **catch up**:

1. Leader compares last log index.
2. Streams missing entries.
3. If lag is too large, sends a **snapshot** instead of entire logs.
4. Follower installs snapshot and resumes normal replication.

This process ensures **fast convergence** even in long downtime scenarios.

---

### **15.9 Replication in Our System**

Our distributed database uses a **Raft-inspired replication layer** embedded within each partition group.

#### **Replication Topology**

* Each partition (range) forms a **Raft group** of size `RF` (Replication Factor).
* Exactly **one leader** handles all writes.
* Followers replicate logs and serve reads depending on consistency mode.

#### **Write Coordination**

```
Client → Leader → Followers
      AppendEntries()
          ↓
    Quorum ACK → Commit
```

* Writes are committed after majority acknowledgment.
* The leader tracks per-follower replication offsets for flow control.
* Followers that lag too far behind receive incremental snapshots.

#### **Consistency Levels**

| Mode                      | Description                                | Use Case                     |
| ------------------------- | ------------------------------------------ | ---------------------------- |
| **Strong (Linearizable)** | Read from current leader                   | Financial or metadata tables |
| **Bounded Staleness**     | Read from follower within known lag window | Analytics queries            |
| **Eventually Consistent** | Read from any replica                      | Caches, session data         |

#### **Leader Coordination**

The control plane ensures:

* No two leaders exist per group (using epoch fencing).
* Rebalancer distributes leadership evenly.
* Leadership transfer occurs before data movement to reduce client disruption.

---

### **15.10 Write Amplification & Pipeline Optimization**

To maintain high throughput:

* Writes are batched into *log groups*.
* Replication uses pipelined acknowledgments - next batch sent before previous fully applied.
* Checksums and sequence numbers ensure correctness under concurrent append streams.

This allows thousands of small writes per second with sub-10ms commit latency on modern hardware.

---

### **15.11 Observability and Metrics**

Effective replication coordination requires visibility:

| Metric                     | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| **Replication Lag**        | Difference between leader’s commit index and follower’s last index. |
| **Election Frequency**     | Measures cluster stability.                                         |
| **Follower Catch-up Time** | Duration for lagging replica to rejoin quorum.                      |
| **Quorum Commit Latency**  | Average time to replicate and commit a log entry.                   |
| **Leader Distribution**    | Ensures balanced leadership load.                                   |

These metrics feed into the control plane’s adaptive balancing and alerting subsystems.

---

### **15.12 Challenges**

| Challenge                    | Description                              | Mitigation                                     |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------- |
| **Split-Brain Scenarios**    | Multiple leaders in partitioned networks | Epoch fencing, quorum enforcement              |
| **Replica Lag**              | Followers fall behind                    | Dynamic throttling, snapshot installation      |
| **Slow Quorum**              | One node delays entire group             | Exclude slow followers temporarily             |
| **Cross-Region Latency**     | High RTT increases commit time           | Multi-region replication pipeline, async reads |
| **Rebalancing Interference** | Leadership migration during replication  | Graceful leader transfer before data move      |

---

### **15.13 Summary**

Replication coordination lies at the **core of distributed correctness**.
Through consensus, ordered logs, and leader election, the system maintains a single, coherent state even amid failures and concurrent operations.

Our system’s Raft-based design ensures:

* deterministic log order,
* linearizable writes,
* efficient leadership management, and
* fault-tolerant recovery.

Replication is not static - it continuously adapts to topology, load, and network conditions through coordination between the **data plane (Raft groups)** and the **control plane (placement service)**.


## **15.14 Replication Contracts & Pseudocode Implementation**

This section connects the theory with practical design - defining **replication APIs**, **control-plane contracts**, and **core pseudocode** that together coordinate replication, elections, and catch-up in your distributed database.
It uses the same “contract” format we’ve used in previous chapters (e.g., for configuration and metadata APIs), followed by pseudocode that shows message flow and coordination logic.

---

## **15.14 Replication Contracts & Pseudocode Implementation**

### **15.14.1 Overview**

Replication involves both:

* **Control Plane APIs** – which define how nodes coordinate leadership, membership, and metadata; and
* **Data Plane RPCs** – which handle actual log propagation, acknowledgments, and snapshots.

The following contracts define these interfaces in a modular and implementation-neutral way, allowing for flexibility in deployment across data centers or cloud environments.

---

### **15.14.2 Replication API Contracts**

#### **(1) ReplicaSync Contract**

```rust
API ReplicaSync {
    AppendEntries(LogBatch) -> AppendAck
    FetchEntries(LogRequest) -> LogBatch
    RequestSnapshot(SnapshotRequest) -> SnapshotData
    ApplySnapshot(SnapshotData) -> SnapshotAck
}
```

**Purpose:**
Handles the log propagation and synchronization between leader and followers.

**Example:**

```rust
pub trait ReplicaSync {
    fn append_entries(&mut self, batch: LogBatch) -> AppendAck;
    fn fetch_entries(&self, req: LogRequest) -> LogBatch;
    fn request_snapshot(&self, req: SnapshotRequest) -> SnapshotData;
    fn apply_snapshot(&mut self, snap: SnapshotData) -> SnapshotAck;
}
```

* `AppendEntries` is the primary replication RPC (Raft-style).
* `FetchEntries` allows new or lagging nodes to catch up incrementally.
* `RequestSnapshot` / `ApplySnapshot` are used for bulk recovery when the log gap is large.

---

#### **(2) LeaderElection Contract**

```rust
API LeaderElection {
    RequestVote(VoteRequest) -> VoteResponse
    Heartbeat(HeartbeatMsg) -> HeartbeatAck
    TransferLeadership(TransferRequest) -> TransferAck
}
```

**Purpose:**
Coordinates election, heartbeats, and graceful leadership transfer.

**Example:**

```rust
pub trait LeaderElection {
    fn request_vote(&mut self, req: VoteRequest) -> VoteResponse;
    fn heartbeat(&mut self, msg: HeartbeatMsg) -> HeartbeatAck;
    fn transfer_leadership(&mut self, req: TransferRequest) -> TransferAck;
}
```

---

#### **(3) ReplicaControl Contract**

```rust
API ReplicaControl {
    AddReplica(NodeId, RangeId) -> ReplicaAck
    RemoveReplica(NodeId, RangeId) -> ReplicaAck
    PromoteReplica(NodeId, RangeId) -> ReplicaAck
    DemoteReplica(NodeId, RangeId) -> ReplicaAck
}
```

**Purpose:**
Defines control-plane operations that modify replica membership - used during rebalancing, recovery, or scale-out.

This aligns with the *Replica Lifecycle Management* functionality coming in Chapter 16.

---

#### **(4) Client Coordination Contract**

```rust
API ClientRouting {
    GetLeader(RangeId) -> NodeAddress
    GetReplicaSet(RangeId) -> ReplicaSet
}
```

**Purpose:**
Used by the router or proxy layer to direct clients to the current leader or replica set.
Clients cache this mapping but invalidate it when receiving a “NotLeader” error.

---

### **15.14.3 Replication Data Structures**

```rust
struct LogEntry {
    term: u64,
    index: u64,
    command: Bytes,
}

struct LogBatch {
    entries: Vec<LogEntry>,
    leader_term: u64,
    prev_index: u64,
}

struct AppendAck {
    success: bool,
    last_applied: u64,
}

struct VoteRequest {
    term: u64,
    candidate_id: NodeId,
    last_log_index: u64,
    last_log_term: u64,
}

struct VoteResponse {
    term: u64,
    vote_granted: bool,
}
```

---

### **15.14.4 Replication Pseudocode**

Below is a simplified, leader-based replication loop that follows Raft semantics.
This pseudocode demonstrates the interplay between the contracts above.

#### **Leader Append Flow**

```rust
// Leader receives client write
fn handle_client_write(cmd: Command) {
    let entry = LogEntry {
        term: current_term,
        index: last_log_index + 1,
        command: serialize(cmd),
    };

    log.append(entry);
    replicate_to_followers();
}

fn replicate_to_followers() {
    for follower in followers {
        spawn(async move {
            let batch = build_log_batch(follower);
            let ack = follower.append_entries(batch).await;
            if ack.success {
                mark_acked(follower, batch.last_index);
            }
        });
    }

    if quorum_reached() {
        commit_entries();
    }
}
```

---

#### **Follower Append Flow**

```rust
fn append_entries(batch: LogBatch) -> AppendAck {
    if batch.prev_index != log.last_index() {
        return AppendAck { success: false, last_applied: log.last_index() };
    }

    for entry in batch.entries {
        log.append(entry);
    }

    log.flush_to_disk();
    AppendAck { success: true, last_applied: log.last_index() }
}
```

---

#### **Leader Election**

```rust
fn start_election() {
    current_term += 1;
    voted_for = self.id;
    votes = 1;

    for peer in peers {
        spawn(async move {
            let req = VoteRequest {
                term: current_term,
                candidate_id: self.id,
                last_log_index: log.last_index(),
                last_log_term: log.last_term(),
            };
            let res = peer.request_vote(req).await;
            if res.vote_granted {
                votes += 1;
                if votes >= quorum_size() {
                    become_leader();
                }
            }
        });
    }
}
```

---

#### **Follower Catch-Up**

```rust
async fn catch_up_from_leader(leader: NodeId) {
    let mut next_index = log.last_index() + 1;

    loop {
        let req = LogRequest { from_index: next_index };
        let batch = leader.fetch_entries(req).await;

        if batch.entries.is_empty() {
            break; // caught up
        }

        for e in batch.entries {
            log.append(e);
        }

        next_index = log.last_index() + 1;
    }

    log.flush_to_disk();
}
```

---

### **15.14.5 Control Plane Integration**

Replication coordination interacts closely with the control plane’s **Placement Service** (see Chapter 14):

```rust
API PlacementControl {
    GetReplicaTopology(RangeId) -> ReplicaMap
    UpdateLeader(RangeId, LeaderId) -> Ack
    ReportReplicaLag(RangeId, NodeId, LagMetrics) -> Ack
}
```

* The **control plane** tracks where each replica lives and who the leader is.
* The **replication layer** reports metrics such as log lag, health, and election outcomes.
* This feedback loop enables automated balancing, leadership redistribution, and failure detection.

---

### **15.14.6 Message Timeline**

Below illustrates a simplified **timeline of messages** during replication:

```
Client ──► Leader ──► Followers
   │          │
   │          ├─ AppendEntries(batch)
   │          │       │
   │          │       └─► AppendAck(success)
   │          │
   │          └─ Commit after quorum
   │
   └─► Response (CommitAck)
```

During failures:

* If the leader dies → new election via `RequestVote`.
* New leader reconciles logs using `AppendEntries` with conflict detection.
* Followers trim or replay logs to match the leader’s committed index.

---

### **15.14.7 Key Invariants**

To ensure safety and consistency, the replication subsystem enforces:

| Invariant                         | Description                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| **Log Matching Property**         | If two logs have same index+term, all previous entries are identical. |
| **Leader Completeness**           | A leader always contains all committed entries from prior terms.      |
| **Quorum Commit Rule**            | Entry is committed only if majority replicated it in current term.    |
| **Monotonic Commit Index**        | Commit index never decreases across terms.                            |
| **Single Active Leader per Term** | Prevents concurrent commits in partitioned networks.                  |

These invariants are formally verifiable and underpin the correctness of the replication system.

---

### **15.14.8 Summary**

This section formalized the **contracts and pseudocode** underlying replication coordination.
The defined APIs - `ReplicaSync`, `LeaderElection`, and `ReplicaControl` - separate **control** from **data replication**, enabling modular implementation and integration with higher-level rebalancing and placement services.

By combining:

* well-defined contracts,
* deterministic log semantics,
* and fault-tolerant election logic,
  the system guarantees strong consistency and predictable recovery under failure.

---

Next, we’ll move naturally into **Chapter 16 - Snapshotting & Log Compaction**, where we handle log growth, checkpointing, and efficient state recovery while preserving these replication guarantees.

---