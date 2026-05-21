# Contributing

感谢你对本项目的兴趣！这是一个教学项目，欢迎提交改进。

## 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发（API + Web UI 同时运行）
pnpm dev

# 运行测试
pnpm test

# 类型检查
pnpm lint
```

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档改动
- `refactor:` 重构（不改变外部行为）
- `test:` 测试相关
- `chore:` 构建/工具链

## 项目原则

- **保持简单** — 核心代码要短小可读，这是教学项目
- **不引入框架** — 不使用 LangChain / LlamaIndex 等 Agent 框架
- **手写优先** — 目的是展示原理，不是追求生产级封装
- **注释面向学习者** — 核心文件的注释应帮助初学者理解
