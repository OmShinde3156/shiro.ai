# Bayesian Knowledge Tracing (KT-01): Mathematical Formulation & Predictive Calibration
*Shiro.ai Technical Deep Dive Series*

---

## 1. Theoretical Background

Bayesian Knowledge Tracing (BKT), originally introduced by Corbett & Anderson (1994), is a Hidden Markov Model (HMM) widely regarded as the foundational algorithm in Educational Data Mining. 

BKT models a learner's mastery of a specific skill or concept as a binary latent state:
* $L_t = 1$: The concept is mastered at step $t$.
* $L_t = 0$: The concept is not mastered at step $t$.

At each observation opportunity $t$, the learner produces an observable binary response $Y_t \in \{0, 1\}$ (incorrect or correct).

---

## 2. Mathematical Formulation

### A. Four Core Parameters
For each knowledge component (concept) $c$, BKT is parameterized by four stationary probabilities:

| Parameter | Symbol | Shiro Default | Definition |
| :--- | :--- | :--- | :--- |
| **Initial Prior** | $P(L_0)$ | $0.20$ | Probability the student has mastered the concept prior to instruction. |
| **Transition Rate** | $P(T)$ | $0.15$ | Probability a non-mastered student learns the concept after an opportunity. |
| **Slip Rate** | $P(S)$ | $0.10$ | Probability a student who has mastered the concept makes an accidental error. |
| **Guess Rate** | $P(G)$ | $0.20$ | Probability a student who has NOT mastered the concept guesses correctly. |

To maintain model identifiability and prevent degenerate degenerate dynamics, Shiro enforces:
$$P(S) + P(G) < 1.0 \quad \text{and} \quad P(S) \le 0.30, \; P(G) \le 0.30$$

### B. Bayesian Posterior Update
Upon observing response $Y_t$, the posterior probability of mastery is computed using Bayes' theorem:

**Case 1: Correct Observation ($Y_t = 1$)**
$$P(L_t \mid Y_t = 1) = \frac{P(L_{t-1}) \cdot (1 - P(S))}{P(L_{t-1}) \cdot (1 - P(S)) + (1 - P(L_{t-1})) \cdot P(G)}$$

**Case 2: Incorrect Observation ($Y_t = 0$)**
$$P(L_t \mid Y_t = 0) = \frac{P(L_{t-1}) \cdot P(S)}{P(L_{t-1}) \cdot P(S) + (1 - P(L_{t-1})) \cdot (1 - P(G))}$$

### C. Knowledge Transition (Learning Update)
Before the next interaction ($t+1$), the student has an opportunity to learn from instructional feedback:
$$P(L_{t+1}) = P(L_t \mid Y_t) + \left(1 - P(L_t \mid Y_t)\right) \cdot P(T)$$

### D. Next-Step Performance Forecast
The predicted probability that the student will answer the next question correctly is given by:
$$\hat{p}_{t+1} = P(Y_{t+1} = 1) = P(L_t) \cdot (1 - P(S)) + (1 - P(L_t)) \cdot P(G)$$

---

## 3. Evaluation & Predictive Calibration

In Shiro v3.5, BKT is evaluated not merely on raw classification accuracy, but on **probabilistic calibration and discriminatory power**:

### A. Brier Score
The Brier score measures the mean squared error between predicted performance probabilities $\hat{p}_t$ and actual binary outcomes $y_t \in \{0, 1\}$:
$$\text{Brier} = \frac{1}{N}\sum_{t=1}^N (\hat{p}_t - y_t)^2$$
* *Uncalibrated coin-flip baseline ($p = 0.5$):* $\text{Brier} = 0.2500$.
* *Shiro v3.5 Empirical Benchmark:* **$\text{Brier} = 0.1834$** (26.64% error reduction).

### B. Expected Calibration Error (ECE)
To assess whether probabilities represent true likelihoods, predictions are partitioned into $M = 10$ equal-width confidence bins $B_m = (\frac{m-1}{M}, \frac{m}{M}]$:
$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
where $\text{acc}(B_m) = \frac{1}{|B_m|}\sum_{i \in B_m} y_i$ and $\text{conf}(B_m) = \frac{1}{|B_m|}\sum_{i \in B_m} \hat{p}_i$.
* *Shiro v3.5 Empirical Benchmark:* **$\text{ECE} = 0.0643$** (under 7% mean calibration error across all bins).

### C. Area Under the ROC Curve (AUC-ROC)
Measures the probability that a randomly chosen correct student was assigned a higher predicted mastery probability than a randomly chosen incorrect student:
$$\text{AUC} = \frac{\sum_{i \in \text{pos}} \text{rank}_i - \frac{N_{\text{pos}}(N_{\text{pos}} + 1)}{2}}{N_{\text{pos}} \cdot N_{\text{neg}}}$$
* *Random guessing baseline:* $\text{AUC} = 0.5000$.
* *Shiro v3.5 Empirical Benchmark:* **$\text{AUC} = 0.7534$**.

---

## 4. Software Implementation Details

The implementation is encapsulated in `Backend/services/knowledge_tracing_service.py`:
1. **Event Ingestion:** `record_observation(user_id, concept_id, is_correct)` writes an append-only event to the database.
2. **State Projection:** Computes running $P(L)$ values with bounded numerical clamping ($\epsilon = 10^{-4}$).
3. **Downstream Consumption:** $P(L)$ values are ingested by `recommendation_service.py` to calculate skill deficit $(1 - P(L))$ and prerequisite unblocking thresholds.
