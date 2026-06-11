/**
 * Self-contained CSS for the injected UI. Lives inside a Shadow DOM so host
 * page styles can't bleed in and ours can't leak out. Palette is the official
 * sovseal brand blend: obsidian black surfaces (#0B1215) and metallic gold accents (#D4AF37).
 */
export const SHADOW_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.sov-root {
  --bg: #0B1215; --card: #121C20; --border: #243237;
  --fg: #F5F7F8; --muted: #7A8E96;
  --primary: #D4AF37; --primary-fg: #0B1215;
  --purple: #D4AF37; --purple-200: #EAD076; --danger: #ef4444;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--fg);
  position: fixed; z-index: 2147483646;
}

/* launcher */
.sov-launcher {
  position: fixed; right: 20px; bottom: 20px; width: 44px; height: 44px;
  border-radius: 14px; border: 1px solid var(--border);
  background: linear-gradient(160deg, #EAD076, #B29124);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,.45); transition: transform .15s ease;
}
.sov-launcher:hover { transform: translateY(-2px); }
.sov-launcher svg { width: 22px; height: 22px; }
.sov-launcher .sov-dot {
  position: absolute; top: -3px; right: -3px; width: 12px; height: 12px;
  border-radius: 50%; border: 2px solid var(--bg); background: var(--muted);
}
.sov-launcher .sov-dot.on { background: #22c55e; }
.sov-launcher .sov-dot.off { background: var(--danger); }

/* panel */
.sov-panel {
  position: fixed; right: 20px; bottom: 76px; width: 340px; max-height: 70vh;
  background: var(--bg); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: 0 16px 50px rgba(0,0,0,.55); display: none; flex-direction: column;
  overflow: hidden;
}
.sov-panel.open { display: flex; }
.sov-head {
  display: flex; align-items: center; gap: 8px; padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.sov-head .sov-title { font-weight: 600; font-size: 14px; letter-spacing: .2px; }
.sov-head .sov-status { margin-left: auto; font-size: 11px; color: var(--muted); display:flex; align-items:center; gap:6px; }
.sov-statusdot { width:8px; height:8px; border-radius:50%; background: var(--muted); }
.sov-statusdot.on { background:#22c55e; } .sov-statusdot.off { background: var(--danger); }

.sov-tabs { display:flex; gap:4px; padding: 8px 12px 0; }
.sov-tab {
  font-size: 12px; padding: 6px 10px; border-radius: 8px 8px 0 0; cursor: pointer;
  color: var(--muted); border: 1px solid transparent; border-bottom: none;
}
.sov-tab.active { color: var(--fg); background: var(--card); border-color: var(--border); }

.sov-body { padding: 12px; overflow-y: auto; flex: 1; }
.sov-empty { color: var(--muted); font-size: 12px; padding: 18px 6px; text-align:center; line-height:1.5; }

.sov-item {
  background: var(--card); border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 12px; margin-bottom: 8px; font-size: 12.5px; line-height: 1.45;
}
.sov-item .sov-text { color: var(--fg); white-space: pre-wrap; word-break: break-word; }
.sov-item .sov-row { display:flex; align-items:center; gap:8px; margin-top:8px; }
.sov-meta { font-size: 10.5px; color: var(--muted); }
.sov-btn {
  font-family: inherit; font-size: 11.5px; border-radius: 8px; padding: 5px 10px;
  cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--fg);
}
.sov-btn:hover { border-color: var(--purple); }
.sov-btn.primary { background: var(--primary); color: var(--primary-fg); border-color: transparent; font-weight: 600; }
.sov-btn.danger:hover { border-color: var(--danger); color: var(--danger); }
.sov-btn.icon { padding: 5px 8px; margin-left:auto; }

.sov-foot {
  border-top: 1px solid var(--border); padding: 10px 14px; display:flex;
  align-items:center; gap:8px; font-size: 11.5px; color: var(--muted);
}
.sov-toggle { margin-left:auto; display:flex; align-items:center; gap:6px; cursor:pointer; }
.sov-switch { width: 32px; height: 18px; border-radius: 999px; background: var(--border); position:relative; transition: background .15s; }
.sov-switch.on { background: var(--purple); }
.sov-knob { position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition: left .15s; }
.sov-switch.on .sov-knob { left: 16px; }

/* first-run notice */
.sov-notice { background: var(--card); border:1px solid var(--border); border-radius:10px; padding:12px; font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:10px; }
.sov-notice b { color: var(--fg); }

/* toast */
.sov-toast {
  position: fixed; right: 20px; bottom: 76px; background: var(--card);
  border: 1px solid var(--purple); color: var(--fg); font-size: 12.5px;
  padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.5);
  opacity: 0; transform: translateY(8px); transition: all .2s ease; pointer-events:none;
  font-family: 'Inter', system-ui, sans-serif;
}
.sov-toast.show { opacity: 1; transform: translateY(0); }

.sov-body::-webkit-scrollbar { width: 8px; }
.sov-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
`;
