/**
 * Filtro puro de resultados de Hugging Face para el panel de IA local.
 * Sin VS Code ni red: el panel busca; aquí se decide qué es compatible.
 */

export interface HFModelSearchResult {
  id: string;
  downloads: number;
  tags?: string[];
  library_name?: string;
  pipeline_tag?: string;
  safetensors?: { total: number };
  siblings?: Array<{ rfilename: string; size?: number }>;
  modelId?: string;
}

export interface SearchResultModel {
  id: string;
  modelId: string;
  downloads: number;
  format: string;
  architecture?: string;
  sizeBytes: number;
  sizeFormatted: string;
  recommendedMemory: string;
  status: 'not-installed' | 'downloaded' | 'loaded';
  compatible: boolean;
}

const ARCH_TAGS = ['llama', 'qwen', 'smollm', 'gemma', 'phi', 'mistral', 'bert', 'gpt'];
const SYSTEM_RESERVE = 1.5 * 1024 * 1024 * 1024;
const SIZE_HINTS: Array<{ needle: string; bytes: number }> = [
  { needle: '360m', bytes: 280 * 1024 * 1024 },
  { needle: '0.3b', bytes: 280 * 1024 * 1024 },
  { needle: '0.5b', bytes: 380 * 1024 * 1024 },
  { needle: '500m', bytes: 380 * 1024 * 1024 },
  { needle: '1.5b', bytes: 1.1 * 1024 * 1024 * 1024 },
  { needle: '1b', bytes: 750 * 1024 * 1024 },
  { needle: '1.0b', bytes: 750 * 1024 * 1024 },
  { needle: '3b', bytes: 2.2 * 1024 * 1024 * 1024 },
  { needle: '7b', bytes: 4.5 * 1024 * 1024 * 1024 },
];

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
  }
  return (bytes / 1024).toFixed(0) + ' KB';
}

export function hasOnnxArtifacts(hfModel: HFModelSearchResult): boolean {
  if (hfModel.tags?.some((t) => t.toLowerCase().includes('onnx'))) return true;
  if (hfModel.siblings?.some((s) => s.rfilename.toLowerCase().endsWith('.onnx'))) return true;
  if (hfModel.library_name?.toLowerCase() === 'transformers.js') return true;
  return false;
}

export function inferArchitectureFromTags(tags?: string[]): string | undefined {
  if (!tags) return undefined;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const arch of ARCH_TAGS) {
      if (lower.includes(arch)) return arch.charAt(0).toUpperCase() + arch.slice(1);
    }
  }
  return undefined;
}

export function estimateModelSizeFromHF(hfModel: HFModelSearchResult): number {
  if (hfModel.safetensors?.total) {
    return hfModel.safetensors.total;
  }
  if (hfModel.siblings) {
    const total = hfModel.siblings.reduce((sum, s) => sum + (s.size ?? 0), 0);
    if (total > 0) return total;
  }
  const id = hfModel.id.toLowerCase();
  for (const hint of SIZE_HINTS) {
    if (id.includes(hint.needle)) return hint.bytes;
  }
  return 500 * 1024 * 1024;
}

export function filterCompatibleModels(data: HFModelSearchResult[]): HFModelSearchResult[] {
  return data
    .filter((m) => Boolean(m.id) && hasOnnxArtifacts(m) && (m.downloads || 0) > 0)
    .slice(0, 12);
}

export function toSearchResultModel(
  m: HFModelSearchResult,
  ctx: { installedIds: Set<string>; currentModelId: string | null; isLoaded: boolean },
): SearchResultModel {
  const sizeBytes = estimateModelSizeFromHF(m);
  let status: SearchResultModel['status'] = 'not-installed';
  if (ctx.installedIds.has(m.id)) {
    status = 'downloaded';
  }
  if (ctx.isLoaded && ctx.currentModelId === m.id) {
    status = 'loaded';
  }
  return {
    id: m.id,
    modelId: m.id,
    downloads: m.downloads || 0,
    format: m.siblings?.some((s) => s.rfilename.toLowerCase().endsWith('.onnx'))
      ? 'ONNX'
      : 'safetensors',
    architecture: inferArchitectureFromTags(m.tags),
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    recommendedMemory: formatBytes(sizeBytes + SYSTEM_RESERVE),
    status,
    compatible: true,
  };
}
