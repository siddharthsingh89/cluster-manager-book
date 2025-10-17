# **Chapter 20 - Testing Strategy & Verification**

Testing a distributed database is a formidable challenge. Unlike single-node systems, correctness depends not only on logic but also on timing, concurrency, and network behavior. A robust testing and verification strategy ensures that new releases maintain functional correctness, consistency guarantees, and operational reliability - even under chaos.

---

## **20.1 Philosophy of Testing Distributed Systems**

Traditional unit tests are insufficient. Distributed systems fail in complex, emergent ways - due to clock drift, message loss, or partial failures.
The testing philosophy here is **defense in depth**:

1. **Verify correctness at multiple layers** - from local logic to global invariants.
2. **Continuously test under stress** - faults, network partitions, and restarts.
3. **Automate verification** - use formal tools and property-based checks.
4. **Simulate reality** - include randomness, delay, and workload diversity.

---

## **20.2 Layers of Testing**

Testing spans from the smallest unit to full system integration.

| Layer                        | Scope                      | Goal                      |
| ---------------------------- | -------------------------- | ------------------------- |
| **Unit Tests**               | Functions, modules         | Local correctness         |
| **Integration Tests**        | Service boundaries         | Component interaction     |
| **System Tests**             | Multi-node clusters        | End-to-end behavior       |
| **Fault Injection Tests**    | Node or network faults     | Resilience                |
| **Consistency Verification** | Data state across replicas | Safety guarantees         |
| **Chaos & Load Testing**     | Real-world stress          | Stability and performance |

---

## **20.3 Unit Testing**

### **20.3.1 Scope**

Unit tests validate algorithms and data structures - such as log compaction, key hashing, and serialization.

Example (Rust):

```rust
#[test]
fn test_log_compaction_removes_obsolete_entries() {
    let mut log = Log::new();
    log.append("x", "1");
    log.append("x", "2");
    log.compact();
    assert_eq!(log.len(), 1);
}
```

### **20.3.2 Characteristics**

* Fast and deterministic
* No network or I/O dependencies
* Mocks for external services

Use frameworks like `tokio::test`, `mockall`, or `proptest` for concurrency and property-based assertions.

---

## **20.4 Integration Testing**

Integration tests validate interactions between subsystems - storage, replication, and configuration.

```rust
#[tokio::test]
async fn test_replica_sync_after_commit() {
    let cluster = TestCluster::new(3).await;
    cluster.client().insert("key", "value").await;
    cluster.await_replication("key").await;
    assert_eq!(cluster.replica_value("key").await, "value");
}
```

They often spin up mini-clusters in containers or ephemeral VMs using Docker Compose or Kubernetes-in-Docker (kind).

**Checklist:**

* API compatibility
* Authentication flow
* Metadata consistency
* Failover correctness

---

## **20.5 System & End-to-End Testing**

End-to-end (E2E) tests mimic real workloads - including concurrent reads/writes, failovers, and schema changes.

### **Example Workload Scenario**

* 5-node cluster
* 3 tenants performing mixed OLTP + analytics queries
* 10 simulated failures (restart, network partition)
* Measure durability and recovery latency

Tools like **Jepsen**, **Litmus**, or custom workload generators are ideal for such testing.

---

## **20.6 Fault Injection Testing**

Fault injection helps validate system behavior under adverse conditions.

### **20.6.1 Types of Faults**

* **Crash faults:** Node or process termination
* **Network faults:** Packet loss, delay, duplication, partition
* **Storage faults:** Disk full, corruption, read-only mounts
* **Timing faults:** Clock skew or drift

Example (simulation snippet):

```rust
fault_injector.drop_messages("raft_append_entries", 0.1);
fault_injector.delay("storage_commit", Duration::from_millis(500));
```

### **20.6.2 Expected Assertions**

* No data loss after crash
* Replication recovers automatically
* Leader election completes under partition
* Quorum consistency holds after recovery

---

## **20.7 Consistency Verification**

Consistency testing verifies that the system maintains its invariants across replicas.

### **20.7.1 Data Invariants**

* **Atomicity:** No partial writes
* **Linearizability:** Reads reflect the latest committed state
* **Snapshot isolation:** Transactions observe a consistent snapshot
* **No stale reads:** After replication completes

### **20.7.2 Verification Techniques**

* **State Hash Comparison:**
  Compute Merkle-tree hashes of replica data periodically.
* **Operation Replays:**
  Re-run command logs on multiple replicas; compare final states.
* **Formal Verification Tools:**
  Model key protocols using **TLA+**, **Ivy**, or **Prusti**.

```rust
fn verify_replica_state(cluster: &Cluster) {
    let hashes: Vec<_> = cluster.nodes.iter().map(|n| n.data_hash()).collect();
    assert!(hashes.iter().all_equal());
}
```

---

## **20.8 Property-Based & Fuzz Testing**

Property-based testing explores input space beyond fixed test cases.

### **Example Property**

> "For any sequence of operations, committed data must be recoverable after restart."

```rust
proptest! {
    #[test]
    fn commit_is_durable(ops in any::<Vec<DbOperation>>()) {
        let db = setup_db();
        for op in ops { db.apply(op); }
        db.restart();
        assert!(db.verify_durability());
    }
}
```

Fuzzers inject random workloads, corrupt packets, or malformed metadata to surface edge cases.

---

## **20.9 Chaos Engineering**

Chaos testing intentionally disturbs the system to ensure graceful degradation.

### **Principles**

1. Run in production-like environments.
2. Automate controlled experiments.
3. Measure recovery time and user impact.

**Example Experiments:**

* Kill leader node every 10 minutes.
* Inject 30% network latency between zones.
* Randomly throttle one replica group’s disk I/O.

Tools: **ChaosMesh**, **Gremlin**, **LitmusChaos**.

---

## **20.10 Performance & Scalability Testing**

Performance testing validates throughput, latency, and resource utilization.

### **Metrics**

* QPS (queries per second)
* p95/p99 latency
* Replica lag
* CPU, memory, and disk I/O under load

Use distributed load generators like **Locust**, **wrk2**, or custom Rust benchmarks with `criterion`.

**Scalability Goal:**

> “Throughput should scale linearly with the number of nodes, up to the replication factor limit.”

---

## **20.11 Regression & Upgrade Testing**

Each release must pass regression and upgrade tests to ensure backward compatibility.

### **Regression Suite**

* All unit, integration, and E2E tests
* Benchmark comparison against baseline
* Schema and API compatibility checks

### **Upgrade Tests**

* Rolling node upgrades with active traffic
* Cross-version replication and recovery
* Data migration correctness

Example:

```rust
cluster.upgrade_node("node-2", "v2.1.0").await;
assert!(cluster.consistency_check().await);
```

---

## **20.12 Continuous Verification Pipelines**

Automation ensures that testing is not an afterthought.

### **Pipeline Stages**

| Stage                      | Description                     |
| -------------------------- | ------------------------------- |
| **Build & Lint**           | Static analysis, code style     |
| **Unit Tests**             | Fast, local verification        |
| **Integration Tests**      | Multi-node mini-cluster         |
| **System Tests**           | End-to-end workloads            |
| **Chaos Stage**            | Fault injections and soak tests |
| **Performance Benchmarks** | Trend tracking                  |
| **Formal Check**           | Model verification (optional)   |

Example CI/CD snippet:

```yaml
stages:
  - build
  - test
  - chaos
  - benchmark
  - verify
```

---

## **20.13 Verification Contracts**

### **API: VerificationContract**

```rust
trait VerificationContract {
    fn verify_invariants(cluster: &Cluster) -> Result<(), Violation>;
    fn inject_fault(fault: FaultSpec) -> Result<(), FaultError>;
    fn check_replica_consistency() -> bool;
    fn run_property_tests(seed: u64);
}
```

This contract defines the verification layer used in both CI and on-demand operator diagnostics.

---

## **20.14 Challenges & Exercises**

**Challenges**

1. Design a fault-injection simulator for your replication protocol.
2. Model your consensus algorithm in TLA+ and check safety under partition.
3. Build a cluster test harness that runs upgrade tests automatically.

**Exercises**

* Write a property-based test for transactional rollback correctness.
* Implement a tool to compare per-replica state hashes during recovery.

---

## **Summary**

Testing and verification turn distributed uncertainty into predictable behavior.
By combining **layered testing**, **fault simulation**, and **formal validation**, teams can ensure that each release of a distributed database remains:

* Correct under concurrency
* Resilient under chaos
* Consistent across replicas
* Safe to upgrade in production

---