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
};

export type RemoteIndexFile = {
  relPath: string;
  name: string;
  kind: string;
  extension: string;
  size: number;
  mtimeNs: number;
  classificationHint?: string | null;
  status: string;
};

export type RemoteIndexFiles = {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  items: RemoteIndexFile[];
  error?: string;
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

export async function getRemoteIndexFiles(options: { offset?: number; limit?: number; kind?: string; q?: string } = {}): Promise<RemoteIndexFiles> {
  const params = new URLSearchParams();
  params.set("offset", String(options.offset || 0));
  params.set("limit", String(options.limit || 100));
  if (options.kind) params.set("kind", options.kind);
  if (options.q) params.set("q", options.q);
  const response = await fetch(`/api/photos/index/files?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`索引记录服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<RemoteIndexFiles>;
}
