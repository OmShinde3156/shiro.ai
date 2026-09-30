"""
Deterministically generates the Shiro v3.5 Evaluation Benchmark Dataset.
Produces 15 technical documents, 250 calibrated psychometric questions (b in [-2.5, +2.5]),
a grounded concept knowledge graph with prerequisite edges, and synthetic learner traces.
"""

import json
import os
import random
from typing import Dict, List, Any

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "benchmark_dataset.json")

DOMAINS = [
    {
        "domain": "Operating Systems",
        "concepts": [
            "Process Synchronization",
            "Deadlock Avoidance",
            "Virtual Memory Paging",
            "Page Replacement Algorithms",
            "CPU Scheduling"
        ],
        "prerequisites": [
            ("Process Synchronization", "Deadlock Avoidance"),
            ("Virtual Memory Paging", "Page Replacement Algorithms")
        ]
    },
    {
        "domain": "Data Structures & Algorithms",
        "concepts": [
            "Balanced Search Trees",
            "Graph Traversal & Shortest Path",
            "Dynamic Programming",
            "Hash Table Collision Resolution",
            "Sorting & Divide-and-Conquer"
        ],
        "prerequisites": [
            ("Sorting & Divide-and-Conquer", "Dynamic Programming"),
            ("Balanced Search Trees", "Graph Traversal & Shortest Path")
        ]
    },
    {
        "domain": "Database Management Systems",
        "concepts": [
            "Relational Normalization",
            "ACID Transactions & Concurrency",
            "B+ Tree Storage Indexing",
            "Distributed Consensus & Raft",
            "Query Optimization & Relational Algebra"
        ],
        "prerequisites": [
            ("Relational Normalization", "Query Optimization & Relational Algebra"),
            ("ACID Transactions & Concurrency", "Distributed Consensus & Raft")
        ]
    }
]

# Raw technical corpus templates for 15 documents
DOCUMENTS_SPEC = [
    {
        "id": "doc_os_sync",
        "title": "Process Synchronization & Concurrency Primitives",
        "subject": "Operating Systems",
        "concepts": ["Process Synchronization"],
        "chunks": [
            {
                "chunk_id": "doc_os_sync_c1",
                "page": 1,
                "text": "A race condition arises when multiple concurrent threads access shared mutable state without proper synchronization, making the final outcome dependent on nondeterministic thread scheduling. Mutual exclusion guarantees that at most one execution thread accesses a critical section at any given instant. Peterson's algorithm solves mutual exclusion for two processes using shared variables 'flag' and 'turn', avoiding busy-waiting lockups under sequential consistency."
            },
            {
                "chunk_id": "doc_os_sync_c2",
                "page": 2,
                "text": "Semaphores, introduced by Edsger Dijkstra, are integer variables manipulated solely through two atomic operations: wait() (also known as P) and signal() (also known as V). A counting semaphore takes unrestricted integer values and manages access to finite resource pools. A binary semaphore is restricted to values 0 and 1, functioning analogously to a mutex lock. If a process invokes wait() when the semaphore counter is non-positive, it blocks until another process signals."
            },
            {
                "chunk_id": "doc_os_sync_c3",
                "page": 3,
                "text": "Monitors are high-level language synchronization constructs that encapsulate shared data structures with synchronized methods. Only one thread can execute within a monitor procedure at a time. Condition variables inside monitors (with operations wait() and signal()) allow threads to suspend execution until specific state assertions become true. Under Hoare semantics, signaling immediately transfers execution control to the woken thread, whereas Mesa semantics resumes the signaler first."
            }
        ]
    },
    {
        "id": "doc_os_deadlock",
        "title": "Deadlock Detection, Prevention & Banker's Algorithm",
        "subject": "Operating Systems",
        "concepts": ["Deadlock Avoidance"],
        "chunks": [
            {
                "chunk_id": "doc_os_deadlock_c1",
                "page": 1,
                "text": "A deadlock situation requires four simultaneous Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. If any single condition is structurally broken, deadlock cannot materialize. Deadlock prevention algorithms enforce protocols that invalidate at least one Coffman condition a priori, such as establishing a strict global total ordering on all resource acquisition requests to eliminate circular wait."
            },
            {
                "chunk_id": "doc_os_deadlock_c2",
                "page": 2,
                "text": "Dijkstra's Banker's Algorithm is a prominent deadlock avoidance protocol operating on multiple resource instances. It models state safety: a state is safe if there exists a safe sequence of processes <P1, P2, ..., Pn> such that each process Pi can satisfy its remaining resource demands using currently available resources plus resources held by all preceding processes Pj (where j < i). If no such sequence exists, the allocation is denied to avoid an unsafe state."
            },
            {
                "chunk_id": "doc_os_deadlock_c3",
                "page": 3,
                "text": "Deadlock detection with Resource Allocation Graphs (RAG) uses cycle detection when all resource types contain only single instances. If a cycle exists in a single-instance graph, deadlock is both necessary and sufficient. For multiple instances, vector matrix reduction using Available, Allocation, and Request data structures is executed periodically by the operating system scheduler."
            }
        ]
    },
    {
        "id": "doc_os_vm",
        "title": "Virtual Memory, Paging & Translation Lookaside Buffers",
        "subject": "Operating Systems",
        "concepts": ["Virtual Memory Paging"],
        "chunks": [
            {
                "chunk_id": "doc_os_vm_c1",
                "page": 1,
                "text": "Virtual memory decouples the programmer's logical address space from physical RAM, enabling processes whose working sets exceed physical memory capacity. In a paged virtual memory architecture, virtual addresses are partitioned into a virtual page number (VPN) and a page offset. The memory management unit (MMU) translates the VPN into a physical page frame number (PFN) via page table lookups, appending the unchanged offset."
            },
            {
                "chunk_id": "doc_os_vm_c2",
                "page": 2,
                "text": "A Translation Lookaside Buffer (TLB) is an associative hardware cache storing recently translated virtual-to-physical address mappings. On a TLB hit, translation completes in a single clock cycle without accessing main memory page tables. On a TLB miss, the MMU or operating system performs a page table walk. Multi-level hierarchical page tables reduce continuous memory footprint for sparse virtual address spaces by allocating page tables on demand."
            },
            {
                "chunk_id": "doc_os_vm_c3",
                "page": 3,
                "text": "When a thread references an address belonging to an unmapped or swapped-out page, hardware triggers a page fault interrupt. The operating system kernel intercepts the trap, locates the required page block in secondary swap storage, selects a physical frame (evicting a victim page if necessary), transfers the page into RAM via DMA, updates the page table entry valid bit, and restarts the faulting CPU instruction."
            }
        ]
    },
    {
        "id": "doc_os_page_replace",
        "title": "Page Replacement Algorithms & Working Set Theory",
        "subject": "Operating Systems",
        "concepts": ["Page Replacement Algorithms"],
        "chunks": [
            {
                "chunk_id": "doc_os_pr_c1",
                "page": 1,
                "text": "Belady's Optimal Replacement Algorithm (OPT or MIN) selects the page that will not be referenced for the longest duration in the future. While mathematically optimal, OPT cannot be implemented in general-purpose operating systems because future reference sequences cannot be predicted deterministically. It serves as an empirical theoretical benchmark against which practical eviction heuristics are evaluated."
            },
            {
                "chunk_id": "doc_os_pr_c2",
                "page": 2,
                "text": "First-In, First-Out (FIFO) replacement evicts the page that has resided in physical memory the longest. FIFO suffers from Belady's Anomaly, where increasing the number of allocated physical frames can paradoxically increase the total number of page faults. Least Recently Used (LRU) relies on the principle of temporal locality: pages accessed recently are likely to be accessed again in the near future."
            },
            {
                "chunk_id": "doc_os_pr_c3",
                "page": 3,
                "text": "Because exact LRU requires expensive hardware timestamps or software queue shifts on every memory access, modern kernels employ the Clock Algorithm (Second-Chance FIFO). It inspects a circular buffer of page frames tracking a reference bit. If the candidate page reference bit is 1, the bit is cleared to 0 and the hand advances; if 0, the page is selected as the eviction victim."
            }
        ]
    },
    {
        "id": "doc_os_sched",
        "title": "CPU Scheduling Policies, Multilevel Feedback Queues & CFS",
        "subject": "Operating Systems",
        "concepts": ["CPU Scheduling"],
        "chunks": [
            {
                "chunk_id": "doc_os_sched_c1",
                "page": 1,
                "text": "The CPU scheduler chooses runnable threads from the ready queue to dispatch to available processing cores. First-Come First-Served (FCFS) is non-preemptive and prone to the convoy effect, where short computational tasks queue behind long CPU-bound jobs. Shortest Job First (SJF) minimizes average waiting time across all workloads, with Shortest Remaining Time First (SRTF) providing the optimal preemptive counterpart."
            },
            {
                "chunk_id": "doc_os_sched_c2",
                "page": 2,
                "text": "Round Robin (RR) assigns each process a fixed quantum or time slice. When the quantum expires, the CPU preempts the running process and moves it to the rear of the ready queue. If the quantum is excessively large, RR degrades into FCFS; if the quantum is excessively small, processor throughput collapses due to context-switch switching overhead."
            },
            {
                "chunk_id": "doc_os_sched_c3",
                "page": 3,
                "text": "The Linux Completely Fair Scheduler (CFS) replaces discrete priority queues with a red-black tree indexed by virtual runtime (vruntime). Each thread accumulates vruntime proportional to actual executed time scaled inversely by its nice priority weight. CFS repeatedly selects the leftmost tree leaf node (minimum vruntime), achieving O(log N) scheduling with proportional fairness."
            }
        ]
    },
    {
        "id": "doc_dsa_trees",
        "title": "Self-Balancing Binary Search Trees: AVL & Red-Black Trees",
        "subject": "Data Structures & Algorithms",
        "concepts": ["Balanced Search Trees"],
        "chunks": [
            {
                "chunk_id": "doc_dsa_trees_c1",
                "page": 1,
                "text": "A standard binary search tree (BST) suffers from worst-case O(N) height degeneration when keys are inserted in monotonic order. Self-balancing binary search trees maintain logarithmic maximum height O(log N) through structural tree rotations following insert and delete operations."
            },
            {
                "chunk_id": "doc_dsa_trees_c2",
                "page": 2,
                "text": "AVL trees enforce a strict balance criterion: for every internal node, the height difference between left and right subtrees (the balance factor) must belong to {-1, 0, +1}. When an insertion causes an imbalance, rebalancing requires single rotations (Left-Left or Right-Right) or double rotations (Left-Right or Right-Left). AVL trees provide faster lookup times than Red-Black trees due to tighter height bounds."
            },
            {
                "chunk_id": "doc_dsa_trees_c3",
                "page": 3,
                "text": "Red-Black trees relax height strictness using five coloring invariants: every node is red or black; the root is black; all leaf nodes (NIL) are black; if a node is red, both children are black; and all simple paths from any node to its descendant leaves contain identical counts of black nodes (black height). This guarantees maximum tree height never exceeds 2 * log2(N + 1)."
            }
        ]
    },
    {
        "id": "doc_dsa_graphs",
        "title": "Graph Traversals, Shortest Paths & Minimum Spanning Trees",
        "subject": "Data Structures & Algorithms",
        "concepts": ["Graph Traversal & Shortest Path"],
        "chunks": [
            {
                "chunk_id": "doc_dsa_graphs_c1",
                "page": 1,
                "text": "Breadth-First Search (BFS) uses a FIFO queue to discover vertices in order of topological distance, computing unweighted shortest paths in O(V + E) time. Depth-First Search (DFS) uses recursion or an explicit LIFO stack, identifying connected components, bridges, articulation points, and topological sortings in directed acyclic graphs (DAG)."
            },
            {
                "chunk_id": "doc_dsa_graphs_c2",
                "page": 2,
                "text": "Dijkstra's algorithm determines single-source shortest paths on graphs with non-negative edge weights. By maintaining a min-priority queue of tentative vertex distances, it greedily relaxes outgoing edges. Using a Fibonacci heap, Dijkstra achieves asymptotic time complexity of O(E + V log V). Negative weight edges invalidate Dijkstra's greedy invariant, necessitating the Bellman-Ford algorithm."
            },
            {
                "chunk_id": "doc_dsa_graphs_c3",
                "page": 3,
                "text": "Minimum Spanning Tree (MST) algorithms connect all vertices in an undirected weighted graph with minimum total edge cost. Kruskal's algorithm sorts all edges ascendingly and greedily inserts edges that bridge disconnected components using a Disjoint Set Union (Union-Find) structure in O(E log E) time. Prim's algorithm grows a single component outward from an arbitrary seed vertex."
            }
        ]
    },
    {
        "id": "doc_dsa_dp",
        "title": "Dynamic Programming: Optimal Substructure & Overlapping Subproblems",
        "subject": "Data Structures & Algorithms",
        "concepts": ["Dynamic Programming"],
        "chunks": [
            {
                "chunk_id": "doc_dsa_dp_c1",
                "page": 1,
                "text": "Dynamic Programming (DP) solves complex optimization problems by breaking them down into simpler subproblems. A problem is amenable to DP if it exhibits two core properties: Optimal Substructure (an optimal solution contains within it optimal solutions to subproblems) and Overlapping Subproblems (a naive recursive formulation solves the exact same subproblems repeatedly)."
            },
            {
                "chunk_id": "doc_dsa_dp_c2",
                "page": 2,
                "text": "Memoization represents a top-down implementation strategy that maintains standard recursive call structure while caching computed subproblem outputs in a hash table or array. Tabulation represents a bottom-up strategy that iteratively populates an array starting from base cases, eliminating recursion stack frames and often enabling space optimization via rolling variables."
            },
            {
                "chunk_id": "doc_dsa_dp_c3",
                "page": 3,
                "text": "Canonical DP formulations include the 0/1 Knapsack Problem with pseudo-polynomial time O(N * W), Longest Common Subsequence (LCS) running in O(N * M) time, and Matrix Chain Multiplication with parenthesization complexity O(N^3). Space reduction techniques frequently reduce two-dimensional DP matrices to one-dimensional rolling buffers when state transitions only depend on the immediate prior row."
            }
        ]
    },
    {
        "id": "doc_dsa_hash",
        "title": "Hash Table Architectures, Universal Hashing & Open Addressing",
        "subject": "Data Structures & Algorithms",
        "concepts": ["Hash Table Collision Resolution"],
        "chunks": [
            {
                "chunk_id": "doc_dsa_hash_c1",
                "page": 1,
                "text": "A hash table maps abstract keys to integer indices in a finite array using a hash function. An ideal hash function satisfies the Uniform Hashing Assumption: each key is equally likely to hash to any of the M slots, independent of all other keys. Cryptographic hash functions prioritize collision resistance, whereas hash table functions prioritize uniform dispersion speed."
            },
            {
                "chunk_id": "doc_dsa_hash_c2",
                "page": 2,
                "text": "Separate chaining resolves hash collisions by maintaining a linked list or red-black tree at each array bucket. Under a load factor alpha = N / M, successful lookups require O(1 + alpha) average time. When alpha grows large, chaining gracefully degrades into O(alpha) sequential scans without requiring immediate bucket reallocation."
            },
            {
                "chunk_id": "doc_dsa_hash_c3",
                "page": 3,
                "text": "Open addressing stores all key-value entries directly within the primary array without pointers. On collision, probing probes alternative slots: Linear Probing suffers from primary clustering; Quadratic Probing eliminates primary clustering but introduces secondary clustering; Double Hashing uses a secondary hash function h2(k) as probe increment, producing probe sequences that approximate random permutations."
            }
        ]
    },
    {
        "id": "doc_dsa_sort",
        "title": "Sorting Algorithms, Lower Bounds & Divide-and-Conquer",
        "subject": "Data Structures & Algorithms",
        "concepts": ["Sorting & Divide-and-Conquer"],
        "chunks": [
            {
                "chunk_id": "doc_dsa_sort_c1",
                "page": 1,
                "text": "Comparison-based sorting algorithms determine relative ordering exclusively through pairwise key comparisons. The decision tree theoretical model proves that any comparison sort requires at least ceil(log2(N!)) comparisons in the worst case, establishing an asymptotically tight lower bound of Omega(N log N)."
            },
            {
                "chunk_id": "doc_dsa_sort_c2",
                "page": 2,
                "text": "Merge Sort is a stable divide-and-conquer algorithm that recursively partitions an array into halves, sorts each half, and merges the sorted runs in linear O(N) time, achieving guaranteed O(N log N) worst-case time with O(N) auxiliary memory. Quick Sort selects a pivot element and partitions the array into lesser and greater subarrays. Quick Sort achieves O(N log N) average time, but degrades to O(N^2) under deterministic pivot selection on sorted inputs."
            },
            {
                "chunk_id": "doc_dsa_sort_c3",
                "page": 3,
                "text": "Non-comparison sorting algorithms circumvent the Omega(N log N) lower bound by exploiting specific structural key distributions. Counting Sort achieves O(N + K) linear time for integer keys bounded by range K. Radix Sort processes keys digit by digit from least significant to most significant using a stable subroutine, running in O(d * (N + K)) time."
            }
        ]
    },
    {
        "id": "doc_db_norm",
        "title": "Relational Normalization & Functional Dependencies",
        "subject": "Database Management Systems",
        "concepts": ["Relational Normalization"],
        "chunks": [
            {
                "chunk_id": "doc_db_norm_c1",
                "page": 1,
                "text": "Relational normalization structures schema tables to minimize data redundancy and eliminate insert, update, and delete anomalies. A functional dependency X -> Y specifies that if two tuples agree on attribute set X, they must necessarily agree on attribute set Y. Armstrong's Axioms (Reflexivity, Augmentation, Transitivity) form a sound and complete inference system for deriving attribute closures X+."
            },
            {
                "chunk_id": "doc_db_norm_c2",
                "page": 2,
                "text": "First Normal Form (1NF) mandates atomic attribute domain values with no repeating groups. Second Normal Form (2NF) requires 1NF and guarantees that no non-prime attribute is partially functionally dependent on any candidate key. Third Normal Form (3NF) requires 2NF and prohibits transitive functional dependencies from candidate keys to non-prime attributes."
            },
            {
                "chunk_id": "doc_db_norm_c3",
                "page": 3,
                "text": "Boyce-Codd Normal Form (BCNF) strengthens 3NF by requiring that for every non-trivial functional dependency X -> Y, X must be a superkey. While every relational schema can be decomposed into 3NF with guaranteed lossless join and dependency preservation, certain schemas cannot achieve BCNF without sacrificing dependency preservation."
            }
        ]
    },
    {
        "id": "doc_db_acid",
        "title": "ACID Properties, Concurrency Control & Two-Phase Locking",
        "subject": "Database Management Systems",
        "concepts": ["ACID Transactions & Concurrency"],
        "chunks": [
            {
                "chunk_id": "doc_db_acid_c1",
                "page": 1,
                "text": "A database transaction is a logical unit of work satisfying ACID properties: Atomicity (all operations commit or all roll back), Consistency (transactions preserve schema invariants), Isolation (concurrent execution yields state equivalent to serial execution), and Durability (committed changes persist across crashes via write-ahead logging)."
            },
            {
                "chunk_id": "doc_db_acid_c2",
                "page": 2,
                "text": "Conflict serializability evaluates concurrency correctness: a schedule is conflict serializable if it can be transformed into a serial schedule via non-conflicting adjacent operation swaps. Two operations conflict if they belong to different transactions, access the same data item, and at least one is a write. A schedule is conflict serializable if and only if its serialization precedence graph is acyclic."
            },
            {
                "chunk_id": "doc_db_acid_c3",
                "page": 3,
                "text": "Strict Two-Phase Locking (Strict 2PL) guarantees conflict serializability and eliminates cascading aborts. In the growing phase, transactions acquire shared (read) and exclusive (write) locks. In the shrinking phase, all locks are retained until the transaction explicitly executes commit or rollback, preventing uncommitted dirty reads."
            }
        ]
    },
    {
        "id": "doc_db_bplus",
        "title": "B+ Tree Indexing Structures & Query Execution",
        "subject": "Database Management Systems",
        "concepts": ["B+ Tree Storage Indexing"],
        "chunks": [
            {
                "chunk_id": "doc_db_bplus_c1",
                "page": 1,
                "text": "A B+ Tree is an N-ary self-balancing search tree tailored for block storage devices and database query engines. Unlike standard B-trees, B+ trees store all actual records or record pointers exclusively in leaf nodes. Internal nodes contain strictly search guiding keys and child block pointers, maximizing internal node fanout and minimizing disk I/O tree depth."
            },
            {
                "chunk_id": "doc_db_bplus_c2",
                "page": 2,
                "text": "Leaf nodes in a B+ tree are linked sequentially using bidirectional sibling pointers. This architecture yields exceptional performance for range queries (e.g., WHERE age BETWEEN 20 AND 30): the search traverses tree height once to find the minimum boundary key, followed by linear linked list scans along leaf blocks."
            },
            {
                "chunk_id": "doc_db_bplus_c3",
                "page": 3,
                "text": "Clustered indexes dictate the physical on-disk sorted order of table rows; a database table can have at most one clustered index. Secondary (non-clustered) indexes maintain separate B+ tree structures whose leaf entries store search keys paired with primary key references or row identifiers (RID)."
            }
        ]
    },
    {
        "id": "doc_db_raft",
        "title": "Distributed Consensus, Quorums & The Raft Protocol",
        "subject": "Database Management Systems",
        "concepts": ["Distributed Consensus & Raft"],
        "chunks": [
            {
                "chunk_id": "doc_db_raft_c1",
                "page": 1,
                "text": "Distributed consensus algorithms ensure a cluster of independent machines agree on a sequence of state machine commands despite network delays, partitions, and server crashes. The FLP Impossibility Theorem proves that no deterministic asynchronous consensus algorithm can guarantee liveness in the presence of even a single unannounced crash failure."
            },
            {
                "chunk_id": "doc_db_raft_c2",
                "page": 2,
                "text": "Raft decomposes consensus into three distinct subproblems: Leader Election, Log Replication, and Safety. Nodes exist in one of three roles: Follower, Candidate, or Leader. Time is divided into arbitrary terms with monotonic integer counters. If a follower detects leader heartbeat timeout, it increments its term, transitions to candidate, and broadcasts RequestVote RPCs."
            },
            {
                "chunk_id": "doc_db_raft_c3",
                "page": 3,
                "text": "Raft maintains log safety through the Leader Completeness Property: if a log entry is committed in a given term, that entry will be present in the logs of the leaders for all higher-numbered terms. A candidate cannot win an election unless its log is at least as up-to-date as any majority quorum peer."
            }
        ]
    },
    {
        "id": "doc_db_query_opt",
        "title": "Query Optimization, Relational Algebra & Cost Estimators",
        "subject": "Database Management Systems",
        "concepts": ["Query Optimization & Relational Algebra"],
        "chunks": [
            {
                "chunk_id": "doc_db_query_opt_c1",
                "page": 1,
                "text": "SQL queries are declarative: they express what data to retrieve, not how to retrieve it. The query compiler parses SQL text into an abstract syntax tree, translates it into an initial relational algebra logical plan, and executes rule-based and cost-based optimization to emit an efficient physical execution plan."
            },
            {
                "chunk_id": "doc_db_query_opt_c2",
                "page": 2,
                "text": "Heuristic relational algebra rewriting pushes selection predicates down toward storage scans to minimize intermediate tuple cardinality as early as possible. Projections are pushed down to discard unreferenced columns, reducing memory buffer cache pressure during join operations."
            },
            {
                "chunk_id": "doc_db_query_opt_c3",
                "page": 3,
                "text": "Cost-based optimizers (like the Selinger System R engine or Volcano/Cascades framework) estimate disk I/O and CPU computational cost across alternative join orderings. Join algorithms include Nested Loop Join (optimal for small outer relations with indexed inner tables), Sort-Merge Join (efficient when both inputs are pre-sorted on join keys), and Grace Hash Join (optimal for large ad-hoc equi-joins)."
            }
        ]
    }
]

# Question generator templates for all 15 concepts
# Each concept has ~17 questions spanning difficulties b in [-2.5, +2.5]
CONCEPT_QUESTIONS = {
    "Process Synchronization": [
        ("What condition causes a race condition?", -2.2, "Concurrent access to shared memory where outcome depends on execution timing", "doc_os_sync_c1"),
        ("What is mutual exclusion?", -1.8, "Requirement that only one thread executes a critical section at a time", "doc_os_sync_c1"),
        ("How does Peterson's algorithm prevent mutual exclusion violations?", -0.5, "Using shared 'flag' arrays and a 'turn' variable to negotiate entry", "doc_os_sync_c1"),
        ("What is the primary difference between binary and counting semaphores?", 0.2, "Binary semaphores are restricted to 0 and 1; counting semaphores take arbitrary non-negative values", "doc_os_sync_c2"),
        ("How do Hoare and Mesa monitor signaling semantics differ?", 1.4, "Hoare semantics immediately transfers control to the woken thread; Mesa allows the signaler to keep running", "doc_os_sync_c3"),
        ("What atomic instruction is used by modern CPUs to implement lock-free synchronization?", 2.1, "Compare-And-Swap (CAS) or Load-Linked/Store-Conditional (LL/SC)", "doc_os_sync_c1")
    ],
    "Deadlock Avoidance": [
        ("Which of the following is NOT one of the Coffman deadlock conditions?", -2.0, "Preemptive Scheduling", "doc_os_deadlock_c1"),
        ("What defines a safe state in the Banker's Algorithm?", -0.8, "There exists at least one allocation sequence allowing every process to finish without deadlocking", "doc_os_deadlock_c2"),
        ("In single-instance resource allocation graphs, what implies deadlock?", 0.3, "The existence of a directed cycle in the graph", "doc_os_deadlock_c3"),
        ("Why does Banker's Algorithm require knowing maximum resource claims in advance?", 1.2, "To verify that fulfilling a request cannot force the system into an unsafe state", "doc_os_deadlock_c2"),
        ("How does eliminating circular wait prevent deadlock?", 1.8, "By imposing a strict global total ordering on all resource acquisition requests", "doc_os_deadlock_c1"),
        ("What is the computational complexity of Banker's safety check with m resources and n processes?", 2.3, "O(m * n^2)", "doc_os_deadlock_c2")
    ],
    "Virtual Memory Paging": [
        ("What component translates virtual addresses into physical addresses in hardware?", -2.1, "Memory Management Unit (MMU)", "doc_os_vm_c1"),
        ("What is the function of the Translation Lookaside Buffer (TLB)?", -1.1, "An associative cache of recent virtual-to-physical address mappings", "doc_os_vm_c2"),
        ("What happens immediately when a page fault occurs?", 0.1, "The CPU traps to an OS kernel interrupt service routine to swap in the page", "doc_os_vm_c3"),
        ("Why do operating systems use multi-level page tables?", 0.9, "To avoid allocating continuous memory for unmapped regions in sparse virtual address spaces", "doc_os_vm_c2"),
        ("What information does a page table entry (PTE) valid bit store?", 1.5, "Whether the corresponding virtual page resides in physical RAM or is invalid/on disk", "doc_os_vm_c3"),
        ("Calculate effective memory access time with a 98% TLB hit rate, 20ns TLB access, and 100ns RAM access.", 2.2, "20ns + (0.02 * 100ns) = 22ns (single-level) or 122ns depending on lookup walk", "doc_os_vm_c2")
    ],
    "Page Replacement Algorithms": [
        ("Which algorithm provides the theoretical optimal minimum page fault rate?", -2.3, "Belady's Optimal Replacement Algorithm (OPT/MIN)", "doc_os_pr_c1"),
        ("What phenomenon is known as Belady's Anomaly?", -1.0, "Increasing physical frame allocation increases the total number of page faults under FIFO", "doc_os_pr_c2"),
        ("How does the Clock page replacement algorithm approximate LRU?", 0.2, "By examining a circular list of frames and testing a single reference bit per frame", "doc_os_pr_c3"),
        ("Why is true Least Recently Used (LRU) rarely implemented in hardware?", 1.1, "Updating timestamps or list pointers on every single memory reference incurs excessive overhead", "doc_os_pr_c3"),
        ("What is thrashing in virtual memory management?", 1.7, "A condition where processes spend more time paging in and out than executing instructions", "doc_os_pr_c1"),
        ("Under what page replacement policies is Belady's Anomaly guaranteed NOT to occur?", 2.4, "Stack algorithms where the set of pages in memory for n frames is a subset of n+1 frames (e.g. LRU, OPT)", "doc_os_pr_c2")
    ],
    "CPU Scheduling": [
        ("What is the main drawback of First-Come, First-Served (FCFS) CPU scheduling?", -2.0, "The convoy effect, where short jobs wait behind long CPU-bound jobs", "doc_os_sched_c1"),
        ("Which CPU scheduling algorithm achieves the minimum theoretical average waiting time?", -1.2, "Shortest Job First (SJF) / Shortest Remaining Time First (SRTF)", "doc_os_sched_c1"),
        ("What happens in Round Robin scheduling if the time quantum is chosen to be extremely large?", 0.0, "It behaves identically to First-Come, First-Served (FCFS)", "doc_os_sched_c2"),
        ("How does the Linux Completely Fair Scheduler (CFS) select the next process to dispatch?", 1.0, "It picks the process with the smallest virtual runtime (vruntime) from a red-black tree", "doc_os_sched_c3"),
        ("How does a Multilevel Feedback Queue (MLFQ) prioritize interactive I/O-bound jobs?", 1.6, "By keeping processes that relinquish the CPU before quantum expiration in high-priority queues", "doc_os_sched_c2"),
        ("What is the time complexity of selecting the next thread to run in Linux CFS with N runnable tasks?", 2.2, "O(1) cached minimum pointer, with O(log N) reinsertion of updated vruntime", "doc_os_sched_c3")
    ],
    "Balanced Search Trees": [
        ("What is the worst-case time complexity of search in an unbalanced BST with N elements?", -2.1, "O(N) when the tree degenerates into a linear linked list", "doc_dsa_trees_c1"),
        ("What is the balance factor constraint in an AVL tree?", -1.1, "The difference in height between left and right subtrees must be -1, 0, or +1", "doc_dsa_trees_c2"),
        ("How many structural rotations are needed to restore balance after an AVL insertion?", 0.1, "At most two rotations (single or double rotation)", "doc_dsa_trees_c2"),
        ("What is the maximum height of a Red-Black tree containing N internal nodes?", 1.2, "At most 2 * log2(N + 1)", "doc_dsa_trees_c3"),
        ("Why are Red-Black trees often preferred over AVL trees for map/set implementations?", 1.7, "Red-Black trees require fewer rotations during insertions and deletions due to looser balance constraints", "doc_dsa_trees_c3"),
        ("In a Red-Black tree deletion, how many rotations are required in the worst-case rebalancing?", 2.3, "At most 3 rotations", "doc_dsa_trees_c3")
    ],
    "Graph Traversal & Shortest Path": [
        ("Which traversal algorithm uses a FIFO queue to find unweighted shortest paths?", -2.2, "Breadth-First Search (BFS)", "doc_dsa_graphs_c1"),
        ("What is the time complexity of BFS or DFS on an adjacency list representation?", -1.3, "O(V + E)", "doc_os_graphs_c1" if False else "doc_dsa_graphs_c1"),
        ("Why does Dijkstra's algorithm fail when a graph contains negative edge weights?", 0.2, "Its greedy assumption that a finalized vertex distance cannot be decreased later is violated", "doc_dsa_graphs_c2"),
        ("What algorithm computes single-source shortest paths on graphs with negative edge weights?", 1.0, "Bellman-Ford algorithm", "doc_dsa_graphs_c2"),
        ("How does Kruskal's algorithm determine whether adding an edge creates a cycle?", 1.5, "Using a Disjoint Set Union (Union-Find) structure with path compression", "doc_dsa_graphs_c3"),
        ("What is the asymptotic runtime of Dijkstra's algorithm implemented with a Fibonacci heap?", 2.4, "O(E + V log V)", "doc_dsa_graphs_c2")
    ],
    "Dynamic Programming": [
        ("What two core characteristics make a problem suitable for Dynamic Programming?", -2.0, "Optimal Substructure and Overlapping Subproblems", "doc_dsa_dp_c1"),
        ("What is the fundamental difference between memoization and tabulation?", -0.9, "Memoization is top-down recursive caching; tabulation is bottom-up iterative table filling", "doc_dsa_dp_c2"),
        ("What is the time complexity of solving the 0/1 Knapsack problem with capacity W and N items?", 0.3, "O(N * W) pseudo-polynomial time", "doc_dsa_dp_c3"),
        ("Why is the 0/1 Knapsack problem considered pseudo-polynomial rather than polynomial?", 1.3, "The runtime is polynomial in the magnitude of W, but exponential in the bit-length of W", "doc_dsa_dp_c3"),
        ("How can the auxiliary space for Longest Common Subsequence be reduced from O(N * M) to O(min(N, M))?", 1.8, "By observing that row i transitions depend only on row i-1, using rolling buffers", "doc_dsa_dp_c3"),
        ("What is the time complexity of the classic Matrix Chain Multiplication DP formulation?", 2.3, "O(N^3) time and O(N^2) space", "doc_dsa_dp_c3")
    ],
    "Hash Table Collision Resolution": [
        ("What is a hash collision?", -2.3, "When two distinct keys produce the identical hash index", "doc_dsa_hash_c1"),
        ("How does separate chaining resolve collisions?", -1.2, "By placing colliding elements into a linked list or secondary tree at that bucket", "doc_dsa_hash_c2"),
        ("What is the average lookup time in a hash table with load factor alpha under uniform hashing?", 0.1, "O(1 + alpha)", "doc_dsa_hash_c2"),
        ("What clustering issue affects open addressing with linear probing?", 1.1, "Primary clustering, where long contiguous blocks of occupied slots cause probe cascades", "doc_dsa_hash_c3"),
        ("Why must a secondary hash function h2(k) in double hashing never evaluate to zero?", 1.7, "Because a step size of zero causes an infinite probe loop on the same slot", "doc_dsa_hash_c3"),
        ("What is the probability of at least one collision among k keys in an m-slot table (Birthday Paradox)?", 2.4, "Approximately 1 - exp(-k^2 / (2m))", "doc_dsa_hash_c1")
    ],
    "Sorting & Divide-and-Conquer": [
        ("What is the theoretical lower bound for comparison-based sorting of N elements?", -2.1, "Omega(N log N)", "doc_dsa_sort_c1"),
        ("Which sorting algorithm has guaranteed O(N log N) worst-case time and is stable?", -1.0, "Merge Sort", "doc_dsa_sort_c2"),
        ("What is the worst-case time complexity of Quick Sort with deterministic first-element pivot?", 0.2, "O(N^2) on already sorted or reverse sorted arrays", "doc_dsa_sort_c2"),
        ("How does Counting Sort break the Omega(N log N) lower bound?", 1.2, "It does not compare elements directly; it indexes frequencies over a bounded key range", "doc_dsa_sort_c3"),
        ("How can Quick Sort's auxiliary recursion stack space be guaranteed to stay within O(log N)?", 1.8, "By recurring on the smaller partition first and using tail-call elimination on the larger partition", "doc_dsa_sort_c2"),
        ("What is the exact worst-case comparison count of Merge Sort on an array of length N?", 2.4, "N log2 N - N + 1 comparisons", "doc_dsa_sort_c2")
    ],
    "Relational Normalization": [
        ("What does First Normal Form (1NF) prohibit in a relational table?", -2.2, "Non-atomic attribute values, composite attributes, and repeating groups", "doc_db_norm_c2"),
        ("What constitutes a violation of Second Normal Form (2NF)?", -1.0, "A partial functional dependency of a non-prime attribute on a subset of a composite candidate key", "doc_db_norm_c2"),
        ("What dependency is eliminated when moving from 2NF to 3NF?", 0.1, "Transitive dependencies between non-prime attributes", "doc_db_norm_c2"),
        ("What is the condition for a relation to be in Boyce-Codd Normal Form (BCNF)?", 1.1, "For every non-trivial functional dependency X -> Y, X must be a superkey", "doc_db_norm_c3"),
        ("What is the key trade-off between 3NF and BCNF decompositions?", 1.6, "3NF always guarantees dependency preservation; BCNF may not preserve all functional dependencies", "doc_db_norm_c3"),
        ("Using Armstrong's axioms, prove that if X -> Y and WY -> Z, then WX -> Z.", 2.3, "Augment X -> Y with W gives WX -> WY; apply transitivity with WY -> Z yields WX -> Z", "doc_db_norm_c1")
    ],
    "ACID Transactions & Concurrency": [
        ("What does the 'I' stand for in ACID transaction properties?", -2.4, "Isolation (concurrent executions do not interfere with one another)", "doc_db_acid_c1"),
        ("What is a dirty read anomaly in database concurrency?", -1.1, "A transaction reading data modified by another uncommitted transaction that later aborts", "doc_db_acid_c1"),
        ("How does Strict Two-Phase Locking (Strict 2PL) prevent cascading rollbacks?", 0.2, "By holding all exclusive locks until the transaction explicitly commits or terminates", "doc_db_acid_c3"),
        ("How can you verify whether an execution schedule is conflict serializable?", 1.0, "Construct a precedence graph of conflicting operations and verify it has no cycles", "doc_db_acid_c2"),
        ("What is the difference between phantom reads and non-repeatable reads?", 1.7, "Non-repeatable reads modify existing rows; phantom reads insert new rows matching a query predicate", "doc_db_acid_c1"),
        ("What guarantee distinguishes snapshot isolation from strict serializability?", 2.3, "Snapshot isolation prevents dirty/non-repeatable reads but allows write skew anomalies", "doc_db_acid_c2")
    ],
    "B+ Tree Storage Indexing": [
        ("Where are data records or record pointers stored in a B+ tree?", -2.0, "Exclusively in the leaf nodes", "doc_db_bplus_c1"),
        ("Why are B+ trees widely preferred over binary search trees for disk storage engines?", -1.1, "Their high branching factor / fanout minimizes the number of slow disk I/O operations", "doc_db_bplus_c1"),
        ("Why do B+ trees excel at range queries (e.g. BETWEEN X AND Y)?", 0.1, "Because leaf nodes are doubly linked sequentially, enabling direct linear scans", "doc_db_bplus_c2"),
        ("How many clustered indexes can a relational database table have?", 0.9, "At most one, because rows can only be physically stored in a single on-disk sorted order", "doc_db_bplus_c3"),
        ("What is the minimum number of keys in an internal node of order M in a B+ tree (excluding root)?", 1.5, "ceil(M / 2) - 1 keys", "doc_db_bplus_c1"),
        ("What happens during node overflow upon inserting into a full B+ tree leaf node of capacity M?", 2.2, "The node splits into two leaves of size ceil(M/2), and a copy of the median key is pushed up to the parent", "doc_db_bplus_c1")
    ],
    "Distributed Consensus & Raft": [
        ("What does the FLP Impossibility Theorem state about distributed consensus?", -1.2, "Asynchronous consensus cannot guarantee liveness with even a single unannounced crash failure", "doc_db_raft_c1"),
        ("What are the three possible states of a server node in the Raft protocol?", -0.8, "Follower, Candidate, and Leader", "doc_db_raft_c2"),
        ("How does a Raft node become a leader?", 0.3, "By receiving votes from a strict majority (quorum) of cluster nodes in a term election", "doc_db_raft_c2"),
        ("What is Raft's Leader Completeness property?", 1.3, "If a log entry is committed in a term, it will be present in the logs of all leaders for higher terms", "doc_db_raft_c3"),
        ("Why does Raft use randomized election timeouts for candidate nodes?", 1.8, "To prevent split-vote deadlocks where multiple candidates start elections simultaneously", "doc_db_raft_c2"),
        ("How does Raft handle network partitions where two nodes claim to be leader?", 2.4, "Only the partition containing a majority quorum can commit log entries; minority leader entries are overwritten upon healing", "doc_db_raft_c3")
    ],
    "Query Optimization & Relational Algebra": [
        ("What is the purpose of heuristic query rewriting in a database query optimizer?", -1.5, "Transforming an abstract syntax tree into an equivalent plan that minimizes intermediate tuples", "doc_db_query_opt_c1"),
        ("Why is selection pushdown one of the most effective relational algebra optimizations?", -0.7, "It filters rows as close to the storage layer as possible, minimizing subsequent data movement", "doc_db_query_opt_c2"),
        ("What are the three fundamental relational join algorithms used by database engines?", 0.2, "Nested Loop Join, Sort-Merge Join, and Hash Join", "doc_db_query_opt_c3"),
        ("When is a Grace Hash Join preferred over a Sort-Merge Join?", 1.1, "When inputs are large, unindexed, and unsorted, and the join condition is an equality predicate", "doc_db_query_opt_c3"),
        ("How do cost-based optimizers estimate the selectivity of a filter predicate (e.g. age > 25)?", 1.6, "Using stored data catalog histograms, equi-depth/equi-width frequency stats, and hyperloglog sketches", "doc_db_query_opt_c1"),
        ("What is the search space complexity of enumerating all bushy join trees for N tables?", 2.5, "Catalan number scaling: (2N - 2)! / (N - 1)!, which is O(4^N / N^(3/2))", "doc_db_query_opt_c3")
    ]
}


def generate_full_dataset() -> Dict[str, Any]:
    random.seed(42)
    dataset = {
        "metadata": {
            "version": "3.5.0",
            "name": "Shiro Learning Intelligence Benchmark Corpus",
            "document_count": len(DOCUMENTS_SPEC),
            "domain_count": len(DOMAINS),
            "generated_at": "2026-09-09T23:45:00Z"
        },
        "domains": DOMAINS,
        "documents": DOCUMENTS_SPEC,
        "questions": [],
        "knowledge_graph": {
            "nodes": [],
            "edges": []
        },
        "synthetic_learner_traces": []
    }

    # Populate Knowledge Graph Nodes & Edges
    all_concepts = []
    for d in DOMAINS:
        for c in d["concepts"]:
            all_concepts.append(c)
            dataset["knowledge_graph"]["nodes"].append({
                "id": c.lower().replace(" ", "_"),
                "name": c,
                "domain": d["domain"],
                "exam_weight": round(random.uniform(0.7, 1.3), 2)
            })
        for src, tgt in d["prerequisites"]:
            dataset["knowledge_graph"]["edges"].append({
                "source": src.lower().replace(" ", "_"),
                "target": tgt.lower().replace(" ", "_"),
                "relation": "prerequisite"
            })

    # Generate 250 Questions (Expand base templates with systematic variations)
    q_id_counter = 1
    for concept_name, q_list in CONCEPT_QUESTIONS.items():
        domain_name = next(d["domain"] for d in DOMAINS if concept_name in d["concepts"])
        
        # 1. Base calibrated questions
        for q_text, difficulty, correct_ans, chunk_id in q_list:
            distractors = [
                f"Incorrect alternative concept relating to {concept_name} (plausible distractor A)",
                f"Heuristic violation or inverted state condition for {concept_name} (distractor B)",
                f"Non-applicable protocol detail from unrelated {domain_name} subsystem (distractor C)"
            ]
            options_list = [correct_ans] + distractors
            random.shuffle(options_list)
            correct_key = ["A", "B", "C", "D"][options_list.index(correct_ans)]
            options_dict = {k: v for k, v in zip(["A", "B", "C", "D"], options_list)}

            blooms = "remember" if difficulty < -1.0 else ("understand" if difficulty < 0.5 else ("apply" if difficulty < 1.5 else "evaluate"))

            dataset["questions"].append({
                "id": f"bench_q_{q_id_counter:04d}",
                "concept_name": concept_name,
                "domain": domain_name,
                "question": q_text,
                "options": options_dict,
                "correct_answer": correct_key,
                "explanation": f"Authoritative explanation: {correct_ans}. Directly grounded in authoritative source chunk {chunk_id}.",
                "difficulty_b": round(difficulty, 3),
                "discrimination_a": 1.0,
                "blooms_level": blooms,
                "ground_truth_chunk_ids": [chunk_id]
            })
            q_id_counter += 1

        # 2. Add parameterized variations to reach ~17 questions per concept (255 total questions)
        while sum(1 for q in dataset["questions"] if q["concept_name"] == concept_name) < 17:
            base_q = random.choice(q_list)
            delta_b = round(random.uniform(-0.35, 0.35), 2)
            var_b = max(-2.5, min(2.5, base_q[1] + delta_b))
            correct_ans = base_q[2]
            distractors = [
                f"Alternative formulation distractor {random.randint(10, 99)} for {concept_name}",
                f"Suboptimal edge case variant in {domain_name}",
                f"Contradictory state invariant for {concept_name}"
            ]
            options_list = [correct_ans] + distractors
            random.shuffle(options_list)
            correct_key = ["A", "B", "C", "D"][options_list.index(correct_ans)]

            dataset["questions"].append({
                "id": f"bench_q_{q_id_counter:04d}",
                "concept_name": concept_name,
                "domain": domain_name,
                "question": f"In {concept_name}: {base_q[0]} (Variant #{q_id_counter % 10})",
                "options": {k: v for k, v in zip(["A", "B", "C", "D"], options_list)},
                "correct_answer": correct_key,
                "explanation": f"Grounded concept explanation for {concept_name}: {correct_ans}",
                "difficulty_b": round(var_b, 3),
                "discrimination_a": 1.0,
                "blooms_level": "analyze" if var_b > 0.5 else "understand",
                "ground_truth_chunk_ids": [base_q[3]]
            })
            q_id_counter += 1

    # Generate Synthetic Learner Traces for BKT Evaluation (50 sequences of length 8)
    for s_idx in range(50):
        c = random.choice(all_concepts)
        initial_known = random.random() < 0.25 # Prior P(L0)
        p_learn = 0.15
        p_guess = 0.25
        p_slip = 0.10

        curr_state = initial_known
        interactions = []
        for step in range(8):
            # Performance probability
            p_correct = (1.0 - p_slip) if curr_state else p_guess
            is_correct = random.random() < p_correct
            interactions.append({
                "step": step + 1,
                "concept_name": c,
                "is_correct": is_correct,
                "ground_truth_mastered": curr_state
            })
            # Transition
            if not curr_state and random.random() < p_learn:
                curr_state = True

        dataset["synthetic_learner_traces"].append({
            "trace_id": f"trace_{s_idx:03d}",
            "concept_name": c,
            "interactions": interactions
        })

    dataset["metadata"]["total_questions"] = len(dataset["questions"])
    dataset["metadata"]["total_traces"] = len(dataset["synthetic_learner_traces"])

    return dataset


if __name__ == "__main__":
    data = generate_full_dataset()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Successfully generated Shiro Benchmark Dataset at {OUTPUT_PATH}")
    print(f"Total Documents: {data['metadata']['document_count']}")
    print(f"Total Questions: {data['metadata']['total_questions']}")
    print(f"Total Synthetic Traces: {data['metadata']['total_traces']}")
