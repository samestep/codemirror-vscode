import * as vscode from "vscode";

export class Subscriber {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private log: vscode.LogOutputChannel,
    private uriStr: string,
  ) {
    log.debug("opening:", uriStr);
  }

  add(disposable: vscode.Disposable) {
    this.disposables.push(disposable);
  }

  /** Short for "subscribe". */
  scribe<T>(event: vscode.Event<T>, listener: (event: T) => void) {
    event(listener, undefined, this.disposables);
  }

  dispose() {
    this.log.debug("disposing:", this.uriStr);
    while (this.disposables.length > 0) this.disposables.pop()?.dispose();
  }
}
