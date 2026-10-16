# 历史记录索引

历史材料保留形成时的原文、路径与证据范围。文中的“当前”“下一步”、命令和未提交状态属于各自记录时点；现行入口见 [接手指南](../CODEX-HANDOFF.md)，完成状态见 [STATUS](../design/STATUS.md)。

## 2026-10-16 工程整理前快照

[快照清单](engineering-20261016/snapshot-manifest.json)记录 11 份文件的原始路径、字节数与 SHA-256。文件按原路径保存在 `engineering-20261016/`，内容逐字保留；其中相对链接与旧源码路径仍以原仓库位置为解析背景。当前路径对应见 [工程迁移记录](../engineering/MIGRATION-20261016.md)。

| 原文件 | 快照 |
| --- | --- |
| `README.md` | [原文](engineering-20261016/README.md) |
| `AGENTS.md` | [原文](engineering-20261016/AGENTS.md) |
| `CLAUDE.md` | [原文](engineering-20261016/CLAUDE.md) |
| `GEMINI.md` | [原文](engineering-20261016/GEMINI.md) |
| `docs/CODEX-HANDOFF.md` | [原文](engineering-20261016/docs/CODEX-HANDOFF.md) |
| `docs/HANDOFF.md` | [原文](engineering-20261016/docs/HANDOFF.md) |
| `docs/design/STATUS.md` | [原文](engineering-20261016/docs/design/STATUS.md) |
| `docs/design/README.md` | [原文](engineering-20261016/docs/design/README.md) |
| `docs/design/DECISIONS.md` | [原文](engineering-20261016/docs/design/DECISIONS.md) |
| `docs/design/manifest.json` | [原文](engineering-20261016/docs/design/manifest.json) |
| `docs/requirements/registry.json` | [原文](engineering-20261016/docs/requirements/registry.json) |

有效用户规则与当前契约由 AGENTS、DECISIONS、分系统规格和接手指南继续承接。快照保存审计来源，不替代它们；历史原始失败、发布检查点和未验证项均可从原文追溯。

## 其他历史材料

- [早期素材目录 v0.2](ASSETS-v02.md)。
- `docs/art/` 与 `docs/design/` 中的各批实施记录保留原有文件身份和证据范围。
- 历史运行工程位于仓库 `archive/godot/` 与 `archive/prototypes/`。
