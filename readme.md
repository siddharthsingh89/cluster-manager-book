# Cluster Manager Book

This project is an **incremental, hands-on guide** (built as an [mdBook](https://rust-lang.github.io/mdBook/)) that walks through the **design and implementation of a cluster manager** - the *control plane* component in a distributed database system.

Unlike many database design tutorials, this book **does not implement the storage or query engine**.  
Instead, it focuses entirely on the **Cluster Manager process** - the component that:
- Tracks and manages cluster membership  
- Handles node join/leave and failure detection  
- Performs placement, rebalancing, and recovery  
- Coordinates replication, configuration, and metadata consistency  
- Exposes operator and client APIs for cluster operations  

---

## Structure

The book is divided into three main parts:

| Part | Focus | Description |
|------|--------|-------------|
| **Part I - Foundations & Surveys** | Theory & Existing Systems | Explains the roles, responsibilities, and real-world designs from systems like Cassandra, CockroachDB, and Etcd. |
| **Part II - Goals & Architecture** | Design & Planning | Defines goals, APIs, architecture, and core algorithms for membership, placement, and replication. |
| **Part III - Implementation** | Hands-on Coding | Step-by-step implementation of the cluster manager modules, assuming APIs for WAL, Storage, and RPC already exist. |

Each chapter builds incrementally toward a working **reference implementation** and **test harness**.

---

## Key Learning Outcomes
By following this book, you’ll learn to:
- Architect a cluster manager and control plane from first principles  
- Analyze existing systems and their trade-offs  
- Design APIs between nodes, clients, and operators  
- Implement membership, leader election, rebalancing, and replication coordination  
- Develop observability, testing, and deployment tooling for distributed clusters  

---

## Prerequisites

- Familiarity with **distributed systems basics** (consensus, replication, failure models)  
- Basic **Rust**, **Go**, or **Java** coding experience (examples use Rust)  
- Installed tools:
  ```bash
  cargo install mdbook
```

## Setup Instructions

Clone this repo and serve the book locally:

git clone https://github.com/<your-username>/cluster-manager-book.git
cd cluster-manager-book
mdbook serve --open


You can now browse the live book at http://localhost:3000


## License

This project is open-source under the MIT License.