// src/hooks/useFetch.ts
// Hook genérico para executar chamadas às funções da src/api/.
// Gerencia estado de loading, erro e exibe toast automático em caso de falha.
//
// Uso:
//   const { execute, data, isLoading, error } = useFetch(studentsApi.list);
//   useEffect(() => { execute(); }, []);
//
//   const { execute: create, isLoading: creating } = useFetch(studentsApi.create);
//   await create({ fullName: '...', lgpdConsent: true, ... });

import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface FetchState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export function useFetch<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [state, setState] = useState<FetchState<TResult>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await fn(...args);
        setState({ data: result, isLoading: false, error: null });
        return result;
      } catch (err: unknown) {
        // Extrai mensagem do envelope de erro do backend { error: { message } }
        const message = axios.isAxiosError(err)
          ? err.response?.data?.error?.message ?? err.message
          : 'Erro inesperado. Tente novamente.';
        setState({ data: null, isLoading: false, error: message });
        toast.error(message);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}