# **Chapter 16 - Recovery & Repair**

### **1. Overview**

Failures are inevitable in any distributed system. Machines crash, disks fail, networks partition, and processes terminate unexpectedly. The goal of a distributed database is not to prevent failures-but to *recover* gracefully and *repair* inconsistencies once normal operation resumes.

Recovery ensures the system can restore its state after a crash or restart. Repair ensures that replicas, logs, and metadata remain consistent across the cluster. Together, they define the system’s *self-healing* capability.

---

### **2. Types of Failures**

Distributed databases face multiple classes of failures, each requiring different recovery mechanisms:

| Failure Type             | Description                                     | Recovery Scope                               |
| ------------------------ | ----------------------------------------------- | -------------------------------------------- |
| **Process Failure**      | Node process crashes or restarts.               | Local recovery of logs and caches.           |
| **Node/Host Failure**    | Machine or VM becomes unavailable.              | Reallocation of replicas and state transfer. |
| **Disk/Data Corruption** | Data files or log segments become unreadable.   | Re-replication from healthy replicas.        |
| **Network Partition**    | Connectivity loss between nodes or datacenters. | Partial recovery and reconciliation.         |
| **Cluster-Wide Outage**  | Multiple nodes or zones fail simultaneously.    | Coordinated recovery via snapshot restore.   |

---

### **3. Recovery Phases**

Recovery in a distributed database typically proceeds through **three logical phases**:

1. **Detection** – Control plane or leader notices missing heartbeats or failed responses.
2. **Reconstruction** – Logs, snapshots, or replicas are used to reconstruct consistent state.
3. **Reintegration** – Recovered node rejoins the cluster and resumes normal operations.

Each subsystem-storage, replication, placement, and metadata-has its own recovery logic, but all follow this pattern.

---

### **4. Local Recovery**

When a node restarts after a crash, it performs *local recovery* before rejoining the cluster.

#### **4.1 Log Replay**

Nodes maintain *write-ahead logs (WALs)* to ensure durability. Upon restart:

1. **Scan the WAL** from the last checkpoint.
2. **Apply** committed entries to local storage.
3. **Discard** incomplete or corrupted entries.

This guarantees that all persisted operations are replayed exactly once.

```rust
fn replay_log(log: &mut WriteAheadLog, store: &mut Storage) -> Result<()> {
    for entry in log.read_from_checkpoint()? {
        if entry.is_valid() && entry.is_committed() {
            store.apply(entry)?;
        }
    }
    Ok(())
}
```

#### **4.2 Snapshot Restoration**

If replaying the entire log is expensive, the system can restore a snapshot and replay only recent deltas:

```
snapshot → replay(log after snapshot)
```

Snapshots may be stored locally or in distributed blob storage.

---

### **5. Replica Repair**

After recovery, replicas may diverge in state due to missed updates, partial replication, or network partitions. The system must reconcile these inconsistencies through **replica repair**.

#### **5.1 Detection**

Use *checksums*, *version vectors*, or *Merkle trees* to detect divergence between replicas.

* **Checksums** – Compare hash of file ranges or SSTables.
* **Merkle Trees** – Hierarchical hash trees to efficiently detect differences.
* **Version Vectors** – Logical timestamps for per-key consistency.

#### **5.2 Repair Mechanisms**

| Method                  | Description                                            | Use Case                   |
| ----------------------- | ------------------------------------------------------ | -------------------------- |
| **Read Repair**         | Fix inconsistencies during read path.                  | Opportunistic fix.         |
| **Anti-Entropy Repair** | Periodic background reconciliation using Merkle trees. | Full sync.                 |
| **Hinted Handoff**      | Temporarily buffer writes for unavailable replicas.    | Short-term unavailability. |
| **Incremental Repair**  | Compare and fix only changed ranges.                   | Efficient recovery.        |

---

### **6. Cluster-Level Recovery**

When multiple nodes fail, the control plane coordinates cluster-wide recovery:

1. **Mark failed nodes** and evacuate their replicas.
2. **Reassign partitions** to healthy nodes.
3. **Trigger re-replication** from surviving copies.
4. **Update placement metadata** and mark recovery complete.

This process is tightly coupled with *rebalancing* (Chapter 14) and *replication coordination* (Chapter 15).

---

### **7. Metadata and Transaction Recovery**

Metadata (e.g., placement tables, configuration state) and transactional logs require *coordinated recovery* to maintain consistency.

#### **7.1 Metadata Journaling**

The control plane maintains a journal of configuration changes, ensuring that even if a master node fails, the next leader can replay the journal to restore system state.

```rust
pub trait MetadataRecovery {
    fn replay_journal(&mut self, entries: Vec<MetaEntry>) -> Result<()>;
    fn validate_state(&self) -> bool;
}
```

#### **7.2 Transaction Rollback**

In-flight transactions at the time of crash must be resolved:

* **Committed but unacknowledged** → replay.
* **In-progress** → abort.
* **Aborted but persisted** → roll back.

This requires *write-ahead logging at transaction layer* and *idempotent operations*.

---

### **8. APIs & Contracts**

To make recovery standardized and modular, we define a set of **Recovery Contracts** across system layers.

#### **(1) Recovery Contracts**

```rust
API NodeRecovery {
    ReplayLogs(CheckpointId) -> ReplayStatus
    RestoreSnapshot(SnapshotId) -> RestoreAck
    VerifyIntegrity(FileRange) -> IntegrityReport
}
```

Allows storage layer to rebuild local state from logs or snapshots.

#### **(2) Replica Repair Contracts**

```rust
API ReplicaRepair {
    CompareChecksums(ReplicaId, Range) -> DiffReport
    SyncMissingEntries(ReplicaId, DiffReport) -> SyncAck
}
```

Coordinates data consistency between peers after repair.

#### **(3) Metadata Recovery Contracts**

```rust
API MetaRecovery {
    ReplayJournal(JournalRange) -> JournalAck
    ValidateClusterState() -> ValidationReport
}
```

Used by control plane to reconstruct cluster topology and configurations.

---

### **9. Pseudocode Example: End-to-End Node Recovery**

Below is a simplified high-level flow executed by a recovering node:

```rust
fn recover_node(node_id: NodeId) -> Result<()> {
    // Phase 1: Local recovery
    replay_log(&mut wal, &mut store)?;
    restore_snapshots_if_needed()?;
    verify_data_integrity()?;
    
    // Phase 2: Coordination with control plane
    let missing_replicas = fetch_missing_replicas(node_id)?;
    for r in missing_replicas {
        request_replica_repair(r)?;
    }
    
    // Phase 3: Reintegration
    notify_cluster(NodeState::Healthy)?;
    Ok(())
}
```

---

### **10. Design Considerations**

| Concern              | Strategy                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| **Idempotency**      | Every recovery and repair operation must be idempotent to avoid duplication. |
| **Isolation**        | Recovering nodes should not serve traffic until verified.                    |
| **Prioritization**   | Critical partitions should be repaired first.                                |
| **Resource Control** | Limit concurrent repairs to avoid disk/network overload.                     |
| **Incrementality**   | Allow partial, resumable recovery steps.                                     |

---

### **11. Real-World Examples**

* **Cassandra**: Uses Merkle trees for anti-entropy repair and hinted handoff for temporary failures.
* **CockroachDB**: Replays Raft logs from durable storage and applies snapshots for node rejoin.
* **MongoDB**: Uses oplog tailing and rollback via sync source election.
* **TiDB**: Reconstructs raft groups from logs and auto-rebalances on node loss.

---

### **12. Exercises**

1. Explain the difference between *read repair* and *anti-entropy repair* with examples.
2. How does snapshot-based recovery reduce recovery time compared to log replay?
3. Why must recovery operations be idempotent?
4. Simulate a node restart scenario and describe the order of recovery operations.
5. Design a repair algorithm for detecting inconsistent replicas using Merkle trees.
6. Discuss trade-offs between synchronous and asynchronous repair.
7. How does hinted handoff help in availability but risk temporary inconsistency?
8. Extend the `ReplicaRepair` API to support incremental repair.
9. What role does metadata journaling play in system-wide recovery?
10. Build a test plan for validating recovery under partial network failures.

---

### **13. Summary**

Recovery and repair mechanisms enable a distributed database to tolerate failures, self-heal, and maintain durability. From local log replay to cluster-wide anti-entropy, these techniques form the backbone of a system’s reliability. Combined with replication, placement, and rebalancing strategies, they complete the lifecycle of *resilient data management*.

---