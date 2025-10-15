# Chapter 12 — Membership & Discovery

This chapter describes the membership and discovery subsystem for our distributed database. It defines goals, data and API contracts (referencing earlier configuration/replication contracts), detailed design, implementation plan, service boundaries, protocols, node-local view, request sequences, ASCII diagrams, tests, and skeleton pseudocode.

---

## 12.1 Goals

1. **Accurate cluster membership:** Every node must be able to learn who the current members are (alive, suspect, or removed) with bounded staleness.
2. **Fast failure detection:** Detect node failures quickly and reliably while minimizing false positives.
3. **Scalable discovery:** Support large clusters (hundreds to thousands) with sub-linear overhead where possible.
4. **Consistent bootstrap:** Nodes joining must get a consistent view of cluster config (replica sets, roles, shard assignments). This must integrate with the configuration contracts from the previous chapter (ConfigAPI, ReplicaSync, etc.).
5. **Resilience to partitions:** Partitioned clusters should make forward progress where possible and have clear reconciliation when partitions heal.
6. **Secure membership changes:** Only authorized controllers or quorum-approved operations may change membership.
7. **Low operational complexity:** The subsystem should be simple to operate, instrument, and reason about.

---

## 12.2 Concepts & Terminology

- **Member:** A node that has been added to cluster membership metadata. Each member has `id`, `endpoint`, `roles` (voter, learner, storage-only, witness), `meta` (labels), and `epoch`.
- **Local View:** The node's internal data structure representing membership state derived from heartbeats, gossip, or controller API.
- **Controller / Seed Nodes:** Special nodes or services that help bootstrap membership. They may be lightweight and not part of every cluster (for fully peer-to-peer clusters). They expose a `Bootstrap`/`Join` API.
- **Failure Detector:** The component that turns missing heartbeats into suspicion and failure events.
- **Gossip:** A scalable dissemination protocol used for membership propagation.
- **Quorum:** A voting subset used for membership changes to avoid split-brain. Implementation uses majority or configurable quorums per replica-group.
- **Epoch / Version:** Monotonic counter for membership configuration changes.

---

## 12.3 Design Overview

We present a hybrid design combining a small, reliable **control-plane** (controller/management nodes or an external configuration service) and **gossip-based** membership for fast local propagation and scalability. Control-plane operations (add/remove) require quorum on controller nodes and produce authoritative membership epochs. Gossip provides eventual convergence and fast failure propagation.

Rationale:
- Control-plane ensures serialized membership changes and strong semantics for critical operations (reconfigs), while gossip keeps membership view fresh across all nodes with low overhead.

Components:
- **Membership Controller Service (MCS):** Accepts administrative requests to add/remove nodes, emits new membership epochs, and stores authoritative configuration. Implements the authoritative API (ties into ConfigAPI from previous chapter).
- **Local Membership Agent (LMA):** Runs on every node, talks to MCS for bootstrap and reconfig, participates in gossip, runs failure detector, emits local events to other subsystems (replication, shards).
- **Gossip Layer:** Peer-to-peer UDP/TCP overlay for disseminating membership updates and failure suspect messages. Uses anti-entropy and piggybacking.
- **Failure Detector:** Phi-accrual detector with adaptive timeouts.
- **Auth & RBAC:** Ensure that only authorized clients can change membership. Mutual TLS between nodes and controllers.

---

## 12.4 API Contracts (references)

Refer back to the configuration contracts from the previous chapter (e.g., `ConfigAPI`, `ReplicaSync`). Here we add/clarify membership-related methods that integrate with those contracts.

```rust
// Controller-side API
pub trait MembershipControllerAPI {
    // Admin operations (require quorum on controllers)
    fn add_member(member: MemberSpec) -> Result<MembershipEpoch>; // returns new epoch
    fn remove_member(member_id: NodeId) -> Result<MembershipEpoch>;
    fn update_member(member: MemberSpec) -> Result<MembershipEpoch>;

    // Query
    fn get_membership() -> MembershipConfig; // latest authoritative config

    // Bootstrap
    fn join_request(join: JoinRequest) -> Result<JoinResponse>; // used by new nodes
}

// Node-local agent events
pub trait LocalMembershipEvents {
    fn on_local_suspect(node_id: NodeId);
    fn on_local_failed(node_id: NodeId);
    fn on_membership_update(cfg: MembershipConfig); // delivered when epoch changes
}
```

`MembershipConfig` includes `epoch`, list of `Member`, and signed metadata.

---

## 12.5 Protocols & Data flows

### 12.5.1 Bootstrap / Join

1. New node starts LMA.
2. LMA contacts a preconfigured seed list (MCS endpoints or seed nodes) using `join_request`.
3. Controller authenticates request, validates, and issues a `JoinResponse` containing the current `MembershipConfig` and TLS bootstrap material if required.
4. LMA records the `MembershipConfig.epoch` and begins normal operation.

Security: Registration may require a token or admin approval depending on cluster policy. The MCS can create a `member` in a `pending` state until node proves identity (e.g., via challenge response).

### 12.5.2 Normal operation (gossip + heartbeats)

- Each LMA periodically sends heartbeats to a small subset of peers (fanout `k`, e.g., 3) and piggybacks its local membership vector.
- On receiving a heartbeat, peers update their local view and piggyback any newer entries.
- Anti-entropy runs occasionally (random peer selection) to reconcile membership tables.
- Suspicion is formed by the Failure Detector; once phi crosses threshold, an LMA advertises a `suspect` message via gossip including local evidence (last seen timestamp, sequence numbers).

### 12.5.3 Reconfiguration (add/remove)

- Admin calls `MembershipControllerAPI::add_member`.
- Controllers coordinate via a leader election (internal; controllers can also be replicated using raft) to produce new epoch and persist config.
- Controller responds with new `MembershipConfig` (signed) and notifies a subset of nodes directly (push) and also relies on gossip to propagate.
- Nodes that receive a higher-epoch config replace their local view atomically and emit `on_membership_update` events.

### 12.5.4 Failure handling & eviction

- If a node is `suspect` for longer than an eviction timeout and quorum of controllers or voters agrees, the controller issues a `remove_member` event with a new epoch.
- Eviction requires quorum to avoid split-brain; thresholds are configurable per cluster.

---

## 12.6 Implementation Plan & Services

### Services to create

1. **Membership Controller Service (MCS)**
   - REST/gRPC management API (add/remove/update/get)
   - Persistent storage (WAL + snapshot) for membership history
   - Optional internal consensus (Raft) for controller replication
   - Webhook/Notification integration to inform operators

2. **Local Membership Agent (LMA)**
   - Runs within node process or as sidecar
   - Handles join/heartbeat/gossip/failure detector
   - Publishes local events via an internal event bus for replication, routing, and admin UI

3. **Gossip Transport**
   - Pluggable transport (UDP for low-latency, TCP for reliability)
   - Message types: heartbeat, membership_update, suspect/restore, anti-entropy

4. **Security & Auth layer**
   - Mutual TLS config distribution during bootstrap
   - Role-based access control for admin APIs

5. **Diagnostics & Metrics**
   - Heartbeat latency, phi values, gossip fanout, membership epoch history

### Data model

```text
Member {
  id: UUID
  endpoint: (host, port)
  roles: [voter, learner, storage]
  meta: {key: value}
  last_seen: timestamp
  status: {Alive, Suspect, Failed, Left}
  epoch: u64
}

MembershipConfig {
  epoch: u64
  members: [Member]
  signature: bytes
}
```

---

## 12.7 Failure Detector & Parameters

Use **Phi-accrual** failure detector with adaptive window sizes. Key parameters:

- `heartbeat_interval` (default 500ms)
- `phi_threshold` (default 8)
- `eviction_timeout` (e.g., 30s to 60s)
- `gossip_fanout` (3)
- `anti_entropy_interval` (e.g., 5s)

Tune these per environment and provide dynamic runtime flags.

---

## 12.8 Local Process Structure (how it looks on the node)

```
+-----------------------------------------+
| Application / Storage Engine            |
|   - Uses LocalMembershipEvents to react |
+-----------------+-----------------------+
                  |
+-----------------v-----------------------+
| Local Membership Agent (LMA)             |
|  - Membership store (in-memory + small  |
|    durable cache)                        |
|  - Failure Detector                      |
|  - Gossip transport                      |
|  - Controller client (for joins, epoch)  |
|  - Admin API (local)                     |
+-----------------+-----------------------+
                  |
   +--------------+-------------+
   |                            |
+--v--+                    +----v----+
| Gossip|                    | Config |  (other subsystems: replication, routing)
| Peer  |                    | Watcher|
+------+                    +---------+
```

LMA exposes local endpoints so the storage engine or replication manager can subscribe to membership change events.

---

## 12.9 Sequence Diagrams (text-based)

### 12.9.1 Node Join

```
Node(LMA) -> Seed(MCS): JoinRequest
Seed -> Controller: validate -> create pending member
Controller -> Seed: JoinResponse(MembershipConfig, credentials)
Seed -> Node: JoinResponse
Node: store epoch, start heartbeats
Gossip: node advertises Alive via piggyback
```

### 12.9.2 Failure detection and eviction

```
NodeA misses heartbeats from NodeB -> FailureDetector marks NodeB suspect
NodeA -> GossipPeers: suspect(NodeB, evidence=last_seen)
ManyPeers receive suspect -> update local view (NodeB:Suspect)
If quorum of voters or controller confirm suspect -> Controller -> remove_member(NodeB) -> new epoch
Controller -> push new MembershipConfig -> nodes update local view (NodeB:Failed)
```

### 12.9.3 Reconfiguration (Add Member)

```
Admin -> Controller: add_member(M)
Controller: persist new epoch
Controller -> some nodes: push(MembershipConfig@epoch+1)
Gossip: propagate config
Nodes receive higher-epoch config -> atomically swap local membership -> emit on_membership_update
```

---

## 12.10 Edge Cases & Reconciliation

- **Split brain:** Controller quorum prevents conflicting authoritative epochs. If controllers partition, nodes accept only signed configs with epoch monotonicity and validate signatures.
- **Network partitions:** Nodes continue serving read-only or degraded operations if configured. Reconciliation on healing requires merging states using epoch ordering — higher epoch wins.
- **Clock skew:** Use logical clocks/monotonic counters where possible; do not rely on wall-clock for ordering critical decisions. Timestamps are for heuristics only.

---

## 12.11 Tests (integration/unit) — what must pass

### Unit tests
1. FailureDetector: phi values increase when heartbeats stop; detector marks suspect at threshold.
2. MembershipStore: applying a higher epoch config replaces lower epoch; lower epoch is rejected.
3. Join/Bootstrap: valid join responses decode correctly and produce initial state.
4. GossipMessage serialization/deserialization and signature verification.

### Integration tests
1. **Small cluster convergence:** 5 nodes start, join via seeds; within `t` seconds (configurable) all nodes have identical membership epoch and Alive statuses.
2. **Failure detection:** Bring down node B; within `eviction_timeout` cluster reaches `Failed` state for B and controller issues removal.
3. **Add/Remove race:** Concurrent add/remove requests serialized by controller; final epoch reflects one canonical result.
4. **Partition & heal:** Split cluster into 2 partitions, make changes in the larger/quorum partition, heal — ensure higher epoch dominates and nodes reconcile.
5. **Security test:** Unauthorized join attempt is rejected. Signed membership configs fail verification if tampered.
6. **Stress test:** 1000-node cluster gossip churn under simulated packet loss — membership converges and overhead remains within expected bounds.
7. **Controller failover:** Simulate controller node failures; controllers replicate via Raft and continue to accept admin requests.

Include deterministic test harness where possible (simulated clocks, network link controls) to avoid flakiness.

---

## 12.12 Skeleton Code / Pseudocode

Below are simplified pseudocode snippets showing main loops and important functions.

### LMA main loop (pseudocode)

```python
class LocalMembershipAgent:
    def __init__(self, config, controller_client, transport):
        self.members = MembershipStore()
        self.fd = PhiFailureDetector()
        self.transport = transport
        self.controller = controller_client
        self.heartbeat_interval = config.heartbeat_interval

    def start(self):
        # bootstrap
        resp = self.controller.join_request(JoinRequest(self.local_id, self.endpoint))
        self.apply_membership(resp.membership)
        # start background loops
        spawn(self.heartbeat_loop)
        spawn(self.gossip_receive_loop)
        spawn(self.failure_check_loop)

    def heartbeat_loop(self):
        while running:
            peers = self.members.random_fanout(k=3)
            for p in peers:
                msg = Heartbeat(self.local_id, self.members.current_epoch(), piggyback=self.members.diff_for(p))
                self.transport.send(p.endpoint, msg)
            sleep(self.heartbeat_interval)

    def gossip_receive_loop(self):
        for msg in self.transport.receive():
            self.handle_message(msg)

    def handle_message(self, msg):
        if msg.type == 'heartbeat' or msg.type == 'membership_update':
            self.members.merge(msg.membership)
            self.fd.heartbeat(msg.from)
        if msg.type == 'suspect':
            self.members.mark_suspect(msg.target, evidence=msg.evidence)

    def failure_check_loop(self):
        while running:
            for m in self.members.list():
                phi = self.fd.phi(m.id)
                if phi >= PHI_THRESHOLD and m.status == 'Alive':
                    self.members.mark_suspect(m.id)
                    self.transport.gossip(Suspect(m.id, evidence=self.fd.evidence(m.id)))
            sleep(heartbeat_interval)

    def apply_membership(self, cfg):
        if cfg.epoch > self.members.epoch:
            self.members.replace(cfg)
            emit_event('on_membership_update', cfg)
```

### Controller add_member flow (pseudocode)

```python
class MembershipController:
    def add_member(self, spec):
        with self.raft.leader_lock():
            cfg = self.store.load_current()
            new_cfg = cfg.clone_with_added(spec)
            new_cfg.epoch += 1
            self.store.persist(new_cfg)
            self.notify_nodes(new_cfg)
            return new_cfg
```

### MembershipStore.merge (pseudo)

```python
class MembershipStore:
    def merge(self, other_cfg):
        if other_cfg.epoch < self.epoch:
            return
        if other_cfg.epoch == self.epoch:
            # merge by member timestamp/status, but keep deterministic rules
            for m in other_cfg.members:
                self._merge_member(m)
        else:
            # other has higher epoch -> replace
            self.replace(other_cfg)
```

---

## 12.13 Operational considerations

- **Upgrades:** Controller code must be backward compatible with older LMAs when rolling upgrades occur. Use feature flags and epoch guards.
- **Observability:** Surface detailed metrics and traces for heartbeats, gossip messages, epoch changes, and controller decisions.
- **Backpressure:** Avoid sending large membership blobs frequently; use diffs and compressed anti-entropy.
- **Configuration:** Allow tuning of phi threshold, fanout, anti-entropy interval via runtime flags.

---

## 12.14 Future enhancements

1. **Adaptive gossip fanout** based on cluster size and topology.
2. **Sharding-aware membership** where membership is maintained per shard to reduce blast radius.
3. **Pluggable failure detectors** (e.g., hybrid logical clocks for long-haul links).
4. **Cross-datacenter optimizations**: separate intra-dc gossip and inter-dc push from controllers.

---

## 12.15 Next steps

- Convert pseudocode to concrete language implementations (Rust for agents and controllers as per project).
- Build unit tests for critical components first (FailureDetector, MembershipStore, Controller persistence).
- Create a deterministic cluster simulator to validate design under failure modes.




