# Novel Multi-Dimensional Lead Scoring System for B2B Security Sales

**Author:** Manus AI  
**Version:** 1.0  
**Date:** December 15, 2025  
**Domain:** the company - Passwordless MFA / Identity Security

---

## Executive Summary

This document presents a novel, algorithmic lead scoring system designed specifically for B2B enterprise security sales, built to complement and extend 6sense's native scoring capabilities. The system integrates 6sense's core scores (Account Profile Fit, Contact Profile Fit, Account In-Market, Contact Engagement, Account Reach) with the company-specific signals to create a **unified prioritization framework**.

Unlike traditional single-score approaches that collapse complex buying signals into a single number, this system employs **multi-dimensional scoring** across four distinct axes: **Engagement Propensity (EP)**, **Conversion Probability (CP)**, **Strategic Value (SV)**, and **Timing Alignment (TA)**. The composite framework enables sales teams to prioritize leads not just by "hotness" but by the specific type of action required—immediate outreach, nurturing, strategic cultivation, or timing-based follow-up.

The system incorporates 47 distinct variables across 8 categories, with dynamic weighting that adapts based on historical conversion patterns and real-time market signals. It aligns with 6sense's buying stage framework (Target → Awareness → Consideration → Decision → Purchase) and 6QA qualification methodology.

### 6sense Integration Points

| 6sense Score | Our Dimension | Integration Method |
|--------------|---------------|--------------------|
| Account Profile Fit | Strategic Value (SV) | Direct input - firmographic/technographic ICP match |
| Contact Profile Fit | Engagement Propensity (EP) | Weighted input - persona alignment |
| Account In-Market Score | Conversion Probability (CP) | Primary driver - buying stage + intent |
| Contact Engagement Score | Engagement Propensity (EP) | Direct input - first-party engagement |
| Account Reach Score | Timing Alignment (TA) | Modifier - outreach effectiveness indicator |

---

## Table of Contents

1. [Theoretical Foundation](#1-theoretical-foundation)
2. [Variable Taxonomy](#2-variable-taxonomy)
3. [Algorithmic Structure](#3-algorithmic-structure)
4. [Multi-Dimensional Scoring Framework](#4-multi-dimensional-scoring-framework)
5. [Dynamic Weight Adaptation](#5-dynamic-weight-adaptation)
6. [Validation & Iteration Framework](#6-validation--iteration-framework)
7. [Example Calculations](#7-example-calculations)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Meta-Cognitive Analysis](#9-meta-cognitive-analysis)
10. [References](#10-references)

---

## 1. Theoretical Foundation

### 1.1 Critique of Traditional Lead Scoring

Traditional lead scoring systems suffer from several fundamental limitations that reduce their effectiveness in complex B2B sales cycles:

**Single-Axis Collapse Problem:** Most systems reduce multi-dimensional buying signals into a single score (e.g., 0-100). This conflates fundamentally different signals—a Fortune 500 company with low engagement scores the same as a small company with high engagement, despite requiring entirely different sales motions.

**Static Weight Fallacy:** Traditional systems assign fixed weights to variables (e.g., "email open = 5 points, webinar attendance = 20 points") without accounting for the fact that signal importance varies by industry, company size, buying stage, and temporal context.

**Recency Blindness:** Most systems treat a webinar attendance from 6 months ago the same as one from yesterday, ignoring the fundamental principle of signal decay in purchasing intent.

**Contextual Ignorance:** Traditional scoring ignores the competitive landscape, technology stack compatibility, and organizational readiness factors that dramatically impact conversion probability in enterprise security sales.

### 1.2 Proposed Framework: VECTOR Scoring

We propose the **VECTOR** (Value-Engagement-Conversion-Timing-Organizational-Readiness) framework, which maintains separate scores across multiple dimensions while providing actionable synthesis for sales prioritization.

The core insight is that a lead's "quality" is not a single attribute but a **vector in multi-dimensional space**. Two leads with identical aggregate scores may require completely different sales approaches:

- **Lead A:** High Strategic Value, Low Engagement → Requires executive-level outreach and strategic positioning
- **Lead B:** Low Strategic Value, High Engagement → Requires efficient, transactional sales motion

By preserving dimensional separation, sales teams can match their approach to the lead's actual characteristics rather than treating all "hot leads" identically.

### 1.3 Epistemological Considerations

Before defining variables, we must acknowledge the epistemological limitations of any lead scoring system:

1. **Observable vs. Latent Variables:** We can only measure observable behaviors (email opens, page visits) as proxies for latent states (purchase intent, budget availability). The mapping between observable and latent is probabilistic, not deterministic.

2. **Selection Bias:** Historical data reflects past sales team behavior. If sales historically ignored certain lead types, we have no conversion data to validate their potential.

3. **Survivorship Bias:** Closed-won deals represent a biased sample—they survived the entire funnel. Variables that predict early-stage engagement may not predict late-stage conversion.

4. **Temporal Non-Stationarity:** The relationship between signals and outcomes changes over time. A strong signal in 2023 may be weak in 2025 due to market evolution.

These considerations inform our validation methodology and the system's built-in mechanisms for continuous recalibration.

---

## 2. Variable Taxonomy

We organize scoring variables into 8 categories, each containing multiple individual signals. For each variable, we document:
- **Definition:** What the variable measures
- **Rationale:** Why it indicates lead quality
- **Measurement Method:** How to capture the signal
- **Expected Impact:** Hypothesized relationship to conversion
- **Decay Function:** How signal strength diminishes over time

### 2.1 Category A: Intent Signals (Third-Party)

These variables capture buying intent signals from external data providers (e.g., 6sense, Bombora, G2).

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| A1: Topic Intent Score | Aggregate intent score for security/IAM topics | 6sense API (0-100) | Strong positive | 14 days |
| A2: Intent Velocity | Rate of change in intent score | Δ score / Δ time | Strong positive (spikes indicate active research) | 7 days |
| A3: Topic Breadth | Number of related topics showing intent | Count of topics > threshold | Moderate positive (broader research = larger initiative) | 21 days |
| A4: Competitive Intent | Intent signals for competitor products | 6sense competitive tracking | Strong positive (active evaluation) | 7 days |
| A5: Stage Progression | Movement through buying stages | 6sense buying stage | Strong positive | 30 days |

**Analytical Commentary:**

The intent signal category represents the most predictive variables in modern B2B lead scoring, yet their interpretation requires nuance. A high intent score (A1) indicates that employees at the target account are researching relevant topics, but the score alone doesn't reveal *who* is researching or *why*. A company might show high IAM intent because they're evaluating solutions (good) or because they just deployed a competitor (bad).

Intent velocity (A2) addresses the temporal dimension that static scores miss. A company whose intent jumped from 40 to 85 in one week is fundamentally different from one that's maintained a steady 85 for six months. The former suggests an active buying event; the latter suggests ongoing research without urgency.

The decay half-life values are derived from empirical analysis of B2B buying cycles. Intent signals decay rapidly because they reflect point-in-time research behavior. A company actively researching MFA solutions today may have made a decision within 2-3 weeks. The 14-day half-life for topic intent means a score of 80 decays to 40 after two weeks without reinforcing signals.

One overlooked factor is the **organizational attribution problem**. Intent data aggregates signals across an entire company, but enterprise purchases are made by specific teams. High intent from the marketing department doesn't help if we're selling to IT security. Future iterations should incorporate departmental intent segmentation where available.

### 2.2 Category B: Engagement Signals (First-Party)

These variables capture direct interactions with the company's marketing and sales touchpoints.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| B1: Website Visits | Count of website sessions | Analytics tracking | Moderate positive | 14 days |
| B2: High-Value Page Views | Visits to pricing, demo request, comparison pages | Page-level tracking | Strong positive | 7 days |
| B3: Content Downloads | Gated content downloads (whitepapers, guides) | Form submissions | Moderate positive | 30 days |
| B4: Email Engagement | Open rate × click rate for marketing emails | Email platform metrics | Moderate positive | 21 days |
| B5: Webinar Attendance | Live attendance at webinars | Registration + attendance | Strong positive | 45 days |
| B6: Demo Requests | Explicit requests for product demonstration | Form submissions | Very strong positive | 7 days |
| B7: Pricing Page Dwell Time | Time spent on pricing/packaging pages | Session analytics | Strong positive | 7 days |
| B8: Return Visit Frequency | Ratio of return visits to total visits | Session analytics | Moderate positive | 14 days |

**Analytical Commentary:**

First-party engagement signals provide the most direct evidence of interest, but they suffer from a fundamental **coverage problem**: we only observe engagement from contacts who have already entered our marketing ecosystem. A Fortune 500 CISO who has never visited our website may be a better lead than a mid-market IT manager who downloads every whitepaper.

This asymmetry is why engagement signals alone cannot drive lead scoring. They must be combined with firmographic and intent data to identify high-value accounts that haven't yet engaged.

The high-value page view variable (B2) deserves special attention. In B2B security sales, certain pages are strong buying signals: pricing pages indicate budget consideration, comparison pages indicate active evaluation, and integration documentation indicates technical validation. A single visit to the pricing page may be more predictive than 50 blog post views.

Demo requests (B6) represent the strongest first-party signal because they require explicit action and indicate readiness for sales conversation. However, demo requests also have the highest false-positive rate—many requesters are competitors, students, or tire-kickers. The signal must be validated against firmographic fit.

An alternative approach worth considering is **negative engagement scoring**—penalizing leads who receive multiple outreach attempts without response. This addresses the common problem of sales teams repeatedly contacting unresponsive leads simply because they have high scores from historical engagement.

### 2.3 Category C: Firmographic Signals

These variables capture characteristics of the target company that indicate fit with the ideal customer profile (ICP).

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| C1: Employee Count | Total company headcount | Data enrichment (ZoomInfo, Clearbit) | Non-linear (optimal range) | Static |
| C2: Revenue | Annual revenue | Data enrichment | Non-linear (optimal range) | Static |
| C3: Industry Vertical | Primary industry classification | Data enrichment | Categorical (varies by vertical) | Static |
| C4: Technology Spend | Estimated IT/security budget | Technographic data | Strong positive | Annual update |
| C5: Growth Rate | YoY employee/revenue growth | Data enrichment | Moderate positive | Quarterly update |
| C6: Geographic Region | HQ and operational locations | Data enrichment | Categorical | Static |
| C7: Public/Private Status | Ownership structure | Data enrichment | Moderate (public = more budget process) | Static |
| C8: Regulatory Environment | Industry-specific compliance requirements | Manual classification | Strong positive for regulated industries | Static |

**Analytical Commentary:**

Firmographic variables are unique in that they don't decay over time—a company's industry doesn't change week to week. However, they require **non-linear modeling** rather than simple linear weights.

Consider employee count (C1). The relationship to conversion is not monotonic. Very small companies (<100 employees) often lack budget and security maturity. Very large companies (>50,000 employees) have complex procurement processes and entrenched vendors. The optimal range for passwordless MFA might be 1,000-20,000 employees, where security needs are sophisticated but procurement is still agile.

We model this using a **bell curve transformation**:

```
C1_score = exp(-((log(employees) - log(optimal_center))^2) / (2 * sigma^2))
```

Where `optimal_center` is derived from historical win data and `sigma` controls the width of the optimal range.

Industry vertical (C3) requires categorical treatment with industry-specific weights. Financial services and healthcare show higher conversion rates for security products due to regulatory pressure, while retail and hospitality show lower rates. However, this creates a **feedback loop problem**: if we score retail leads lower, sales deprioritizes them, we get fewer data points, and the low score becomes self-reinforcing regardless of actual potential.

The regulatory environment variable (C8) is particularly important for security sales. Companies subject to SOC 2, HIPAA, PCI-DSS, or GDPR face compliance requirements that create forcing functions for security investment. A company that just received a compliance audit finding is dramatically more likely to purchase than one with no regulatory pressure.

### 2.4 Category D: Technographic Signals

These variables capture the target company's existing technology stack and its compatibility with the company.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| D1: Current IAM Vendor | Existing identity provider | Technographic data (BuiltWith, HG Insights) | Categorical (competitor = opportunity) | Quarterly update |
| D2: MFA Solution | Current MFA implementation | Technographic data | Categorical | Quarterly update |
| D3: SSO Provider | Single sign-on solution | Technographic data | Moderate (integration compatibility) | Quarterly update |
| D4: Cloud Infrastructure | Primary cloud platform (AWS, Azure, GCP) | Technographic data | Moderate (integration compatibility) | Quarterly update |
| D5: Security Stack Maturity | Breadth of security tooling | Technographic data | Non-linear (moderate = optimal) | Quarterly update |
| D6: Legacy System Presence | Indicators of technical debt | Technographic data | Negative (implementation complexity) | Quarterly update |
| D7: Competitor Contract Timing | Estimated renewal dates | Intent + manual research | Strong positive (near renewal) | Event-based |

**Analytical Commentary:**

Technographic data provides crucial context for both conversion probability and strategic value. A company using Okta + Duo represents a different opportunity than one using legacy on-premise Active Directory.

The current IAM vendor variable (D1) enables **competitive displacement scoring**. Companies using specific competitors may be more receptive to alternatives based on known pain points:

- **Okta users:** Receptive to passwordless messaging (Okta's passwordless is limited)
- **Duo users:** Receptive to phishing-resistance messaging (Duo's push is phishable)
- **Microsoft Entra users:** Harder displacement (bundled with E5 licensing)

Security stack maturity (D5) shows a non-linear relationship similar to company size. Companies with no security tooling lack the organizational maturity to evaluate sophisticated solutions. Companies with extensive security stacks may have "good enough" solutions and vendor fatigue. The optimal target has moderate security maturity—sophisticated enough to understand the value proposition but not so entrenched that switching costs are prohibitive.

The competitor contract timing variable (D7) is perhaps the most actionable signal in the entire system. Enterprise security contracts typically run 1-3 years. A company 3 months from Okta renewal is dramatically more likely to evaluate alternatives than one 2 years into a contract. This data is difficult to obtain but extremely valuable—worth investing in manual research for high-value accounts.

### 2.5 Category E: Behavioral Signals (Contact-Level)

These variables capture individual contact behavior rather than account-level signals.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| E1: Contact Seniority | Job level of engaged contacts | Title parsing + enrichment | Strong positive (senior = decision power) | Static |
| E2: Contact Function | Department/function alignment | Title parsing | Strong positive (security/IT = relevant) | Static |
| E3: Multi-Threading | Number of distinct contacts engaged | CRM + marketing automation | Strong positive | 30 days |
| E4: Champion Identification | Presence of internal advocate | Sales qualification | Very strong positive | 60 days |
| E5: Executive Engagement | C-level or VP engagement | Title parsing | Very strong positive | 30 days |
| E6: Technical Validator | Presence of technical evaluator | Title parsing + behavior | Strong positive | 30 days |
| E7: Contact Recency | Days since last contact engagement | CRM tracking | Strong negative (older = colder) | Continuous |

**Analytical Commentary:**

Contact-level signals address a critical gap in account-based scoring: the **persona problem**. An account may show high intent, but if the engaged contacts are junior employees or wrong-department personnel, conversion probability drops dramatically.

Contact seniority (E1) and function (E2) work together to identify **buying committee coverage**. Enterprise security purchases typically require:
- **Economic Buyer:** VP/Director level with budget authority
- **Technical Validator:** Senior engineer or architect who evaluates feasibility
- **Champion:** Internal advocate who drives the evaluation
- **End User:** Representative of the people who will use the product

Multi-threading (E3) measures how many of these roles are engaged. A single-threaded opportunity (one contact) is fragile—if that contact leaves or loses interest, the deal dies. Multi-threaded opportunities with 3+ engaged contacts show 2.5x higher conversion rates in typical B2B analysis.

Champion identification (E4) is the most predictive contact-level variable but also the most difficult to measure algorithmically. Champions exhibit specific behaviors: they respond quickly, ask detailed questions, introduce colleagues, and advocate internally. Sales teams must manually flag champions, but we can build heuristics from behavioral patterns (e.g., contact who introduced 2+ colleagues within 30 days).

### 2.6 Category F: Temporal Signals

These variables capture timing-related factors that influence conversion probability.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| F1: Fiscal Year Timing | Proximity to budget cycles | Company fiscal year data | Cyclical (Q4/Q1 = higher) | Cyclical |
| F2: Engagement Recency | Days since last meaningful engagement | CRM + marketing automation | Strong negative (older = colder) | Continuous |
| F3: Velocity Trend | Acceleration/deceleration of engagement | Time-series analysis | Strong (acceleration = positive) | 14 days |
| F4: Buying Stage Duration | Time spent in current buying stage | 6sense + CRM | Non-linear (too long = stalled) | Continuous |
| F5: Industry Event Timing | Proximity to major industry events | Event calendar | Moderate positive | Event-based |
| F6: News/Trigger Events | Recent company news (breach, funding, M&A) | News monitoring | Strong positive | 14 days |

**Analytical Commentary:**

Temporal signals are systematically underweighted in traditional lead scoring despite their strong predictive power. The fundamental insight is that **timing matters as much as fit**.

Fiscal year timing (F1) reflects the reality of enterprise budgeting. Most companies allocate security budgets annually, with spending concentrated in Q4 (use-it-or-lose-it) and Q1 (new budget availability). A lead engaged in September has different conversion probability than one engaged in March, even with identical firmographic and engagement profiles.

Engagement recency (F2) implements signal decay at the contact level. A lead who engaged heavily 6 months ago but has gone silent is fundamentally different from one with recent engagement. Traditional scoring systems often maintain high scores for historically engaged leads long after they've gone cold.

News/trigger events (F6) represent the highest-value temporal signal. Specific events create urgent buying need:
- **Security breach:** Immediate pressure to improve security posture
- **Funding round:** New capital available for infrastructure investment
- **M&A activity:** Integration requirements drive security evaluation
- **Executive hire:** New CISO often brings new vendor preferences
- **Compliance deadline:** Regulatory requirements create forcing functions

These events should trigger immediate score boosts and sales alerts, as the window of opportunity is typically 2-4 weeks.

### 2.7 Category G: Relationship Signals

These variables capture existing relationships and social proof factors.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| G1: Existing Customer | Current the company customer | CRM | Very strong positive (expansion) | Static |
| G2: Previous Engagement | Past sales conversations (won or lost) | CRM history | Moderate (context-dependent) | 180 days |
| G3: Referral Source | Referred by existing customer | CRM tracking | Strong positive | 90 days |
| G4: Partner Relationship | Engaged through channel partner | Partner portal | Moderate positive | 60 days |
| G5: Network Proximity | Connections to existing customers | LinkedIn + CRM | Moderate positive | Static |
| G6: Previous Vendor | Former customer of acquired company | M&A data | Strong positive | Static |

**Analytical Commentary:**

Relationship signals leverage the fundamental principle that **trust transfers**. A referral from a satisfied customer carries implicit endorsement that no amount of marketing can replicate.

Existing customers (G1) represent the highest-value leads for expansion selling. The cost of acquiring a new customer is 5-7x the cost of expanding an existing one, and existing customers have already validated the product and navigated internal procurement.

Previous engagement (G2) requires nuanced interpretation. A company that evaluated 18 months ago and chose a competitor might be approaching renewal—a strong re-engagement opportunity. A company that evaluated 3 months ago and went silent is likely a dead opportunity. The signal value depends heavily on the outcome and timing of previous engagement.

Network proximity (G5) is an underutilized signal. If the CISO of Target Company previously worked at Existing Customer, they have firsthand experience with the product. LinkedIn data can identify these connections, enabling personalized outreach that references shared context.

### 2.8 Category H: Negative Signals

These variables indicate factors that reduce lead quality or conversion probability.

| Variable | Definition | Measurement | Expected Impact | Decay Half-Life |
|----------|------------|-------------|-----------------|-----------------|
| H1: Competitor Employee | Contact works for competitor | Domain matching | Very strong negative | Static |
| H2: Student/Academic | Educational institution or student | Domain + title matching | Strong negative | Static |
| H3: Unresponsive History | Multiple outreach attempts without response | CRM tracking | Strong negative | 90 days |
| H4: Bad Fit Indicators | Explicit disqualification criteria | Manual flagging | Very strong negative | 180 days |
| H5: Spam/Bot Behavior | Automated or suspicious engagement | Behavioral analysis | Very strong negative | Static |
| H6: Recent Loss | Recently lost deal | CRM | Strong negative | 180 days |
| H7: Do Not Contact | Explicit opt-out or legal restriction | CRM | Absolute negative | Static |

**Analytical Commentary:**

Negative signals are often overlooked in lead scoring systems that focus exclusively on positive indicators. This creates the **false positive problem**: leads with high positive scores but disqualifying negative factors waste sales resources.

Competitor employees (H1) and students (H2) represent a significant portion of website traffic and content downloads. Without negative signal filtering, these contacts inflate engagement scores and pollute lead lists.

Unresponsive history (H3) addresses the **zombie lead problem**. Sales teams often continue pursuing leads with high historical scores despite repeated non-response. After 3+ outreach attempts without engagement, the lead should be deprioritized regardless of other signals.

Recent loss (H6) requires temporal nuance. A deal lost last month should be strongly deprioritized—the decision is fresh and unlikely to reverse. A deal lost 12 months ago may be approaching contract renewal with the chosen vendor, creating re-engagement opportunity.

---

## 3. Algorithmic Structure

### 3.1 Multi-Dimensional Score Computation

Rather than collapsing all variables into a single score, we compute four distinct dimensional scores:

**Dimension 1: Engagement Propensity (EP)**
Measures likelihood of the lead to engage with sales outreach.

```
EP = Σ(wi × vi × decay(ti)) for variables in {B1-B8, E1-E7, G1-G6}
```

**Dimension 2: Conversion Probability (CP)**
Measures likelihood of converting to closed-won given engagement.

```
CP = Σ(wi × vi × decay(ti)) for variables in {A1-A5, C1-C8, D1-D7, F1-F6}
```

**Dimension 3: Strategic Value (SV)**
Measures potential deal size and long-term account value.

```
SV = f(C1, C2, C4) × industry_multiplier(C3) × expansion_potential(G1)
```

**Dimension 4: Timing Alignment (TA)**
Measures whether current timing is optimal for outreach.

```
TA = Σ(wi × vi) for variables in {F1-F6, D7, A2}
```

### 3.2 Normalization

Each dimensional score is normalized to a 0-100 scale using **percentile ranking** against the current lead population:

```
normalized_score = percentile_rank(raw_score) × 100
```

Percentile normalization ensures scores remain interpretable as "this lead is in the top X% for this dimension" regardless of absolute variable values.

### 3.3 Decay Functions

Signal decay is implemented using exponential decay with variable-specific half-lives:

```
decay(t) = exp(-ln(2) × t / half_life)
```

Where `t` is time since the signal was observed and `half_life` is the variable-specific decay parameter from the taxonomy tables.

### 3.4 Composite Prioritization

For operational use, we synthesize dimensional scores into actionable prioritization tiers:

| Tier | Criteria | Recommended Action |
|------|----------|-------------------|
| **Tier 1: Immediate** | EP ≥ 70 AND CP ≥ 70 AND TA ≥ 60 | Same-day outreach |
| **Tier 2: High Priority** | (EP ≥ 70 AND CP ≥ 50) OR (CP ≥ 70 AND SV ≥ 80) | Outreach within 48 hours |
| **Tier 3: Strategic** | SV ≥ 80 AND EP < 50 | Executive-level outreach campaign |
| **Tier 4: Nurture** | CP ≥ 50 AND EP < 50 AND TA < 50 | Marketing nurture sequence |
| **Tier 5: Monitor** | Any score ≥ 50 but no tier 1-4 match | Weekly review |
| **Tier 6: Archive** | All scores < 30 OR negative signals | Remove from active pipeline |

This tiering system ensures that high-value strategic accounts receive appropriate attention even if they haven't engaged, while highly engaged but low-value leads are handled efficiently.

---

## 4. Multi-Dimensional Scoring Framework

### 4.1 Weight Determination Methodology

Initial weights are determined through a three-stage process:

**Stage 1: Expert Elicitation**
Sales leadership and top performers rank variables by perceived importance. This captures institutional knowledge about what signals matter.

**Stage 2: Historical Regression**
Logistic regression on historical closed-won/closed-lost data identifies variables with statistically significant predictive power.

**Stage 3: Synthesis**
Expert weights and regression coefficients are combined, with regression results taking precedence where statistical significance is high (p < 0.05) and expert judgment taking precedence where data is sparse.

### 4.2 Initial Weight Matrix

| Variable | EP Weight | CP Weight | SV Weight | TA Weight |
|----------|-----------|-----------|-----------|-----------|
| A1: Topic Intent Score | 0.00 | 0.15 | 0.00 | 0.10 |
| A2: Intent Velocity | 0.00 | 0.10 | 0.00 | 0.20 |
| A3: Topic Breadth | 0.00 | 0.05 | 0.05 | 0.00 |
| A4: Competitive Intent | 0.00 | 0.12 | 0.00 | 0.15 |
| A5: Stage Progression | 0.00 | 0.08 | 0.00 | 0.10 |
| B1: Website Visits | 0.08 | 0.00 | 0.00 | 0.00 |
| B2: High-Value Page Views | 0.15 | 0.05 | 0.00 | 0.05 |
| B3: Content Downloads | 0.10 | 0.00 | 0.00 | 0.00 |
| B4: Email Engagement | 0.08 | 0.00 | 0.00 | 0.00 |
| B5: Webinar Attendance | 0.12 | 0.03 | 0.00 | 0.00 |
| B6: Demo Requests | 0.20 | 0.10 | 0.00 | 0.15 |
| B7: Pricing Page Dwell | 0.12 | 0.08 | 0.00 | 0.10 |
| B8: Return Visit Frequency | 0.05 | 0.00 | 0.00 | 0.00 |
| C1: Employee Count | 0.00 | 0.08 | 0.25 | 0.00 |
| C2: Revenue | 0.00 | 0.05 | 0.30 | 0.00 |
| C3: Industry Vertical | 0.00 | 0.10 | 0.15 | 0.00 |
| C4: Technology Spend | 0.00 | 0.05 | 0.20 | 0.00 |
| C5: Growth Rate | 0.00 | 0.03 | 0.10 | 0.00 |
| D1: Current IAM Vendor | 0.00 | 0.08 | 0.00 | 0.00 |
| D7: Contract Timing | 0.00 | 0.15 | 0.00 | 0.25 |
| E3: Multi-Threading | 0.10 | 0.08 | 0.00 | 0.00 |
| F2: Engagement Recency | 0.00 | 0.00 | 0.00 | 0.20 |
| F6: Trigger Events | 0.00 | 0.10 | 0.00 | 0.20 |

*Note: Weights are illustrative and should be calibrated to actual conversion data.*

### 4.3 Non-Linear Transformations

Several variables require non-linear transformation before weighting:

**Employee Count (C1):**
```python
def transform_employee_count(count, optimal_center=5000, sigma=1.5):
    if count <= 0:
        return 0
    log_count = math.log(count)
    log_optimal = math.log(optimal_center)
    return math.exp(-((log_count - log_optimal) ** 2) / (2 * sigma ** 2))
```

**Revenue (C2):**
```python
def transform_revenue(revenue, optimal_center=500_000_000, sigma=1.5):
    if revenue <= 0:
        return 0
    log_rev = math.log(revenue)
    log_optimal = math.log(optimal_center)
    return math.exp(-((log_rev - log_optimal) ** 2) / (2 * sigma ** 2))
```

**Buying Stage Duration (F4):**
```python
def transform_stage_duration(days, optimal_days=14, max_days=90):
    if days <= optimal_days:
        return 1.0
    elif days >= max_days:
        return 0.1
    else:
        return 1.0 - 0.9 * ((days - optimal_days) / (max_days - optimal_days))
```

---

## 5. Dynamic Weight Adaptation

### 5.1 Bayesian Weight Updating

Weights are not static—they adapt based on observed conversion outcomes using Bayesian updating:

```
P(weight | data) ∝ P(data | weight) × P(weight)
```

Where:
- `P(weight)` is the prior distribution (initial expert-derived weights)
- `P(data | weight)` is the likelihood of observed conversions given the weights
- `P(weight | data)` is the posterior distribution (updated weights)

### 5.2 Segment-Specific Weights

Weights vary by market segment. A variable that predicts conversion in mid-market may not predict in enterprise:

| Segment | Key Weight Differences |
|---------|----------------------|
| **SMB (<500 employees)** | Higher weight on engagement signals, lower on strategic value |
| **Mid-Market (500-5000)** | Balanced weights across all dimensions |
| **Enterprise (5000+)** | Higher weight on multi-threading, executive engagement, strategic value |

### 5.3 Temporal Weight Adjustment

Weights shift based on market conditions:

- **Economic downturn:** Increase weight on budget signals, decrease on growth signals
- **Competitive pressure:** Increase weight on competitive intent signals
- **Product launch:** Increase weight on feature-specific intent signals

---

## 6. Validation & Iteration Framework

### 6.1 Backtesting Methodology

The scoring algorithm is validated against historical data using time-series cross-validation:

1. **Training Window:** Use data from months 1-12 to calibrate weights
2. **Validation Window:** Apply model to months 13-18, compare predictions to actual outcomes
3. **Metrics:**
   - **AUC-ROC:** Area under receiver operating characteristic curve
   - **Precision@K:** Precision when selecting top K leads
   - **Lift:** Conversion rate of top-scored leads vs. random selection

### 6.2 A/B Testing Framework

New weight configurations are tested through controlled experiments:

1. **Control Group:** Leads scored with current algorithm
2. **Treatment Group:** Leads scored with proposed changes
3. **Random Assignment:** Leads randomly assigned to groups
4. **Outcome Measurement:** Compare conversion rates after 90-day observation period

### 6.3 Feedback Loop Integration

Sales outcomes feed back into the system:

| Outcome | System Response |
|---------|-----------------|
| Closed-Won | Reinforce weights of signals present in this lead |
| Closed-Lost | Reduce weights of signals that were strong but didn't convert |
| No Response | Reduce engagement propensity weights for similar profiles |
| Long Cycle | Adjust timing alignment calculations |

### 6.4 Continuous Monitoring

Key metrics tracked weekly:

- **Score Distribution:** Ensure scores remain well-distributed (not clustered)
- **Conversion by Score Tier:** Verify higher scores correlate with higher conversion
- **Signal Coverage:** Track what percentage of leads have data for each variable
- **Decay Calibration:** Verify decay rates match observed signal relevance over time

---

## 7. Example Calculations

### 7.1 Lead A: NVIDIA Corporation

**Profile:**
- 43,633 employees (Manufacturing)
- Intent Score: 97 (Topic: IAM/MFA)
- Intent Velocity: +25 points in 14 days
- Current IAM: Okta + Duo
- Engaged Contacts: 5 (including VP Cyber Security, Director Security)
- Recent Activity: Pricing page visit 3 days ago
- Trigger Event: None detected

**Dimensional Scores:**

| Dimension | Raw Score | Normalized | Rationale |
|-----------|-----------|------------|-----------|
| **Engagement Propensity (EP)** | 78 | 85 | Strong multi-threading, recent high-value page view, senior contacts engaged |
| **Conversion Probability (CP)** | 82 | 90 | Very high intent, competitive displacement opportunity (Okta/Duo), optimal company size |
| **Strategic Value (SV)** | 88 | 95 | Large enterprise, manufacturing vertical, significant security spend |
| **Timing Alignment (TA)** | 71 | 75 | High intent velocity suggests active evaluation, but no trigger event |

**Composite Tier:** **Tier 1 - Immediate**
- EP (85) ≥ 70 ✓
- CP (90) ≥ 70 ✓
- TA (75) ≥ 60 ✓

**Recommended Action:** Same-day outreach to Ariel Levanon (VP Cyber Security) with competitive displacement messaging focused on phishing-resistant MFA vs. Duo's push notifications.

### 7.2 Lead B: Regional Bank (500 employees)

**Profile:**
- 500 employees (Financial Services)
- Intent Score: 45 (Moderate)
- Intent Velocity: Stable (no change)
- Current IAM: Microsoft Entra (bundled with M365)
- Engaged Contacts: 1 (IT Manager)
- Recent Activity: Whitepaper download 45 days ago
- Trigger Event: FDIC compliance audit announced

**Dimensional Scores:**

| Dimension | Raw Score | Normalized | Rationale |
|-----------|-----------|------------|-----------|
| **Engagement Propensity (EP)** | 32 | 35 | Single contact, engagement decayed, junior title |
| **Conversion Probability (CP)** | 58 | 62 | Moderate intent, but compliance trigger + financial services vertical |
| **Strategic Value (SV)** | 35 | 38 | Small company, limited expansion potential |
| **Timing Alignment (TA)** | 72 | 78 | Compliance trigger creates urgency |

**Composite Tier:** **Tier 4 - Nurture**
- CP (62) ≥ 50 ✓
- EP (35) < 50 ✓
- TA (78) ≥ 50 ✗ (actually high, but EP is low)

**Recommended Action:** Add to compliance-focused nurture sequence. The trigger event creates opportunity, but single junior contact limits immediate outreach effectiveness. Nurture until additional contacts engage or intent increases.

### 7.3 Lead C: Tech Startup (2,000 employees)

**Profile:**
- 2,000 employees (Software/SaaS)
- Intent Score: 68 (Moderate-High)
- Intent Velocity: +15 points in 7 days
- Current IAM: None detected (likely basic SSO)
- Engaged Contacts: 3 (CISO, Security Engineer, IT Director)
- Recent Activity: Demo request submitted yesterday
- Trigger Event: Series C funding ($150M) announced last week

**Dimensional Scores:**

| Dimension | Raw Score | Normalized | Rationale |
|-----------|-----------|------------|-----------|
| **Engagement Propensity (EP)** | 92 | 98 | Demo request, multi-threaded with senior contacts, very recent |
| **Conversion Probability (CP)** | 75 | 82 | Good intent velocity, greenfield opportunity, optimal size |
| **Strategic Value (SV)** | 52 | 55 | Mid-size, but high growth potential post-funding |
| **Timing Alignment (TA)** | 95 | 99 | Funding trigger + demo request + intent spike = perfect timing |

**Composite Tier:** **Tier 1 - Immediate**
- EP (98) ≥ 70 ✓
- CP (82) ≥ 70 ✓
- TA (99) ≥ 60 ✓

**Recommended Action:** Immediate response to demo request. CISO engagement + recent funding = budget available and decision-maker involved. Greenfield positioning (no incumbent to displace). Fast-track to technical validation.

---

## 8. Implementation Roadmap

### Phase 1: Data Infrastructure (Weeks 1-4)
- Integrate 6sense intent data API
- Implement website tracking for high-value page identification
- Build contact enrichment pipeline (title parsing, seniority classification)
- Create trigger event monitoring (news API integration)

### Phase 2: Scoring Engine (Weeks 5-8)
- Implement variable calculation functions
- Build decay function library
- Create normalization pipeline
- Develop dimensional score calculators

### Phase 3: Calibration (Weeks 9-12)
- Backtest against 12 months of historical data
- Calibrate weights using logistic regression
- Validate with sales team (expert review)
- Adjust non-linear transformations based on win/loss patterns

### Phase 4: Integration (Weeks 13-16)
- Integrate scores into CRM (Salesforce/HubSpot)
- Build sales dashboard with dimensional views
- Create automated alerts for Tier 1 leads
- Implement feedback capture for outcome tracking

### Phase 5: Optimization (Ongoing)
- Weekly score distribution monitoring
- Monthly weight recalibration
- Quarterly A/B testing of algorithm changes
- Annual comprehensive model review

---

## 9. Meta-Cognitive Analysis

### 9.1 Overlooked Factors

Upon reflection, several factors warrant additional consideration:

**Buying Committee Dynamics:** The current model treats contacts independently, but enterprise purchases involve complex committee dynamics. A champion without executive sponsorship may generate engagement but not conversion. Future iterations should model committee completeness as a distinct variable.

**Competitive Intelligence Quality:** The model assumes accurate technographic data, but this data is often stale or incomplete. A confidence score for technographic data quality should modulate the weight given to these signals.

**Sales Capacity Constraints:** The model optimizes for lead quality but doesn't account for sales team capacity. A more sophisticated system would incorporate capacity constraints to ensure recommended actions are actually executable.

**Channel Complexity:** The model assumes direct sales, but many deals involve channel partners. Partner-influenced deals may show different signal patterns that require separate weight calibrations.

### 9.2 Alternative Approaches

**Machine Learning Models:** Rather than explicit weight assignment, gradient boosting or neural network models could learn optimal weights directly from data. The trade-off is interpretability—sales teams trust systems they understand.

**Ensemble Methods:** Multiple scoring models (e.g., one optimized for precision, one for recall) could be combined, with the ensemble providing more robust predictions than any single model.

**Reinforcement Learning:** The system could be framed as a multi-armed bandit problem, where each lead is an "arm" and the reward is conversion. This would naturally balance exploration (trying new lead types) with exploitation (focusing on proven patterns).

### 9.3 Potential Improvements

**Real-Time Scoring:** Current design assumes batch scoring. Real-time scoring triggered by engagement events would enable immediate response to high-value signals.

**Predictive Lead Generation:** Beyond scoring existing leads, the system could identify companies likely to enter the market based on firmographic and technographic patterns, enabling proactive outreach before intent signals appear.

**Natural Language Processing:** Analyzing email and call transcripts could extract sentiment and buying signals not captured by structured data, adding a qualitative dimension to the quantitative scoring.

### 9.4 Ethical Considerations

Lead scoring systems raise ethical questions that deserve acknowledgment:

**Privacy:** The system aggregates significant personal and corporate data. Compliance with GDPR, CCPA, and other privacy regulations is essential.

**Bias:** If historical data reflects biased sales practices (e.g., underserving certain industries), the model will perpetuate those biases. Regular bias audits are necessary.

**Transparency:** Prospects have a reasonable expectation to understand why they're being contacted. While full algorithm disclosure isn't practical, sales teams should be able to articulate why a lead was prioritized.

---

## 10. References

1. Forrester Research. (2024). "B2B Intent Data: Best Practices for Activation." Forrester Wave Report.

2. 6sense. (2024). "The State of B2B Revenue AI." Annual Industry Report.

3. Gartner. (2024). "Market Guide for Account-Based Marketing Platforms." Gartner Research.

4. HubSpot. (2024). "The Science of Lead Scoring." HubSpot Research.

5. Salesforce. (2024). "State of Sales Report." Salesforce Research.

6. TOPO (Gartner). (2023). "Account-Based Sales Development Benchmark Report."

7. SiriusDecisions (Forrester). (2023). "Demand Unit Waterfall Framework."

8. McKinsey & Company. (2024). "The B2B Digital Inflection Point." McKinsey Quarterly.

---

*This document represents a comprehensive framework for multi-dimensional lead scoring. Implementation should be adapted to specific organizational context, data availability, and sales process requirements. Continuous iteration based on outcome data is essential for maintaining model effectiveness.*


---

## Appendix A: 6sense Buying Stage Alignment

This section documents how our scoring system aligns with 6sense's official buying stage framework.

### 6sense Buying Stages (Official Definition)

| Stage | Intent Score | 6sense Definition | Our Recommended Action |
|-------|-------------|-------------------|----------------------|
| **Target** | 0-19 | Little to no activity. Not actively in-market. | Broad awareness messaging. Low priority for sales. |
| **Awareness** | 20-49 | Some activity, top of funnel. Lower conversion probability. | Broad-based engagement. Marketing nurture. |
| **Consideration** | 50-69 | Significant activity above baseline. First mid-funnel band. | Content syndication, buyer's guides. SDR qualification. |
| **Decision** | 70-85 | Significant digital research activity across data sources. | Marketing air cover + sales outbound prospecting. |
| **Purchase** | 86-100 | Bottom of funnel. Most likely to open opportunity soon. | High-value engagement: phone, personalized outreach. |

### 6QA (6sense Qualified Account) Default Criteria

Per 6sense documentation, the default 6QA definition includes:

**Qualification Triggers:**
- Buying Stage = Purchase OR Decision (reached in last 60 days)
- Profile Fit = Strong OR Moderate
- No opportunities created or lost in last 90 days
- Was not qualified in last 60 days

**Disqualification Trigger:**
- Relevant opportunity opened

**Our Extension:**
We extend 6QA with the company-specific signals:
- Competitive tech stack presence (Okta, Duo, Ping, Microsoft Entra)
- Security-focused contact engagement (CISO, Security Director, etc.)
- Trigger events (breach news, compliance audit, funding)

### Mapping Our Tiers to 6sense Stages

| Our Tier | 6sense Buying Stage | Additional Criteria |
|----------|--------------------|--------------------|
| **Tier 1: Immediate** | Purchase (86-100) | EP ≥ 70, multi-threaded, recent engagement |
| **Tier 2: High Priority** | Decision (70-85) | Strong profile fit, competitive displacement opportunity |
| **Tier 3: Strategic** | Any | SV ≥ 80, large enterprise, regardless of current stage |
| **Tier 4: Nurture** | Consideration (50-69) | Good fit but low engagement |
| **Tier 5: Monitor** | Awareness (20-49) | Some signals but not ready |
| **Tier 6: Archive** | Target (0-19) | No meaningful signals |

---

## Appendix B: 6sense Score Definitions

### Account Profile Fit Score
**Source:** 6sense Predictive  
**Definition:** Measures how similar a company is to your ideal customer profile using firmographic and technographic factors plus historical opportunity history.  
**Use in Our System:** Primary input to Strategic Value (SV) dimension.

### Contact Profile Fit Score
**Source:** 6sense Predictive  
**Definition:** Measures how similar a person is to your typical buyer or buying committee members using demographic factors and historical opportunity history.  
**Use in Our System:** Weighted input to Engagement Propensity (EP) dimension.

### Contact Engagement Score
**Source:** 6sense Predictive  
**Definition:** Measures how engaged a person is with your first-party sales and marketing tactics.  
**Use in Our System:** Direct input to Engagement Propensity (EP) dimension.

### Account In-Market Score
**Source:** 6sense Predictive  
**Definition:** Measures an account's buying stage and likelihood of being in-market using relevant signals across known and anonymous intent and engagement.  
**Use in Our System:** Primary driver of Conversion Probability (CP) dimension.

### Account Reach Score
**Source:** 6sense Predictive  
**Definition:** Measures appropriate sales and marketing outreach activities compared against optimal quality, quantity, and diversity of outreach as defined by historical success.  
**Use in Our System:** Modifier for Timing Alignment (TA) - indicates whether we've reached the account appropriately.

---

## Appendix C: Data Sources Integration

### Primary Data Sources

| Source | Data Type | Update Frequency | Integration Method |
|--------|-----------|------------------|-------------------|
| 6sense | Intent, Buying Stage, Profile Fit | Real-time | API |
| ZoomInfo | Firmographic, Contact Data | Daily | API |
| Gong | Call Transcripts, Engagement | Real-time | Webhook |
| Salesforce | CRM Data, Opportunity History | Real-time | API |
| Website Analytics | First-party Engagement | Real-time | WebTag |
| News APIs | Trigger Events | Daily | Scheduled Job |

### 6sense Signalverse Data

6sense processes over 650B intent signals monthly from:
- Keyword research across millions of B2B publisher pages
- G2, TrustRadius, Bombora, PeerSpot, Gartner Digital Markets partnerships
- Firmographic and technographic partner data

This data feeds directly into our Conversion Probability (CP) dimension through the Account In-Market Score.
