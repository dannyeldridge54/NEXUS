# SmartDaemon — Final Report

**Generated:** 2026-07-17T19:16:21.842Z
**Cycles:** 15
**Total Evaluations:** 259,670
**Anomalies:** 292515
**Discoveries:** 0

## Best Fits

| Model | Fitness | BIC | Parameters |
|-------|---------|-----|------------|
| beam-optimizer | 4.3781 | 4.38 | width=10.0328, height=110.7423, length=501.9719 |

## Anomalies (207835 high-severity of 292515 total)

- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_609MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_398MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_647MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_793MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_1641MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_328MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_276MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_278MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_675MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_4676MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: deflection_exceeded, aspect_ratio_too_high
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_467MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_1317MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_605MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_470MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_555MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_534MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_3423MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: stress_exceeded_2239MPa, deflection_exceeded
- [constraint_violation] severity=0.60: Constraints violated: deflection_exceeded, aspect_ratio_too_high

## Exploration Path

- **grid**: 3600 evals → fitness=5.7675
- **zoom**: 3600 evals → fitness=4.8705
- **zoom**: 3600 evals → fitness=4.8352
- **zoom**: 3600 evals → fitness=4.6959
- **zoom**: 3600 evals → fitness=4.6732
- **zoom**: 3600 evals → fitness=4.7673
- **optimize**: 1 evals → fitness=4.4281
- **explore**: 12 evals → fitness=78.2692
- **anomaly_chase**: 50 evals → fitness=725451.7902