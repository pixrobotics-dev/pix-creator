# Install pix-creator with Claude Code's help

**English** | [Español](INSTALAR-CON-CLAUDE.md)

Paste this prompt into a Claude Code session. Claude will check your machine against the [requirements in the README](../README.en.md#machine-requirements) before installing.

```text
Install the PIX plugin pix-creator into my Claude Code from the GitHub marketplace pixrobotics-dev/pix-creator.

Before installing, read the "Machine requirements" section of the README of that repository (https://github.com/pixrobotics-dev/pix-creator/blob/main/README.en.md) and check my machine using the commands in the "How to check" column. The required items are: 64-bit Windows, PIX Studio in C:\Program Files\PIX (with Robot.exe and PIX.Recorder.Desktop.exe), the folder C:\ProgramData\PIX\.nuget containing PIX.Activities.3.0.0.nupkg, .NET 10 Desktop Runtime x64 (Microsoft.NETCore.App and Microsoft.WindowsDesktop.App 10.x), Node.js 20 or newer, Claude Code with the "claude plugin" command, Git, and access to github.com:443. The optional items are Chrome with the PIX extension and a PIX license.

Follow these steps in order. After each one, tell me in one line what happened. If something fails, stop and explain the problem: do not improvise workarounds and do not install any program without asking me first.

1. Check the requirements and show me a table with PASS, FAIL or WARN for each one. If there is any FAIL, tell me what is missing and where to download it, and do not continue until I have fixed it.

2. Register and install the plugin:
   - `claude plugin marketplace add pixrobotics-dev/pix-creator`
   - `claude plugin install pix-creator@pix-robotics`
   If it was already installed, use `claude plugin marketplace update pix-robotics` and then `claude plugin update pix-creator@pix-robotics`.

3. Confirm with `claude plugin list` that pix-creator appears as enabled.

4. Do not change any other settings or permissions. In particular, do not add `approve_migration` to any allow list.

5. Finish with a short summary. Tell me I must close this session and open a new one so the tools load.
```

## Check in the new session

```text
Check that the pix-creator plugin was installed correctly: use search_activities to look for the "MessageBox" activity, list the tools of the pix-extras server and tell me whether everything responds. Do not generate or modify anything.
```

## Verification with the repository script

If you have the repository cloned or downloaded, you can check everything at once:

```bash
powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1
```

## What cannot be automated

- Claude Code will ask you to approve the commands and, afterwards, the plugin's tools.
- The session must be restarted by hand.
- If PIX Studio, .NET, Node or Git are missing, Claude will tell you what to do but should not install them without asking.
