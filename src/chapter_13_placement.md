## **Chapter 13 - Placement & Replica Assignment**

### **13.1 Overview**

In a distributed system, **placement** determines *where* data or computation lives. Whether you’re placing containers across nodes, shards across databases, or replicas across availability zones, placement decisions impact **latency, availability, cost, and fault tolerance**.

At its core, placement and replica assignment form the backbone of **resource distribution and resilience** in large-scale systems. A cluster manager must ensure that workloads are spread intelligently while respecting constraints such as hardware capacity, failure domains, affinity rules, and performance metrics.

---

### **13.2 The Placement Problem**

Placement is a **multi-dimensional optimization problem**:

* **Resources:** CPU, memory, disk, network bandwidth
* **Topology:** rack, node, region, zone
* **Constraints:** affinity, anti-affinity, co-location
* **Policies:** cost, priority, balance, energy efficiency

For example:

* A Kubernetes scheduler must assign Pods to Nodes ensuring CPU/memory limits are respected.
* A Cassandra cluster must place replicas across racks to ensure quorum availability.
* A distributed file system like HDFS places blocks to balance reliability and access speed.

The goal is to **maximize cluster utilization** while **minimizing risk and contention**.

---

### **13.3 Replica Assignment Basics**

Most distributed systems use **replication** to achieve durability and fault tolerance.
Replica assignment determines **where each copy of the data is placed**.

Common strategies:

| Strategy                       | Description                                         | Example System   |
| ------------------------------ | --------------------------------------------------- | ---------------- |
| **Uniform replication**        | Each partition is replicated *N* times across nodes | HDFS             |
| **Zone-aware replication**     | Replicas placed across racks/zones                  | Cassandra, Kafka |
| **Load-aware replication**     | Balances data size and read/write load              | CockroachDB      |
| **Topology-aware replication** | Takes network hierarchy into account                | Ceph, Swift      |

Replica assignment is tightly coupled with placement - often the same module performs both, balancing **data locality** with **failure independence**.

---

### **13.4 Consistent Hashing and Data Distribution**

A key primitive for placement is **consistent hashing**, used widely in:

* DynamoDB
* Cassandra
* Kafka partitions
* TiDB and CockroachDB

#### **Mechanism**

Nodes (or storage servers) are assigned to positions on a **hash ring**. Each data item (e.g., key, partition) is hashed and assigned to the next node clockwise on the ring.

Advantages:

* Minimal data movement when nodes join/leave.
* Load balancing through virtual nodes (vnodes).

#### **Example**

```
HashRing: [N1, N2, N3]
Data(keyA) -> hash(keyA) -> N2
Data(keyB) -> hash(keyB) -> N3
```

When N2 fails, N3 temporarily serves its partitions, minimizing rebalancing.

---

### **13.5 Placement Constraints**

Placement systems often support rich constraints to capture business or infrastructure rules.

| Constraint Type     | Example                                                 |
| ------------------- | ------------------------------------------------------- |
| **Affinity**        | “Run service A and B on the same node for low latency.” |
| **Anti-Affinity**   | “Avoid placing two replicas on the same rack.”          |
| **Capacity**        | “Only place workloads on nodes with >4GB RAM free.”     |
| **Topology Spread** | “Ensure replicas are evenly distributed across zones.”  |
| **Custom Policy**   | “Prefer renewable-energy-powered datacenters.”          |

Schedulers model this as a **Constraint Satisfaction Problem (CSP)** or **Integer Linear Program (ILP)**, optimizing for both hard and soft constraints.

---

### **13.6 Algorithms & Techniques**

Placement algorithms range from greedy heuristics to machine learning–based optimizers.

#### **Greedy / Rule-Based**

* Simple, fast.
* Used in early Mesos and Kubernetes schedulers.
* Example: “Pick first node that fits the request.”

#### **Scoring / Weighted Ranking**

* Nodes get a score based on resource fit and policy match.
* Example: Kubernetes’ *ScorePlugins*.
* Compute: `score = w1*resource_fit + w2*topology_score + w3*latency`

#### **Constraint Optimization**

* Solved using ILP, SAT solvers, or simulated annealing.
* Used in Borg (Google’s internal scheduler).
* Expensive but produces globally optimal placements.

#### **Feedback-Based Placement**

* Uses cluster telemetry (CPU, IO, latency) to continuously rebalance.
* Example: *Autopilot* in Google Cloud or *Rebalancer* in Kafka.

---

### **13.7 Dynamic Rebalancing**

Placement is not a one-time operation. Systems must **rebalance dynamically** due to:

* Node failures or scaling events
* Hotspots in data access
* Resource contention

A good rebalancer:

* Minimizes **data movement**
* Respects **network cost**
* Preserves **availability**

**Example – Kafka Rebalance:**
Kafka’s partition reassignor redistributes partitions when brokers join/leave, while maintaining replica spread across racks.

---

### **13.8 Practical Design Example: Kafka Partition Placement**

Let’s analyze Kafka’s partition placement logic:

1. **Each topic** has multiple partitions.
2. **Each partition** has `replication.factor` replicas.
3. **Replica placement policy:**

   * Spread replicas across racks.
   * Assign leader partitions evenly across brokers.
   * On broker failure, reassign partitions using a rebalance plan.

This simple yet effective placement ensures **data durability, rack-level fault tolerance, and balanced broker load.**

---

### **13.9 Challenges**

| Challenge                      | Description                                         |
| ------------------------------ | --------------------------------------------------- |
| **Skewed load**                | Some nodes get “hot” due to uneven access.          |
| **Constraint explosion**       | Too many policies can make scheduling NP-hard.      |
| **Latency vs Cost**            | Data locality vs cross-zone replication trade-offs. |
| **Heterogeneous hardware**     | Nodes with different performance profiles.          |
| **Dynamic cluster membership** | Nodes joining/leaving frequently.                   |

Real-world systems often use **heuristics and feedback loops** to deal with these challenges incrementally rather than aiming for perfect optimality.

---

### **13.10 Future Directions**

Emerging trends in placement and replica assignment include:

* **Reinforcement learning–based schedulers** that adapt dynamically.
* **Energy-aware placement** to reduce carbon footprint.
* **Predictive load balancing** using historical telemetry.
* **Declarative scheduling languages** like Kubernetes’ Scheduling Framework.

---

### **13.11 Exercises**

1. **Conceptual:**
   Why does consistent hashing minimize data movement compared to modulo-based partitioning?

2. **Applied:**
   Given 3 racks and replication factor 3, propose an algorithm to ensure replicas are rack-aware.

3. **Analytical:**
   Describe the trade-off between data locality and fault tolerance in placement decisions.

4. **Design:**
   Build a simplified scoring function for a scheduler that considers both CPU usage and latency.

5. **Case Study:**
   Research how CockroachDB places replicas and compare it to Cassandra.

6. **Challenge:**
   Implement a simulation of consistent hashing with N nodes and visualize how keys reassign when one node is removed.

7. **Exploratory:**
   Suggest a way to integrate a learning-based placement feedback loop into an existing rule-based scheduler.

---

### **13.12 Placement Strategy for Our Distributed Database**

Designing a placement and replica assignment strategy for a distributed database requires balancing **durability**, **consistency**, **performance**, and **resource utilization**. Unlike generic workload schedulers, databases operate under strong data locality, replication, and quorum semantics — making placement a *foundational layer* for both correctness and efficiency.

Our strategy builds upon several principles used in production-grade databases like **Cassandra**, **CockroachDB**, and **TiDB**, but tailored for **control-plane-driven coordination**.

---

#### **13.12.1 Core Principles**

1. **Data-local placement**

   * Primary replicas are placed close to where data is most frequently read or written (client proximity or partition ownership).
   * Minimizes latency for read-heavy workloads.

2. **Failure-domain isolation**

   * Replicas are distributed across *zones*, *racks*, and *nodes* to prevent correlated failures.
   * Each replica of a partition must lie in a distinct fault domain.

3. **Consistent hashing with topology awareness**

   * Base placement uses a consistent hash ring.
   * The ring is segmented into **zones**; each partition is placed in N zones (where N = replication factor).

4. **Quorum alignment**

   * Replica placement ensures that quorum (majority) replicas span independent zones to maximize availability even under partial failures.
   * Example: RF=3 across 3 zones ensures quorum survival after any single zone outage.

5. **Load-aware assignment**

   * Monitor per-node CPU, memory, and IO utilization.
   * Avoid placing new replicas on “hot” or overloaded nodes.
   * Integrate with telemetry feedback from the storage layer.

6. **Stable membership under churn**

   * Minimize rebalancing when nodes join or leave.
   * Maintain replica stability to reduce data movement overhead.

---

#### **13.12.2 Placement Workflow**

The **placement controller** inside the cluster manager operates as a modular pipeline:

| Stage                        | Description                                                      | Example Component |
| ---------------------------- | ---------------------------------------------------------------- | ----------------- |
| **1. Partition Hashing**     | Each table is partitioned using consistent hashing.              | HashRing module   |
| **2. Replica Selection**     | Choose N nodes from distinct racks/zones for each partition.     | ReplicaPlanner    |
| **3. Constraint Validation** | Ensure rack/zone affinity, resource limits, and anti-colocation. | PolicyEngine      |
| **4. Scoring & Balancing**   | Score candidates based on current utilization.                   | LoadScorer        |
| **5. Commit Placement**      | Persist decisions in the cluster metadata store.                 | PlacementRegistry |
| **6. Rebalance Loop**        | Periodically or reactively adjust to failures or load shifts.    | Rebalancer        |

The entire process is deterministic and auditable — ensuring reproducibility across control-plane replicas.

---

#### **13.12.3 Example Policy: Zone-Aware Consistent Hashing**

We extend standard consistent hashing to include *zone weights*:

```text
ZoneA (weight 2)
ZoneB (weight 1)
ZoneC (weight 1)
```

Replicas are assigned proportionally to zone weights while maintaining distinct fault domains per partition.
For RF=3:

* Replica1 → ZoneA (Primary)
* Replica2 → ZoneB
* Replica3 → ZoneC

When a new node joins ZoneC, only keys mapping to ZoneC’s hash range are rebalanced — minimizing cross-zone data movement.

---

#### **13.12.4 Rebalancing and Healing**

Our rebalancer operates in **two modes**:

* **Reactive mode:** Triggered on node/rack failure. Moves replicas from unavailable domains.
* **Proactive mode:** Periodic balancing based on node load and replication lag metrics.

Rules:

* Never move more than *K%* of partitions per cycle.
* Prefer local-zone replacements first.
* Rebalance one replica per partition at a time to preserve quorum.

---

#### **13.12.5 Integration with the Control Plane**

The placement service exposes a well-defined API:

```rust
trait PlacementAPI {
    fn assign_replicas(&self, partition_id: &str, replication_factor: usize) -> PlacementPlan;
    fn rebalance(&self, cluster_state: &ClusterState) -> Vec<PlacementPlan>;
    fn validate_plan(&self, plan: &PlacementPlan) -> Result<(), PlacementError>;
}
```

This API is consumed by higher-level modules:

* **Metadata Service** → persists placement metadata.
* **Replication Manager** → uses placement for replica streaming.
* **Rebalancer Agent** → monitors drift and triggers placement updates.

---

#### **13.12.6 Benefits of the Chosen Strategy**

| Goal                      | How it’s achieved                                           |
| ------------------------- | ----------------------------------------------------------- |
| **High Availability**     | Zone- and rack-aware replica assignment                     |
| **Low Latency**           | Data-local primary selection                                |
| **Scalability**           | Consistent hashing for O(1) lookup and O(log N) rebalancing |
| **Operational Stability** | Minimal movement under churn                                |
| **Policy Control**        | Explicit placement and validation hooks in control plane    |

---

#### **13.12.7 Looking Ahead**

Future enhancements may include:

* **Machine learning–based placement scoring** using predictive workload heatmaps.
* **Historical telemetry analysis** to predict and preempt hotspots.
* **Adaptive replication factor** per partition, based on access frequency.
* **Declarative placement rules** in configuration DSLs (e.g., YAML or Rego policies).

---

## Mini Replica Placement Simulator (Rust)

- This is a standalone command-line simulator that demonstrates:
- a consistent-hash ring with virtual nodes (vnodes)
- assigning keys to nodes and reporting distribution
- simulating node removal/addition and reporting how many keys moved
- a simple rack-aware replica placement heuristic
- Build with: `cargo new placement_sim --bin` and replace src/main.rs with this file, or save as main.rs inside a cargo project.

```Rust
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fmt::Write as FmtWrite;
use std::hash::{Hash, Hasher};

fn hash_u64<T: Hash>(t: &T) -> u64 {
    let mut s = DefaultHasher::new();
    t.hash(&mut s);
    s.finish()
}

#[derive(Debug, Clone)]
struct Node {
    id: String,     // unique node id, e.g. "node-1"
    rack: String,   // rack id, e.g. "rack-a"
}

#[derive(Debug)]
struct ConsistentHashRing {
    replicas: usize, // virtual nodes per physical node
    // We use a BTreeMap for ordered ring mapping from hash->node_id
    ring: BTreeMap<u64, String>,
}

impl ConsistentHashRing {
    fn new(replicas: usize) -> Self {
        Self { replicas, ring: BTreeMap::new() }
    }

    fn vnode_key(node_id: &str, i: usize) -> String {
        format!("{}#vn{}", node_id, i)
    }

    fn add_node(&mut self, node_id: &str) {
        for i in 0..self.replicas {
            let key = Self::vnode_key(node_id, i);
            let h = hash_u64(&key);
            // collisions extremely unlikely; we simply overwrite if present
            self.ring.insert(h, node_id.to_string());
        }
    }

    fn remove_node(&mut self, node_id: &str) {
        let mut to_remove = Vec::new();
        for (h, nid) in self.ring.iter() {
            if nid == node_id {
                to_remove.push(*h);
            }
        }
        for h in to_remove {
            self.ring.remove(&h);
        }
    }

    // find the node responsible for the given key hash
    fn get_node_for_hash(&self, h: u64) -> Option<String> {
        // BTreeMap::range can find first key >= h; otherwise wrap to first
        if let Some((_, node)) = self.ring.range(h..).next() {
            return Some(node.clone());
        }
        // wrap-around
        self.ring.iter().next().map(|(_, node)| node.clone())
    }

    fn get_node_for_key<T: Hash>(&self, key: &T) -> Option<String> {
        let h = hash_u64(key);
        self.get_node_for_hash(h)
    }

    // For debugging / distribution metrics
    fn ring_size(&self) -> usize {
        self.ring.len()
    }
}

// Simple placement simulator harness
struct PlacementSimulator {
    ring: ConsistentHashRing,
    nodes: HashMap<String, Node>, // node_id -> Node
}

impl PlacementSimulator {
    fn new(replicas: usize) -> Self {
        Self { ring: ConsistentHashRing::new(replicas), nodes: HashMap::new() }
    }

    fn add_node(&mut self, node: Node) {
        let id = node.id.clone();
        self.ring.add_node(&id);
        self.nodes.insert(id.clone(), node);
    }

    fn remove_node(&mut self, node_id: &str) {
        self.ring.remove_node(node_id);
        self.nodes.remove(node_id);
    }

    // assign each key to a primary node (consistent hash)
    fn assign_primaries(&self, keys: &[String]) -> HashMap<String, Vec<String>> {
        let mut mapping: HashMap<String, Vec<String>> = HashMap::new();
        for k in keys {
            if let Some(node) = self.ring.get_node_for_key(k) {
                mapping.entry(node).or_default().push(k.clone());
            } else {
                // no nodes in ring
            }
        }
        mapping
    }

    // Rack-aware replica assignment: for each key, pick primary via ring,
    // then walk ring clockwise picking replicas from distinct racks until
    // we have `replication_factor` replicas or exhaust nodes.
    fn assign_replicas_rack_aware(&self, keys: &[String], replication_factor: usize) -> HashMap<String, Vec<Vec<String>>> {
        // return map: key -> list of replica node ids (ordered: primary first)
        let mut out: HashMap<String, Vec<Vec<String>>> = HashMap::new();
        if self.nodes.is_empty() {
            return out;
        }

        // build an ordered list of (hash, node_id) for walking
        let mut sorted_ring: Vec<(u64, String)> = self.ring.ring.iter().map(|(h, nid)| (*h, nid.clone())).collect();
        sorted_ring.sort_by_key(|(h, _)| *h);

        let unique_nodes: Vec<String> = {
            let mut set = Vec::new();
            let mut seen = HashSet::new();
            for (_, nid) in &sorted_ring {
                if !seen.contains(nid) {
                    seen.insert(nid.clone());
                    set.push(nid.clone());
                }
            }
            set
        };

        for key in keys {
            let primary = match self.ring.get_node_for_key(key) {
                Some(n) => n,
                None => continue,
            };

            let mut replicas: Vec<String> = Vec::new();
            let mut used_racks: HashSet<String> = HashSet::new();

            // add primary
            if let Some(node) = self.nodes.get(&primary) {
                used_racks.insert(node.rack.clone());
                replicas.push(primary.clone());
            } else {
                // node not present
            }

            // iterate through unique_nodes in ring order starting after primary
            if unique_nodes.len() > 1 {
                // find index of primary
                let mut idx = unique_nodes.iter().position(|n| n == &primary).unwrap_or(0);
                let mut steps = 0;
                while replicas.len() < replication_factor && steps < unique_nodes.len() * 2 {
                    idx = (idx + 1) % unique_nodes.len();
                    let candidate = &unique_nodes[idx];
                    if replicas.contains(candidate) { steps += 1; continue; }
                    let candidate_rack = &self.nodes.get(candidate).unwrap().rack;
                    if !used_racks.contains(candidate_rack) {
                        used_racks.insert(candidate_rack.clone());
                        replicas.push(candidate.clone());
                    }
                    steps += 1;
                }
            }

            // if we still don't have enough replicas (not enough racks), allow same-rack nodes
            if replicas.len() < replication_factor {
                for n in &unique_nodes {
                    if replicas.len() >= replication_factor { break; }
                    if replicas.contains(n) { continue; }
                    replicas.push(n.clone());
                }
            }

            out.insert(key.clone(), vec![replicas]);
        }

        // Note: returned structure is key -> Vec<Vec<String>> to match possible future extension (per-replica metadata)
        out
    }

    // Utility: count how many keys changed primary owner between two mappings
    fn count_moved_keys(old_map: &HashMap<String, Vec<String>>, new_map: &HashMap<String, Vec<String>>) -> usize {
        // Build key->owner for both
        let mut old_owner: HashMap<&String, &String> = HashMap::new();
        for (node, keys) in old_map {
            for k in keys { old_owner.insert(k, node); }
        }
        let mut new_owner: HashMap<&String, &String> = HashMap::new();
        for (node, keys) in new_map {
            for k in keys { new_owner.insert(k, node); }
        }
        let mut moved = 0usize;
        for (k, old) in old_owner.iter() {
            if let Some(new) = new_owner.get(k) {
                if *old != *new { moved += 1; }
            } else {
                moved += 1; // lost key
            }
        }
        moved
    }

    // Distribution metrics: return node -> count
    fn distribution_counts(mapping: &HashMap<String, Vec<String>>) -> HashMap<String, usize> {
        let mut out: HashMap<String, usize> = HashMap::new();
        for (node, keys) in mapping {
            out.insert(node.clone(), keys.len());
        }
        out
    }
}

fn make_sample_keys(n: usize) -> Vec<String> {
    (0..n).map(|i| format!("key-{:06}", i)).collect()
}

fn print_dist_stats(dist: &HashMap<String, usize>) {
    let mut keys: Vec<_> = dist.iter().collect();
    keys.sort_by_key(|(k, _)| *k);
    let mut total = 0usize;
    for (_, v) in &keys { total += *v; }
    let mean = (total as f64) / (keys.len() as f64);
    let mut s = String::new();
    writeln!(&mut s, "Distribution across {} nodes (total keys = {}):", keys.len(), total).ok();
    for (k, v) in keys {
        writeln!(&mut s, "  {:15} -> {:6} keys", k, v).ok();
    }
    writeln!(&mut s, "  mean = {:.2}", mean).ok();
    println!("{}", s);
}

fn main() {
    // Simple demo run
    let replicas = 100; // vnodes per node
    let mut sim = PlacementSimulator::new(replicas);

    // Add 6 nodes across 3 racks
    sim.add_node(Node { id: "node-1".into(), rack: "rack-a".into() });
    sim.add_node(Node { id: "node-2".into(), rack: "rack-a".into() });
    sim.add_node(Node { id: "node-3".into(), rack: "rack-b".into() });
    sim.add_node(Node { id: "node-4".into(), rack: "rack-b".into() });
    sim.add_node(Node { id: "node-5".into(), rack: "rack-c".into() });
    sim.add_node(Node { id: "node-6".into(), rack: "rack-c".into() });

    println!("Ring virtual nodes total = {}", sim.ring.ring_size());

    let keys = make_sample_keys(10_000);
    let primaries_before = sim.assign_primaries(&keys);
    let dist_before = PlacementSimulator::distribution_counts(&primaries_before);
    print_dist_stats(&dist_before);

    // Simulate node failure: remove node-3
    println!("\nSimulating removal of node-3 (rack-b) ...\n");
    sim.remove_node("node-3");
    let primaries_after = sim.assign_primaries(&keys);
    let dist_after = PlacementSimulator::distribution_counts(&primaries_after);
    print_dist_stats(&dist_after);

    let moved = PlacementSimulator::count_moved_keys(&primaries_before, &primaries_after);
    println!("Keys moved due to removal: {} ({}% of {})", moved, (moved as f64) * 100.0 / (keys.len() as f64), keys.len());

    // Rack-aware replicas (replication factor 3)
    println!("\nComputing rack-aware replica assignments (replication_factor=3) for first 10 keys:\n");
    let first_keys: Vec<String> = keys.iter().take(10).cloned().collect();
    let replicas_map = sim.assign_replicas_rack_aware(&first_keys, 3);
    for k in &first_keys {
        if let Some(list) = replicas_map.get(k) {
            // list is Vec<Vec<String>>; our implementation puts replicas vec as list[0]
            if let Some(replica_vec) = list.get(0) {
                println!("{} -> replicas = {:?}", k, replica_vec);
            }
        }
    }

    println!("\nDone. You can modify the node set, keys, and parameters in main() for experimentation.");
}
```