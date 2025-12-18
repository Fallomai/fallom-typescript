/**
 * Fallom Evals - Run LLM evaluations locally using G-Eval with LLM as a Judge.
 *
 * Evaluate production outputs or compare different models on your dataset.
 * Results are uploaded to Fallom dashboard for visualization.
 */

// Types
export type {
  MetricName,
  MetricInput,
  DatasetInput,
  DatasetItem,
  EvalResult,
  ModelResponse,
  Message,
  ModelCallable,
  Model,
  CustomMetric,
  InitOptions,
  EvaluateOptions,
  CompareModelsOptions,
} from "./types";

export { AVAILABLE_METRICS, isCustomMetric, getMetricName } from "./types";

// Prompts
export { METRIC_PROMPTS } from "./prompts";

// Core functions
export {
  init,
  evaluate,
  compareModels,
  uploadResultsPublic as uploadResults,
  DEFAULT_JUDGE_MODEL,
} from "./core";

// Helper functions
export {
  createOpenAIModel,
  createCustomModel,
  createModelFromCallable,
  customMetric,
  datasetFromTraces,
  datasetFromFallom,
} from "./helpers";
