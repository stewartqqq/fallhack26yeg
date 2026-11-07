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
  | { type: 'petAway'; away: boolean; landX?: number };

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
  | ({ type: 'heist'; id: number } & HeistReply);

/** Where the pet is in the panel, in screen coordinates (null until the user has touched the panel). */
type HeistPanel = { petX: number; groundY: number; minX: number; maxX: number } | null;
type HeistReply = { png: string; heist: HeistConfig; panel: HeistPanel; margin: number; endScale: number };

class SidekickViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'sidekick.view';

  private view?: vscode.WebviewView;
  private heistRequests = new Map<number, (r: HeistReply) => void>();
  private nextId = 1;
  /** Current stage as reported by the webview. Used later for editor detection. */
  stage = 'character';

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
      <button id="btn-tokens" class="btn hidden">Feed tokens</button>
    </div>
  </aside>

  <div id="note" class="hidden"></div>

  <script nonce="${nonce}" src="${media('webview', 'config.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'sound.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'scenery.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'speech.js')}"></script>
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

  dispose() {
    this.proc?.kill();
  }
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
  overlay.onLine((line) => {
    if (line === 'kick') vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    else if (line.startsWith('done')) {
      // "done <screen x>": where it landed back in the panel
      const x = parseFloat(line.split(' ')[1]);
      endHeist(Number.isFinite(x) ? x : undefined);
    }
  });

  const chatHeist = async () => {
    await vscode.commands.executeCommand('workbench.action.chat.open');
    if (heistRunning) return;
    heistRunning = true;
    const req = await provider.requestHeist();
    if (!req) {
      log.appendLine('heist: webview did not answer');
      heistRunning = false;
      return;
    }
    // Let the chat finish opening so the pet visibly "notices" it.
    await new Promise((r) => setTimeout(r, 500));
    provider.post({ type: 'petAway', away: true });
    overlay.heist(req);
    heistSafety = setTimeout(() => endHeist(), 12000); // never leave the pet stranded
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
