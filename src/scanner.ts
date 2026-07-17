/**
 * SmartDaemon — Adaptive Scanner with Anomaly Detection
 * Copyright (c) 2012-2026 Danny Lee Eldridge. All rights reserved.
 *
 * Self-learning parameter exploration engine with:
 * - Grid scanning → Adaptive zooming → Nelder-Mead optimization
 * - Anomaly detection (constraint violations, statistical outliers, gradient spikes)
 * - Discovery logging (correlations, degeneracies, plateaus)
 * - Smart pathfinding (tracks exploration path, avoids revisiting)
 * - Bayesian-inspired acquisition (explore vs exploit balance)
 */

import {
  ExplorableModel, Parameter, Dataset, ScanResult,
  ExplorationReport, Anomaly, Discovery, ParameterCorrelation, PathNode, ConstraintResult
} from './interfaces';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface ScanConfig {
  /** Grid points per dimension */
  gridResolution: number;
  /** Max optimizer iterations */
  maxIterations: number;
  /** Convergence tolerance */
  tolerance: number;
  /** Enable adaptive zoom */
  adaptiveZoom: boolean;
  /** Zoom narrowing factor per pass */
  zoomFactor: number;
  /** Number of zoom refinement passes */
  refinementPasses: number;
  /** Enable anomaly detection */
  detectAnomalies: boolean;
  /** Z-score threshold for outlier detection */
  anomalyThreshold: number;
  /** Min samples before pathfinding activates */
  pathfindMinSamples: number;
  /** Exploration vs exploitation balance (0=exploit, 1=explore) */
  explorationRate: number;
  /** Enable gradient-based anomaly detection */
  gradientDetection: boolean;
  /** Enable plateau detection */
  plateauDetection: boolean;
}

const DEFAULT_CONFIG: ScanConfig = {
  gridResolution: 50,
  maxIterations: 2000,
  tolerance: 1e-8,
  adaptiveZoom: true,
  zoomFactor: 0.4,
  refinementPasses: 5,
  detectAnomalies: true,
  anomalyThreshold: 3.0,
  pathfindMinSamples: 30,
  explorationRate: 0.2,
  gradientDetection: true,
  plateauDetection: true,
};

// ─── Core Scanner ────────────────────────────────────────────────────────────

export class AdaptiveScanner {
  private history: ScanResult[] = [];
  private anomalies: Anomaly[] = [];
  private discoveries: Discovery[] = [];
  private path: PathNode[] = [];
  private visitedRegions: Map<string, number> = new Map();
  private config: ScanConfig;

  constructor(config: Partial<ScanConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Reset all history (for new model scan) */
  reset(): void {
    this.history = [];
    this.anomalies = [];
    this.discoveries = [];
    this.path = [];
    this.visitedRegions.clear();
  }

  /**
   * Full adaptive scan of a model against data.
   */
  async scan(model: ExplorableModel, data: Dataset): Promise<ExplorationReport> {
    const startTime = Date.now();
    this.log(`Scanning ${model.name} (${model.parameters.length} params)...`);

    // Phase 1: Coarse grid scan
    let results = this.gridScan(model, data);
    this.history.push(...results);
    this.recordPath('grid', results);

    // Phase 2: Adaptive zoom refinement
    if (this.config.adaptiveZoom) {
      for (let pass = 0; pass < this.config.refinementPasses; pass++) {
        const centroid = this.weightedCentroid(results);
        const spread = this.parameterSpread(results);

        const zoomedRanges: Record<string, [number, number]> = {};
        for (const p of model.parameters) {
          const center = centroid[p.name] ?? p.default;
          const halfWidth = (spread[p.name] ?? (p.max - p.min) * 0.1) * this.config.zoomFactor;
          zoomedRanges[p.name] = [
            Math.max(p.min, center - halfWidth),
            Math.min(p.max, center + halfWidth),
          ];
        }

        const refined = this.gridScan(model, data, zoomedRanges);
        results = [...results, ...refined];
        this.history.push(...refined);
        this.recordPath('zoom', refined);
        this.log(`  Pass ${pass + 1}: best fitness = ${this.bestResult(results).fitness.toFixed(6)}`);
      }
    }

    // Phase 3: Nelder-Mead optimization
    const best = this.bestResult(results);
    const optimized = this.nelderMead(model, data, best.params);
    if (optimized.fitness < best.fitness) {
      results.push(optimized);
      this.history.push(optimized);
      this.recordPath('optimize', [optimized]);
    }

    // Phase 4: Smart exploration of unexplored regions
    if (this.history.length >= this.config.pathfindMinSamples) {
      const explored = this.smartExplore(model, data);
      if (explored.length > 0) {
        results.push(...explored);
        this.history.push(...explored);
        this.recordPath('explore', explored);
      }
    }

    // Phase 5: Anomaly detection
    if (this.config.detectAnomalies) {
      this.detectAllAnomalies(results, model);

      // Phase 5b: Chase anomalies — explore around interesting regions
      const anomalyResults = this.chaseAnomalies(model, data);
      if (anomalyResults.length > 0) {
        results.push(...anomalyResults);
        this.history.push(...anomalyResults);
        this.recordPath('anomaly_chase', anomalyResults);
      }
    }

    // Phase 6: Discovery logging
    this.logDiscoveries(results, model);

    const finalBest = this.bestResult(this.history);
    const elapsed = Date.now() - startTime;

    this.log(`Complete: ${this.history.length} evaluations in ${(elapsed / 1000).toFixed(1)}s`);
    this.log(`Best fit: fitness = ${finalBest.fitness.toFixed(6)}, BIC = ${finalBest.bic.toFixed(2)}`);
    if (this.anomalies.length > 0) this.log(`Anomalies: ${this.anomalies.length} detected`);
    if (this.discoveries.length > 0) this.log(`Discoveries: ${this.discoveries.length} found`);

    return {
      model: model.id,
      totalEvaluations: this.history.length,
      bestFit: finalBest,
      anomalies: [...this.anomalies],
      discoveries: [...this.discoveries],
      correlations: this.computeCorrelations(results, model),
      pathHistory: [...this.path],
      elapsedMs: elapsed,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Grid Scan ─────────────────────────────────────────────────────────────

  private gridScan(
    model: ExplorableModel,
    data: Dataset,
    ranges?: Record<string, [number, number]>
  ): ScanResult[] {
    const results: ScanResult[] = [];
    const params = model.parameters;
    const n = this.config.gridResolution;

    if (params.length <= 2) {
      const grid = this.buildFullGrid(params, ranges, n);
      for (const point of grid) {
        results.push(this.evaluatePoint(model, data, point));
      }
    } else {
      const samples = this.latinHypercube(params, ranges, n * n);
      for (const point of samples) {
        results.push(this.evaluatePoint(model, data, point));
      }
    }
    return results;
  }

  private buildFullGrid(
    params: Parameter[], ranges: Record<string, [number, number]> | undefined, n: number
  ): Record<string, number>[] {
    const points: Record<string, number>[] = [];

    if (params.length === 1) {
      const p = params[0];
      const [lo, hi] = ranges?.[p.name] ?? [p.min, p.max];
      for (let i = 0; i < n; i++) {
        points.push({ [p.name]: lo + (hi - lo) * i / (n - 1) });
      }
    } else {
      const p1 = params[0], p2 = params[1];
      const [lo1, hi1] = ranges?.[p1.name] ?? [p1.min, p1.max];
      const [lo2, hi2] = ranges?.[p2.name] ?? [p2.min, p2.max];
      const sqrtN = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < sqrtN; i++) {
        for (let j = 0; j < sqrtN; j++) {
          const point: Record<string, number> = {
            [p1.name]: lo1 + (hi1 - lo1) * i / (sqrtN - 1),
            [p2.name]: lo2 + (hi2 - lo2) * j / (sqrtN - 1),
          };
          for (const p of params.slice(2)) {
            point[p.name] = p.default;
          }
          points.push(point);
        }
      }
    }
    return points;
  }

  private latinHypercube(
    params: Parameter[], ranges: Record<string, [number, number]> | undefined, nSamples: number
  ): Record<string, number>[] {
    const points: Record<string, number>[] = [];
    for (let i = 0; i < nSamples; i++) {
      const point: Record<string, number> = {};
      for (const p of params) {
        const [lo, hi] = ranges?.[p.name] ?? [p.min, p.max];
        const binWidth = (hi - lo) / nSamples;
        point[p.name] = lo + binWidth * (i + Math.random());
      }
      points.push(point);
    }
    // Shuffle columns independently
    for (const p of params) {
      const values = points.map(pt => pt[p.name]);
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      points.forEach((pt, idx) => { pt[p.name] = values[idx]; });
    }
    return points;
  }

  // ─── Point Evaluation ──────────────────────────────────────────────────────

  private evaluatePoint(model: ExplorableModel, data: Dataset, params: Record<string, number>): ScanResult {
    const fitness = model.evaluate(params, data);
    const k = model.extraParameters;
    const n = data.points.length;
    const bic = fitness + k * Math.log(n);
    const constraints = model.checkConstraints?.(params) ?? { allSatisfied: true, violations: [] };

    // Track visited region
    const regionKey = this.regionKey(params, model.parameters);
    this.visitedRegions.set(regionKey, (this.visitedRegions.get(regionKey) ?? 0) + 1);

    return { params: { ...params }, fitness, bic, constraints, timestamp: new Date().toISOString() };
  }

  // ─── Nelder-Mead Optimizer ─────────────────────────────────────────────────

  private nelderMead(model: ExplorableModel, data: Dataset, startParams: Record<string, number>): ScanResult {
    const params = model.parameters;
    const n = params.length;

    let simplex: { params: Record<string, number>; fitness: number }[] = [];
    simplex.push({ params: { ...startParams }, fitness: model.evaluate(startParams, data) });

    for (let i = 0; i < n; i++) {
      const p = { ...startParams };
      const range = params[i].max - params[i].min;
      p[params[i].name] += range * 0.05;
      p[params[i].name] = Math.min(params[i].max, Math.max(params[i].min, p[params[i].name]));
      simplex.push({ params: p, fitness: model.evaluate(p, data) });
    }

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      simplex.sort((a, b) => a.fitness - b.fitness);
      const best = simplex[0];
      const worst = simplex[n];
      const secondWorst = simplex[n - 1];

      // Centroid
      const centroid: Record<string, number> = {};
      for (const p of params) {
        centroid[p.name] = simplex.slice(0, n).reduce((s, v) => s + v.params[p.name], 0) / n;
      }

      // Reflection
      const reflected: Record<string, number> = {};
      for (const p of params) {
        reflected[p.name] = this.clamp(2 * centroid[p.name] - worst.params[p.name], p.min, p.max);
      }
      const refFit = model.evaluate(reflected, data);

      if (refFit < best.fitness) {
        // Expansion
        const expanded: Record<string, number> = {};
        for (const p of params) {
          expanded[p.name] = this.clamp(3 * centroid[p.name] - 2 * worst.params[p.name], p.min, p.max);
        }
        const expFit = model.evaluate(expanded, data);
        simplex[n] = expFit < refFit
          ? { params: expanded, fitness: expFit }
          : { params: reflected, fitness: refFit };
      } else if (refFit < secondWorst.fitness) {
        simplex[n] = { params: reflected, fitness: refFit };
      } else {
        // Contraction
        const contracted: Record<string, number> = {};
        for (const p of params) {
          contracted[p.name] = (centroid[p.name] + worst.params[p.name]) / 2;
        }
        const conFit = model.evaluate(contracted, data);
        if (conFit < worst.fitness) {
          simplex[n] = { params: contracted, fitness: conFit };
        } else {
          // Shrink
          for (let i = 1; i <= n; i++) {
            for (const p of params) {
              simplex[i].params[p.name] = (simplex[i].params[p.name] + best.params[p.name]) / 2;
            }
            simplex[i].fitness = model.evaluate(simplex[i].params, data);
          }
        }
      }

      if (simplex[n].fitness - simplex[0].fitness < this.config.tolerance) break;
    }

    simplex.sort((a, b) => a.fitness - b.fitness);
    const finalBest = simplex[0];
    const constraints = model.checkConstraints?.(finalBest.params) ?? { allSatisfied: true, violations: [] };
    const k = model.extraParameters;
    const bic = finalBest.fitness + k * Math.log(data.points.length);
    return { params: finalBest.params, fitness: finalBest.fitness, bic, constraints, timestamp: new Date().toISOString() };
  }

  // ─── Smart Pathfinding (Explore Unvisited Regions) ─────────────────────────

  private smartExplore(model: ExplorableModel, data: Dataset): ScanResult[] {
    const results: ScanResult[] = [];
    const params = model.parameters;
    const nExplore = Math.ceil(this.config.gridResolution * this.config.explorationRate);

    // Generate candidate points biased toward unvisited regions
    for (let i = 0; i < nExplore; i++) {
      let bestCandidate: Record<string, number> | null = null;
      let bestNovelty = -1;

      // Generate 10 random candidates, pick the most novel
      for (let c = 0; c < 10; c++) {
        const candidate: Record<string, number> = {};
        for (const p of params) {
          candidate[p.name] = p.min + Math.random() * (p.max - p.min);
        }
        const key = this.regionKey(candidate, params);
        const visits = this.visitedRegions.get(key) ?? 0;
        const novelty = 1 / (1 + visits);

        if (novelty > bestNovelty) {
          bestNovelty = novelty;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        results.push(this.evaluatePoint(model, data, bestCandidate));
      }
    }

    // If any exploration point beat the current best, zoom into it
    const currentBest = this.bestResult(this.history);
    const explorationBest = this.bestResult(results);
    if (results.length > 0 && explorationBest.fitness < currentBest.fitness * 0.95) {
      this.log(`  ★ Exploration found better region: ${explorationBest.fitness.toFixed(6)}`);
    }

    return results;
  }

  // ─── Anomaly Detection ─────────────────────────────────────────────────────

  private detectAllAnomalies(results: ScanResult[], model: ExplorableModel): void {
    // 1. Constraint violations
    for (const r of results) {
      if (!r.constraints.allSatisfied) {
        this.anomalies.push({
          type: 'constraint_violation',
          severity: Math.min(1, r.constraints.violations.length * 0.3),
          description: `Constraints violated: ${r.constraints.violations.join(', ')}`,
          params: r.params,
          fitness: r.fitness,
          timestamp: r.timestamp,
        });
      }
    }

    // 2. Statistical outliers (Z-score)
    const fitnessValues = results.map(r => r.fitness);
    const mean = fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length;
    const std = Math.sqrt(fitnessValues.reduce((s, v) => s + (v - mean) ** 2, 0) / fitnessValues.length);

    if (std > 0) {
      for (const r of results) {
        const zScore = Math.abs(r.fitness - mean) / std;
        if (zScore > this.config.anomalyThreshold) {
          this.anomalies.push({
            type: 'statistical_outlier',
            severity: Math.min(1, zScore / 10),
            description: `Statistical outlier: Z-score = ${zScore.toFixed(2)} (threshold: ${this.config.anomalyThreshold})`,
            params: r.params,
            fitness: r.fitness,
            timestamp: r.timestamp,
          });
        }
      }
    }

    // 3. Gradient spikes
    if (this.config.gradientDetection && results.length > 10) {
      this.detectGradientSpikes(results, model);
    }

    // 4. Plateaus
    if (this.config.plateauDetection && results.length > 20) {
      this.detectPlateaus(results, model);
    }
  }

  private detectGradientSpikes(results: ScanResult[], model: ExplorableModel): void {
    // Sort by first parameter and check for sudden jumps
    const sorted = [...results].sort((a, b) => {
      const p = model.parameters[0].name;
      return a.params[p] - b.params[p];
    });

    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i].fitness - sorted[i - 1].fitness);
      const paramDiff = Math.abs(
        sorted[i].params[model.parameters[0].name] - sorted[i - 1].params[model.parameters[0].name]
      );
      if (paramDiff > 0) {
        const gradient = diff / paramDiff;
        const avgFitness = (sorted[i].fitness + sorted[i - 1].fitness) / 2;
        if (gradient > avgFitness * 10) {
          this.anomalies.push({
            type: 'gradient_spike',
            severity: Math.min(1, gradient / (avgFitness * 100)),
            description: `Sharp gradient detected: Δfitness/Δparam = ${gradient.toFixed(2)}`,
            params: sorted[i].params,
            fitness: sorted[i].fitness,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  private detectPlateaus(results: ScanResult[], model: ExplorableModel): void {
    // Detect regions where fitness barely changes despite parameter variation
    const sorted = [...results].sort((a, b) => a.fitness - b.fitness);
    const topN = sorted.slice(0, Math.ceil(sorted.length * 0.1));

    if (topN.length < 5) return;

    const fitnessRange = topN[topN.length - 1].fitness - topN[0].fitness;
    const avgFitness = topN.reduce((s, r) => s + r.fitness, 0) / topN.length;

    // If top 10% of results are within 0.1% of each other → plateau
    if (fitnessRange < avgFitness * 0.001 && avgFitness > 0) {
      // Check parameter spread in the plateau
      for (const p of model.parameters) {
        const values = topN.map(r => r.params[p.name]);
        const pMin = Math.min(...values);
        const pMax = Math.max(...values);
        const pRange = p.max - p.min;

        if ((pMax - pMin) > pRange * 0.3) {
          this.anomalies.push({
            type: 'plateau',
            severity: 0.6,
            description: `Plateau: ${p.name} varies ${((pMax - pMin) / pRange * 100).toFixed(0)}% of range with <0.1% fitness change`,
            params: topN[0].params,
            fitness: topN[0].fitness,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  // ─── Anomaly Chasing ───────────────────────────────────────────────────────

  private chaseAnomalies(model: ExplorableModel, data: Dataset): ScanResult[] {
    const results: ScanResult[] = [];
    const highSeverity = this.anomalies.filter(a => a.severity > 0.5);

    // Explore around high-severity anomalies
    for (const anomaly of highSeverity.slice(0, 5)) {
      for (let i = 0; i < 10; i++) {
        const point: Record<string, number> = {};
        for (const p of model.parameters) {
          const center = anomaly.params[p.name];
          const jitter = (p.max - p.min) * 0.02 * (Math.random() - 0.5);
          point[p.name] = this.clamp(center + jitter, p.min, p.max);
        }
        results.push(this.evaluatePoint(model, data, point));
      }
    }

    return results;
  }

  // ─── Discovery Logging ─────────────────────────────────────────────────────

  private logDiscoveries(results: ScanResult[], model: ExplorableModel): void {
    // Check for parameter correlations
    const correlations = this.computeCorrelations(results, model);
    for (const corr of correlations) {
      if (corr.isDegeneracy) {
        this.discoveries.push({
          title: `Parameter degeneracy: ${corr.param1} ↔ ${corr.param2}`,
          description: `Strong correlation (r=${corr.pearsonR.toFixed(3)}) suggests these parameters are degenerate.`,
          confidence: Math.abs(corr.pearsonR),
          evidence: { pearsonR: corr.pearsonR },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check for multi-modal fitness landscape
    const sorted = [...results].sort((a, b) => a.fitness - b.fitness);
    const best = sorted[0].fitness;
    const localMinima = sorted.filter(r => {
      return r.fitness < best * 1.1 && this.distance(r.params, sorted[0].params, model.parameters) > 0.2;
    });

    if (localMinima.length > 0) {
      this.discoveries.push({
        title: `Multi-modal landscape: ${localMinima.length + 1} local minima found`,
        description: `Multiple well-separated regions with near-optimal fitness detected.`,
        confidence: Math.min(1, localMinima.length * 0.3),
        evidence: { nMinima: localMinima.length + 1, bestFitness: best },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─── Correlations ──────────────────────────────────────────────────────────

  private computeCorrelations(results: ScanResult[], model: ExplorableModel): ParameterCorrelation[] {
    const correlations: ParameterCorrelation[] = [];
    const params = model.parameters;

    for (let i = 0; i < params.length; i++) {
      for (let j = i + 1; j < params.length; j++) {
        const xs = results.map(r => r.params[params[i].name]);
        const ys = results.map(r => r.params[params[j].name]);
        const r = this.pearson(xs, ys);
        correlations.push({
          param1: params[i].name,
          param2: params[j].name,
          pearsonR: r,
          isDegeneracy: Math.abs(r) > 0.85,
        });
      }
    }
    return correlations;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private weightedCentroid(results: ScanResult[]): Record<string, number> {
    if (results.length === 0) return {};
    const minFit = Math.min(...results.map(r => r.fitness));
    const weights = results.map(r => Math.exp(-0.5 * (r.fitness - minFit)));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const centroid: Record<string, number> = {};
    const names = Object.keys(results[0].params);
    for (const name of names) {
      centroid[name] = results.reduce((s, r, i) => s + r.params[name] * weights[i], 0) / totalW;
    }
    return centroid;
  }

  private parameterSpread(results: ScanResult[]): Record<string, number> {
    const centroid = this.weightedCentroid(results);
    const spread: Record<string, number> = {};
    for (const name of Object.keys(results[0].params)) {
      const values = results.map(r => r.params[name]);
      const mean = centroid[name];
      spread[name] = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    }
    return spread;
  }

  private bestResult(results: ScanResult[]): ScanResult {
    return results.reduce((best, r) => r.fitness < best.fitness ? r : best, results[0]);
  }

  private regionKey(params: Record<string, number>, paramDefs: Parameter[]): string {
    // Discretize into 10 bins per parameter for region tracking
    return paramDefs.map(p => {
      const normalized = (params[p.name] - p.min) / (p.max - p.min);
      return Math.floor(normalized * 10);
    }).join(',');
  }

  private distance(a: Record<string, number>, b: Record<string, number>, params: Parameter[]): number {
    let sum = 0;
    for (const p of params) {
      const range = p.max - p.min;
      sum += ((a[p.name] - b[p.name]) / range) ** 2;
    }
    return Math.sqrt(sum / params.length);
  }

  private pearson(xs: number[], ys: number[]): number {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom === 0 ? 0 : num / denom;
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  private recordPath(phase: PathNode['phase'], results: ScanResult[]): void {
    if (results.length === 0) return;
    const best = this.bestResult(results);
    this.path.push({ phase, fitness: best.fitness, params: best.params, evaluations: results.length });
  }

  private log(msg: string): void {
    console.log(`[NEXUS] ${msg}`);
  }
}
