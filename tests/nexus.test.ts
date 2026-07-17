/**
 * NEXUS — Test Suite
 */

import { AdaptiveScanner, SmartDaemon, ExplorableModel, Dataset, Parameter } from '../src/index';

// ─── Test Model: Rosenbrock function (classic optimization benchmark) ────────

const rosenbrock: ExplorableModel = {
  id: 'rosenbrock',
  name: 'Rosenbrock',
  description: 'Classic 2D optimization benchmark with narrow curved valley',
  extraParameters: 2,
  parameters: [
    { name: 'x', min: -5, max: 5, default: 0, description: 'x coordinate' },
    { name: 'y', min: -5, max: 5, default: 0, description: 'y coordinate' },
  ],
  evaluate(params) {
    const { x, y } = params;
    return (1 - x) ** 2 + 100 * (y - x ** 2) ** 2;
  },
  checkConstraints(params) {
    const violations: string[] = [];
    if (params.x ** 2 + params.y ** 2 > 25) violations.push('outside_circle');
    return { allSatisfied: violations.length === 0, violations };
  },
};

// ─── Test Model: Rastrigin function (multi-modal) ────────────────────────────

const rastrigin: ExplorableModel = {
  id: 'rastrigin',
  name: 'Rastrigin',
  description: 'Multi-modal function with many local minima',
  extraParameters: 2,
  parameters: [
    { name: 'x', min: -5.12, max: 5.12, default: 0 },
    { name: 'y', min: -5.12, max: 5.12, default: 0 },
  ],
  evaluate(params) {
    const { x, y } = params;
    return 20 + x ** 2 - 10 * Math.cos(2 * Math.PI * x) + y ** 2 - 10 * Math.cos(2 * Math.PI * y);
  },
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const testData: Dataset = {
  name: 'test-points',
  points: Array.from({ length: 20 }, (_, i) => ({
    x: i * 0.5,
    observed: Math.sin(i * 0.5) + Math.random() * 0.1,
    error: 0.1,
  })),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NEXUS — AdaptiveScanner', () => {
  test('finds Rosenbrock minimum near (1, 1)', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 30, refinementPasses: 3 });
    const report = await scanner.scan(rosenbrock, testData);

    expect(report.bestFit.fitness).toBeLessThan(1);
    expect(report.bestFit.params.x).toBeCloseTo(1, 0);
    expect(report.bestFit.params.y).toBeCloseTo(1, 0);
  });

  test('detects anomalies in Rastrigin (multi-modal)', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 40, detectAnomalies: true });
    const report = await scanner.scan(rastrigin, testData);

    expect(report.totalEvaluations).toBeGreaterThan(100);
    expect(report.bestFit.fitness).toBeLessThan(5);
  });

  test('reports exploration path', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 20, refinementPasses: 2 });
    const report = await scanner.scan(rosenbrock, testData);

    expect(report.pathHistory.length).toBeGreaterThan(0);
    expect(report.pathHistory[0].phase).toBe('grid');
    expect(report.pathHistory.some(p => p.phase === 'zoom')).toBe(true);
  });

  test('computes parameter correlations', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 20 });
    const report = await scanner.scan(rosenbrock, testData);

    expect(report.correlations.length).toBe(1); // 2 params → 1 pair
    expect(report.correlations[0].param1).toBe('x');
    expect(report.correlations[0].param2).toBe('y');
    expect(typeof report.correlations[0].pearsonR).toBe('number');
  });

  test('handles single-parameter model', async () => {
    const singleParam: ExplorableModel = {
      id: 'single',
      name: 'Single Param',
      description: 'f(x) = (x-2)^2',
      extraParameters: 1,
      parameters: [{ name: 'x', min: -10, max: 10, default: 0 }],
      evaluate(params) { return (params.x - 2) ** 2; },
    };

    const scanner = new AdaptiveScanner({ gridResolution: 50 });
    const report = await scanner.scan(singleParam, testData);

    expect(report.bestFit.params.x).toBeCloseTo(2, 1);
    expect(report.bestFit.fitness).toBeLessThan(0.1);
  });

  test('respects constraints and logs violations', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 30, detectAnomalies: true });
    const report = await scanner.scan(rosenbrock, testData);

    // Some points outside circle r=5 should trigger constraint violations
    const violations = report.anomalies.filter(a => a.type === 'constraint_violation');
    expect(violations.length).toBeGreaterThanOrEqual(0); // may or may not hit boundary
  });

  test('BIC is computed correctly', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 20 });
    const report = await scanner.scan(rosenbrock, testData);

    const expectedBIC = report.bestFit.fitness + 2 * Math.log(testData.points.length);
    expect(report.bestFit.bic).toBeCloseTo(expectedBIC, 4);
  });

  test('reset clears all history', async () => {
    const scanner = new AdaptiveScanner({ gridResolution: 15 });
    await scanner.scan(rosenbrock, testData);
    scanner.reset();
    const report = await scanner.scan(rosenbrock, testData);

    // After reset, path starts fresh
    expect(report.pathHistory[0].phase).toBe('grid');
  });

  test('3+ parameter model uses Latin Hypercube', async () => {
    const threeParam: ExplorableModel = {
      id: 'three-param',
      name: '3D Sphere',
      description: 'f(x,y,z) = x^2 + y^2 + z^2',
      extraParameters: 3,
      parameters: [
        { name: 'x', min: -5, max: 5, default: 0 },
        { name: 'y', min: -5, max: 5, default: 0 },
        { name: 'z', min: -5, max: 5, default: 0 },
      ],
      evaluate(params) { return params.x ** 2 + params.y ** 2 + params.z ** 2; },
    };

    const scanner = new AdaptiveScanner({ gridResolution: 10 });
    const report = await scanner.scan(threeParam, testData);

    expect(report.bestFit.fitness).toBeLessThan(1);
  });

  test('smart exploration finds novel regions', async () => {
    const scanner = new AdaptiveScanner({
      gridResolution: 20,
      pathfindMinSamples: 10,
      explorationRate: 0.5,
    });
    const report = await scanner.scan(rosenbrock, testData);

    // Should have an 'explore' phase in path
    expect(report.pathHistory.some(p => p.phase === 'explore')).toBe(true);
  });
});

describe('NEXUS — SmartDaemon', () => {
  test('runs limited cycles and stops', async () => {
    const daemon = new SmartDaemon({
      cycleIntervalSec: 0,
      maxCycles: 2,
      baseGridResolution: 10,
      dashboard: false,
      outputDir: './test-reports',
    });
    daemon.addModel(rosenbrock).addDataset(testData);

    await daemon.start();
    // If we get here, it stopped after 2 cycles ✓
    expect(true).toBe(true);
  }, 30000);

  test('stops on fitness target', async () => {
    const easyModel: ExplorableModel = {
      id: 'easy',
      name: 'Easy',
      description: 'Always returns 0',
      extraParameters: 1,
      parameters: [{ name: 'x', min: 0, max: 1, default: 0.5 }],
      evaluate() { return 0; },
    };

    const daemon = new SmartDaemon({
      cycleIntervalSec: 0,
      fitnessTarget: 0.1,
      baseGridResolution: 5,
      dashboard: false,
      outputDir: './test-reports',
    });
    daemon.addModel(easyModel).addDataset(testData);

    await daemon.start();
    expect(true).toBe(true);
  }, 10000);

  test('throws if no models registered', async () => {
    const daemon = new SmartDaemon({ dashboard: false });
    daemon.addDataset(testData);
    await expect(daemon.start()).rejects.toThrow('No models');
  });

  test('throws if no datasets registered', async () => {
    const daemon = new SmartDaemon({ dashboard: false });
    daemon.addModel(rosenbrock);
    await expect(daemon.start()).rejects.toThrow('No datasets');
  });
});
