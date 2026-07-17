/**
 * NEXUS — Example: Hyperparameter Tuning for ML Model
 *
 * Shows how NEXUS can optimize learning rate, batch size, and dropout
 * for a neural network (simulated fitness function here).
 */

import { SmartDaemon, ExplorableModel, Dataset } from '../src/index';

// Simulated ML training fitness (lower = better validation loss)
const mlModel: ExplorableModel = {
  id: 'neural-net-tuning',
  name: 'Neural Network Hyperparams',
  description: 'Optimize learning rate, batch size, dropout for best validation loss',
  extraParameters: 3,
  parameters: [
    { name: 'learning_rate', min: 0.0001, max: 0.1, default: 0.001, description: 'Learning rate' },
    { name: 'batch_size', min: 8, max: 256, default: 32, description: 'Batch size' },
    { name: 'dropout', min: 0, max: 0.8, default: 0.3, description: 'Dropout rate' },
  ],
  evaluate(params) {
    const { learning_rate, batch_size, dropout } = params;
    // Simulated loss landscape (real usage would call actual training)
    const lr_penalty = (Math.log10(learning_rate) + 2.5) ** 2;
    const bs_penalty = ((batch_size - 64) / 100) ** 2;
    const drop_penalty = (dropout - 0.4) ** 2;
    const noise = Math.random() * 0.01;
    return 0.5 + lr_penalty * 0.3 + bs_penalty * 0.2 + drop_penalty * 0.5 + noise;
  },
  checkConstraints(params) {
    const violations: string[] = [];
    if (params.learning_rate > 0.01 && params.dropout < 0.2) {
      violations.push('high_lr_low_dropout_unstable');
    }
    return { allSatisfied: violations.length === 0, violations };
  },
};

// Dummy dataset (NEXUS needs one, but our evaluate() is self-contained)
const validationData: Dataset = {
  name: 'validation-metrics',
  points: [{ x: 0, observed: 0.5, error: 0.1 }],
};

// Run NEXUS
const daemon = new SmartDaemon({
  cycleIntervalSec: 5,
  maxCycles: 10,
  baseGridResolution: 20,
  maxGridResolution: 80,
  resolutionStep: 5,
  dashboard: true,
  outputDir: './reports/ml-tuning',
  scannerConfig: {
    explorationRate: 0.3,
    anomalyThreshold: 2.5,
  },
});

daemon.addModel(mlModel).addDataset(validationData);
daemon.start().then(() => {
  console.log('\n✅ Hyperparameter optimization complete! Check ./reports/ml-tuning/');
});
