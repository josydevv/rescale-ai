# Rescale AI - Free AI Agent for Roblox Studio

![GitHub stars](https://img.shields.io/github/stars/sebattfg/Rescale AI-Free?style=social)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

**Rescale AI** is a free browser extension that turns DeepSeek, Gemini, Kimi, GLM, Qwen or Arena into a Roblox Studio AI agent.
Control Roblox Studio with AI directly from your browser - read/edit scripts, run Luau, generate assets, all from a normal AI chat. No API key, no terminal, no coding needed.

> 🌐 **Website: [rescale-ai-five.vercel.app](https://rescale-ai-five.vercel.app)** the free Lemonade.gg / Luamotion alternative for building Roblox games with AI.

Six AI providers are supported: **DeepSeek** (chat.deepseek.com, recommended), **Google Gemini** (gemini.google.com), **Kimi** (kimi.com, Moonshot AI), **GLM** (chat.z.ai, Z.ai), **Qwen** (chat.qwen.ai) and **Arena** (arena.ai, a multi-model playground). Gemini and Kimi can be unstable: Gemini tends to stop using the Roblox tools in long sessions, and Kimi sometimes uses its own native tools instead of the Roblox commands. On Arena, use **Direct** mode (Rescale AI only supports Direct; it blocks Start in Battle / Side-by-Side / Agent modes). DeepSeek is the recommended provider.

> 💬 **Stuck? Join the [Discord community](https://discord.gg/9aNyZsMWcb)** get help, share feedback, and follow updates.

> *Also known as: Rescale AI Roblox, Rescale AI free download, Roblox DeepSeek agent, Roblox Gemini agent, Roblox Kimi agent, Roblox GLM agent, Roblox Qwen agent, Roblox Arena agent, Roblox Studio AI automation, Luau AI, MCP Roblox, lemonade alternative free, lemonade.gg alternative, free Roblox AI agent, free lemonade roblox alternative*
## How it works

```
AI chat (DeepSeek / Gemini / Kimi / GLM / Qwen / Arena, in your browser) -> Rescale AI Extension -> Bridge (your PC) -> Roblox Studio
```

The extension runs inside the chat page (DeepSeek, Gemini, Kimi, GLM, Qwen or Arena). When you type a request, it sends commands to the Bridge running on your PC, which drives Roblox Studio through the built-in MCP server.

## Setup

> 📺 **Lost? Watch the [setup tutorial on YouTube](https://youtu.be/kPKiZLZ9_Ps) it covers every step below.**

### 1. Download the zip and install the extension

Download the latest zip from the **Releases** page and extract it. The zip contains both the **Bridge** and the **extension folder**.

To load the extension:

- Go to `edge://extensions` (Edge) or `chrome://extensions` (Chrome)
- Enable **Developer mode** (top right toggle)
- Click **Load unpacked**
- Select the `rescale-ai-extension` folder from the extracted zip

### 2. Start Roblox Studio and enable MCP

Open Studio and load a Place, then enable MCP (first time only):

- Click **Assistant AI** in the top bar
- Click **...** (top right of the Assistant panel)
- Click **Manage MCP Servers**
- Click **Enable Studio as MCP Server**

> Not sure where to find these options? The [video tutorial](https://youtu.be/kPKiZLZ9_Ps) shows exactly where to click.

### 3. Run the Bridge

Double-click `start.bat` inside the extracted folder. A small window opens, that means the Bridge is running.

### 4. Start a session

Go to https://chat.deepseek.com (recommended), https://gemini.google.com, https://www.kimi.com, https://chat.z.ai, https://chat.qwen.ai or https://arena.ai and open a new chat. The Rescale AI bar appears above the input box. Click **Start session**. Type what you want to build.

> Only works on chat.deepseek.com, gemini.google.com, kimi.com, chat.z.ai, chat.qwen.ai and arena.ai - it will not work on any other site.
> On Arena, keep the mode dropdown on **Direct** - Rescale AI blocks Start in Battle / Side-by-Side / Agent modes (it only drives a single Direct reply).
> Gemini and Kimi can be unstable (model behavior, not the extension): Gemini may stop using the Roblox tools after a while, and Kimi may use its own native tools instead. If the AI starts answering in plain text instead of acting, remind it to use the commands or start a new session.
### 5. Watch the setup tutorial

[Watch the setup tutorial on YouTube](https://youtu.be/kPKiZLZ9_Ps)

## What the AI can do

- Read and edit scripts
- Run Luau code directly in Studio
- Inspect the game tree and instances
- Generate meshes, materials, and models
- Browse and insert from the Creator Store
- Control play-testing
- **Remember your project across sessions** persistent project memory saved inside your place

## New in 1.4.2

- **Self-healing Studio connection:** the bridge now recovers on its own from a third-party app hijacking Studio's MCP port, and from a leftover StudioMCP process that used to leave the tool count stuck at 0 no matter how many times you restarted Studio or the bridge.
- **Clearer failure messages:** a missing custom-MCP command (e.g. `uvx` not installed) now names the real problem instead of looking like a silent restart loop.

## New in 1.4.1

- **Much more reliable Roblox Studio connection:** the bridge now recovers on its own from the connection issues Studio itself can cause - a stuck/orphaned MCP process, Studio opened after the bridge, or Studio's MCP toggle losing its registration. When it can't fix something automatically (e.g. Studio's MCP plugin needs a manual nudge), the status bar tells you exactly what to click instead of leaving you guessing or forcing a bridge restart.
- **Faster startup with addon servers:** the bridge no longer waits on Roblox Studio before other MCP servers (like Blender) become usable - addons are ready in seconds instead of up to a minute.
- **Sturdier bridge:** background monitoring can no longer silently stop working after an error; start.bat is hardened against more first-run edge cases (missing winget, an unextracted ZIP, stale installs).

See [CHANGELOG.md](CHANGELOG.md) for older releases.

## Panel status

| Dot | Meaning |
|-----|---------|
| Green | Bridge + Studio ready (a place is open) |
| Yellow | Bridge OK, but Studio isn't usable yet - open Roblox Studio, load a place, or enable its MCP server (hover the dot for the exact reason) |
| Grey | Bridge offline - run start.bat |

## Requirements

- Windows PC
- Roblox Studio (MCP support built-in)
- Microsoft Edge or Chrome
- Python 3.8+ (included in start.bat setup)

## Support

Rescale AI is free. If it saves you time: [Ko-fi](https://ko-fi.com/sebattfg) - Robux tip passes available in the extension panel

---

Credit: the idea for connecting other MCP servers (Blender, Sketchfab, etc.) alongside Roblox Studio came from [javnpa](https://github.com/javnpa).
