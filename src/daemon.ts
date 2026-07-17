/**
 * SmartDaemon — Set-and-Forget Daemon
 * Copyright (c) 2012-2026 Danny Lee Eldridge. All rights reserved.
 *
 * Continuously scans models, detects anomalies, chases discoveries,
 * and produces reports. Runs indefinitely with progressive resolution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExplorableModel, Dataset, ExplorationReport, Anomaly, Discovery } from './interfaces';
import { AdaptiveScanner, ScanConfig } from './scanner';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface DaemonConfig {
  /** Seconds between cycles */
  cycleIntervalSec: number;
  /** Starting grid resolution */
  baseGridResolution: number;
  /** Maximum resolution (caps progressive increase) */
  maxGridResolution: number;
  /** Resolution increase per cycle */
  resolutionStep: number;
  /** Output directory */
  outputDir: string;
  /** Scanner config overrides */
  scannerConfig: Partial<ScanConfig>;
  /** Max cycles (0 = infinite) */
  maxCycles: number;
  /** Enable real-time console dashboard */
  dashboard: boolean;
  /** Auto-chase anomalies between cycles */
  autoChaseAnomalies: boolean;
  /** Stop if fitness drops below this (0 = never stop) */
  fitnessTarget: number;
}

const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  cycleIntervalSec: 30,
  baseGridResolution: 30,
  maxGridResolution: 200,
  resolutionStep: 10,
  outputDir: './reports',
  scannerConfig: {},
  maxCycles: 0,
  dashboard: true,
  autoChaseAnomalies: true,
  fitnessTarget: 0,
};

// ─── Daemon ──────────────────────────────────────────────────────────────────

export class SmartDaemon {
  private config: DaemonConfig;
  private running = false;
  private cycle = 0;
  private models: ExplorableModel[] = [];
  private datasets: Dataset[] = [];
  private allReports: ExplorationReport[] = [];
  private globalBest: Map<string, ExplorationReport> = new Map();
  private totalAnomalies: Anomaly[] = [];
  private totalDiscoveries: Discovery[] = [];

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = { ...DEFAULT_DAEMON_CONFIG, ...config };
  }

  /** Register a model to scan */
  addModel(model: ExplorableModel): this {
    this.models.push(model);
    return this;
  }

  /** Register a dataset */
  addDataset(dataset: Dataset): this {
    this.datasets.push(dataset);
    return this;
  }

  /** Start the daemon */
  async start(): Promise<void> {
    if (this.models.length === 0) throw new Error('No models registered. Call addModel() first.');
    if (this.datasets.length === 0) throw new Error('No datasets registered. Call addDataset() first.');

    this.running = true;
    const outDir = path.resolve(this.config.outputDir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(path.join(outDir, 'data'), { recursive: true });

    this.printBanner();

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    while (this.running) {
      await this.runCycle();
      if (!this.running) break;
      if (this.config.maxCycles > 0 && this.cycle >= this.config.maxCycles) {
        this.log('Max cycles reached. Stopping.');
        break;
      }
      // Check fitness target
      if (this.config.fitnessTarget > 0) {
        const anyReached = [...this.globalBest.values()].some(
          r => r.bestFit.fitness <= this.config.fitnessTarget
        );
        if (anyReached) {
          this.log(`★ Fitness target ${this.config.fitnessTarget} reached! Stopping.`);
          break;
        }
      }
      await this.sleep(this.config.cycleIntervalSec * 1000);
    }

    this.saveFinalReport();
    this.log('Shutdown complete.');
  }

  stop(): void {
    this.log('Stopping after current cycle...');
    this.running = false;
  }

  // ─── Cycle ─────────────────────────────────────────────────────────────────

  private async runCycle(): Promise<void> {
    this.cycle++;
    const resolution = Math.min(
      this.config.maxGridResolution,
      this.config.baseGridResolution + this.config.resolutionStep * (this.cycle - 1)
    );

    if (this.config.dashboard) this.printCycleHeader(resolution);

    // Combine all datasets
    const combined: Dataset = {
      name: 'combined',
      points: this.datasets.flatMap(d => d.points),
    };

    const scanner = new AdaptiveScanner({
      gridResolution: resolution,
      ...this.config.scannerConfig,
    });

    const cycleResults: ExplorationReport[] = [];

    for (const model of this.models) {
      scanner.reset();
      try {
        const report = await scanner.scan(model, combined);
        cycleResults.push(report);
        this.allReports.push(report);

        // Update global best
        const existing = this.globalBest.get(model.id);
        if (!existing || report.bestFit.fitness < existing.bestFit.fitness) {
          this.globalBest.set(model.id, report);
        }

        // Collect anomalies and discoveries
        this.totalAnomalies.push(...report.anomalies);
        this.totalDiscoveries.push(...report.discoveries);

        if (this.config.dashboard) this.printModelResult(report);
      } catch (err: any) {
        console.error(`  ✗ ${model.name}: ${err.message}`);
      }
    }

    this.saveCycleReport(cycleResults);
    if (this.config.dashboard) this.printCycleSummary();
  }

  // ─── Reports ───────────────────────────────────────────────────────────────

  private saveCycleReport(results: ExplorationReport[]): void {
    const outDir = path.resolve(this.config.outputDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    // Per-cycle JSON
    fs.writeFileSync(
      path.join(outDir, 'data', `cycle-${this.cycle}-${ts}.json`),
      JSON.stringify({ cycle: this.cycle, timestamp: new Date().toISOString(), results }, null, 2)
    );

    // Summary JSON
    fs.writeFileSync(
      path.join(outDir, 'daemon-summary.json'),
      JSON.stringify(this.buildSummary(), null, 2)
    );
  }

  private saveFinalReport(): void {
    const outDir = path.resolve(this.config.outputDir);
    const summary = this.buildSummary();

    // Markdown report
    const lines: string[] = [
      '# SmartDaemon — Final Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Cycles:** ${this.cycle}`,
      `**Total Evaluations:** ${this.allReports.reduce((s, r) => s + r.totalEvaluations, 0).toLocaleString()}`,
      `**Anomalies:** ${this.totalAnomalies.length}`,
      `**Discoveries:** ${this.totalDiscoveries.length}`,
      '',
      '## Best Fits',
      '',
      '| Model | Fitness | BIC | Parameters |',
      '|-------|---------|-----|------------|',
    ];

    for (const [id, report] of this.globalBest) {
      const params = Object.entries(report.bestFit.params)
        .map(([k, v]) => `${k}=${v.toFixed(4)}`)
        .join(', ');
      lines.push(`| ${id} | ${report.bestFit.fitness.toFixed(4)} | ${report.bestFit.bic.toFixed(2)} | ${params} |`);
    }

    if (this.totalDiscoveries.length > 0) {
      lines.push('', '## Discoveries', '');
      for (const d of this.totalDiscoveries.slice(0, 20)) {
        lines.push(`- **${d.title}** (confidence: ${(d.confidence * 100).toFixed(0)}%)`);
        lines.push(`  ${d.description}`);
      }
    }

    if (this.totalAnomalies.length > 0) {
      const high = this.totalAnomalies.filter(a => a.severity > 0.5);
      lines.push('', `## Anomalies (${high.length} high-severity of ${this.totalAnomalies.length} total)`, '');
      for (const a of high.slice(0, 20)) {
        lines.push(`- [${a.type}] severity=${a.severity.toFixed(2)}: ${a.description}`);
      }
    }

    lines.push('', '## Exploration Path', '');
    const latestReport = this.allReports[this.allReports.length - 1];
    if (latestReport?.pathHistory) {
      for (const node of latestReport.pathHistory) {
        lines.push(`- **${node.phase}**: ${node.evaluations} evals → fitness=${node.fitness.toFixed(4)}`);
      }
    }

    fs.writeFileSync(path.join(outDir, 'daemon-report.md'), lines.join('\n'));
  }

  private buildSummary(): any {
    return {
      lastUpdated: new Date().toISOString(),
      totalCycles: this.cycle,
      totalEvaluations: this.allReports.reduce((s, r) => s + r.totalEvaluations, 0),
      totalAnomalies: this.totalAnomalies.length,
      totalDiscoveries: this.totalDiscoveries.length,
      bestByModel: Object.fromEntries(
        [...this.globalBest].map(([id, r]) => [id, {
          fitness: r.bestFit.fitness,
          bic: r.bestFit.bic,
          params: r.bestFit.params,
        }])
      ),
    };
  }

  // ─── Console Dashboard ─────────────────────────────────────────────────────

  private printBanner(): void {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗            ║');
    console.log('║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝            ║');
    console.log('║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗            ║');
    console.log('║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║            ║');
    console.log('║     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║            ║');
    console.log('║     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝            ║');
    console.log('║                                                              ║');
    console.log('║  Neural Exploration eXplorer with Unified Scanning  v1.0.0   ║');
    console.log('║  Self-Learning • Anomaly Detection • Smart Pathfinding       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Models:     ${this.models.map(m => m.name).join(', ')}`);
    console.log(`  Datasets:   ${this.datasets.map(d => `${d.name} (${d.points.length} pts)`).join(', ')}`);
    console.log(`  Output:     ${path.resolve(this.config.outputDir)}`);
    console.log(`  Interval:   ${this.config.cycleIntervalSec}s`);
    console.log(`  Max cycles: ${this.config.maxCycles || '∞'}`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  }

  private printCycleHeader(resolution: number): void {
    console.log(`\n${'━'.repeat(64)}`);
    console.log(`  ⟳ Cycle ${this.cycle} │ Resolution: ${resolution} │ ${new Date().toLocaleTimeString()}`);
    console.log(`${'━'.repeat(64)}`);
  }

  private printModelResult(report: ExplorationReport): void {
    const pStr = Object.entries(report.bestFit.params)
      .map(([k, v]) => `${k}=${v.toFixed(3)}`)
      .join(' ');
    console.log(`  ✓ ${report.model.padEnd(20)} fitness=${report.bestFit.fitness.toFixed(4)}  BIC=${report.bestFit.bic.toFixed(1)}  [${pStr}]`);

    if (report.discoveries.length > 0) {
      for (const d of report.discoveries) {
        console.log(`    💡 ${d.title}`);
      }
    }
    if (report.anomalies.length > 0) {
      const high = report.anomalies.filter(a => a.severity > 0.5);
      if (high.length > 0) console.log(`    ⚠  ${high.length} anomalies (severity > 0.5)`);
    }
  }

  private printCycleSummary(): void {
    const totalEvals = this.allReports.reduce((s, r) => s + r.totalEvaluations, 0);
    console.log(`\n  ── Cumulative: ${this.cycle} cycles │ ${totalEvals.toLocaleString()} evals │ ${this.totalDiscoveries.length} discoveries │ ${this.totalAnomalies.length} anomalies`);

    if (this.globalBest.size > 1) {
      const ranked = [...this.globalBest.entries()].sort((a, b) => a[1].bestFit.bic - b[1].bestFit.bic);
      console.log(`  ── Ranking: ${ranked.map(([id], i) => `${i + 1}.${id}`).join(' > ')}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(msg: string): void {
    console.log(`\n[NEXUS] ${msg}`);
  }
}
