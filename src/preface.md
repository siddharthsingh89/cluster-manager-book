# Preface

Designing the cluster manager of a distributed database is one of the most fascinating and under-explored areas of systems engineering. While much has been written about query engines, storage engines, and consensus algorithms, the *control plane* - the process that ties everything together - often remains hidden behind diagrams and abstractions.

This book is an attempt to make that invisible layer visible.

We will gradually build our understanding and design from first principles - starting with what a cluster manager is, what problems it solves, and how it interacts with the rest of a distributed system. We’ll study how real-world systems like **Cassandra**, **CockroachDB**, **TiDB**, and **MongoDB** handle membership, leadership, configuration changes, and fault tolerance. Then, we’ll use those insights to design and implement our own cluster manager step by step.

The goal is not to recreate an entire distributed database, but to *build the mind of one*.
We’ll assume that APIs for storage, WAL, and replication already exist, and focus entirely on the logic of coordination, discovery, and orchestration.

Throughout the book, you’ll see:

* **Design discussions** to understand *why* each component exists.
* **Architecture sketches** to visualize *how* modules interact.
* **Code walkthroughs** to learn *how to build* a working implementation.

This book follows an *incremental design* philosophy - each chapter adds a small but complete piece to the overall system. By the end, you’ll have not only a working prototype but also the intuition to reason about fault tolerance, consistency, and cluster coordination in production-grade systems.

I’m still learning too - and this book is written in that spirit.
It’s a conversation between curiosity and experience, refined with the help of modern tools (including LLMs) to make complex ideas approachable.

Welcome to the journey of building a brain for distributed systems-one module at a time!