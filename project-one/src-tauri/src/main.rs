// junbai家专用理财软件 — Tauri 桌面外壳，加载打包好的本地前端（dist）。
// 纯本地：数据存在本机，不联网、不上传。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
