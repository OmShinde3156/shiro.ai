# Study Pathway Optimizer (REC-01): Constrained Beam Search & Pacing Dynamics
*Shiro.ai Technical Deep Dive Series*

---

## 1. Problem Formulation: Why Greedy Scheduling Fails

Scheduling personalized study sessions is a combinatorial optimization problem. Given:
* A set of candidate learning objectives (concepts) $\mathcal{C} = \{c_1, \dots, c_m\}$.
* A set of pedagogical modalities $\mathcal{A} = \{\text{Flashcards}, \text{Adaptive Quiz}, \text{Feynman Mode}, \text{Summary Reading}\}$.
* A hard time budget $T \in \{15, 30, 45, 60, 90\}$ minutes.

A naive **Greedy ROI** algorithm selects actions that maximize immediate utility per minute:
$$\arg\max_{(c, a)} \frac{\text{Utility}(c, a)}{\text{Duration}(a)}$$

### The Failure Modes of Greedy Selection:
1. **Pacing Violations (60% Failure Rate in Benchmarks):** Greedy algorithms frequently place high-intensity activities (e.g. a 15-minute diagnostic exam) at the very start of a session, causing acute cognitive fatigue before foundational concepts are activated.
2. **Prerequisite Inversion:** Greedy algorithms assign advanced topics without verifying whether prerequisites are mastered.
3. **Monotony:** Greedy selection repeatedly schedules identical activities (e.g., three consecutive flashcard decks) because of their short duration.

---

## 2. The REC-01 Multi-Constraint Architecture

REC-01 replaces greedy selection with a **Pruned Beam Search ($K = 8$)** that plans multi-step study sequences under explicit cognitive and pedagogical constraints:

```text
                        REC-01 PRUNED BEAM SEARCH (K=8)
                        
   Initial State: Time Remaining = T, Sequence = []
   
   Step 1: Expand Valid Actions (Candidate Concepts x Modalities)
           • Prerequisite Filter: P(L_prereq) >= 0.50
           • Duration Fit: duration(a) <= time_remaining
           • Pacing Filter: phase(a) == current_expected_phase
           
   Step 2: Score Expanded Paths
           Score(path) = ∑ Utility(step) - Penalties
           
   Step 3: Prune to Top-K Paths (K = 8)
   
   Step 4: Repeat until time budget T is exhausted.
   
   Optimal Sequence: arg max_{path ∈ Beam} Score(path)
```

---

## 3. Mathematical Utility Model

The utility of assigning action $a$ to concept $c$ is defined as:

$$\text{Utility}(c, a) = w_m \cdot \Delta \text{Mastery}(c, a) + w_r \cdot \Delta \text{Retention}(c, a) + w_e \cdot \text{ExamWeight}(c) - \lambda \cdot \text{Cost}(c, a)$$

where:
1. **Mastery Gain Term ($\Delta \text{Mastery}$):**
   $$\Delta \text{Mastery} = (1 - P(L_c)) \cdot \eta_{\text{modality}}(a)$$
   Scaled by the current knowledge deficit $(1 - P(L_c))$ from BKT.
2. **Retention Recovery Term ($\Delta \text{Retention}$):**
   $$\Delta \text{Retention} = (1 - R_c(t)) \cdot \phi_{\text{modality}}(a)$$
   Scaled by the decay from FORGET-01.
3. **Exam Alignment ($w_e \cdot \text{ExamWeight}$):**
   Prioritizes high-yield topics based on exam blueprint weighting.
4. **Cognitive Pacing Constraint:**
   Enforces the sequence:
   $$\text{Warmup (Flashcards / Summary)} \prec \text{Core (Adaptive CAT / Feynman)} \prec \text{Consolidation (Mindmap / Review)}$$
   Sequences violating this progression incur a severe utility penalty $\Pi_{\text{pacing}} = -5.0$.

---

## 4. Empirical Evaluation: The REC-01 vs Greedy ROI Trade-Off

In our publication benchmark (`Backend/benchmarks/RESULTS.md`), REC-01 was evaluated against 5 baselines across 5 time budgets:

| Metric (45m Budget) | Random Baseline | Greedy ROI | REC-01 (Shiro) |
| :--- | :--- | :--- | :--- |
| **Mean Utility** | 0.572 | **1.258** | 1.192 (**+108.4% vs Random**) |
| **Cognitive Pacing Adherence** | 0.0% | 40.0% | **100.0%** |
| **Prerequisite Violations** | 1.00 | 1.20 | **0.80** |
| **Budget Utilization** | 94.2% | 94.7% | 93.3% |

### Why REC-01 Demonstrates Engineering Maturity:
* **The Trade-Off:** REC-01 achieves 5.25% lower raw unconstrained utility than Greedy ROI (1.192 vs 1.258).
* **The Reason:** Greedy ROI achieves high raw numbers by ignoring pedagogical constraints: it assigns intense flashcard bursts out of order.
* **The Engineering Decision:** REC-01 trades off 5% theoretical raw ROI to achieve **100% cognitive pacing adherence** (vs 40% for greedy) and lower prerequisite violations, producing a realistic, low-fatigue learning experience.
