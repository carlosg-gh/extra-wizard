import * as Comlink from 'comlink';
import { useEffect, useRef, useState } from 'react';
import type { Card, MatchMode } from '@core';
import type { MatchResult } from '../data/types';

export interface WorkerApi {
  whenReady(): Promise<number>;
  query(selected: Card[], mode: MatchMode, includeUnparsed: boolean): Promise<MatchResult[]>;
}

export function useMatchWorker(): {
  api: React.MutableRefObject<Comlink.Remote<WorkerApi> | null>;
  ready: boolean;
  dbCount: number;
} {
  const api = useRef<Comlink.Remote<WorkerApi> | null>(null);
  const [ready, setReady] = useState(false);
  const [dbCount, setDbCount] = useState(0);

  useEffect(() => {
    const worker = new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module' });
    const wrapped = Comlink.wrap<WorkerApi>(worker);
    api.current = wrapped;
    wrapped.whenReady().then((n) => {
      setDbCount(n);
      setReady(true);
    });
    return () => {
      worker.terminate();
      api.current = null;
    };
  }, []);

  return { api, ready, dbCount };
}
