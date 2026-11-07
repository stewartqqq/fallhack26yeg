import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

// Messages the extension sends into the webview.
type ToWebview =
  | { type: 'next' }
  | { type: 'reset' }
  | { type: 'replay' }
  | { type: 'getHeist'; id: number }
  | { type: 'petAway'; away: boolean; landX?: number }
  | { type: 'inspectDone'; landX?: number }
  | { type: 'rageQuit' }
  | { type: 'restored' }
  | { type: 'codeReady'; ready: boolean }
  | { type: 'submitResult'; ok: boolean };

type HeistConfig = {
  line: string;
  startXFrac: number;
  startYFromBottom: number;
  chatXFromRight: number;
  chatYFrac: number;
};

// Messages the webview sends back.
type FromWebview =
  | { type: 'stage'; stage: string }
  | { type: 'log'; text: string }
  | ({ type: 'heist'; id: number } & HeistReply)
  | InspectRequest
  | { type: 'restoreCode' }
  | { type: 'submitCode' };

/** Where the pet / panel is, in screen coordinates (null until the user has touched the panel). */
type PanelRect = { petX: number; groundY: number; minX: number; maxX: number; left: number; top: number; width: number };
type HeistPanel = PanelRect | null;

/** Eyes stage: the pet floats out over the code. */
type InspectRequest = {
  type: 'inspect';
  png: string;
  panel: PanelRect;
  margin: number;
  endScale: number;
  lines: string[];
  inspect: { editorTop: number; gutter: number; charWidth: number; lineHeight: number; speed: number; holdMs: number };
};
type HeistReply = { png: string; heist: HeistConfig; panel: HeistPanel; margin: number; endScale: number };

class SidekickViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'sidekick.view';

  private view?: vscode.WebviewView;
  private heistRequests = new Map<number, (r: HeistReply) => void>();
  private nextId = 1;
  /** Current stage as reported by the webview. Used for editor detection. */
  stage = 'character';
  /** Messages the rest of the extension cares about (inspect, restoreCode, submitCode, stage). */
  onMessage?: (msg: FromWebview) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage((msg: FromWebview) => {
      if (msg.type === 'stage') {
        this.stage = msg.stage;
      } else if (msg.type === 'log') {
        console.log('[sidekick]', msg.text);
      } else if (msg.type === 'heist') {
        this.heistRequests.get(msg.id)?.(msg);
        this.heistRequests.delete(msg.id);
      }
      this.onMessage?.(msg);
    });
  }

  /** Post to the webview, opening the panel first if it hasn't been shown yet. */
  async post(msg: ToWebview) {
    if (!this.view) {
      await vscode.commands.executeCommand(`${SidekickViewProvider.viewId}.focus`);
    }
    this.view?.webview.postMessage(msg);
  }

  /** Ask the webview for the pet PNG + heist config (positions, line). */
  async requestHeist(): Promise<HeistReply | undefined> {
    const id = this.nextId++;
    const reply = new Promise<HeistReply>((resolve) =>
      this.heistRequests.set(id, resolve)
    );
    await this.post({ type: 'getHeist', id });
    const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500));
    return Promise.race([reply, timeout]);
  }

  private getHtml(webview: vscode.Webview): string {
    const media = (...p: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', ...p));
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @font-face {
      font-family: 'Gloria Hallelujah';
      src: url('${media('fonts', 'GloriaHallelujah.ttf')}') format('truetype');
    }
  </style>
  <link rel="stylesheet" href="${media('webview', 'style.css')}">
</head>
<body>
  <canvas id="stage"></canvas>

  <!-- Onboarding overlay: character pick, analyzing, sprite pick -->
  <section id="onboarding"></section>

  <!-- Interaction card (bottom-right) -->
  <aside id="card" class="sketchy hidden">
    <div class="pad-wrap">
      <canvas id="pad"></canvas>
      <span id="pad-hint">draw with touchpad</span>
    </div>
    <div class="card-actions">
      <button id="btn-done" class="btn primary">Done</button>
      <button id="btn-clear" class="btn">Clear</button>
    </div>
    <button id="btn-submit" class="btn primary submit hidden">submit code</button>
  </aside>

  <div id="note" class="hidden"></div>

  <script nonce="${nonce}" src="${media('webview', 'config.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'sound.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'scenery.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'speech.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'walk.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'main.js')}"></script>
</body>
</html>`;
  }
}

/**
 * Desktop overlay (media/overlay.ps1): a transparent, click-through, always-on-top window
 * that lets the pet leave the panel. Spawned once up front because PowerShell takes ~1.5s to start.
 */
class Overlay {
  private proc?: ChildProcessWithoutNullStreams;
  private listeners: ((line: string) => void)[] = [];

  constructor(private readonly extensionUri: vscode.Uri, private readonly log: vscode.OutputChannel) {}

  start() {
    if (this.proc && this.proc.exitCode === null) return;
    const media = vscode.Uri.joinPath(this.extensionUri, 'media').fsPath;
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(media, 'overlay.ps1'), path.join(media, 'fonts') + path.sep],
      { windowsHide: true }
    );
    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        this.log.appendLine(`overlay: ${line}`);
        this.listeners.forEach((l) => l(line));
      }
    });
    proc.stderr.on('data', (d) => this.log.append(`overlay error: ${d}`));
    proc.on('exit', (code) => this.log.appendLine(`overlay exited (${code})`));
    this.proc = proc;
  }

  onLine(fn: (line: string) => void) {
    this.listeners.push(fn);
  }

  heist({ png, heist: h, panel, margin, endScale }: HeistReply) {
    this.start();
    const line = h.line.replace(/[\t\r\n]/g, ' ');
    this.proc!.stdin.write(
      [
        'heist', line, h.startXFrac, h.startYFromBottom, h.chatXFromRight, h.chatYFrac,
        panel ? 1 : 0, panel?.petX ?? 0, panel?.groundY ?? 0, panel?.minX ?? 0, panel?.maxX ?? 0,
        margin, endScale, png,
      ].join('\t') + '\n'
    );
  }

  /** Eyes stage: float over the code (box in screen coords), one roast line per stop, then back. */
  tour(req: InspectRequest, code: { left: number; top: number; width: number; height: number }) {
    this.start();
    const b64 = (t: string) => Buffer.from(t, 'utf8').toString('base64');
    const p = req.panel;
    this.proc!.stdin.write(
      [
        'tour', req.margin, req.endScale, p.petX, p.groundY,
        code.left, code.top, code.width, code.height,
        p.left, p.left + p.width, p.top,
        req.inspect.speed, req.inspect.holdMs,
        req.lines.map(b64).join(','), req.png,
      ].join('\t') + '\n'
    );
  }

  dispose() {
    this.proc?.kill();
  }
}

const DEMO_FILE = 'two_sum.py';
const isDemoDoc = (doc: vscode.TextDocument) => path.basename(doc.fileName) === DEMO_FILE;
const squash = (t: string) => t.replace(/\s+/g, '');
/** The empty line under `if complement in seen:` has something on it now. */
const hasAnswerLine = (t: string) => /if\s+complement\s+in\s+seen\s*:[ \t]*\r?\n[ \t]*\S/.test(t);
/** Either order of the two indices is a correct Two Sum answer. */
const isSolved = (t: string) =>
  squash(t).includes('return[seen[complement],i]') || squash(t).includes('return[i,seen[complement]]');

/** Where the code text is on screen, estimated from the panel (the editor sits right above it). */
function codeBox(req: InspectRequest) {
  const editor =
    vscode.window.visibleTextEditors.find((e) => isDemoDoc(e.document)) ?? vscode.window.activeTextEditor;
  const lines = (editor?.document.getText() ?? '').replace(/\t/g, '    ').split(/\r?\n/);
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  const cfg = vscode.workspace.getConfiguration('editor');
  const fontSize = cfg.get<number>('fontSize', 14);
  const lh = cfg.get<number>('lineHeight', 0);
  const lineHeight = lh <= 0 ? fontSize * req.inspect.lineHeight : lh < 8 ? lh * fontSize : lh;
  const maxLen = Math.max(20, ...lines.map((l) => l.length));
  return {
    left: req.panel.left + req.inspect.gutter,
    top: req.inspect.editorTop, // from the window's top edge
    width: maxLen * fontSize * req.inspect.charWidth,
    height: Math.max(1, lines.length) * lineHeight,
  };
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new SidekickViewProvider(context.extensionUri);
  const log = vscode.window.createOutputChannel('doodle in distress');
  const overlay = new Overlay(context.extensionUri, log);
  overlay.start();

  // Chat heist: we own the chat shortcut, so we know exactly when chat gets opened.
  let heistRunning = false;
  let heistSafety: NodeJS.Timeout | undefined;
  const endHeist = (landX?: number) => {
    clearTimeout(heistSafety);
    heistRunning = false;
    provider.post({ type: 'petAway', away: false, landX });
  };
  // Which overlay routine is running: the chat heist or the eyes-stage code inspection.
  let overlayJob: 'heist' | 'inspect' | null = null;
  let inspectSafety: NodeJS.Timeout | undefined;
  overlay.onLine((line) => {
    if (line === 'kick') vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    else if (line.startsWith('done')) {
      // "done <screen x>": where it landed back in the panel
      const x = parseFloat(line.split(' ')[1]);
      const landX = Number.isFinite(x) ? x : undefined;
      if (overlayJob === 'inspect') {
        clearTimeout(inspectSafety);
        provider.post({ type: 'inspectDone', landX });
      } else endHeist(landX);
      overlayJob = null;
    }
  });

  // ----- the story's editor side: inspection, rage-quit rescue, submit -----
  let snapshot: string | undefined; // last version of two_sum.py that still had real code in it
  let restoring = false;
  let readyTimer: NodeJS.Timeout | undefined;
  const demoDoc = () => vscode.workspace.textDocuments.find(isDemoDoc);

  const sendCodeReady = () => {
    const doc = demoDoc();
    provider.post({ type: 'codeReady', ready: !!doc && hasAnswerLine(doc.getText()) });
  };

  provider.onMessage = async (msg) => {
    if (msg.type === 'inspect') {
      if (overlayJob) return;
      overlayJob = 'inspect';
      overlay.tour(msg, codeBox(msg));
      // never leave the pet stranded outside its panel
      inspectSafety = setTimeout(() => {
        overlayJob = null;
        provider.post({ type: 'inspectDone' });
      }, 30000);
    } else if (msg.type === 'restoreCode') {
      const doc = demoDoc();
      if (doc && snapshot) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), snapshot);
        await vscode.workspace.applyEdit(edit);
      }
      restoring = false;
      provider.post({ type: 'restored' });
    } else if (msg.type === 'submitCode') {
      const doc = demoDoc();
      provider.post({ type: 'submitResult', ok: !!doc && isSolved(doc.getText()) });
    } else if (msg.type === 'stage' && msg.stage === 'coding') {
      sendCodeReady();
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!isDemoDoc(e.document) || e.contentChanges.length === 0) return;
      const text = e.document.getText();
      if (text.trim().length > 60) snapshot = text;
      if (provider.stage !== 'coding' || restoring) return;
      // you deleted (nearly) everything: rage quit
      if (text.trim().length < 15 && snapshot) {
        restoring = true;
        provider.post({ type: 'rageQuit' });
        return;
      }
      // once you stop typing, tell the webview whether there's an answer to submit
      clearTimeout(readyTimer);
      readyTimer = setTimeout(sendCodeReady, 1200);
    }),
  );
  // the starting code counts as the first snapshot
  const initial = demoDoc();
  if (initial && initial.getText().trim().length > 60) snapshot = initial.getText();

  const chatHeist = async () => {
    await vscode.commands.executeCommand('workbench.action.chat.open');
    if (heistRunning || overlayJob) return;
    heistRunning = true;
    overlayJob = 'heist';
    const req = await provider.requestHeist();
    if (!req) {
      log.appendLine('heist: webview did not answer');
      heistRunning = false;
      overlayJob = null;
      return;
    }
    // Let the chat finish opening so the pet visibly "notices" it.
    await new Promise((r) => setTimeout(r, 500));
    provider.post({ type: 'petAway', away: true });
    overlay.heist(req);
    heistSafety = setTimeout(() => {
      overlayJob = null;
      endHeist();
    }, 12000); // never leave the pet stranded
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidekickViewProvider.viewId, provider, {
      // Keep the pet alive when the user switches to the Terminal tab.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('sidekick.next', () => provider.post({ type: 'next' })),
    vscode.commands.registerCommand('sidekick.reset', () => provider.post({ type: 'reset' })),
    vscode.commands.registerCommand('sidekick.replay', () => provider.post({ type: 'replay' })),
    vscode.commands.registerCommand('sidekick.chatHeist', chatHeist),
    log,
    overlay,
  );
}

export function deactivate() {}
