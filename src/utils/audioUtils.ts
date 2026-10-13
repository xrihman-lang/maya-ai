export async function playPCM(base64Data: string): Promise<void> {
  if (!base64Data) return;

  try {
    // If it's a standard WAV container (starts with 'UklGR' which is 'RIFF' in Base64)
    if (base64Data.startsWith("UklGR")) {
      return new Promise<void>((resolve) => {
        try {
          const audio = new Audio(`data:audio/wav;base64,${base64Data}`);
          audio.onended = () => resolve();
          audio.onerror = () => {
            // Fallback to Web Audio API if HTML5 Audio encounters an issue
            playRawPCM(base64Data).then(resolve);
          };
          audio.play().catch(() => {
            playRawPCM(base64Data).then(resolve);
          });
        } catch {
          playRawPCM(base64Data).then(resolve);
        }
      });
    }

    // Otherwise play as raw PCM
    return playRawPCM(base64Data);
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

async function playRawPCM(base64Data: string): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    const audioCtx = new AudioContextClass({ sampleRate: 24000 });
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new Int16Array(bytes.buffer);
    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.error("Error playing raw PCM:", error);
  }
}
