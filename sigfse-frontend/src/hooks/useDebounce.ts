// src/hooks/useDebounce.ts
// Adia a atualização de um valor por `delay` ms.
// Evita disparar uma requisição GET /students/search a cada tecla digitada.
//
// Uso:
//   const [q, setQ] = useState('');
//   const debouncedQ = useDebounce(q, 300);
//   useEffect(() => { if (debouncedQ.length >= 2) studentsApi.search(debouncedQ); }, [debouncedQ]);

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}