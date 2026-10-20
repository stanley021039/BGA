export async function fileBase64(file: File, maxBytes = 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) throw new Error(`圖片不得超過 ${maxBytes / 1024 / 1024} MB`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取檔案'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

export async function audioDuration(file: File, signal: AbortSignal): Promise<number> {
  const audio = new Audio(),
    url = URL.createObjectURL(file);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  try {
    return await new Promise((resolve, reject) => {
      cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) return cancel();
      timer = setTimeout(
        () => reject(new Error('無法讀取音樂長度，請換一個有效的音樂檔案。')),
        15000,
      );
      audio.onloadedmetadata = () =>
        Number.isFinite(audio.duration)
          ? resolve(audio.duration)
          : reject(new Error('無法讀取音樂長度。'));
      audio.onerror = () => reject(new Error('瀏覽器無法解碼這個音樂檔案。'));
      audio.src = url;
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    audio.onloadedmetadata = audio.onerror = null;
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}
