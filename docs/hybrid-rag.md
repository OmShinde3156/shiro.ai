# Grounded Retrieval (Hybrid RAG): Dense-Sparse Reciprocal Rank Fusion & Provenance
*Shiro.ai Technical Deep Dive Series*

---

## 1. The RAG Problem in Educational Systems

Generic LLM chatbots suffer from hallucination and lack of source traceability. In educational contexts, hallucinations lead to incorrect learning of factual formulas and concepts.

Shiro implements a **Hybrid Dense-Sparse Information Retrieval Pipeline** coupled with **strict citation provenance tracing**:

```text
                                  HYBRID RETRIEVAL DATAFLOW
                                  
                               ┌──────────────────────┐
                               │  USER STUDY QUERY    │
                               └──────────┬───────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
         ┌───────────────────────┐                 ┌───────────────────────┐
         │   SPARSE RETRIEVAL    │                 │    DENSE RETRIEVAL    │
         │   BM25 Lexical Store  │                 │    ChromaDB Cosine    │
         │   Acronyms & Formulas │                 │    Semantic Concepts  │
         └───────────┬───────────┘                 └───────────┬───────────┘
                     │                                         │
                     │  Rank r_sparse(d)                       │  Rank r_dense(d)
                     └────────────────────┬────────────────────┘
                                          ▼
                             ┌─────────────────────────┐
                             │ RECIPROCAL RANK FUSION  │
                             │ RRF(d) = ∑ 1 / (60 + r) │
                             └────────────┬────────────┘
                                          ▼
                             ┌─────────────────────────┐
                             │ TOP-K CHUNK RE-RANKING  │
                             │ Provenance [CIT-n] Tag  │
                             └─────────────────────────┘
```

---

## 2. Mathematical Formulation of Reciprocal Rank Fusion (RRF)

Dense vector search is effective for semantic similarity but frequently misses exact technical tokens (e.g. `O(N log N)`, `CAS`, `Two-Phase Commit`, `MVCC`). Sparse BM25 search excels at exact lexical tokens but fails on paraphrased questions.

To combine both strengths without requiring complex score normalization, Shiro applies **Reciprocal Rank Fusion (Cormack et al., 2009)**:

$$\text{RRFScore}(d) = \sum_{m \in \{\text{dense}, \text{sparse}\}} \frac{1}{k + r_m(d)}$$

where:
* $r_m(d) \in \{1, 2, \dots, N\}$ is the 1-based rank of document chunk $d$ in system $m$.
* $k = 60$ is the ranking constant that mitigates the impact of high-ranking outliers.

### Properties of RRF:
1. Chunks appearing near the top of both lists receive the highest fused scores.
2. Chunks appearing in only one list are preserved if their rank is sufficiently high.
3. No calibration or scale-matching of cosine similarities vs BM25 scores is required.

---

## 3. Provenance Tracing & Citation Groundedness

Shiro enforces citation traceability on every generated response:
1. **Source Chunk Tagging:** When context chunks are formatted for the LLM prompt, each chunk is wrapped in an immutable XML citation tag `<citation id="CIT-n" doc="document_name" page="p">`.
2. **Provenance Drawer:** In the React frontend, clicking any `[CIT-n]` badge opens a provenance drawer displaying:
   * Document title and verified page number.
   * Exact text excerpt retrieved.
   * RRF relevance score and source ranking.
3. **Automated Groundedness Evaluation:** In `Backend/benchmarks/rag_evaluator.py`, every test question evaluates whether the retrieved chunk contains the required ground-truth evidence:
   $$\text{Citation Precision} = \frac{|\text{Retrieved GroundTruth Chunks}|}{|\text{Total Cited Chunks}|}$$

---

## 4. Empirical Benchmark Results

On our 15-document technical benchmark (`Backend/benchmarks/RESULTS.md`):

| Pipeline | Recall@3 | Recall@5 | Recall@10 | MRR | nDCG@5 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sparse BM25** | 92.0% | 96.0% | 96.0% | 0.9300 | 0.9372 |
| **Dense Semantic** | 100.0% | 100.0% | 100.0% | 1.0000 | 1.0000 |
| **Hybrid RRF ($k=60$)** | **96.0%** | **96.0%** | **100.0%** | **0.9667** | **0.9600** |

* **Citation Precision:** **92.16%**.
* **Document Groundedness Rate:** **96.0%**.
* **Unsupported Claim Rate:** **4.0%**.
