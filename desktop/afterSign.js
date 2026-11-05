// electron-builder 打包后钩子：给整个 App（含内嵌的 Electron Helper/Framework）
// 做一次「深度」ad-hoc 自签名（不花钱，不用苹果开发者账号）。
//
// 背景：Electron App 打包出来其实是好几层——外层 App + 里面嵌着的 Helper.app、
// 各种 .framework。如果只是笼统地不签名(identity:null)，这些内层文件可能签名
// 不完整/不一致，macOS 校验时会直接判定「签名结构有问题」——表现出来就是那句
// 更吓人的「已损坏」「可能暴露隐私」，而不是温和一点的「未知开发者，是否打开」。
// --deep 保证外层到每个内层都盖上一致的自签名，能顶掉相当一部分这类问题。
//
// 这不是完整的苹果签名+公证，不能保证 100% 不再提示——macOS 对完全没有 Apple
// 开发者证书的 App，多少还是会在首次打开时问一句。想彻底不提示，只有走
// 付费的 Developer ID 签名 + 公证这条路（见 desktop/README.md）。
const { execFileSync } = require("child_process");

exports.default = async function afterSign(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== "darwin") return;
  const appPath = `${appOutDir}/${packager.appInfo.productFilename}.app`;
  console.log(`[afterSign] 深度 ad-hoc 签名：${appPath}`);
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
    console.log("[afterSign] 签名完成");
  } catch (e) {
    console.warn("[afterSign] 签名失败（不影响继续打包，只是可能还会被 Gatekeeper 拦一下）：", e.message);
  }
};
