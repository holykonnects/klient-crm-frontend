// === 2. useCachedFetch.js ===
// File: src/hooks/useCachedFetch.js
import { useEffect, useState } from 'react';

export const useCachedFetch = (key, url) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem(key);
    if (cached) {
      setData(JSON.parse(cached));
      setLoading(false);
    }

    fetch(url)
      .then(res => res.json())
      .then(fresh => {
        setData(fresh);
        localStorage.setItem(key, JSON.stringify(fresh));
      })
      .finally(() => setLoading(false));
  }, [key, url]);

  return { data, loading };
};
