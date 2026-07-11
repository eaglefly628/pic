// 版本号单一真源：根目录 VERSION 文件。构建前把它同步进本包的 package.json，
// 这样你以后改版本只改 VERSION 一处，App / run.py(/api/version) 都跟着走。
const fs = require("fs");
const path = require("path");

const ver = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf-8").trim();
if (!/^\d+\.\d+\.\d+/.test(ver)) {
  console.error(`VERSION 内容不像版本号：「${ver}」`);
  process.exit(1);
}
const pkgPath = path.join(__dirname, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
if (pkg.version !== ver) {
  pkg.version = ver;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`已把 App 版本同步为 v${ver}`);
} else {
  console.log(`App 版本已是 v${ver}`);
}
