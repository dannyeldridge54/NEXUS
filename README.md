<div align="center">

# ⚡ NEXUS

### Neural Exploration eXplorer with Unified Scanning

**Self-learning parameter exploration daemon with anomaly detection.**  
**Works with ANY model, ANY domain, ANY data.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)]()
[![Domain Agnostic](https://img.shields.io/badge/Domain-Agnostic-orange)]()

</div>

---

## What Is NEXUS?

NEXUS is a **domain-agnostic, self-learning daemon** that autonomously explores parameter spaces, detects anomalies, and finds optimal configurations for *any* model you give it.

Think of it as a tireless research assistant that:
1. Systematically scans your parameter space
2. Zooms into promising regions
3. Optimizes with Nelder-Mead
4. Detects anomalies (violations, outliers, gradient spikes, plateaus)
5. Explores unvisited territory (smart pathfinding)
6. Chases interesting anomalies deeper
7. Logs discoveries (degeneracies, multi-modal landscapes)
8. Reports everything in Markdown + JSON

**Set it. Forget it. Wake up to discoveries.**

---

## 🚀 Quick Start

```typescript
import { SmartDaemon, ExplorableModel, Dataset } from 'nexus-daemon';

// Define your model (ANY domain)
const myModel: ExplorableModel = {
  id: 'my-model',
  name: 'My Model',
  description: 'Testing something',
  extraParameters: 2,
  parameters: [
    { name: 'x', min: -10, max: 10, default: 0 },
    { name: 'y', min: -10, max: 10, default: 0 },
  ],
  evaluate(params, data) {
    // Return fitness (lower = better)
    // Could be chi², MSE, loss, error, cost — anything
    return (params.x - 3.14)**2 + (params.y + 2.71)**2;
  },
};

// Define your data
const myData: Dataset = {
  name: 'observations',
  points: [
    { x: 1, observed: 5.2, error: 0.1 },
    { x: 2, observed: 8.7, error: 0.2 },
  ],
};

// Launch daemon
const daemon = new SmartDaemon({ cycleIntervalSec: 10, maxCycles: 50 });
daemon.addModel(myModel).addDataset(myData);
daemon.start();
```

---

## 🧠 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         NEXUS ENGINE                              │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  Grid Scan   │  Adaptive    │  Nelder-Mead │  Smart Explore    │
│  (coarse)    │  Zoom (5x)   │  (precise)   │  (novel regions)  │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬───────────┘
       │              │              │               │
       ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ANOMALY DETECTOR                               │
├────────────────┬───────────────┬──────────────┬─────────────────┤
│  Constraint    │  Z-Score      │  Gradient    │  Plateau        │
│  Violations    │  Outliers     │  Spikes      │  Detection      │
└────────────────┴───────┬───────┴──────────────┴─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ANOMALY CHASER                                 │
│         (explores around high-severity anomalies)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DISCOVERY ENGINE                               │
│  • Parameter degeneracies  • Multi-modal landscapes              │
│  • Correlations            • Novel minima                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Use Cases

| Domain | Model | Fitness Function |
|--------|-------|------------------|
| **Physics** | Cosmological models | χ² against observations |
| **Machine Learning** | Hyperparameter tuning | Validation loss |
| **Engineering** | Design optimization | Cost/performance metric |
| **Finance** | Portfolio optimization | Risk-adjusted returns |
| **Chemistry** | Reaction parameters | Yield maximization |
| **Biology** | Population models | Prediction error |
| **Game Design** | Balance tuning | Player satisfaction metric |
| **Signal Processing** | Filter design | SNR / error rate |

**If your problem has tunable parameters and a fitness function, NEXUS can explore it.**

---

## ⚡ Features

### 🔍 Smart Pathfinding
- Tracks visited regions to avoid redundant exploration
- Bayesian-inspired acquisition: balances explore vs exploit
- Automatically steers toward uncharted territory

### 🚨 4 Anomaly Detectors
| Detector | What It Catches |
|----------|----------------|
| **Constraint Violations** | Domain rules broken (physics, bounds, invariants) |
| **Statistical Outliers** | Z-score > threshold (configurable) |
| **Gradient Spikes** | Sharp fitness changes in parameter space |
| **Plateau Detection** | Large parameter regions with identical fitness |

### 🏃 Anomaly Chasing
When a high-severity anomaly is detected, NEXUS automatically explores the surrounding region with fine-grained sampling to understand the anomaly better.

### 💡 Discovery Engine
- Parameter degeneracy detection (Pearson r > 0.85)
- Multi-modal landscape identification
- Correlation analysis across all parameter pairs

### 📊 Progressive Resolution
Starts coarse, gets finer each cycle. Early cycles find the ballpark; later cycles refine to precision.

### 🖥️ Pro Console Dashboard
```
╔══════════════════════════════════════════════════════════════╗
║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗            ║
║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝            ║
║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗            ║
║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║            ║
║     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║            ║
║     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝            ║
║                                                              ║
║  Neural Exploration eXplorer with Unified Scanning  v1.0.0   ║
║  Self-Learning • Anomaly Detection • Smart Pathfinding       ║
╚══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⟳ Cycle 12 │ Resolution: 140 │ 3:42:15 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ my-model             fitness=0.0012  BIC=4.2  [x=3.141 y=-2.709]
    💡 Parameter degeneracy: x ↔ y
    ⚠  2 anomalies (severity > 0.5)

  ── Cumulative: 12 cycles │ 48,000 evals │ 3 discoveries │ 7 anomalies
```

---

## ⚙️ Configuration

```typescript
const daemon = new SmartDaemon({
  cycleIntervalSec: 30,       // Time between cycles
  baseGridResolution: 30,     // Starting resolution
  maxGridResolution: 200,     // Cap
  resolutionStep: 10,         // Increase per cycle
  maxCycles: 0,               // 0 = infinite
  dashboard: true,            // Pro console output
  autoChaseAnomalies: true,   // Chase high-severity anomalies
  fitnessTarget: 0.001,       // Stop if fitness ≤ this (0 = never)
  outputDir: './reports',     // Where reports go
  scannerConfig: {
    refinementPasses: 5,      // Zoom iterations
    explorationRate: 0.2,     // 20% of evals go to unexplored regions
    anomalyThreshold: 3.0,    // Z-score threshold
    gradientDetection: true,  // Detect sharp gradients
    plateauDetection: true,   // Detect flat regions
  },
});
```

---

## 📦 Zero Dependencies

NEXUS has **zero runtime dependencies**. Pure TypeScript. Runs anywhere Node.js runs.

---

## 💰 Licensing

| Tier | Price | Academic (30% off) |
|------|-------|-------------------|
| **Student** | **FREE** | .edu email required |
| Individual | $99/year | $69/year |
| Team (5) | $399/year | $279/year |
| Enterprise (unlimited) | $1,999/year | $1,399/year |

---

## 📬 Contact

**Danny Lee Eldridge**  
📧 dannyeldridge@proton.me

---

<div align="center">

*NEXUS — Set it. Forget it. Discover.*

© 2012–2026 Danny Lee Eldridge. All rights reserved.

</div>
