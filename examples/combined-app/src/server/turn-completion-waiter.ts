interface PendingTurn {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class TurnCompletionWaiter {
  private pending: PendingTurn | null = null;

  wait(send: () => Promise<void>, timeoutMs: number): Promise<void> {
    if (this.pending) {
      return Promise.reject(new Error("Codex is already waiting for a turn to complete"));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectPending(new Error(`Codex turn timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending = { resolve, reject, timer };
      void Promise.resolve()
        .then(send)
        .catch((error: unknown) => {
          this.rejectPending(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  completeNext(): boolean {
    const pending = this.takePending();
    if (!pending) return false;
    pending.resolve();
    return true;
  }

  rejectPending(error: Error): boolean {
    const pending = this.takePending();
    if (!pending) return false;
    pending.reject(error);
    return true;
  }

  private takePending(): PendingTurn | null {
    const pending = this.pending;
    if (!pending) return null;
    this.pending = null;
    clearTimeout(pending.timer);
    return pending;
  }
}
