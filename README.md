# Snake Game (多人在线贪吃蛇)

一个基于 WebSocket 的多人贪吃蛇小游戏，包含排行榜、击杀/死亡提示、手机触控摇杆与复活机制。

## 技术栈

- 客户端: React + TypeScript + Vite
- 服务端: Node.js + Express + ws

## 目录结构

- `client/`: 前端工程
- `server/`: 后端与 WebSocket 游戏逻辑
- `todo.md`: 当前迭代任务清单

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
- 手机: 屏幕触控摇杆控制移动。
- 撞墙或碰撞后会死亡，点击遮罩可复活。
- 排行榜按分数实时排序。

## 开发说明

- 前端组件位于 `client/src/components/`。
- 共享类型位于 `client/src/types/game.ts`。
- 画布渲染与网络状态同步由 `client/src/App.tsx` 统一调度。
