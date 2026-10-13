// Demo semester used when no backend is configured. Dates are relative to the
// day the demo database is first created so the workspace never looks stale.

import type {
  Evidence,
  Experiment,
  LabCourse,
  QuizQuestion,
  RecordStatus,
  Source,
  Subject,
  TopicStatus,
  Unit,
} from "../types";
import { addDays, toISODate } from "../../lib/dates";

export interface SeedTopic {
  id: string;
  subjectId: string;
  unitId: string;
  title: string;
  status: TopicStatus;
  concepts: string[];
}

export interface ConceptHistory {
  concept: string;
  topicId: string;
  results: boolean[];
  lastSeen: string;
}

const PAPERS = {
  N22: "End-Sem Nov 2022",
  M23: "End-Sem May 2023",
  N23: "End-Sem Nov 2023",
  M24: "End-Sem May 2024",
  N24: "End-Sem Nov 2024",
  M25: "End-Sem May 2025",
} as const;
type PaperKey = keyof typeof PAPERS;
export const PAPERS_PER_SUBJECT = Object.keys(PAPERS).length;

type Appearance = [PaperKey, string, number, string];

interface TopicSpec {
  title: string;
  status: TopicStatus;
  concepts: string[];
  papers: Appearance[];
  notes?: string;
}

interface UnitSpec {
  title: string;
  hours: number;
  topics: TopicSpec[];
}

interface SubjectSpec {
  id: string;
  code: string;
  name: string;
  examInDays: number;
  units: UnitSpec[];
}

const standardPattern = {
  totalMarks: 70,
  durationMins: 180,
  parts: [
    { name: "Part A · short answer", questions: 10, attempt: 10, marksEach: 2 },
    { name: "Part B · long answer", questions: 7, attempt: 5, marksEach: 10 },
  ],
};

const SUBJECTS: SubjectSpec[] = [
  {
    id: "dbms",
    code: "CS501",
    name: "Database Management Systems",
    examInDays: 42,
    units: [
      {
        title: "Introduction and ER model",
        hours: 8,
        topics: [
          {
            title: "ER model and ER-to-relational mapping",
            status: "done",
            concepts: ["Weak entity sets", "Cardinality constraints", "ER to relational mapping"],
            papers: [
              ["M23", "Q2(a)", 10, "Draw an ER diagram for a university database with students, courses and instructors. Convert it into relational tables."],
              ["N23", "Q2", 10, "Design an ER model for a hospital management system. Clearly mark weak entities and participation constraints."],
              ["M24", "Q1(c)", 2, "Define a weak entity set with an example."],
              ["N24", "Q2(a)", 10, "Construct an ER diagram for an online bookstore and map it to a relational schema."],
              ["M25", "Q1(b)", 2, "Differentiate between total and partial participation."],
            ],
          },
          {
            title: "Database architecture and data independence",
            status: "done",
            concepts: ["Three-schema architecture", "Logical vs physical independence"],
            papers: [
              ["N22", "Q1(a)", 2, "What is physical data independence?"],
              ["M24", "Q1(a)", 2, "List the three levels of the ANSI/SPARC architecture."],
            ],
          },
        ],
      },
      {
        title: "Relational model and SQL",
        hours: 10,
        topics: [
          {
            title: "Relational algebra",
            status: "in_progress",
            concepts: ["Selection and projection", "Joins in relational algebra", "Division operator"],
            papers: [
              ["N22", "Q3", 10, "Write relational algebra expressions for the following queries on the Sailors–Boats–Reserves schema."],
              ["M23", "Q3(a)", 10, "Explain the division operator with an example. Write an expression to find students enrolled in all courses."],
              ["N23", "Q1(d)", 2, "What is a natural join?"],
              ["N24", "Q3", 10, "Given the Employee–Department schema, express the following queries in relational algebra."],
              ["M25", "Q3(a)", 5, "Differentiate between theta join and equi join with examples."],
            ],
          },
          {
            title: "SQL: joins, nested queries and aggregation",
            status: "in_progress",
            concepts: ["GROUP BY and HAVING", "Correlated subqueries", "Outer joins"],
            papers: [
              ["N22", "Q4", 10, "Write SQL queries for the following on the given banking schema (aggregation and nested queries)."],
              ["M23", "Q4", 10, "Explain correlated subqueries. Write a query to find employees earning more than their department average."],
              ["N23", "Q3", 10, "Write SQL to list departments with more than five employees, ordered by average salary."],
              ["M24", "Q3", 10, "Explain different types of outer joins with SQL examples."],
              ["N24", "Q4(a)", 5, "Differentiate between WHERE and HAVING clauses."],
              ["M25", "Q4", 10, "Write SQL queries on the Student–Course–Enrolment schema (joins, GROUP BY, nested queries)."],
            ],
            notes: "My notes, p. 14: correlated subquery re-runs once per outer row — compare with IN / EXISTS.",
          },
          {
            title: "Views, triggers and integrity constraints",
            status: "not_started",
            concepts: ["Referential integrity", "Triggers"],
            papers: [
              ["M24", "Q1(e)", 2, "What is referential integrity?"],
              ["N24", "Q1(d)", 2, "What is a trigger? Give one use case."],
            ],
          },
        ],
      },
      {
        title: "Normalization",
        hours: 9,
        topics: [
          {
            title: "Functional dependencies and closure",
            status: "in_progress",
            concepts: ["Attribute closure", "Canonical cover", "Armstrong's axioms"],
            papers: [
              ["N22", "Q5(a)", 5, "Find the closure of the attribute set {A, B} for the given set of FDs."],
              ["M23", "Q5", 10, "Find the canonical cover of F = {A→BC, B→C, A→B, AB→C}. Determine the candidate keys."],
              ["N23", "Q5(a)", 5, "State Armstrong's axioms and prove the union rule."],
              ["M24", "Q5(a)", 5, "Compute a minimal cover for the given set of functional dependencies."],
              ["N24", "Q5", 10, "Find all candidate keys of R(A, B, C, D, E) with the given FDs and justify using closure."],
              ["M25", "Q5(a)", 5, "Explain attribute closure and its use in finding keys."],
            ],
            notes: "DBMS normalization notes, p. 3–6: worked examples of closure and canonical cover.",
          },
          {
            title: "Normal forms: 1NF to BCNF",
            status: "not_started",
            concepts: ["Partial dependency and 2NF", "3NF vs BCNF", "Lossless decomposition"],
            papers: [
              ["N22", "Q5(b)", 5, "Explain 3NF with an example. How is it different from BCNF?"],
              ["M23", "Q6", 10, "Normalise the given relation up to BCNF, showing each step."],
              ["N23", "Q5(b)", 5, "What is a lossless-join decomposition? Test the given decomposition."],
              ["M24", "Q5(b)", 5, "Explain 2NF with an example of partial dependency."],
              ["M25", "Q5(b)", 5, "Decompose the relation into BCNF and check dependency preservation."],
            ],
          },
          {
            title: "Multivalued dependencies and 4NF",
            status: "not_started",
            concepts: ["Multivalued dependency"],
            papers: [["N23", "Q1(h)", 2, "Define multivalued dependency."]],
          },
        ],
      },
      {
        title: "Transactions and concurrency control",
        hours: 11,
        topics: [
          {
            title: "ACID properties and serializability",
            status: "in_progress",
            concepts: ["Conflict serializability", "Precedence graph", "View serializability"],
            papers: [
              ["N22", "Q6", 10, "Check whether the given schedule is conflict serializable using a precedence graph."],
              ["M23", "Q7(a)", 5, "Explain the ACID properties of a transaction."],
              ["N23", "Q6", 10, "Differentiate between conflict and view serializability with examples."],
              ["M24", "Q6", 10, "Test the following schedules for conflict serializability."],
              ["N24", "Q6", 10, "What is a recoverable schedule? Check the given schedule for serializability and recoverability."],
              ["M25", "Q6", 10, "Draw the precedence graph for the schedule and determine an equivalent serial order."],
            ],
          },
          {
            title: "Concurrency control: locking and timestamps",
            status: "not_started",
            concepts: ["Two-phase locking", "Strict 2PL", "Timestamp ordering"],
            papers: [
              ["N22", "Q7", 10, "Explain the two-phase locking protocol. Does it guarantee freedom from deadlock?"],
              ["N23", "Q7", 10, "Explain the timestamp-ordering protocol with Thomas' write rule."],
              ["M24", "Q7(a)", 5, "Differentiate between basic 2PL and strict 2PL."],
              ["M25", "Q7", 10, "Explain lock-based concurrency control with lock compatibility matrix."],
            ],
          },
          {
            title: "Recovery: logs and checkpoints",
            status: "not_started",
            concepts: ["Write-ahead logging", "Checkpoints"],
            papers: [
              ["M23", "Q7(b)", 5, "Explain log-based recovery with deferred and immediate modification."],
              ["N24", "Q7", 10, "Explain checkpoints and their role in recovery. Describe the ARIES algorithm briefly."],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "os",
    code: "CS502",
    name: "Operating Systems",
    examInDays: 45,
    units: [
      {
        title: "Processes and CPU scheduling",
        hours: 10,
        topics: [
          {
            title: "CPU scheduling algorithms",
            status: "done",
            concepts: ["FCFS and SJF", "Round robin", "Turnaround and waiting time"],
            papers: [
              ["N22", "Q2", 10, "For the given process set, draw Gantt charts for FCFS, SJF and RR (q = 2) and compute average waiting time."],
              ["M23", "Q2", 10, "Compare preemptive SJF and priority scheduling with an example."],
              ["N23", "Q2", 10, "Calculate average turnaround time for FCFS, SRTF and round robin."],
              ["M24", "Q2", 10, "Explain multilevel feedback queue scheduling."],
              ["N24", "Q2(b)", 5, "What is starvation? How does ageing solve it?"],
              ["M25", "Q2", 10, "Draw Gantt charts and compute waiting times for the given processes under four algorithms."],
            ],
          },
          {
            title: "Processes and threads",
            status: "done",
            concepts: ["Process states", "User vs kernel threads"],
            papers: [
              ["N22", "Q1(b)", 2, "Draw the process state diagram."],
              ["M24", "Q1(a)", 2, "What does a process control block contain?"],
              ["N24", "Q2(a)", 5, "Differentiate between user-level and kernel-level threads."],
            ],
          },
        ],
      },
      {
        title: "Process synchronization",
        hours: 9,
        topics: [
          {
            title: "Critical section problem and semaphores",
            status: "in_progress",
            concepts: ["Peterson's solution", "Semaphores", "Mutex vs semaphore"],
            papers: [
              ["N22", "Q3", 10, "What is the critical section problem? Explain Peterson's solution and prove it satisfies the three requirements."],
              ["M23", "Q3(a)", 5, "Differentiate between counting and binary semaphores."],
              ["N23", "Q3", 10, "Explain semaphores and their implementation without busy waiting."],
              ["N24", "Q3(a)", 5, "What are the requirements of a solution to the critical section problem?"],
              ["M25", "Q3", 10, "Explain Peterson's solution. Why does it fail on modern architectures?"],
            ],
          },
          {
            title: "Classical synchronization problems",
            status: "not_started",
            concepts: ["Producer–consumer", "Readers–writers", "Dining philosophers"],
            papers: [
              ["N22", "Q4", 10, "Solve the bounded-buffer producer–consumer problem using semaphores."],
              ["M24", "Q3", 10, "Give a solution to the readers–writers problem. Which group can starve?"],
              ["N24", "Q3(b)", 5, "Explain the dining philosophers problem and one deadlock-free solution."],
              ["M25", "Q4(a)", 5, "Write pseudo-code for producer–consumer with a monitor."],
            ],
          },
        ],
      },
      {
        title: "Deadlocks",
        hours: 6,
        topics: [
          {
            title: "Deadlock avoidance: Banker's algorithm",
            status: "in_progress",
            concepts: ["Safe state", "Banker's algorithm", "Resource-request algorithm"],
            papers: [
              ["N22", "Q5", 10, "Apply the Banker's algorithm to the given snapshot. Is the system in a safe state?"],
              ["M23", "Q4", 10, "Given Allocation, Max and Available matrices, find the safe sequence. Can request (1, 0, 2) by P1 be granted?"],
              ["N23", "Q4", 10, "Explain the Banker's algorithm with an example."],
              ["M24", "Q4", 10, "Determine whether the system is safe using Banker's algorithm and find a safe sequence."],
              ["N24", "Q4", 10, "For the snapshot, compute the Need matrix and check whether P4's request can be granted immediately."],
              ["M25", "Q5", 10, "Explain deadlock avoidance. Apply Banker's algorithm to the given data."],
            ],
            notes: "OS unit 3 notes, p. 2–5: Banker's walkthrough — I keep mixing up Need = Max − Allocation.",
          },
          {
            title: "Deadlock conditions and detection",
            status: "not_started",
            concepts: ["Coffman conditions", "Resource allocation graph"],
            papers: [
              ["N22", "Q1(e)", 2, "List the four necessary conditions for deadlock."],
              ["N23", "Q1(f)", 2, "When does a resource allocation graph with a cycle not imply deadlock?"],
              ["M25", "Q1(d)", 2, "Differentiate between deadlock prevention and avoidance."],
            ],
          },
        ],
      },
      {
        title: "Memory and storage management",
        hours: 12,
        topics: [
          {
            title: "Paging and segmentation",
            status: "in_progress",
            concepts: ["Page tables", "TLB and effective access time", "Segmentation"],
            papers: [
              ["N22", "Q6", 10, "Explain paging with a diagram. Compute the effective access time given TLB hit ratio 80%."],
              ["M23", "Q6", 10, "Differentiate between paging and segmentation. Explain segmentation with paging."],
              ["N23", "Q6(a)", 5, "What is a TLB? How does it improve performance?"],
              ["M24", "Q6", 10, "Explain multi-level paging and inverted page tables."],
              ["N24", "Q6(a)", 5, "Calculate the number of pages and page table size for the given logical address space."],
            ],
          },
          {
            title: "Page replacement algorithms",
            status: "not_started",
            concepts: ["FIFO and Belady's anomaly", "LRU", "Optimal page replacement"],
            papers: [
              ["N22", "Q7", 10, "For the reference string, find page faults under FIFO, LRU and Optimal with 3 frames."],
              ["M23", "Q7", 10, "Explain Belady's anomaly with an example."],
              ["N23", "Q7", 10, "Compute page faults for LRU and Optimal with 4 frames."],
              ["M24", "Q7", 10, "Compare FIFO and LRU. What is thrashing?"],
              ["N24", "Q6(b)", 5, "Find the number of page faults using LRU for the given string."],
              ["M25", "Q6", 10, "For the reference string, calculate page faults for FIFO, LRU and Optimal."],
            ],
          },
          {
            title: "Disk scheduling",
            status: "not_started",
            concepts: ["SSTF", "SCAN and C-SCAN"],
            papers: [
              ["N23", "Q6(b)", 5, "Compute total head movement for SSTF and SCAN."],
              ["N24", "Q7", 10, "Explain disk scheduling algorithms and compare their head movement for the given queue."],
              ["M25", "Q7(a)", 5, "Differentiate between SCAN and C-SCAN."],
            ],
          },
          {
            title: "File systems and allocation methods",
            status: "not_started",
            concepts: ["Allocation methods", "Directory structure"],
            papers: [["M24", "Q1(h)", 2, "List the file allocation methods."]],
          },
        ],
      },
    ],
  },
  {
    id: "cn",
    code: "CS503",
    name: "Computer Networks",
    examInDays: 50,
    units: [
      {
        title: "Physical and data link layer",
        hours: 8,
        topics: [
          {
            title: "Error detection: CRC and Hamming code",
            status: "done",
            concepts: ["CRC", "Hamming code"],
            papers: [
              ["N22", "Q2", 10, "Compute the CRC for the message 1101011011 using generator 10011."],
              ["M23", "Q2(a)", 5, "Explain Hamming code with an example."],
              ["M24", "Q2", 10, "Find the transmitted codeword using CRC and verify at the receiver."],
              ["M25", "Q2(a)", 5, "How many redundancy bits are needed for a 7-bit Hamming code?"],
            ],
          },
          {
            title: "Sliding window protocols",
            status: "in_progress",
            concepts: ["Stop-and-wait", "Go-Back-N", "Selective repeat"],
            papers: [
              ["N22", "Q3", 10, "Compare Go-Back-N and Selective Repeat ARQ."],
              ["N23", "Q2", 10, "Explain sliding window flow control. Calculate link utilisation for stop-and-wait."],
              ["N24", "Q2", 10, "Why must the window size of selective repeat be at most half the sequence space?"],
              ["M25", "Q3(a)", 5, "Explain stop-and-wait ARQ with a timing diagram."],
            ],
          },
        ],
      },
      {
        title: "Network layer",
        hours: 12,
        topics: [
          {
            title: "IPv4 addressing and subnetting",
            status: "in_progress",
            concepts: ["Subnetting", "CIDR", "Subnet masks"],
            papers: [
              ["N22", "Q4", 10, "Divide 192.168.10.0/24 into 6 subnets. List the network address and broadcast address of each."],
              ["M23", "Q4", 10, "Explain classful addressing and CIDR with examples."],
              ["N23", "Q4", 10, "An organisation is granted 200.10.0.0/20. Allocate addresses to three departments."],
              ["M24", "Q4", 10, "Find the subnet mask and number of hosts for the given requirements."],
              ["N24", "Q4", 10, "Perform VLSM for the given network with four LANs."],
              ["M25", "Q4", 10, "Explain subnetting with an example. Find the first and last usable address."],
            ],
          },
          {
            title: "Routing algorithms",
            status: "not_started",
            concepts: ["Distance vector routing", "Link state routing", "Count-to-infinity"],
            papers: [
              ["N22", "Q5", 10, "Explain distance vector routing. What is the count-to-infinity problem?"],
              ["M23", "Q5", 10, "Apply Dijkstra's algorithm to find shortest paths from node A."],
              ["N23", "Q5", 10, "Compare distance vector and link state routing."],
              ["M24", "Q5", 10, "Construct routing tables using distance vector for the given topology."],
              ["M25", "Q5", 10, "Explain link state routing and OSPF."],
            ],
          },
        ],
      },
      {
        title: "Transport layer",
        hours: 9,
        topics: [
          {
            title: "TCP congestion control",
            status: "not_started",
            concepts: ["Slow start", "AIMD"],
            papers: [
              ["N22", "Q6", 10, "Explain TCP congestion control with a graph of congestion window size."],
              ["N23", "Q6", 10, "Describe slow start, congestion avoidance and fast recovery."],
              ["N24", "Q6", 10, "Plot the congestion window for the given sequence of events."],
              ["M25", "Q6", 10, "Explain AIMD. Why is it fair?"],
            ],
          },
          {
            title: "TCP vs UDP and connection management",
            status: "not_started",
            concepts: ["Three-way handshake", "UDP use cases"],
            papers: [
              ["M23", "Q6", 10, "Explain TCP connection establishment and termination."],
              ["M24", "Q6(a)", 5, "Compare TCP and UDP."],
              ["N24", "Q1(f)", 2, "Why does DNS use UDP?"],
            ],
          },
        ],
      },
      {
        title: "Application layer and security",
        hours: 6,
        topics: [
          {
            title: "DNS and HTTP",
            status: "not_started",
            concepts: ["DNS resolution", "HTTP persistent connections"],
            papers: [
              ["N22", "Q7", 10, "Explain recursive and iterative DNS resolution."],
              ["M24", "Q7", 10, "Explain HTTP request/response format. Compare persistent and non-persistent HTTP."],
              ["M25", "Q7(a)", 5, "What is a DNS resource record?"],
            ],
          },
          {
            title: "Network security basics",
            status: "not_started",
            concepts: ["Symmetric vs asymmetric keys", "Digital signatures"],
            papers: [["N23", "Q7", 10, "Explain RSA with an example. How are digital signatures created?"]],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------- quiz bank

type Q = [concept: string, prompt: string, options: string[], answer: number, explanation: string];

const QUESTION_BANK: Record<string, Q[]> = {
  "ER model and ER-to-relational mapping": [
    ["Weak entity sets", "A weak entity set is identified by…", ["Its own primary key alone", "Its partial key together with the owner's key", "A surrogate key generated by the DBMS", "Any candidate key"], 1, "A weak entity has only a discriminator (partial key); it is identified together with the primary key of its identifying owner."],
    ["ER to relational mapping", "A many-to-many relationship between Student and Course is mapped to…", ["A foreign key in Student", "A foreign key in Course", "A separate relation holding both keys", "It cannot be mapped"], 2, "M:N relationships become their own relation whose key is the combination of both participating keys."],
  ],
  "Database architecture and data independence": [
    ["Logical vs physical independence", "Adding an index without changing application programs is an example of…", ["Logical data independence", "Physical data independence", "View serializability", "Referential integrity"], 1, "Changes to storage structures that do not affect the conceptual schema demonstrate physical data independence."],
  ],
  "Relational algebra": [
    ["Division operator", "Which query is naturally expressed with the division operator?", ["Students enrolled in at least one course", "Students enrolled in all courses", "Courses with no students", "Average marks per course"], 1, "Division answers “for all” queries: tuples related to every tuple of the divisor."],
    ["Joins in relational algebra", "A natural join between R(A,B) and S(B,C) produces a relation with attributes…", ["A, B, B, C", "A, B, C", "A, C", "B only"], 1, "Natural join equates common attributes and keeps a single copy of each."],
  ],
  "SQL: joins, nested queries and aggregation": [
    ["GROUP BY and HAVING", "Which clause filters groups after aggregation?", ["WHERE", "HAVING", "ORDER BY", "DISTINCT"], 1, "WHERE filters rows before grouping; HAVING filters the groups produced by GROUP BY."],
    ["Correlated subqueries", "A correlated subquery is one that…", ["Runs once before the outer query", "References columns of the outer query", "Always uses EXISTS", "Cannot return more than one row"], 1, "It depends on the current row of the outer query, so it is logically re-evaluated per outer row."],
    ["Outer joins", "A LEFT OUTER JOIN from Dept to Emp returns departments with no employees…", ["Never", "With NULLs in Emp columns", "Only if Emp has a NULL foreign key", "Only with a WHERE clause"], 1, "Unmatched left rows are kept and the right side's columns are filled with NULL."],
  ],
  "Views, triggers and integrity constraints": [
    ["Referential integrity", "Referential integrity ensures that…", ["Every primary key is unique", "Foreign key values match an existing primary key or are NULL", "No column contains NULL", "Views are updatable"], 1, "A foreign key must reference an existing tuple in the parent relation (or be NULL where allowed)."],
  ],
  "Functional dependencies and closure": [
    ["Attribute closure", "Given F = {A→B, B→C}, the closure {A}+ is…", ["{A}", "{A, B}", "{A, B, C}", "{B, C}"], 2, "A→B adds B; B→C then adds C."],
    ["Canonical cover", "A canonical cover must have…", ["No extraneous attributes and unique left-hand sides", "Only single-attribute left-hand sides", "Exactly one FD per attribute", "No transitive dependencies"], 0, "Each FD has no extraneous attributes, and each left-hand side appears only once."],
    ["Armstrong's axioms", "Which is NOT one of Armstrong's axioms?", ["Reflexivity", "Augmentation", "Transitivity", "Decomposition"], 3, "Decomposition is derived from the three axioms; it is not one of them."],
  ],
  "Normal forms: 1NF to BCNF": [
    ["3NF vs BCNF", "A relation in BCNF requires that for every non-trivial FD X→Y…", ["Y is a prime attribute", "X is a superkey", "X is a candidate key and Y is non-prime", "Y depends on the whole key"], 1, "BCNF demands that every determinant is a superkey."],
    ["Partial dependency and 2NF", "A partial dependency exists when a non-prime attribute depends on…", ["Another non-prime attribute", "A proper subset of a candidate key", "The whole candidate key", "A foreign key"], 1, "2NF removes dependencies of non-prime attributes on part of a composite key."],
  ],
  "Multivalued dependencies and 4NF": [
    ["Multivalued dependency", "4NF eliminates…", ["Partial dependencies", "Transitive dependencies", "Non-trivial multivalued dependencies", "Join dependencies"], 2, "A relation is in 4NF if every non-trivial MVD has a superkey on the left."],
  ],
  "ACID properties and serializability": [
    ["Conflict serializability", "Two operations conflict if they belong to different transactions, access the same item, and…", ["Both are reads", "At least one is a write", "Both are commits", "They are adjacent"], 1, "Read–read pairs never conflict; any pair involving a write does."],
    ["Precedence graph", "A schedule is conflict serializable if and only if its precedence graph is…", ["Connected", "Acyclic", "A tree", "Complete"], 1, "Any topological order of an acyclic precedence graph gives an equivalent serial schedule."],
    ["View serializability", "Every conflict-serializable schedule is also…", ["Recoverable", "View serializable", "Strict", "Cascadeless"], 1, "Conflict serializability is a stricter condition than view serializability."],
  ],
  "Concurrency control: locking and timestamps": [
    ["Two-phase locking", "Basic two-phase locking guarantees…", ["Freedom from deadlock", "Conflict serializability", "Cascadeless schedules", "Starvation freedom"], 1, "2PL ensures conflict serializability but can still deadlock."],
    ["Strict 2PL", "Strict 2PL holds exclusive locks until…", ["The lock point", "The transaction commits or aborts", "The next read", "A checkpoint"], 1, "Holding X-locks to commit/abort prevents cascading rollbacks."],
  ],
  "Recovery: logs and checkpoints": [
    ["Write-ahead logging", "Under write-ahead logging, a log record must reach stable storage…", ["After the data page is written", "Before the corresponding data page is written", "Only at commit", "Only at checkpoints"], 1, "WAL guarantees undo information exists before the change hits disk."],
  ],
  "CPU scheduling algorithms": [
    ["Round robin", "In round robin, a very large time quantum makes it behave like…", ["SJF", "FCFS", "Priority scheduling", "SRTF"], 1, "If no process is pre-empted by the quantum, RR degenerates to FCFS."],
    ["Turnaround and waiting time", "Waiting time equals…", ["Completion time − arrival time", "Turnaround time − burst time", "Burst time − arrival time", "Response time + burst time"], 1, "Turnaround = completion − arrival; waiting = turnaround − burst."],
  ],
  "Processes and threads": [
    ["User vs kernel threads", "If one user-level thread (many-to-one model) makes a blocking system call…", ["Only that thread blocks", "The entire process blocks", "The kernel creates a new thread", "The call fails"], 1, "The kernel sees one schedulable entity, so the whole process blocks."],
  ],
  "Critical section problem and semaphores": [
    ["Semaphores", "A counting semaphore initialised to 3 allows…", ["Exactly one process in the critical section", "Up to three concurrent holders", "Three signals before blocking", "Unlimited waits"], 1, "The initial value is the number of processes that can proceed before wait() blocks."],
    ["Peterson's solution", "Peterson's solution uses which shared variables?", ["A mutex and a condition variable", "flag[2] and turn", "A semaphore and a counter", "A monitor"], 1, "Each process sets its flag and yields the turn to the other."],
  ],
  "Classical synchronization problems": [
    ["Producer–consumer", "In the bounded-buffer solution, the semaphore `empty` is initialised to…", ["0", "1", "The buffer size n", "n − 1"], 2, "`empty` counts free slots, so it starts at the buffer size."],
  ],
  "Deadlock avoidance: Banker's algorithm": [
    ["Banker's algorithm", "In the Banker's algorithm, the Need matrix is computed as…", ["Max + Allocation", "Max − Allocation", "Available − Allocation", "Allocation − Max"], 1, "Need is what each process may still request: Max − Allocation."],
    ["Safe state", "A system in an unsafe state…", ["Is always deadlocked", "May lead to deadlock", "Cannot allocate resources", "Must abort a process"], 1, "Unsafe means a deadlock is possible, not certain."],
    ["Resource-request algorithm", "A request is granted immediately only if, after pretending to allocate it…", ["Available is non-negative", "The resulting state is safe", "Need becomes zero", "No process is waiting"], 1, "The Banker's algorithm grants only requests that keep the system safe."],
  ],
  "Deadlock conditions and detection": [
    ["Coffman conditions", "Which is NOT a necessary condition for deadlock?", ["Mutual exclusion", "Hold and wait", "Preemption", "Circular wait"], 2, "The condition is *no* preemption."],
  ],
  "Paging and segmentation": [
    ["TLB and effective access time", "With 80% TLB hit ratio, 20 ns TLB lookup and 100 ns memory access, the effective access time is…", ["120 ns", "140 ns", "220 ns", "100 ns"], 1, "0.8 × 120 + 0.2 × 220 = 96 + 44 = 140 ns."],
    ["Page tables", "Paging eliminates…", ["Internal fragmentation", "External fragmentation", "Thrashing", "Page faults"], 1, "Fixed-size frames remove external fragmentation; internal fragmentation can remain in the last page."],
  ],
  "Page replacement algorithms": [
    ["FIFO and Belady's anomaly", "Belady's anomaly can occur with…", ["LRU", "Optimal", "FIFO", "All stack algorithms"], 2, "FIFO is not a stack algorithm, so more frames can produce more faults."],
    ["LRU", "LRU replaces the page that…", ["Arrived first", "Will not be used for the longest time", "Has not been used for the longest time", "Is used least often"], 2, "LRU looks backwards at recency of use; Optimal looks forward."],
  ],
  "Disk scheduling": [
    ["SCAN and C-SCAN", "C-SCAN differs from SCAN in that it…", ["Serves requests in both directions", "Returns to the start without serving on the way back", "Picks the nearest request", "Uses priorities"], 1, "C-SCAN gives more uniform wait times by treating the cylinders as a circular list."],
  ],
  "Error detection: CRC and Hamming code": [
    ["Hamming code", "For 4 data bits, a Hamming code needs how many parity bits?", ["2", "3", "4", "5"], 1, "2^r ≥ m + r + 1 → r = 3 for m = 4."],
  ],
  "Sliding window protocols": [
    ["Selective repeat", "With an n-bit sequence number, the maximum selective-repeat window size is…", ["2^n − 1", "2^(n−1)", "2^n", "n"], 1, "Sender and receiver windows must not overlap ambiguous sequence numbers, so the window is at most half the space."],
    ["Go-Back-N", "In Go-Back-N, when a frame is lost the sender…", ["Resends only the lost frame", "Resends the lost frame and all after it", "Waits for a NAK", "Halves the window"], 1, "The receiver discards out-of-order frames, so everything from the lost frame onward is resent."],
  ],
  "IPv4 addressing and subnetting": [
    ["Subnetting", "How many usable hosts does a /27 subnet have?", ["32", "30", "28", "62"], 1, "2^5 − 2 = 30 (network and broadcast addresses are reserved)."],
    ["CIDR", "200.10.16.0/20 covers which range?", ["200.10.16.0 – 200.10.31.255", "200.10.16.0 – 200.10.23.255", "200.10.0.0 – 200.10.15.255", "200.10.16.0 – 200.10.16.255"], 0, "A /20 spans 16 /24 blocks: 16 through 31 in the third octet."],
  ],
  "Routing algorithms": [
    ["Count-to-infinity", "The count-to-infinity problem affects…", ["Link state routing", "Distance vector routing", "Static routing", "Flooding"], 1, "Distance vector nodes only know neighbours' distances, so bad news propagates slowly."],
  ],
  "TCP congestion control": [
    ["Slow start", "During slow start, the congestion window…", ["Grows by 1 MSS per RTT", "Doubles every RTT", "Halves on each ACK", "Stays constant"], 1, "cwnd grows by one MSS per ACK, which doubles it each round trip."],
  ],
  "TCP vs UDP and connection management": [
    ["Three-way handshake", "The second segment of the TCP three-way handshake has which flags set?", ["SYN", "ACK", "SYN and ACK", "FIN"], 2, "The server replies SYN-ACK to the client's SYN."],
  ],
  "DNS and HTTP": [
    ["DNS resolution", "In iterative resolution, the local DNS server…", ["Asks the root, which queries the TLD for it", "Receives referrals and queries each server itself", "Only uses its cache", "Forwards to the client"], 1, "Each server replies with a referral; the local resolver follows them."],
  ],
};

// ------------------------------------------------------------ concept history

const HISTORY: [topicTitle: string, concept: string, results: string, daysAgo: number][] = [
  ["Deadlock avoidance: Banker's algorithm", "Banker's algorithm", "01010010", 2],
  ["Deadlock avoidance: Banker's algorithm", "Safe state", "1101", 2],
  ["ACID properties and serializability", "Conflict serializability", "10100110", 3],
  ["ACID properties and serializability", "Precedence graph", "0110", 3],
  ["Functional dependencies and closure", "Canonical cover", "001010", 1],
  ["Functional dependencies and closure", "Attribute closure", "11011", 1],
  ["IPv4 addressing and subnetting", "Subnetting", "01101001", 4],
  ["IPv4 addressing and subnetting", "CIDR", "1011", 4],
  ["SQL: joins, nested queries and aggregation", "Correlated subqueries", "0100110", 5],
  ["SQL: joins, nested queries and aggregation", "GROUP BY and HAVING", "11110111", 5],
  ["CPU scheduling algorithms", "Round robin", "11101111", 9],
  ["CPU scheduling algorithms", "Turnaround and waiting time", "1111011", 9],
  ["Sliding window protocols", "Selective repeat", "00101", 6],
  ["Relational algebra", "Division operator", "0010", 7],
  ["Paging and segmentation", "TLB and effective access time", "01001", 2],
  ["Critical section problem and semaphores", "Semaphores", "1101011", 8],
  ["ER model and ER-to-relational mapping", "ER to relational mapping", "111011", 14],
  ["Error detection: CRC and Hamming code", "Hamming code", "11101", 12],
];

// ------------------------------------------------------------------- labs

type ExpSpec = [title: string, aim: string, status: RecordStatus, dueInDays: number, viva: string[]];

const LABS: { lab: Omit<LabCourse, "practicalExamDate">; examInDays: number; experiments: ExpSpec[] }[] = [
  {
    lab: { id: "dbms-lab", code: "CS551", name: "DBMS Lab", subjectId: "dbms" },
    examInDays: 30,
    experiments: [
      ["DDL and DML commands", "Create, alter and populate tables for a student database using DDL and DML statements.", "checked", -35, ["Difference between DELETE, TRUNCATE and DROP?", "What does ALTER TABLE … ADD CONSTRAINT do?"]],
      ["Integrity constraints", "Apply PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL and CHECK constraints and observe violations.", "checked", -28, ["What happens on ON DELETE CASCADE?", "Can a foreign key be NULL?"]],
      ["Aggregate functions and GROUP BY", "Write queries using COUNT, SUM, AVG, MIN, MAX with GROUP BY and HAVING.", "written", -21, ["Why can't aggregates appear in WHERE?", "What does COUNT(*) count that COUNT(col) does not?"]],
      ["Joins and nested queries", "Retrieve data across tables using inner, outer and self joins, and nested subqueries.", "written", -14, ["When would you use a self join?", "IN vs EXISTS — which is faster and why?"]],
      ["Views and indexes", "Create simple and complex views, and measure query time before and after adding an index.", "draft", 2, ["Can every view be updated?", "Clustered vs non-clustered index?"]],
      ["PL/SQL procedures and functions", "Write stored procedures and functions with IN/OUT parameters and exception handling.", "draft", 4, ["Procedure vs function?", "What is a named exception?"]],
      ["Triggers", "Write row-level and statement-level triggers to maintain an audit table.", "not_started", 9, ["BEFORE vs AFTER triggers?", "What are :NEW and :OLD?"]],
      ["Cursors", "Process query results row by row using explicit and implicit cursors.", "not_started", 16, ["What is %ROWCOUNT?", "Implicit vs explicit cursor?"]],
      ["Mini project: library schema", "Design, normalise and implement a library management database with sample queries.", "not_started", 23, ["Justify your normal form.", "Which queries would benefit from an index?"]],
    ],
  },
  {
    lab: { id: "os-lab", code: "CS552", name: "OS Lab", subjectId: "os" },
    examInDays: 32,
    experiments: [
      ["Linux commands and shell scripting", "Practise file, process and permission commands; write shell scripts with loops and conditionals.", "checked", -35, ["What does chmod 754 mean?", "Difference between a hard link and a soft link?"]],
      ["fork, exec and wait", "Create child processes using fork(), replace images with exec() and synchronise with wait().", "checked", -28, ["How many processes does fork(); fork(); create?", "What is a zombie process?"]],
      ["FCFS and SJF scheduling", "Simulate FCFS and SJF scheduling and compute average waiting and turnaround times.", "written", -14, ["Why is SJF optimal for average waiting time?", "What is the convoy effect?"]],
      ["Round robin and priority scheduling", "Simulate round robin with a configurable quantum and non-preemptive priority scheduling.", "draft", 1, ["How does quantum size affect performance?", "How does ageing prevent starvation?"]],
      ["Producer–consumer with semaphores", "Implement a bounded buffer using POSIX semaphores and pthreads.", "not_started", 8, ["Why are two counting semaphores needed?", "What happens if wait() calls are swapped?"]],
      ["Banker's algorithm", "Implement the safety and resource-request algorithms for n processes and m resources.", "not_started", 15, ["What is a safe sequence?", "Why is Banker's rarely used in real OSes?"]],
      ["Page replacement", "Simulate FIFO, LRU and Optimal page replacement and compare page faults.", "not_started", 22, ["Show Belady's anomaly with your program.", "How is LRU approximated in hardware?"]],
    ],
  },
  {
    lab: { id: "cn-lab", code: "CS553", name: "Computer Networks Lab", subjectId: "cn" },
    examInDays: 34,
    experiments: [
      ["Network commands", "Use ping, traceroute, netstat, nslookup and ipconfig/ifconfig to inspect a network.", "checked", -30, ["How does traceroute work?", "What does a TTL of 64 indicate?"]],
      ["TCP client–server", "Implement an echo server and client using TCP sockets.", "written", -16, ["Why does the server need listen() and accept()?", "What is the backlog parameter?"]],
      ["UDP chat application", "Build a two-way chat using UDP sockets.", "draft", 3, ["How do you detect lost messages over UDP?", "Is connect() meaningful for UDP?"]],
      ["CRC implementation", "Implement CRC-CCITT encoding and error detection.", "not_started", 10, ["Why is the generator's MSB always 1?", "Which errors can CRC not detect?"]],
      ["Sliding window simulation", "Simulate Go-Back-N and Selective Repeat with random frame loss.", "not_started", 17, ["Why does GBN need only one receiver buffer?", "Window size limit for SR?"]],
      ["Packet analysis with Wireshark", "Capture and analyse ARP, DNS, TCP handshake and HTTP traffic.", "not_started", 24, ["Which filter shows only the handshake?", "Why do you see two DNS queries?"]],
    ],
  },
];

// ------------------------------------------------------------------- build

export interface SeedData {
  subjects: Subject[];
  units: Unit[];
  topics: SeedTopic[];
  evidence: Evidence[];
  sources: Source[];
  questions: QuizQuestion[];
  history: ConceptHistory[];
  labs: LabCourse[];
  experiments: Experiment[];
}

export function buildSeed(today: Date): SeedData {
  const day = (offset: number) => toISODate(addDays(today, offset));
  const stamp = (offset: number, hour = 18) => {
    const d = addDays(today, offset);
    d.setHours(hour, 12, 0, 0);
    return d.toISOString();
  };

  const subjects: Subject[] = [];
  const units: Unit[] = [];
  const topics: SeedTopic[] = [];
  const evidence: Evidence[] = [];
  const sources: Source[] = [];
  const questions: QuizQuestion[] = [];
  const topicIdByTitle = new Map<string, string>();

  for (const s of SUBJECTS) {
    subjects.push({ id: s.id, code: s.code, name: s.name, examDate: day(s.examInDays), examPattern: standardPattern });
    const totalHours = s.units.reduce((n, u) => n + u.hours, 0);
    const syllabusId = `src-${s.id}-syllabus`;
    const papersId = `src-${s.id}-papers`;
    const notesId = `src-${s.id}-notes`;
    const topicCount = s.units.reduce((n, u) => n + u.topics.length, 0);
    const questionCount = s.units.reduce((n, u) => n + u.topics.reduce((m, t) => m + t.papers.length, 0), 0);

    sources.push(
      {
        id: syllabusId, subjectId: s.id, kind: "syllabus", filename: `${s.code}_syllabus_2023_scheme.pdf`,
        pages: 3, sizeKb: 214, uploadedAt: stamp(-40, 21), status: "ready",
        extracted: { units: s.units.length, topics: topicCount, questions: 0 },
      },
      {
        id: papersId, subjectId: s.id, kind: "past_paper", filename: `${s.code}_previous_papers_2022-2025.pdf`,
        pages: 18, sizeKb: 3120, uploadedAt: stamp(-39, 22), status: "ready",
        extracted: { units: 0, topics: 0, questions: questionCount },
      },
    );

    s.units.forEach((u, ui) => {
      const unitId = `${s.id}-u${ui + 1}`;
      units.push({ id: unitId, subjectId: s.id, number: ui + 1, title: u.title, hours: u.hours });

      u.topics.forEach((t, ti) => {
        const topicId = `${unitId}-t${ti + 1}`;
        topicIdByTitle.set(t.title, topicId);
        topics.push({ id: topicId, subjectId: s.id, unitId, title: t.title, status: t.status, concepts: t.concepts });

        evidence.push({
          id: `${topicId}-syl`, topicId, kind: "syllabus", sourceId: syllabusId,
          label: `Syllabus · Unit ${ui + 1}`,
          excerpt: `Unit ${ui + 1}: ${u.title} (${u.hours} of ${totalHours} lecture hours). Listed: ${t.title}.`,
        });
        t.papers.forEach(([paper, q, marks, text], pi) => {
          evidence.push({
            id: `${topicId}-p${pi}`, topicId, kind: "past_paper", sourceId: papersId,
            label: `${PAPERS[paper]} · ${q}`, marks, excerpt: text,
          });
        });
        if (t.notes) {
          evidence.push({ id: `${topicId}-n`, topicId, kind: "notes", sourceId: notesId, label: "Your notes", excerpt: t.notes });
        }

        (QUESTION_BANK[t.title] ?? []).forEach(([concept, prompt, options, answerIndex, explanation], qi) => {
          questions.push({ id: `${topicId}-q${qi + 1}`, topicId, concept, prompt, options, answerIndex, explanation });
        });
      });
    });
  }

  sources.push(
    {
      id: "src-dbms-notes", subjectId: "dbms", kind: "notes", filename: "DBMS normalization notes.pdf",
      pages: 11, sizeKb: 4810, uploadedAt: stamp(-12, 23), status: "ready",
      extracted: { units: 0, topics: 2, questions: 0 },
    },
    {
      id: "src-os-notes", subjectId: "os", kind: "notes", filename: "OS unit 3 notes (scanned).pdf",
      pages: 9, sizeKb: 6240, uploadedAt: stamp(-6, 22), status: "ready",
      extracted: { units: 0, topics: 2, questions: 0 },
    },
    {
      id: "src-cn-notes", subjectId: "cn", kind: "notes", filename: "IMG_2041.HEIC",
      pages: 1, sizeKb: 2950, uploadedAt: stamp(-1, 20), status: "failed", extracted: null,
      error: "HEIC images aren't supported yet. Export as JPG or PDF and upload again.", retryable: false,
    },
    {
      id: "src-pattern", subjectId: null, kind: "exam_pattern", filename: "Odd semester exam scheme notice.pdf",
      pages: 2, sizeKb: 180, uploadedAt: stamp(-38, 10), status: "ready",
      extracted: { units: 0, topics: 0, questions: 0 },
    },
  );

  const history: ConceptHistory[] = HISTORY.flatMap(([title, concept, results, daysAgo]) => {
    const topicId = topicIdByTitle.get(title);
    if (!topicId) return [];
    return [{ concept, topicId, results: [...results].map((c) => c === "1"), lastSeen: stamp(-daysAgo, 21) }];
  });

  const labs: LabCourse[] = [];
  const experiments: Experiment[] = [];
  for (const l of LABS) {
    labs.push({ ...l.lab, practicalExamDate: day(l.examInDays) });
    l.experiments.forEach(([title, aim, status, dueIn, viva], i) => {
      const done = status !== "not_started";
      experiments.push({
        id: `${l.lab.id}-e${i + 1}`,
        labId: l.lab.id,
        number: i + 1,
        title,
        aim,
        performedOn: done ? day(Math.min(dueIn, 0) - 6) : null,
        due: day(dueIn),
        status,
        checklist: {
          aim: done,
          procedure: done,
          code: status === "written" || status === "checked" || (status === "draft" && i % 2 === 0),
          output: status === "written" || status === "checked",
          conclusion: status === "written" || status === "checked",
        },
        attachments: done ? [{ name: `exp${i + 1}_output.png`, sizeKb: 180 + i * 37 }] : [],
        vivaQuestions: viva,
      });
    });
  }

  return { subjects, units, topics, evidence, sources, questions, history, labs, experiments };
}
