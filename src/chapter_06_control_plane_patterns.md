# **Chapter 6: Control Plane Patterns & Primitives**

> *“If the data plane moves the bytes, the control plane moves the decisions.”*

---

## **6.1 What Is a Control Plane?**

In any distributed system, there are two fundamental planes:

* **Data Plane** - The components that handle actual workload data (e.g., serving requests, running containers, storing rows).
* **Control Plane** - The components that decide *what should happen* in the data plane (e.g., scheduling, configuration updates, coordination).

The **control plane** orchestrates the cluster’s behavior, providing a consistent, observable, and modifiable *state of intent*.

### **Examples**

* **Kubernetes:** The control plane includes the API Server, Controller Manager, Scheduler, and etcd.
* **Consul:** Control plane provides service registry, health checks, and key-value configuration.
* **Kafka:** The Controller node coordinates partition leaders, replication, and rebalances.

---

## **6.2 Core Responsibilities**

| Responsibility                  | Description                                   | Example                                    |
| ------------------------------- | --------------------------------------------- | ------------------------------------------ |
| **State Management**            | Maintains desired vs. actual state            | etcd stores the cluster desired state      |
| **Scheduling**                  | Decides placement of workloads                | Kubernetes Scheduler assigns Pods to Nodes |
| **Coordination**                | Ensures nodes agree on shared state           | Raft in etcd, Zookeeper in Kafka           |
| **Configuration Distribution**  | Propagates config updates to all nodes        | Envoy xDS protocol                         |
| **Monitoring & Reconciliation** | Watches system state, triggers fixes          | K8s controllers constantly reconcile       |
| **Security & Policy**           | Manages identity, RBAC, and admission control | Kubernetes Admission Webhooks              |

---

## **6.3 Primitives of a Control Plane**

Every control plane is built upon a set of **primitives** - the atomic operations and design elements that higher-level patterns are composed from.

### 1. **State Store**

A highly consistent database storing the system’s *desired state*.
Often implemented via consensus systems like **Raft** or **Paxos**.

**Example:**

```plaintext
etcd/
 ├── /pods/
 │    ├── podA -> {"node": "worker-1", "status": "Running"}
 │    └── podB -> {"node": "worker-2", "status": "Pending"}
 └── /nodes/
      ├── worker-1 -> {"cpu": 60%}
      └── worker-2 -> {"cpu": 80%}
```

### 2. **Watcher / Observer**

Allows components to *subscribe* to changes in the state store (like a pub-sub model).

Example (etcd Watch API):

```go
watchChan := client.Watch(ctx, "/pods/", etcd.WithPrefix())
for resp := range watchChan {
    for _, ev := range resp.Events {
        fmt.Printf("Updated: %s %q : %q\n", ev.Type, ev.Kv.Key, ev.Kv.Value)
    }
}
```

### 3. **Reconciler**

A control loop that compares **desired state** (from store) and **actual state** (from data plane), applying actions to converge them.

**Pattern:**

```
loop {
    desired = get_desired_state()
    actual = observe_system()
    if desired != actual:
        take_action()
}
```

Kubernetes controllers are a direct application of this **reconciliation pattern**.

### 4. **Leader Election**

To ensure single coordination source for specific tasks.

**Example (Raft-style):**

```
Nodes: A, B, C
Timeouts randomly staggered
→ Node A times out first → becomes candidate
→ Requests votes → gains majority → becomes Leader
→ Others follow until leader fails
```

### 5. **Work Queue / Controller Queue**

Many control planes use internal queues to process updates asynchronously and retry failures.

---

## **6.4 Control Plane Design Patterns**

### **Pattern 1: Declarative Control Plane**

Users declare *what they want*, not *how to do it*.
Controllers then reconcile the cluster towards that goal.

**Used in:** Kubernetes, Terraform, Pulumi.

```yaml
# Kubernetes Example
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
  - name: nginx
    image: nginx
```

→ Control plane ensures `Pod:web` is created and running on a node.

**Key Benefit:** Self-healing, automated correction, scalable coordination.

---

### **Pattern 2: Event-Driven Control Plane**

State changes trigger asynchronous actions in controllers.
Often implemented with watches, message queues, or event buses.

**Used in:** Envoy xDS, Istio Pilot, Control loops in etcd/K8s.

**Flow:**

```
Change → Event → Controller reacts → Data plane update
```

---

### **Pattern 3: Centralized vs. Distributed Control**

| Model                         | Pros                          | Cons                           | Example                        |
| ----------------------------- | ----------------------------- | ------------------------------ | ------------------------------ |
| **Centralized Control Plane** | Simpler, consistent decisions | Bottlenecks, single failure    | Kubernetes API Server          |
| **Distributed Control Plane** | Scalable, fault-tolerant      | Harder to maintain consistency | Consul, Istio, HashiCorp Nomad |

**Design Trade-off:**

* Centralized for consistency → easier reasoning
* Distributed for scalability → more autonomy

---

### **Pattern 4: Control Plane Federation**

Multiple control planes coordinating across regions or clusters.

**Example:**

* *Kubernetes Federation* allows multi-cluster control.
* *Cloud load balancers* operate across data centers.

**Challenge:** Ensuring **eventual consistency** and **conflict resolution**.

---

## **6.5 Design Example: Mini Control Plane**

Let’s design a simple control plane for a **job scheduler**.

### **Components**

1. **JobStore (etcd)** - desired jobs
2. **Scheduler Controller** - assigns job to node
3. **Agent (Worker)** - executes jobs and reports back

### **Flow**

```
User → API → JobStore (/jobs/j1: Pending)
Scheduler watches /jobs → assigns NodeA
→ NodeA starts execution
→ Reports status back (/jobs/j1: Running)
→ Reconciler verifies & updates
```

**Key Concepts:**

* Watchers notify controllers
* Controllers act to move system toward desired state
* Agents reflect actual system status

---

## **6.6 Common Challenges**

| Challenge              | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| **Event Storms**       | Rapid state changes can overwhelm watchers and queues                       |
| **Split Brain**        | Multiple leaders lead to conflicting decisions                              |
| **Reconciliation Lag** | Delay in observing actual state causes drift                                |
| **State Explosion**    | Thousands of objects create scaling pressure on the control store           |
| **Security**           | Misconfigured RBAC or trust boundaries can expose sensitive control actions |

---

## **6.7 Exercises**

1. **Conceptual:**
   Explain the difference between *desired state* and *observed state*. How does a control loop help maintain cluster reliability?

2. **Practical:**
   Write pseudocode for a simple controller that ensures all nodes have a config file `/etc/app.conf` matching the version stored in etcd.

3. **Analysis:**
   Compare Kubernetes’ reconciliation pattern to that of Consul’s service catalog updates. What are the trade-offs?

4. **Design:**
   Design a leader election algorithm for a control plane where nodes may have intermittent network connectivity.

5. **Debugging:**
   What metrics would you collect from a control plane to detect reconciliation lag or misconfigurations?

---

## **6.8 Design Challenges**

1. **Mini Control Plane Implementation:**
   Build a small control plane in Rust or Go that:

   * Stores “tasks” in memory
   * Watches them for updates
   * Spawns worker goroutines to simulate nodes
   * Logs reconciliation actions

2. **Resilient Watch System:**
   Design a watch mechanism that can survive transient disconnections without missing updates.

3. **Multi-Leader Simulation:**
   Simulate a split-brain scenario and propose a detection + recovery mechanism.

4. **Policy-Driven Scheduling:**
   Extend your mini control plane to support policies like CPU limits or node labels.

---


## **6.9 Solution: Mini Control plane**


### **Illustration: Mini Control Plane Design**

Below is a conceptual flow of a **minimal control plane** that manages background “Jobs” and schedules them to worker nodes.

```
                          ┌────────────────────────────┐
                          │        User / CLI          │
                          │  (Submits Job Spec)        │
                          └────────────┬───────────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │   API / JobStore  │
                             │  (etcd or memory) │
                             └────────┬──────────┘
                                      │ (watch jobs/)
                     ┌────────────────┴──────────────────┐
                     ▼                                   ▼
        ┌─────────────────────┐             ┌─────────────────────┐
        │  Scheduler          │             │  Reconciler         │
        │ Assigns Jobs to     │             │ Ensures Desired ==  │
        │ available Nodes     │             │ Actual state        │
        └─────────┬───────────┘             └──────────┬──────────┘
                  │ (update store)                     │ (trigger corrections)
                  ▼                                    ▼
            ┌──────────────────────┐        ┌──────────────────────┐
            │  Worker Node (Agent) │        │  Worker Node (Agent) │
            │  Executes jobs and   │        │  Reports status      │
            │  updates state       │        │  back to store       │
            └──────────────────────┘        └──────────────────────┘

                             <--- Feedback Loop --->
                             Reconciler compares desired vs. actual
                             and reschedules as needed
```

---

### **Go Version - Minimal Control Plane Prototype**

Here’s a minimal Go prototype demonstrating a control plane loop using a shared in-memory store.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type Job struct {
    ID     string
    Node   string
    Status string
}

type Node struct {
    ID      string
    Running bool
}

// Shared in-memory “etcd”
var jobStore = struct {
    sync.RWMutex
    jobs map[string]*Job
}{jobs: make(map[string]*Job)}

func scheduler(nodes []Node) {
    for {
        jobStore.Lock()
        for _, job := range jobStore.jobs {
            if job.Status == "Pending" {
                for _, n := range nodes {
                    if !n.Running {
                        fmt.Printf("[Scheduler] Assigning job %s → %s\n", job.ID, n.ID)
                        job.Node = n.ID
                        job.Status = "Running"
                        break
                    }
                }
            }
        }
        jobStore.Unlock()
        time.Sleep(2 * time.Second)
    }
}

func worker(id string) {
    for {
        jobStore.Lock()
        for _, job := range jobStore.jobs {
            if job.Node == id && job.Status == "Running" {
                fmt.Printf("[Worker %s] Executing %s...\n", id, job.ID)
                time.Sleep(3 * time.Second)
                job.Status = "Completed"
                fmt.Printf("[Worker %s] Job %s done.\n", id, job.ID)
            }
        }
        jobStore.Unlock()
        time.Sleep(1 * time.Second)
    }
}

func reconciler() {
    for {
        jobStore.RLock()
        for _, job := range jobStore.jobs {
            if job.Status != "Completed" && job.Node == "" {
                fmt.Printf("[Reconciler] Found unassigned job: %s\n", job.ID)
            }
        }
        jobStore.RUnlock()
        time.Sleep(5 * time.Second)
    }
}

func main() {
    nodes := []Node{{ID: "n1"}, {ID: "n2"}}
    jobStore.jobs["job1"] = &Job{ID: "job1", Status: "Pending"}
    jobStore.jobs["job2"] = &Job{ID: "job2", Status: "Pending"}

    go scheduler(nodes)
    go reconciler()
    go worker("n1")
    go worker("n2")

    select {} // run forever
}
```

**Concepts Shown**

* The **Scheduler** assigns jobs to free nodes.
* The **Workers** simulate job execution and update the job state.
* The **Reconciler** detects jobs stuck in an unassigned state.

---

### **Rust Version - Simplified Control Plane Loop**

Below is a Rust version showing the same control plane pattern using threads and shared state (`Arc<Mutex<>>`):

```rust
use std::{sync::{Arc, Mutex}, thread, time::Duration};

#[derive(Clone)]
struct Job {
    id: String,
    node: Option<String>,
    status: String,
}

type JobStore = Arc<Mutex<Vec<Job>>>;

fn scheduler(store: JobStore, nodes: Vec<String>) {
    loop {
        let mut jobs = store.lock().unwrap();
        for job in jobs.iter_mut() {
            if job.status == "Pending" {
                if let Some(node) = nodes.iter().find(|_| true) {
                    println!("[Scheduler] Assigning {} → {}", job.id, node);
                    job.node = Some(node.clone());
                    job.status = "Running".to_string();
                }
            }
        }
        drop(jobs);
        thread::sleep(Duration::from_secs(2));
    }
}

fn worker(store: JobStore, node: String) {
    loop {
        let mut jobs = store.lock().unwrap();
        for job in jobs.iter_mut() {
            if job.node.as_deref() == Some(&node) && job.status == "Running" {
                println!("[Worker {}] Executing {}", node, job.id);
                thread::sleep(Duration::from_secs(3));
                job.status = "Completed".to_string();
                println!("[Worker {}] Job {} done.", node, job.id);
            }
        }
        drop(jobs);
        thread::sleep(Duration::from_secs(1));
    }
}

fn reconciler(store: JobStore) {
    loop {
        let jobs = store.lock().unwrap();
        for job in jobs.iter() {
            if job.node.is_none() && job.status != "Completed" {
                println!("[Reconciler] Unassigned job detected: {}", job.id);
            }
        }
        drop(jobs);
        thread::sleep(Duration::from_secs(4));
    }
}

fn main() {
    let store: JobStore = Arc::new(Mutex::new(vec![
        Job { id: "job1".into(), node: None, status: "Pending".into() },
        Job { id: "job2".into(), node: None, status: "Pending".into() },
    ]));

    let nodes = vec!["n1".into(), "n2".into()];

    let s_store = store.clone();
    let r_store = store.clone();
    let w1_store = store.clone();
    let w2_store = store.clone();

    thread::spawn(move || scheduler(s_store, nodes.clone()));
    thread::spawn(move || reconciler(r_store));
    thread::spawn(move || worker(w1_store, "n1".into()));
    thread::spawn(move || worker(w2_store, "n2".into()));

    loop { thread::sleep(Duration::from_secs(1)); }
}
```

**Concepts Demonstrated**

* Shared state (`Arc<Mutex<Vec<Job>>>`) mimics etcd or a control store.
* Independent threads act as controllers and workers.
* Shows **watch-reconcile-execute loop** fundamental to control planes.

---

## **6.10 Summary**

* The **control plane** is the decision-making layer of any cluster manager.
* It operates using primitives like **state stores, watchers, reconcilers, and leader election**.
* Patterns like **declarative configuration** and **event-driven control** make systems self-healing and predictable.
* Designing a good control plane involves balancing **consistency, availability, and scalability**.

