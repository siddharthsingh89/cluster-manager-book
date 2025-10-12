# Part I - Foundations & Surveys

Before we can design our own cluster manager, we need to understand **what problems it solves** and **how others have solved them**.
This part of the book lays the groundwork - the mental model, vocabulary, and design space - for everything that follows.

A distributed system is a dance between *coordination* and *data*. While storage engines and consensus layers handle persistence and replication, the cluster manager is the conductor ensuring that nodes know **who’s in the cluster**, **who’s leading**, **what configuration to follow**, and **how to recover when something fails**.

Part I explores these foundations across eight chapters:

---

### **Chapter 1 - Why a Cluster Manager?**

We begin by asking why databases even need a dedicated cluster manager.
We’ll examine what happens without one, what complexity it hides, and how it serves as the *control plane* of a distributed database.

---

### **Chapter 2 - Roles & Responsibilities**

A deep dive into the cluster manager’s duties - from node discovery and membership tracking to leader election, configuration updates, and coordination with the query and storage layers.

---

### **Chapter 3 - Core Concepts and Terminology**

A glossary of key ideas - clusters, nodes, epochs, leases, quorums, heartbeats, replication groups, and metadata stores - forming the shared vocabulary we’ll use throughout the book.

---

### **Chapter 4 - Failure Models & Fault Tolerance**

Understanding failure is essential to building resilient systems.
This chapter explains crash faults, network partitions, Byzantine failures, and how timeouts, retries, and consensus protocols mitigate them.

---

### **Chapter 5 - Consistency Models & Guarantees**

From linearizability to eventual consistency, we’ll clarify how cluster managers maintain system-wide correctness across replicas and nodes under concurrent updates.

---

### **Chapter 6 - Control Plane Patterns & Primitives**

A practical look at control-plane design: service discovery, heartbeats, leases, configuration push/pull models, and how systems like Kubernetes, Etcd, and Zookeeper expose reusable patterns.

---

### **Chapter 7 - Comparative Survey**

A guided tour through real implementations - Cassandra, CockroachDB, TiDB, and others - comparing their cluster-manager architectures, strengths, and trade-offs.

---

### **Chapter 8 - Design Constraints & NFRs**

We conclude with the non-functional requirements that shape every design: scalability, availability, observability, operability, and upgradeability. These constraints define the playing field for the design we’ll build in later parts.

---

By the end of Part I, you’ll have a **complete mental model** of what a cluster manager is, how it fits into a distributed database, and the range of approaches taken in production systems.
From here, we’ll move from theory to design - setting goals, defining architecture, and finally, building the modules that bring a cluster to life.

---