# UX-Helpers 命名空间

## 设计目的

UX-Helpers 是 skill-evolver 生成的辅助型 skills 的独立存储空间，解决以下问题：

1. **关注点分离**：原 skill 专注于核心功能，不混杂"如何使用"类辅助内容
2. **避免污染**：生成的 skills 不放在被分析的 skill 目录下
3. **统一发现**：所有 UX 优化类 skills 集中存放，便于管理和发现

## 目录结构

```
~/.claude/skills/
├── analysis/              # 分析型 skills（如 tech-trend-monitor）
├── skill-evolver/         # 进化型 skills
├── skills-verifier/       # 验证型 skills
└── ux-helpers/            # UX 辅助型 skills（新生成）
    ├── how-do-i-run-tech-trend/
    ├── how-do-i-configure-x/
    └── how-do-i-debug-y/
```

## 配置项

在 `skill-evolver.config.yaml` 中配置：

```yaml
skill_evolver:
  # UX-Helpers 目录（默认：~/.claude/skills/ux-helpers）
  ux_helpers_dir: "~/.claude/skills/ux-helpers"
```

## Skill 类型对比

| 类型 | 存放位置 | 示例 | 生成方式 |
|:---|:---|:---|:---|
| **Core** | `~/.claude/skills/{name}/` | tech-trend-monitor | 人工开发 |
| **UX-Helper** | `~/.claude/skills/ux-helpers/{name}/` | how-do-i-run-tech-trend | skill-evolver 自动生成 |

## 元数据标记

生成的 UX-Helper skills 包含特殊元数据：

```yaml
---
name: how-do-i-run-tech-trend
description: How do I run tech-trend-monitor with custom search queries
type: interactive
author: skill-evolver
category: ux-helper              # 技能类别
target_skill: tech-trend-monitor  # 指向被帮助的 skill
version: 1.0.0
---
```

## 相似度检查

harvester 在生成新 skill 时，会检查以下位置避免重复：

1. `~/.claude/skills/` - 全局 skills
2. `{cwd}/.claude/skills/` - 项目级 skills
3. `~/.claude/skills/ux-helpers/` - UX 辅助 skills

## 迁移说明

对于已存在的 draft skills：

```bash
# 手动迁移旧位置到新位置
mv ~/.claude/skills/{target}/.claude/skills/draft/* \
   ~/.claude/skills/ux-helpers/
```

## 设计原则

1. **单一职责**：每个 skill 只做一件事
2. **显式依赖**：通过 `target_skill` 字段声明关联
3. **独立演化**：UX-Helper 可以独立更新版本
4. **可发现性**：集中存放便于检索和管理
