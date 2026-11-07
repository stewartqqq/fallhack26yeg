import * as vscode from 'vscode';
import * as crypto from 'crypto';

// Messages the extension sends into the webview.
type ToWebview =
  | { type: 'next' }
  | { type: 'reset' }
  | { type: 'replay' };

// Messages the webview sends back.
type FromWebview =
  | { type: 'stage'; stage: string }
  | { type: 'log'; text: string };

class SidekickViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'sidekick.view';

  private view?: vscode.WebviewView;
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

  <div id="toast" class="hidden"></div>

  <script nonce="${nonce}" src="${media('webview', 'config.js')}"></script>
  <script nonce="${nonce}" src="${media('webview', 'main.js')}"></script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new SidekickViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidekickViewProvider.viewId, provider, {
      // Keep the pet alive when the user switches to the Terminal tab.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('sidekick.next', () => provider.post({ type: 'next' })),
    vscode.commands.registerCommand('sidekick.reset', () => provider.post({ type: 'reset' })),
    vscode.commands.registerCommand('sidekick.replay', () => provider.post({ type: 'replay' })),
  );
}

export function deactivate() {}
