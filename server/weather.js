let current = null;

async function refresh() {
  try {
    const res = await fetch('https://wttr.in/?format=j1&lang=zh', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`wttr.in ${res.status}`);
    const data = await res.json();
    const cond = data?.current_condition?.[0];
    current = {
      location: data?.nearest_area?.[0]?.areaName?.[0]?.value || '',
      tempC: cond?.temp_C ?? null,
      desc: cond?.lang_zh?.[0]?.value || cond?.weatherDesc?.[0]?.value || '',
      humidity: cond?.humidity ?? null,
      windKmph: cond?.windspeedKmph ?? null,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[weather] refresh failed:', err.message);
  }
}

function start() {
  refresh();
  setInterval(refresh, 30 * 60 * 1000);
}

function getCached() {
  return current;
}

export { start, getCached };
