// Original source: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/utils/DebugHelper.ts#L1

export const durationTreshold = 0; //0.05; //ms

export function setDebugging(value: boolean) {
  DEBUGGING = (process.env.NODE_ENV === 'development') 
  ? value
  : false;
}

export let DEBUGGING = false;

export const log = console.log.bind(window.console);
export const debug = (fn: CallableFunction, fnName: string, ...messages: unknown[]) => {
  console.log(fnName,fn,...messages);
};

export class CustomMutationObserver {
  private originalCallback: MutationCallback;
  private observer: MutationObserver | null;
  private name: string;

  constructor(callback: MutationCallback, name: string) {
    this.originalCallback = callback;
    this.observer = null;
    this.name = name;
  }

  observe(target: Node, options: MutationObserverInit) {
    const wrappedCallback: MutationCallback = async (mutationsList, observer) => {
      const startTime = performance.now(); // Get start time
      await this.originalCallback(mutationsList, observer); // Invoke the original callback
      const endTime = performance.now(); // Get end time
      const executionTime = endTime - startTime;
      if (executionTime > durationTreshold) {
        console.log(`${CustomMutationObserver.name}.${this.name} MutationObserver callback took ${executionTime}ms to execute`, observer);
      }
    };

    this.observer = new MutationObserver(wrappedCallback);

    // Start observing with the modified callback
    this.observer.observe(target, options);
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}