# Memory Retention & Decay Modeling (FORGET-01): Exponential Forgetting Dynamics
*Shiro.ai Technical Deep Dive Series*

---

## 1. Background & Ebbinghaus Decay Theory

Human memory retention decays exponentially over time without reinforcement, as originally observed by Hermann Ebbinghaus (1885). 

In modern educational software, treating a student's mastery as a static scalar leads to severe pedagogical failures: a topic mastered two months ago is treated with the same confidence as a topic reviewed yesterday.

Shiro implements **FORGET-01**, an exponential memory decay engine that forecasts time-dependent retrieval probability and computes precise spacing intervals.

---

## 2. Mathematical Formulation

### A. The Exponential Retention Function
At time $t \ge 0$ (measured in days since the last verified interaction), the predicted probability of recall $R(t)$ is given by:

$$R(t) = \exp\left(-\frac{t}{\tau}\right)$$

where $\tau > 0$ is the **memory stability parameter** (in days).

### B. Fundamental Identities
1. **Initial Recall:** At $t = 0$, $R(0) = \exp(0) = 1.0$.
2. **Asymptotic Decay:** As $t \to \infty$, $R(t) \to 0$.
3. **Memory Half-Life:** The duration $h_{1/2}$ at which retrieval probability drops to 50%:
   $$R(h_{1/2}) = 0.50 \implies \exp\left(-\frac{h_{1/2}}{\tau}\right) = 0.50 \implies h_{1/2} = \tau \cdot \ln(2) \approx 0.6931 \cdot \tau$$
4. **Conditional 7-Day Attrition Risk:** The probability that a student will forget the concept within the upcoming 7 days:
   $$P_{\text{loss}}(7\text{d} \mid t) = 1 - \exp\left(-\frac{7}{\tau}\right)$$

---

## 3. Memory Stability Dynamics & Anti-Inflation Debouncing

### A. Reinforcement Dynamics
Whenever a student successfully reviews a concept (via flashcards, quizzes, or Feynman explanations), the stability parameter $\tau$ updates according to:

$$\tau_{\text{new}} = \tau_{\text{old}} \cdot \left(1 + \alpha \cdot e^{-R(t)}\right)$$

where $\alpha = 0.40$ is the stability growth constant. 
* *Desirable Difficulty Effect:* If a student successfully recalls a concept when retention is low (small $R(t)$), the relative memory boost is significantly higher ($\propto e^{-R(t)}$) than if recalled when memory was already fresh.

### B. Anti-Inflation Session Debouncing
Cramming (e.g. reviewing the same flashcard 10 times in 15 minutes) does NOT produce long-term memory stability. Shiro enforces an anti-inflation session window:
$$\Delta t_{\text{review}} < 30 \text{ minutes} \implies \tau \text{ remains frozen}$$
Successive repetitions within the 30-minute debouncing window are recorded as practice interactions but do not artificially inflate the concept's half-life.

### C. Diagnostic CAT Booster Integration
When a student demonstrates proficiency during a Computerized Adaptive Testing (CAT) session, the latent ability estimate $\hat{\theta}$ triggers a cross-system stability booster:
$$\tau_{\text{boost}} = \tau \cdot \left(1 + 0.25 \cdot \max(0, \hat{\theta})\right)$$
This aligns item-level psychometric proficiency directly with temporal memory resilience.

---

## 4. Downstream Integration with REC-01

The retention service (`Backend/services/retention_service.py`) feeds the recommendation optimizer:
* Concepts with $R(t) \le 0.70$ are flagged as entering the **Critical Attrition Zone**.
* The expected retention gain for a review action is modeled as:
  $$\Delta R = 1.0 - R(t)$$
* This term is directly weighted in REC-01's multi-objective utility function, prioritizing topics before they suffer catastrophic memory loss.
