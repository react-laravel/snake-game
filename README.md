# Snake Game (多人在线贪吃蛇)

一个基于 WebSocket 的多人贪吃蛇小游戏，包含排行榜、击杀/死亡提示、手机触控摇杆与复活机制。

## 技术栈

- 客户端: React + TypeScript + Vite
- 服务端: Node.js + Express + ws

## 目录结构

- `client/`: 前端工程
- `server/`: 后端与 WebSocket 游戏逻辑
- `progress.md`: 迭代记录和验证结果

## 本地运行

1. 安装后端依赖
   - `cd server`
   - `npm install`
2. 启动后端
   - `npm run dev`
3. 新开终端安装前端依赖
   - `cd client`
   - `npm install`
4. 启动前端
   - `npm run dev`
5. 打开浏览器访问前端地址（默认 `http://localhost:5173/snake/`）

## 生产构建

1. 构建前端
   - `cd client && npm run build`
2. 启动服务端
   - `cd server && npm run start`

## 玩法说明

- PC: 方向键或 WASD 控制移动。
- 手机: 在地图上拖动使用摇杆，或点击左下角方向按钮。竖屏排行榜可以展开和收起。
- PC: 按 F 切换全屏，Esc 退出全屏。
- 撞墙、自己的蛇身或其他蛇会出局；点击「再来一次」或按 Enter 复活，累计积分保留。
- 食物 +10，存活每秒 +1，击杀存活对手 +100；正面相撞（包括头部互换）双方出局且不奖励击杀分。
- 排行榜按分数实时排序。
- 临时断线后自动重试，30 秒内可恢复身份和积分；断线期间蛇停在原地，身体仍会挡住别人。死亡后刷新仍保持出局，需手动复活。同一个身份被另一个页面接走时，旧页面回到大厅，不会再开一条新蛇。
- 点击「离开」立即移除当前蛇，返回大厅；昵称会记住，下一次加入从新对局开始。

## 开发说明

- 前端组件位于 `client/src/components/`。
- 共享类型位于 `client/src/types/game.ts`。
- `App.tsx` 负责页面组合，`useGameConnection` 管理网络和复活确认，`useGameControls` 管理键盘与触控。
- `GameCanvas` 按服务器状态、窗口尺寸和可见性变化重绘；静态网格使用离屏缓存，像素比例最多为 2。
- 1100px 以上在侧栏旁适配地图。更窄的窗口收起排行榜，格子最小约 8px；放不下整张图时跟随自己的蛇，小地图同时标出蛇和食物。
- `server/game.js` 负责安全出生、食物占位、转向队列和同时碰撞判定；`server/index.js` 负责会话、重连和状态广播。
- 本地开发代理仅转发 `/snake/ws`，页面由 Vite 加载当前源码。生产启动前仍需先构建前端。

## 验证

```sh
cd client
npm test
npm run build
cd ../server
npm test
```

服务端测试覆盖出生、食物、碰撞、连续转向、积分、重连、旧连接隔离、空闲保活和主动退出。客户端测试覆盖消息解析、重试退避、排行榜复用和禁用存储。

启动 Vite 后可运行 `cd client && npm run test:browser`，用 Chromium 验证连接生命周期（需要已安装的 Playwright；可通过 `PLAYWRIGHT_MODULE` 指定现有模块路径）。此测试使用可控 WebSocket 和时钟，不创建真实对局。

浏览器自动化入口为 `window.render_game_to_text()` 和 `window.advanceTime(ms)`。后者等待真实时间，游戏状态由服务器推进；不会在客户端预测服务器结果。
