export type IndexCount = { files: number; bytes: number };

export type RemoteSource = {
  name: string;
  path: string;
  readable: boolean;
  writable: boolean;
};

export type RemoteIndexStatus = {
  ok: boolean;
  status: "not_started" | "running" | "pausing" | "paused" | "completed" | "error";
  processAlive: boolean;
  db: string;
  dbBytes?: number;
  interrupted?: boolean;
  source?: string;
  defaultSource: string;
  sources: RemoteSource[];
  indexedThisRun?: number;
  errors?: number;
  lastPath?: string | null;
  message?: string | null;
  error?: string;
  totals?: Record<string, IndexCount>;
  hints?: Record<string, IndexCount>;
  directories?: Record<string, number>;
  topDirectories?: { topDir: string; files: number; media: number; bytes: number }[];
  extensions?: { extension: string; kind: string; files: number; bytes: number }[];
  skippedDirectories?: { rel_path: string; last_error: string }[];
  metadataAnalysis?: {
    status: "not_started" | "running" | "paused" | "completed" | "error";
    processAlive: boolean;
    runId?: number;
    total: number;
    processed: number;
    withTime: number;
    withGps: number;
    needsReview: number;
    errors: number;
    lastPath?: string | null;
    message?: string | null;
  };
};

async function request(path: string, init?: RequestInit): Promise<RemoteIndexStatus> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) throw new Error(`照片索引服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<RemoteIndexStatus>;
}

export function getRemoteIndexStatus() {
  return request("/api/photos/index/status");
}

export function startRemoteIndex(source: string) {
  return request("/api/photos/index/start", { method: "POST", body: JSON.stringify({ source }) });
}

export function pauseRemoteIndex() {
  return request("/api/photos/index/pause", { method: "POST", body: "{}" });
}

export function revealRemoteIndex() {
  return request("/api/photos/index/reveal", { method: "POST", body: "{}" });
}

export function startMetadataAnalysis(source: string) {
  return request("/api/photos/metadata/start", { method: "POST", body: JSON.stringify({ source }) });
}

export function pauseMetadataAnalysis() {
  return request("/api/photos/metadata/pause", { method: "POST", body: "{}" });
}

export async function backupRemoteIndex(): Promise<{ ok: boolean; bytes?: number; localPath?: string; remotePath?: string; error?: string }> {
  const response = await fetch("/api/photos/index/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error(`索引备份服务不可用（HTTP ${response.status}）`);
  return response.json();
}
