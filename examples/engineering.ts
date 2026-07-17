/**
 * NEXUS — Example: Engineering Design Optimization
 *
 * Optimize a simple beam design: minimize weight while maintaining
 * stress and deflection constraints.
 */

import { SmartDaemon, ExplorableModel, Dataset } from '../src/index';

const beamDesign: ExplorableModel = {
  id: 'beam-optimizer',
  name: 'Cantilever Beam Design',
  description: 'Minimize beam weight subject to stress and deflection constraints',
  extraParameters: 3,
  parameters: [
    { name: 'width', min: 10, max: 200, default: 50, unit: 'mm' },
    { name: 'height', min: 10, max: 300, default: 100, unit: 'mm' },
    { name: 'length', min: 500, max: 3000, default: 1000, unit: 'mm' },
  ],
  evaluate(params) {
    const { width, height, length } = params;
    // Weight (minimize)
    const volume = width * height * length;
    const weight = volume * 7.85e-6; // steel density kg/mm³

    // Stress penalty (must be < 250 MPa)
    const F = 10000; // 10kN load
    const I = (width * height ** 3) / 12;
    const stress = (F * length * height / 2) / I;
    const stressPenalty = stress > 250 ? (stress - 250) ** 2 : 0;

    // Deflection penalty (must be < L/200)
    const E = 200000; // Steel E in MPa
    const deflection = (F * length ** 3) / (3 * E * I);
    const maxDeflection = length / 200;
    const deflPenalty = deflection > maxDeflection ? (deflection - maxDeflection) ** 2 * 1000 : 0;

    return weight + stressPenalty + deflPenalty;
  },
  checkConstraints(params) {
    const { width, height, length } = params;
    const violations: string[] = [];
    const F = 10000;
    const I = (width * height ** 3) / 12;
    const stress = (F * length * height / 2) / I;
    const E = 200000;
    const deflection = (F * length ** 3) / (3 * E * I);

    if (stress > 250) violations.push(`stress_exceeded_${stress.toFixed(0)}MPa`);
    if (deflection > length / 200) violations.push(`deflection_exceeded`);
    if (height / width > 10) violations.push('aspect_ratio_too_high');

    return { allSatisfied: violations.length === 0, violations };
  },
};

const specs: Dataset = {
  name: 'design-specs',
  points: [{ x: 0, observed: 0, error: 1 }],
};

const daemon = new SmartDaemon({
  cycleIntervalSec: 3,
  maxCycles: 15,
  baseGridResolution: 15,
  maxGridResolution: 60,
  dashboard: true,
  outputDir: './reports/beam-design',
});

daemon.addModel(beamDesign).addDataset(specs);
daemon.start().then(() => {
  console.log('\n✅ Beam optimization complete! Check ./reports/beam-design/');
});
