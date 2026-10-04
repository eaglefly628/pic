#!/usr/bin/env node
"use strict";

// 常驻进程：从 stdin 接收一行一个文件路径，使用 exifr 只读取图片元数据，
// 避免为十几万张图片反复启动 Node。输出仍是一行一个 JSON。
const readline = require("readline");
const exifrPath = process.argv[2];
if (!exifrPath) throw new Error("缺少 exifr 模块路径");
const exifr = require(exifrPath);

function dateText(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = String(value).trim();
  return text || null;
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function inspect(path) {
  try {
    const meta = await exifr.parse(path, {
      tiff: true, ifd0: true, exif: true, gps: true, xmp: true,
      iptc: false, icc: false, jfif: false, ihdr: true,
      mergeOutput: true, reviveValues: true,
    }) || {};
    return {
      ok: true,
      capturedAt: dateText(meta.DateTimeOriginal || meta.CreateDate || meta.DateCreated || meta.ModifyDate),
      latitude: number(meta.latitude),
      longitude: number(meta.longitude),
      make: meta.Make ? String(meta.Make) : null,
      model: meta.Model ? String(meta.Model) : null,
      width: number(meta.ExifImageWidth || meta.ImageWidth || meta.PixelXDimension),
      height: number(meta.ExifImageHeight || meta.ImageHeight || meta.PixelYDimension),
    };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: "请求格式错误" }) + "\n"); return; }
  const result = await inspect(String(request.path || ""));
  process.stdout.write(JSON.stringify(result) + "\n");
});
