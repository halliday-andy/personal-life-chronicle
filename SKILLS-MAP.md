# Claude Skills & Plugins — Where Everything Lives

A reference map of where Claude Code finds skills and plugins on this machine.
Generated 2026-07-17 by inspecting the actual filesystem.

## Why you can't find these in Finder

1. **They live in hidden dot-folders** (`~/.claude`, `~/.claude-os`). Finder hides
   any folder starting with `.`. Toggle visibility with **⌘⇧.** (Cmd-Shift-Period),
   or jump to a path with **⌘⇧G** (Go to Folder).
2. **`~/.claude/skills` is a symlink** to `~/.claude-os/skills` — the real files are
   in `.claude-os`. Your global `~/.claude/CLAUDE.md` is likewise a symlink to
   `~/.claude-os/CLAUDE.md`.

## The map

```
~/.claude-os/                        ← YOUR hand-authored stuff (the real home)
├── CLAUDE.md                        ← global behavioral contract
│                                      (~/.claude/CLAUDE.md is a symlink to this)
├── skills/                          ← YOUR personal skills (~68 folders)
│   ├── base/  code-review/  security/  firebase/  react-web/ …   (coding)
│   └── critique-color/  layout-grid/  fitts-law/ …               (designer set)
└── style-guides/                    ← referenced by your CLAUDE.md

~/.claude/                           ← Claude Code's runtime config dir
├── skills   ─────────────────────►  symlink to ~/.claude-os/skills
├── CLAUDE.md ────────────────────►  symlink to ~/.claude-os/CLAUDE.md
├── settings.json / settings.local.json
└── plugins/                         ← ALL PLUGINS LIVE HERE
    ├── installed_plugins.json       ← registry: what's installed + where
    ├── known_marketplaces.json      ← the marketplaces you've added
    ├── marketplaces/                ← git clones of each marketplace repo
    │   ├── superpowers-marketplace/
    │   ├── compound-engineering-plugin/
    │   └── claude-plugins-official/
    └── cache/                       ← the ACTUAL installed plugin code (versioned)
        ├── superpowers-marketplace/superpowers/<version>/skills/
        ├── compound-engineering-plugin/compound-engineering/<version>/skills/
        └── claude-plugins-official/{frontend-design,github}/

<this project>/.claude/skills/       ← project-local skills (none in this repo yet)
```

## Installed plugins (as of 2026-07-17, post-update)

| Plugin | Version | Skills folder |
|--------|---------|---------------|
| **superpowers** | 6.1.1 | `~/.claude/plugins/cache/superpowers-marketplace/superpowers/6.1.1/skills/` |
| **compound-engineering** | 3.19.0 | `~/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/3.19.0/skills/` |
| frontend-design | (official) | `~/.claude/plugins/cache/claude-plugins-official/frontend-design/` |
| github | (official) | `~/.claude/plugins/cache/claude-plugins-official/github/` |

> Version numbers appear in the folder path and change when a plugin updates.
> If a path above 404s, check the current version in `installed_plugins.json`.

## How Claude accesses them

At the **start of every session**, the harness scans all four skill locations —
your `~/.claude-os/skills`, each plugin's `skills/` folder, and this project's
`.claude/skills` — reads only the `name` + `description` frontmatter from each
skill's `SKILL.md`, and presents that merged list to Claude. The full skill body
is loaded on demand when Claude invokes the **`Skill` tool** by name:

- Personal / plain skills → bare name: `code-review`, `security`
- Plugin skills → `plugin:skill` form: `superpowers:brainstorming`,
  `compound-engineering:ce-plan`

The `plugin:skill` naming encodes the folder path: plugin `compound-engineering`
→ its `skills/ce-plan/` folder. Each skill is a folder whose `SKILL.md` *is* the
skill (plus any supporting files alongside it).

## Fastest way to browse in Finder

Open Finder → **⌘⇧G** → paste any of:

- `~/.claude-os/skills` — your own skills
- `~/.claude/plugins/cache/superpowers-marketplace/superpowers/6.1.1/skills` — superpowers
- `~/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/3.19.0/skills` — compound engineering

## Regenerating this map

If plugins change and you want the current state, ask Claude to re-inspect, or run:

```sh
# What's installed and where
cat ~/.claude/plugins/installed_plugins.json

# Your personal skills
ls ~/.claude-os/skills

# A plugin's skills (adjust version)
ls ~/.claude/plugins/cache/superpowers-marketplace/superpowers/*/skills
ls ~/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/*/skills
```
