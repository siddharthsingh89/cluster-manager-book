# **Chapter 17 – Configuration Management**

### **1. Overview**

Configuration Management is the backbone of control and coordination in a distributed database. It governs *what runs where*, *how replicas are placed*, *how features and parameters evolve*, and *how cluster-wide policies remain consistent*.

In a distributed system, configuration state is **shared mutable metadata** - it must be versioned, replicated, and carefully updated to avoid cascading failures. A misconfigured quorum size, replication factor, or timeouts can destabilize the entire cluster. Thus, configuration management must combine principles of **consistency**, **safety**, and **auditable change control**.

---

### **2. Configuration Layers**

Configuration in a distributed database spans multiple levels, each with distinct lifecycles and ownership.

| Layer                      | Scope                           | Example Parameters                         | Update Frequency |
| -------------------------- | ------------------------------- | ------------------------------------------ | ---------------- |
| **System Config**          | Cluster-wide settings           | replication_factor, region_topology        | Rare             |
| **Node Config**            | Per-node environment and limits | CPU quota, disk path, network endpoint     | Moderate         |
| **Shard/Partition Config** | Data placement and replication  | leader node, replica set, range boundaries | Frequent         |
| **Feature/Runtime Config** | Tunable knobs for algorithms    | consistency_level, compaction_strategy     | Dynamic          |

Each configuration layer has its own persistence, propagation, and validation model.

---

### **3. Configuration Principles**

A robust configuration system adheres to several principles:

1. **Centralized Truth, Distributed Caches** – Keep one source of truth (often in metadata store), with local caches for performance.
2. **Versioned & Auditable Changes** – Every configuration change is logged with timestamps, author, and version.
3. **Transactional Updates** – Apply config updates atomically across dependent components.
4. **Runtime Reloadability** – Allow safe dynamic reconfiguration without restarts.
5. **Consistency Levels** – Support strong consistency for critical configs and eventual consistency for less critical ones.

---

### **4. Architecture of Configuration Service**

A typical configuration subsystem comprises:

* **Config Store** – A durable, replicated key-value store (like etcd, ZooKeeper, or an internal raft-based metadata service).
* **Config Controller** – Validates, version-controls, and publishes changes.
* **Config Watchers/Agents** – Subscribe to updates and apply them locally.
* **Config Schema Registry** – Defines structure, type, and validation logic for all configuration keys.

#### **Diagram (Conceptual)**

```
          +---------------------------+
          |       Control Plane       |
          |---------------------------|
          |  Config Controller        |
          |  Validation Engine        |
          |  Version Registry         |
          +------------+--------------+
                       |
          +------------v-------------+
          |   Distributed Config KV  |  ← Raft/etcd/ZK
          +------------+-------------+
                       |
        +--------------+--------------+
        |                             |
+-------v--------+           +--------v-------+
|  Node Watcher  |           |  Node Watcher  |
|  Apply Changes |           |  Apply Changes |
+----------------+           +----------------+
```

---

### **5. Configuration Lifecycle**

1. **Definition** – Declare configuration schema with allowed keys, ranges, and defaults.
2. **Validation** – Run static and dynamic validation (syntax, semantic, dependency).
3. **Propagation** – Publish updates via Raft/etcd or event-based system.
4. **Application** – Local agents apply configuration safely (hot reload, throttled restart).
5. **Audit & Rollback** – Log every change and support version rollback.

---

### **6. Schema Example**

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct ClusterConfig {
    pub replication_factor: u8,
    pub max_node_disk_usage: f64,
    pub consistency_mode: String,
    pub gc_interval_secs: u64,
}

impl ClusterConfig {
    pub fn validate(&self) -> Result<()> {
        if !(1..=7).contains(&self.replication_factor) {
            return Err(anyhow!("Invalid replication factor"));
        }
        if self.max_node_disk_usage > 0.95 {
            return Err(anyhow!("Unsafe disk threshold"));
        }
        Ok(())
    }
}
```

This schema enforces structural safety and prevents misconfigurations that can destabilize the system.

---

### **7. Configuration Propagation**

When configuration updates occur, they must be:

* **Reliable** – Ensure every node eventually sees the same version.
* **Consistent** – Changes are atomic, even across partitions.
* **Ordered** – New configurations must supersede older ones deterministically.

#### **Propagation Flow**

1. Admin submits update via API or CLI.
2. Control Plane validates and commits new version to Config Store.
3. Each node’s Config Watcher streams updates and verifies version sequence.
4. Node applies configuration atomically, emitting a local “config updated” event.

---

### **8. Configuration Versioning**

Each configuration change is versioned by a monotonically increasing ID and timestamp.

```rust
pub struct ConfigVersion {
    pub version_id: u64,
    pub checksum: String,
    pub committed_at: DateTime<Utc>,
}
```

Nodes track their local configuration version and periodically reconcile with the control plane.

---

### **9. Contracts & APIs**

#### **(1) Configuration Service Contracts**

```rust
API ConfigService {
    GetConfig(ConfigKey) -> ConfigValue
    UpdateConfig(ConfigKey, ConfigValue) -> UpdateAck
    WatchConfig(ConfigKey, FromVersion) -> Stream<ConfigUpdate>
}
```

The `WatchConfig` stream enables push-based propagation.

#### **(2) Validation Contracts**

```rust
API ConfigValidator {
    ValidateSchema(ConfigSchema) -> ValidationReport
    ValidateUpdate(OldConfig, NewConfig) -> ValidationResult
}
```

Ensures all configuration updates are syntactically and semantically valid before commit.

#### **(3) Node Agent Contracts**

```rust
API ConfigAgent {
    ApplyConfig(ConfigVersion) -> ApplyAck
    ReportConfigStatus(NodeId) -> ConfigState
}
```

Allows nodes to apply or rollback configurations in a controlled way.

---

### **10. Pseudocode: Dynamic Configuration Update**

```rust
fn apply_cluster_config_update(new_config: ClusterConfig) -> Result<()> {
    // Step 1: Validate schema
    new_config.validate()?;

    // Step 2: Compare with local
    let current = CONFIG_STORE.read().unwrap().clone();
    if new_config == current {
        log::info!("No configuration change detected");
        return Ok(());
    }

    // Step 3: Atomically swap
    CONFIG_STORE.write().unwrap().replace(new_config.clone());

    // Step 4: Notify subsystems
    trigger_event("config_updated", &new_config)?;

    // Step 5: Persist locally
    persist_config_to_disk(&new_config)?;
    Ok(())
}
```

This ensures updates are applied safely and atomically.

---

### **11. Configuration Rollback**

Configuration rollback allows safe restoration of a previous version in case of instability.

#### **Rollback Flow**

1. Fetch previous version from audit log.
2. Validate backward compatibility.
3. Reapply using same commit pipeline.
4. Emit version rollback event for observability.

#### **Rollback API**

```rust
API ConfigRollback {
    GetHistory(ConfigKey) -> Vec<ConfigVersion>
    RollbackTo(ConfigKey, VersionId) -> RollbackAck
}
```

---

### **12. Security and Access Control**

Because configuration changes are powerful, they require **strict RBAC (Role-Based Access Control)**:

* **Reader** – View configuration.
* **Operator** – Apply runtime-safe configurations.
* **Administrator** – Modify system-level parameters and perform rollbacks.

Each change must be digitally signed or authenticated via secure tokens.

---

### **13. Design Considerations**

| Concern           | Strategy                                     |
| ----------------- | -------------------------------------------- |
| **Consistency**   | Use quorum writes for config commits.        |
| **Safety**        | Multi-phase validation before apply.         |
| **Resilience**    | Retry propagation to lagging nodes.          |
| **Auditing**      | Maintain immutable change logs.              |
| **Observability** | Export metrics and alerts for version drift. |

---

### **14. Real-World Implementations**

* **etcd / Kubernetes ConfigMaps** – Versioned key-value configuration, watchable and consistent.
* **CockroachDB Settings** – Stored in system tables and replicated through Raft consensus.
* **Cassandra Dynamic Config** – Allows live configuration reload via JMX without restart.
* **TiDB PD (Placement Driver)** – Manages cluster topology, config, and placement metadata centrally.

---

### **15. Exercises**

1. Explain how a configuration service differs from metadata or control plane storage.
2. Implement a Rust struct for runtime configuration hot-reload.
3. Describe how version conflicts are detected when two admins modify the same config key.
4. What failure scenarios could cause configuration drift, and how can you detect it?
5. Extend the `ConfigService` API to support partial updates and batch commits.
6. How can configuration be rolled back safely without disrupting cluster consistency?
7. Simulate a misconfiguration in replication factor and describe recovery steps.
8. Design a watcher mechanism that avoids flooding nodes during frequent updates.
9. Discuss the trade-offs between centralized and decentralized configuration storage.
10. Suggest a schema validation approach using versioned Protobuf or JSON schemas.

---

### **16. Summary**

Configuration management acts as the **central nervous system** of a distributed database - orchestrating operational parameters, enforcing safety policies, and enabling seamless scaling.
It must balance **flexibility** with **stability**, allowing runtime adjustments without compromising system integrity.
As the system grows, configuration management evolves from static files to dynamic, audited, and self-validating infrastructure that governs the cluster’s behavior in real time.

---