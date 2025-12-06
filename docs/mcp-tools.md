# MCP Tools Reference

## spawn-terminal

Create a new terminal session.

**Parameters:**
- `shell` (string, optional): Shell to use
- `cwd` (string, optional): Working directory
- `cols` (number, optional): Terminal width
- `rows` (number, optional): Terminal height
- `env` (object, optional): Environment variables
- `visible` (boolean, optional): Open terminal window

**Returns:**
```json
{
  "sessionId": "abc123",
  "cwd": "/home/user",
  "visible": true,
  "tmuxSession": "termwright-abc123",
  "attachCommand": "tmux attach -t termwright-abc123"
}
```

---

## send-input

Send keystrokes to terminal.

**Parameters:**
- `sessionId` (string, required): Session ID
- `input` (string, required): Input to send. Escape sequences: `\n` (newline), `\t` (tab), `\x1b` (escape)

---

## run-command

Execute command and wait for completion.

**Parameters:**
- `sessionId` (string, required): Session ID
- `command` (string, required): Command to run
- `timeout` (number, optional): Timeout in ms (default: 30000)
- `waitFor` (string, optional): Regex pattern for completion

**Returns:**
```json
{
  "output": "command output here",
  "completed": true,
  "sessionId": "abc123"
}
```

---

## read-output

Read terminal output buffer.

**Parameters:**
- `sessionId` (string, required): Session ID
- `lines` (number, optional): Number of lines to return
- `clear` (boolean, optional): Clear buffer after reading

---

## wait-for-pattern

Wait for pattern in output.

**Parameters:**
- `sessionId` (string, required): Session ID
- `pattern` (string, required): Regex pattern
- `timeout` (number, optional): Timeout in ms
- `clear` (boolean, optional): Clear buffer after match

---

## list-sessions

List all active sessions. No parameters.

---

## close-terminal

Close terminal session.

**Parameters:**
- `sessionId` (string, required): Session ID

---

## open-terminal-window

Open or reopen terminal window for visible session.

**Parameters:**
- `sessionId` (string, required): Session ID
