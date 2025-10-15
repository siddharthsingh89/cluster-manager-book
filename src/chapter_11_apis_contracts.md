# **Chapter 11 - APIs & Contracts**

---

## **11.1 Why Contracts Matter**

In a distributed database, **APIs are the boundaries of trust**.
They define what’s expected between:

* Control plane ↔ Data nodes
* Clients ↔ Cluster
* Internal services ↔ Each other

These boundaries must be:

* **Explicit** - clear message structures and semantics
* **Stable** - versioned and backward-compatible
* **Observable** - traceable and debuggable

Poorly defined contracts often lead to subtle bugs - mismatched state, ghost replicas, or double commits.
Hence, this chapter serves as the **single reference section** for all key APIs in our cluster manager.

---

## **11.2 APIs**

### **API ClientStore**

```
Write(KeyValue) -> Ack  
Read(Key) -> ValueResult  
Delete(Key) -> Ack  
BatchWrite(BatchItems) -> BatchAck  
RangeQuery(RangeRequest) -> RangeResult  
```

Supports CRUD, batch, and range operations for client access.

```rust
pub trait ClientStore {
    fn write(&self, kv: KeyValue) -> Ack;
    fn read(&self, key: String) -> ValueResult;
    fn delete(&self, key: String) -> Ack;
    fn batch_write(&self, items: Vec<KeyValue>) -> BatchAck;
    fn range_query(&self, req: RangeRequest) -> RangeResult;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct KeyValue { pub key: String, pub value: Vec<u8> }
#[derive(Serialize, Deserialize, Debug)]
pub struct ValueResult { pub value: Option<Vec<u8>>, pub version: u64 }
```

---

## **(2) Replication & Log Contracts**

### **API ReplicaSync**

```
AppendEntries(LogBatch) -> AppendAck  
FetchEntries(LogRequest) -> LogBatch  
RequestSnapshot(SnapshotRequest) -> SnapshotData  
ApplySnapshot(SnapshotData) -> SnapshotAck  
```

Handles log replication, snapshotting, and state synchronization between replicas.

```rust
pub trait ReplicaSync {
    fn append_entries(&self, batch: LogBatch) -> AppendAck;
    fn fetch_entries(&self, req: LogRequest) -> LogBatch;
    fn request_snapshot(&self, req: SnapshotRequest) -> SnapshotData;
    fn apply_snapshot(&self, snapshot: SnapshotData) -> SnapshotAck;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LogBatch { pub entries: Vec<LogEntry> }
#[derive(Serialize, Deserialize, Debug)]
pub struct LogEntry { pub key: String, pub value: Vec<u8>, pub version: u64 }
```

---

## **(3) Membership & Discovery Contracts**

### **API ClusterMembership**

```
Join(NodeInfo) -> JoinAck  
Leave(NodeId) -> Ack  
Heartbeat(HealthPing) -> HealthAck  
GetClusterView() -> ClusterView  
```

Defines node lifecycle and cluster topology exchange.

```rust
pub trait ClusterMembership {
    fn join(&self, node: NodeInfo) -> JoinAck;
    fn leave(&self, id: NodeId) -> Ack;
    fn heartbeat(&self, ping: HealthPing) -> HealthAck;
    fn get_cluster_view(&self) -> ClusterView;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NodeInfo { pub id: String, pub addr: String, pub capacity: f64 }
#[derive(Serialize, Deserialize, Debug)]
pub struct ClusterView { pub members: Vec<NodeInfo>, pub version: u64 }
```

---

## **(4) Placement & Replica Assignment Contracts**

### **API PlacementService**

```
GetReplicas(Key) -> ReplicaSet  
Rebalance(RebalanceRequest) -> RebalancePlan  
```

Determines data placement and generates rebalancing plans.

```rust
pub trait PlacementService {
    fn get_replicas(&self, key: String) -> ReplicaSet;
    fn rebalance(&self, req: RebalanceRequest) -> RebalancePlan;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReplicaSet { pub replicas: Vec<String>, pub leader: Option<String> }
#[derive(Serialize, Deserialize, Debug)]
pub struct RebalanceRequest { pub reason: String }
```

---

## **(5) Rebalancing & Data Movement Contracts**

### **API DataMover**

```
TransferPartition(PartitionMove) -> Ack  
CheckRebalanceStatus(PlanId) -> RebalanceStatus  
```

Moves partitions or shards between nodes during scaling or repair.

```rust
pub trait DataMover {
    fn transfer_partition(&self, mv: PartitionMove) -> Ack;
    fn check_rebalance_status(&self, plan_id: String) -> RebalanceStatus;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PartitionMove {
    pub partition_id: String,
    pub source: String,
    pub target: String,
}
```

---

## **(6) Replication Coordination (Consensus) Contracts**

### **API ConsensusProtocol**

```
RequestVote(VoteRequest) -> VoteResponse  
AppendEntries(LogBatch) -> AppendAck  
CommitIndex(UpdateCommit) -> Ack  
```

Implements Raft/Paxos-style replication and leader election.

```rust
pub trait ConsensusProtocol {
    fn request_vote(&self, req: VoteRequest) -> VoteResponse;
    fn append_entries(&self, batch: LogBatch) -> AppendAck;
    fn commit_index(&self, commit: UpdateCommit) -> Ack;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VoteRequest { pub term: u64, pub candidate_id: String }
#[derive(Serialize, Deserialize, Debug)]
pub struct VoteResponse { pub term: u64, pub granted: bool }
```

---

## **(7) Recovery & Repair Contracts**

### **API RecoveryService**

```
FetchSegment(SegmentRequest) -> SegmentData  
ReplayLog(LogBatch) -> ReplayAck  
FetchSnapshot(PartitionId) -> SnapshotData  
```

Handles crash recovery and repair of corrupted replicas.

```rust
pub trait RecoveryService {
    fn fetch_segment(&self, req: SegmentRequest) -> SegmentData;
    fn replay_log(&self, batch: LogBatch) -> ReplayAck;
    fn fetch_snapshot(&self, pid: String) -> SnapshotData;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SegmentData { pub entries: Vec<LogEntry> }
```

---

## **(8) Configuration & Metadata Contracts**

### **API ConfigAPI**

```
UpdateConfig(ClusterConfig) -> Ack  
GetConfig() -> ClusterConfig  
WatchConfig(NodeId) -> Stream<ConfigChange>  
```

Allows the control plane to propagate configuration changes and observe updates.

```rust
pub trait ConfigAPI {
    fn update_config(&self, cfg: ClusterConfig) -> Ack;
    fn get_config(&self) -> ClusterConfig;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClusterConfig {
    pub replication_factor: u8,
    pub read_quorum: u8,
    pub write_quorum: u8,
    pub compaction_policy: String,
}
```

---

## **(9) Security & Multi-Tenancy Contracts**

### **API AuthService**

```
Login(Credentials) -> AuthToken  
Authorize(AccessRequest) -> AccessResult  
GetTenantLimits(TenantId) -> TenantLimits  
```

Supports authentication, authorization, and tenant isolation.

```rust
pub trait AuthService {
    fn login(&self, creds: Credentials) -> AuthToken;
    fn authorize(&self, req: AccessRequest) -> AccessResult;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Credentials { pub user: String, pub password: String }
#[derive(Serialize, Deserialize, Debug)]
pub struct TenantLimits { pub max_storage: u64, pub max_throughput: u64 }
```

---

## **(10) Observability & Tooling Contracts**

### **API MonitorService**

```
GetMetrics() -> MetricsSnapshot  
HealthCheck() -> HealthStatus  
SubmitTrace(TraceReport) -> Ack  
```

Used for introspection, monitoring, and performance tracing.

```rust
pub trait MonitorService {
    fn get_metrics(&self) -> MetricsSnapshot;
    fn health_check(&self) -> HealthStatus;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MetricsSnapshot { pub cpu: f64, pub mem: f64, pub io: f64 }
#[derive(Serialize, Deserialize, Debug)]
pub struct HealthStatus { pub status: String }
```

---

## **(11) Testing & Fault Injection Contracts**

### **API FaultInjector**

```
InjectFault(FaultRequest) -> Ack  
RunConsistencyCheck(Range) -> ConsistencyReport  
```

Used during testing to simulate failures and validate cluster correctness.

```rust
pub trait FaultInjector {
    fn inject_fault(&self, req: FaultRequest) -> Ack;
    fn run_consistency_check(&self, range: (String, String)) -> ConsistencyReport;
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FaultRequest { pub fault_type: String, pub duration_ms: u64 }
```

---

 **This set now fully covers all system concerns:**

* **Client** (CRUD)
* **Replication & Consensus**
* **Membership**
* **Placement & Balancing**
* **Recovery**
* **Configuration**
* **Security**
* **Observability**
* **Testing**

This may evolve once individual components are implemented. I will update the contracts here as well.
---

## **Layered API Contract Map**

```
┌─────────────────────────────────────────────┐
│                 CLIENT PLANE                │
│─────────────────────────────────────────────│
│  (1) ClientStore API                        │
│     • Write / Read / Delete / RangeQuery    │
│  (9) AuthService API                        │
│     • Login / Authorize / TenantLimits      │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│               DATA PLANE                    │
│─────────────────────────────────────────────│
│  (2) ReplicaSync API                        │
│     • AppendEntries / FetchEntries          │
│  (6) ConsensusProtocol API                  │
│     • RequestVote / AppendEntries / Commit  │
│  (5) DataMover API                          │
│     • TransferPartition / RebalanceStatus   │
│  (7) RecoveryService API                    │
│     • FetchSegment / ReplayLog / Snapshot   │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│              CONTROL PLANE                  │
│─────────────────────────────────────────────│
│  (3) ClusterMembership API                  │
│     • Join / Leave / Heartbeat / ClusterView│
│  (4) PlacementService API                   │
│     • GetReplicas / RebalancePlan           │
│  (8) ConfigAPI                              │
│     • UpdateConfig / GetConfig / Watch      │
│  (10) MonitorService API                    │
│     • Metrics / HealthCheck / Tracing       │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│                SYSTEM PLANE                 │
│─────────────────────────────────────────────│
│  (11) FaultInjector API                     │
│     • InjectFault / ConsistencyCheck        │
│  (Logging, Metrics Export, Event Streams)   │
│  (Audit / Security Enforcement)             │
└─────────────────────────────────────────────┘
```

---

### **Layer Overview**

| Plane             | Purpose                                                                       | Example Components                               |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| **Client Plane**  | User-facing APIs that provide CRUD, authentication, and access control        | REST/GRPC frontend, SDKs                         |
| **Data Plane**    | Core data replication, consensus, and recovery mechanisms                     | Storage engine, log replication, compaction, WAL |
| **Control Plane** | Cluster-wide coordination, configuration, and monitoring                      | Scheduler, config manager, health monitor        |
| **System Plane**  | Background automation, testing hooks, fault injection, observability pipeline | Chaos tests, system repair daemons               |

---

###  **Inter-Plane Relationships**

* **Client → Control Plane:** Authenticated clients call cluster endpoints (via placement service) to locate data nodes.
* **Control Plane → Data Plane:** PlacementService and ConfigAPI update data-plane replicas with new assignments and configuration.
* **Data Plane → System Plane:** Exposes metrics, health, and logs; FaultInjector simulates load/failures for testing resilience.
* **Control Plane ↔ System Plane:** Configuration, audit, and monitoring systems interact to manage SLA and tenant-level enforcement.

---

### **Key Design Insights**

1. **Separation of Planes = Clarity of Responsibility**
   Each plane owns its domain: Control for coordination, Data for consistency, System for safety, Client for access.

2. **Contracts as Boundaries, not Just APIs**
   These contracts aren’t just methods — they define what can change independently (e.g., swapping Raft for Paxos doesn’t break ClientStore).

3. **Consistent Serialization**
   Every API uses structured contracts (`serde` in Rust) for cross-language and backward compatibility.

4. **Observability Everywhere**
   Every plane emits metrics and traces — ensuring operational goals (from Chapter 9) can be enforced.


---

## **11.8 Exercises and Challenges**

1. **Design Your Own Control API**
   Add a `ScaleCluster` or `DrainNode` API to the `ClusterControl` trait.
   What parameters would you include, and how would you ensure it’s idempotent?

2. **Consistency Tuning**
   Suppose you want a “read-your-own-writes” guarantee for queries.
   Which API would you modify - client or replication layer - and how?

3. **Error Injection Drill**
   Create a simulation where a `NodeUnavailable` error occurs during `AppendEntries`.
   How should the leader react to maintain consistency?

4. **Version Compatibility**
   Introduce a `NodeHealthV2` struct with an additional `disk_usage` field.
   How would you deploy this without breaking existing nodes?

5. **Mini Project - WAL Sync Contract**
   Write a new API `SyncWALSegment(start, end)` between replicas.
   Describe how it would integrate with the replication layer safely.

---

**Summary**

We’ve now built the **contractual backbone** of our distributed database.
These APIs - from query execution to node coordination and replication - form the foundation of **trust and predictability** in the cluster.

In the next chapter, we’ll explore **membership and discovery**, showing how new nodes join, get validated, and are integrated into this API ecosystem.

---