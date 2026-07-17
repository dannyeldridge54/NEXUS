/**
 * SmartDaemon — Interfaces
 * Copyright (c) 2012-2026 Danny Lee Eldridge. All rights reserved.
 *
 * Generic interfaces for any domain. Not tied to cosmology.
 */

// ─── Core Model Interface ────────────────────────────────────────────────────

/** Any model that can be evaluated against data implements this interface */
export interface ExplorableModel {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this model does */
  readonly description: string;
  /** Parameters to explore */
  readonly parameters: Parameter[];
  /** Number of extra parameters beyond baseline (for BIC) */
  readonly extraParameters: number;

  /**
   * Evaluate model fitness against data.
   * Lower = better (like chi², MSE, negative log-likelihood, etc.)
   */
  evaluate(params: Record<string, number>, data: Dataset): number;

  /**
   * Optional: check domain-specific constraints.
   * Return violated constraint names (empty = all satisfied).
   */
  checkConstraints?(params: Record<string, number>): ConstraintResult;
}

/** A single tunable parameter */
export interface Parameter {
  name: string;
  min: number;
  max: number;
  default: number;
  description?: string;
  unit?: string;
}

/** Generic dataset — array of data points with values and errors */
export interface Dataset {
  readonly name: string;
  readonly points: DataPoint[];
}

export interface DataPoint {
  /** Independent variable (e.g., x, time, redshift, frequency) */
  x: number;
  /** Observed value */
  observed: number;
  /** Measurement uncertainty (1σ) */
  error: number;
  /** Optional category/type label */
  type?: string;
  /** Optional metadata */
  meta?: Record<string, any>;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface ScanResult {
  params: Record<string, number>;
  fitness: number;
  bic: number;
  constraints: ConstraintResult;
  timestamp: string;
}

export interface ConstraintResult {
  allSatisfied: boolean;
  violations: string[];
}

export interface Anomaly {
  /** What triggered it */
  type: 'constraint_violation' | 'statistical_outlier' | 'gradient_spike' | 'plateau';
  /** Severity 0-1 */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Parameters where detected */
  params: Record<string, number>;
  /** Fitness value */
  fitness: number;
  /** When detected */
  timestamp: string;
}

export interface Discovery {
  /** What was found */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Confidence 0-1 */
  confidence: number;
  /** Evidence */
  evidence: Record<string, number>;
  /** When discovered */
  timestamp: string;
}

export interface ExplorationReport {
  model: string;
  totalEvaluations: number;
  bestFit: ScanResult;
  anomalies: Anomaly[];
  discoveries: Discovery[];
  correlations: ParameterCorrelation[];
  pathHistory: PathNode[];
  elapsedMs: number;
  generatedAt: string;
}

export interface ParameterCorrelation {
  param1: string;
  param2: string;
  pearsonR: number;
  isDegeneracy: boolean;
}

export interface PathNode {
  /** Which phase produced this */
  phase: 'grid' | 'zoom' | 'optimize' | 'explore' | 'anomaly_chase';
  /** Best fitness at this node */
  fitness: number;
  /** Parameters */
  params: Record<string, number>;
  /** How many evaluations in this phase */
  evaluations: number;
}
