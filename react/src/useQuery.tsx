import { useEffect, useRef, useState } from 'react';
import { Result, ResultType } from '@routier/core/results';

type LiveQueryState<T> = 
  | { status: 'pending'; loading: true; error: null; data: undefined }
  | { status: 'error'; loading: false; error: Error; data: undefined }
  | { status: 'success'; loading: false; error: null; data: T };

  export function useQuery<T>(
    query: (callback: (result: ResultType<T>) => void) => void | (() => void),
    deps: any[] = []
  ): LiveQueryState<T> {
    const [state, setState] = useState<LiveQueryState<T>>({
      status: 'pending',
      loading: true,
      error: null,
      data: undefined
    });
  
    const unsubscribeRef = useRef<(() => void) | null>(null);
  
    useEffect(() => {
      setState({
        status: 'pending',
        loading: true,
        error: null,
        data: undefined
      });
  
      const unsubscribe = query((result) => {
        if (result.ok === Result.SUCCESS) {
          setState({
            status: 'success',
            loading: false,
            error: null,
            data: result.data
          });
        } else {
          setState({
            status: 'error',
            loading: false,
            error: new Error(result.error?.message || 'Unknown error'),
            data: undefined
          });
        }
      });
  
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribeRef.current = unsubscribe;
      }
  
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }, deps);
  
    return state;
  }