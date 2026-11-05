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
  runId?: number;
  dbBytes?: number;
  interrupted?: boolean;
  source?: string;
  defaultSource: string;
  platform?: "windows" | "mac" | "linux";
  sources: RemoteSource[];
  indexedThisRun?: number;
  newInRun?: { image?: number; video?: number };
  metadataPending?: number;
  unarchivedMedia?: number;
  scanMode?: "full" | "selected";
  selectedDirectories?: string[];
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

export type RemoteTimelinePeriod = {
  period: string;
  files: number;
  images: number;
  videos: number;
  gps: number;
  needsReview: number;
  bytes: number;
};

export type RemoteTimelinePlace = {
  key: string;
  label: string;
  latitude?: number;
  longitude?: number;
  files: number;
  images: number;
  videos: number;
  needsReview: number;
  bytes: number;
  context?: string;
};

export type RemoteTimelineData = {
  ok: boolean;
  error?: string;
  analysisStatus: "not_started" | "running" | "paused" | "completed" | "error";
  total: number;
  processed: number;
  withTime: number;
  withGps: number;
  suspiciousTime: number;
  periods: RemoteTimelinePeriod[];
  selectedPeriod?: string;
  places: RemoteTimelinePlace[];
};

export type BrowseScope = "all" | "month" | "year_only" | "unclassified" | "place" | "day" | "person";
export type BrowseHint = "all" | "screenshot" | "screen_recording";
export type BrowseSummary = {
  ok: boolean;
  error?: string;
  total: number;
  months: { period: string; files: number; images: number; videos: number; bytes: number }[];
  yearOnly: { year: string; files: number }[];
  unclassified: number;
  gpsTotal: number;
  places: { key: string; label: string; latitude: number; longitude: number; files: number }[];
  datedTotal: number;
  events: { day: string; files: number }[];
  peopleIndexed: number;
  screenshotNameHints: number;
  screenRecordingNameHints: number;
};
export type PhotoStorageStatus = {
  ok: boolean;
  cache: { bytes: number | null; status: "scanning" | "ready" | "unavailable" | "error"; checkedAt: number | null; error?: string | null };
  database: { indexBytes: number; peopleBytes: number; totalBytes: number };
};
export type BrowseItem = {
  relPath: string;
  name: string;
  kind: "image" | "video";
  extension: string;
  size: number;
  captureTime: string | null;
  timeSource: string | null;
  timePrecision: "day" | "month" | "year" | "unknown";
  needsReview: number;
  latitude: number | null;
  longitude: number | null;
};
export type BrowseItems = { ok: boolean; error?: string; total: number; items: BrowseItem[]; offset: number; limit: number };
export type BrowseSort = "newest" | "oldest" | "name_asc" | "name_desc" | "size_desc" | "size_asc";

export async function getBrowseSummary(): Promise<BrowseSummary> {
  const response = await fetch("/api/photos/browse/summary", { cache: "no-store" });
  if (!response.ok) throw new Error(`影像分类不可用（HTTP ${response.status}）`);
  return response.json() as Promise<BrowseSummary>;
}

export async function getPhotoStorageStatus(refresh = false): Promise<PhotoStorageStatus> {
  const response = await fetch(`/api/photos/storage${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法读取存储用量（HTTP ${response.status}）`);
  return response.json() as Promise<PhotoStorageStatus>;
}

export async function getBrowseItems(options: {
  scope: BrowseScope; key?: string; kind?: "all" | "image" | "video";
  q?: string; sort?: BrowseSort; hint?: BrowseHint; offset?: number; limit?: number;
}): Promise<BrowseItems> {
  const params = new URLSearchParams({ scope: options.scope });
  if (options.key) params.set("key", options.key);
  if (options.kind && options.kind !== "all") params.set("kind", options.kind);
  if (options.q) params.set("q", options.q);
  if (options.sort) params.set("sort", options.sort);
  if (options.hint && options.hint !== "all") params.set("hint", options.hint);
  params.set("offset", String(options.offset || 0));
  params.set("limit", String(options.limit || 48));
  const response = await fetch(`/api/photos/browse/items?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`影像列表不可用（HTTP ${response.status}）`);
  return response.json() as Promise<BrowseItems>;
}

export type TrashBatch = { batchId: string; deletedAt: string; count: number; bytes: number; paths: string[] };
export async function getTrashPreview(path: string): Promise<{ ok: boolean; error?: string; items: { relPath: string; name: string; kind: string; size: number }[] }> {
  const response = await fetch(`/api/photos/browse/trash/preview?${new URLSearchParams({ path })}`, { cache: "no-store" });
  return response.json();
}
export async function getTrashPreviewMany(paths: string[]): Promise<{ ok: boolean; error?: string; items: { relPath: string; name: string; kind: string; size: number }[] }> {
  const response = await fetch("/api/photos/browse/trash/preview-many", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }),
  });
  return response.json();
}
export async function getTrashStatus(): Promise<{ ok: boolean; batches: TrashBatch[]; pendingCount?: number; cachePendingCount?: number }> {
  const response = await fetch("/api/photos/browse/trash/status", { cache: "no-store" });
  return response.json();
}
export async function moveToTrash(path: string, expectedPaths: string[]): Promise<{ ok: boolean; error?: string; batchId?: string; cache?: { cleared: number; pending: number } }> {
  const response = await fetch("/api/photos/browse/trash/move", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, expectedPaths }),
  });
  return response.json();
}
export async function moveManyToTrash(paths: string[], expectedPaths: string[]): Promise<{ ok: boolean; error?: string; batchId?: string; cache?: { cleared: number; pending: number } }> {
  const response = await fetch("/api/photos/browse/trash/move", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, expectedPaths }),
  });
  return response.json();
}
export async function restoreFromTrash(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/photos/browse/trash/restore", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId }),
  });
  return response.json();
}

export type ArchivePrecision = "year" | "month" | "day";
export type ArchiveItem = { sourceRel: string; targetRel: string; name: string; kind: string; size: number };
export type ArchivePreview = {
  ok: boolean; error?: string; items: ArchiveItem[]; count: number;
  targetDirectory: string; precision: ArchivePrecision; date: string; selectedCount: number;
};
export async function previewManualArchive(paths: string[], precision: ArchivePrecision, date: string): Promise<ArchivePreview> {
  const response = await fetch("/api/photos/browse/archive/preview", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, precision, date }),
  });
  return response.json();
}
export async function moveManualArchive(paths: string[], preview: ArchivePreview): Promise<{ ok: boolean; error?: string; moved?: number; targetDirectory?: string }> {
  const response = await fetch("/api/photos/browse/archive/move", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, precision: preview.precision, date: preview.date,
      expected: preview.items.map(({ sourceRel, targetRel }) => ({ sourceRel, targetRel })) }),
  });
  return response.json();
}

export type PhotoOrganizeStatus = {
  ok: boolean;
  error?: string;
  status: "not_started" | "planned" | "running" | "pausing" | "paused" | "completed" | "error";
  processAlive: boolean;
  runId?: number;
  sourceRoot?: string;
  targetRoot?: string;
  layout?: "month" | "day" | "review_month_year" | "other_review";
  profileLog?: string;
  averageRate?: number;
  estimatedRemainingSeconds?: number | null;
  profileBatches?: number;
  total?: number;
  moved?: number;
  verified?: number;
  errors?: number;
  bytesTotal?: number;
  bytesMoved?: number;
  reliable?: number;
  needsReview?: number;
  reviewPhase?: {
    month: { total: number; verified: number };
    yearOnly: { total: number; verified: number };
    unclassified: { total: number; verified: number };
  } | null;
  lastPath?: string | null;
  message?: string | null;
  examples?: { sourceRel: string; targetRel: string; status: string; error?: string | null }[];
};

export type PhotoDuplicateStatus = {
  ok: boolean;
  status: "not_started" | "running" | "paused" | "completed" | "error";
  processAlive?: boolean;
  months?: number;
  completedMonths?: number;
  monthPercent?: number;
  currentMonth?: { month: string; total: number; percent: number } | null;
  candidates?: number;
  confirmedGroups?: number;
  confirmedDuplicateFiles?: number;
  potentialReclaimBytes?: number;
  errors?: number;
  error?: string;
};

export async function getPhotoDuplicateStatus(): Promise<PhotoDuplicateStatus> {
  const response = await fetch("/api/photos/duplicates/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`重复检测进度不可用（HTTP ${response.status}）`);
  return response.json() as Promise<PhotoDuplicateStatus>;
}

export type PhotoDuplicateCleanupStatus = {
  ok: boolean;
  status: "not_started" | "running" | "paused" | "completed" | "error";
  processAlive?: boolean;
  total?: number;
  deleted?: number;
  skippedHardlink?: number;
  remaining?: number;
  errors?: number;
  percent?: number;
  deletedBytes?: number;
  totalBytes?: number;
  error?: string;
};

export async function getPhotoDuplicateCleanupStatus(): Promise<PhotoDuplicateCleanupStatus> {
  const response = await fetch("/api/photos/duplicates/cleanup/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`清理进度不可用（HTTP ${response.status}）`);
  return response.json() as Promise<PhotoDuplicateCleanupStatus>;
}

export type PhotoHandoffStatus = {
  ok: boolean;
  error?: string | null;
  message?: string;
  action?: "exported" | "imported";
  platform: "windows" | "mac" | "linux";
  python: string;
  pythonVersion: string;
  sourceRoot?: string | null;
  bundle?: string | null;
  bundleBytes?: number;
  canExport: boolean;
  canImport: boolean;
  indexDatabase: string;
  manifest?: {
    exportedAt?: string;
    sourceRoot?: string;
    targetName?: string;
    runId?: number | null;
    status?: string;
    total?: number;
    verified?: number;
    errors?: number;
    databaseBytes?: number;
  } | null;
  importResult?: {
    unchanged?: boolean;
    sourceRoot?: string;
    targetRoot?: string;
    runId?: number;
    verified?: number;
    total?: number;
    backup?: string | null;
    message?: string;
  } | null;
  index?: RemoteIndexStatus;
  organize?: PhotoOrganizeStatus;
};

async function request(path: string, init?: RequestInit): Promise<RemoteIndexStatus> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (response.status === 404) throw new Error("5180 端口上的服务不是当前版本；请关闭旧服务，再从最新项目启动应用");
  if (!response.ok) throw new Error(`照片索引服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<RemoteIndexStatus>;
}

export function getRemoteIndexStatus() {
  return request("/api/photos/index/status");
}

export type BackupDirectory = {
  name: string;
  relPath: string;
  readable: boolean;
  indexedImages: number;
  indexedVideos: number;
};

export async function getBackupDirectories(source: string): Promise<{ ok: boolean; source: string; directories: BackupDirectory[]; error?: string }> {
  const response = await fetch(`/api/photos/index/backup-directories?source=${encodeURIComponent(source)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法读取备份目录（HTTP ${response.status}）`);
  return response.json();
}

export function startRemoteIndex(source: string, includes?: string[]) {
  return request("/api/photos/index/start", { method: "POST", body: JSON.stringify({ source, includes }) });
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

export async function getRemoteTimeline(period?: string): Promise<RemoteTimelineData> {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  const response = await fetch(`/api/photos/timeline${params.size ? `?${params}` : ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`时间地点索引服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<RemoteTimelineData>;
}

async function organizeRequest(path: string, body?: object): Promise<PhotoOrganizeStatus> {
  const response = await fetch(path, body ? {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" });
  if (response.status === 404) throw new Error("5180 端口上的服务缺少照片整理接口；请关闭旧服务，再从最新项目启动应用");
  if (!response.ok) throw new Error(`照片整理服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<PhotoOrganizeStatus>;
}

export function getPhotoOrganizeStatus() {
  return organizeRequest("/api/photos/organize/status");
}

export function planPhotoOrganize(targetName = "家庭影像库") {
  return organizeRequest("/api/photos/organize/plan", { targetName });
}

export function planPhotoReviewOrganize() {
  return organizeRequest("/api/photos/organize/review-plan", {});
}

export function startPhotoOrganize() {
  return organizeRequest("/api/photos/organize/start", {});
}

export function pausePhotoOrganize() {
  return organizeRequest("/api/photos/organize/pause", {});
}

async function handoffRequest(path: string, method = "GET"): Promise<PhotoHandoffStatus> {
  const response = await fetch(path, {
    method, cache: "no-store", headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  if (response.status === 404) throw new Error("5180 端口上的服务没有照片接力接口；请关闭旧服务，再从最新项目启动应用");
  if (!response.ok) throw new Error(`照片接力服务不可用（HTTP ${response.status}）`);
  return response.json() as Promise<PhotoHandoffStatus>;
}

export function getPhotoHandoffStatus() {
  return handoffRequest("/api/photos/handoff/status");
}

export function exportPhotoHandoff() {
  return handoffRequest("/api/photos/handoff/export", "POST");
}

export function importPhotoHandoff() {
  return handoffRequest("/api/photos/handoff/import", "POST");
}
