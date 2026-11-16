const ICE_GATHERING_TIMEOUT_MS = 20000;

export function waitForIceGatheringComplete(peer, timeoutMs = ICE_GATHERING_TIMEOUT_MS) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado aguardando a coleta de candidatos de rede (ICE).'));
    }, timeoutMs);

    const onChange = () => {
      if (peer.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onChange);
    };

    peer.addEventListener('icegatheringstatechange', onChange);
  });
}

export function createPeerConnection({ iceServers = [] } = {}) {
  return new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });
}

export async function createOffer(peer) {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  await waitForIceGatheringComplete(peer);
  return peer.localDescription;
}

export async function acceptOfferAndCreateAnswer(peer, offer) {
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  await waitForIceGatheringComplete(peer);
  return peer.localDescription;
}

export async function acceptAnswer(peer, answer) {
  await peer.setRemoteDescription(answer);
}

export function waitForDataChannelOpen(channel, timeoutMs = 25000) {
  if (channel.readyState === 'open') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('A conexão não foi estabelecida. Verifique se os aparelhos estão na mesma rede Wi-Fi.'));
    }, timeoutMs);

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      reject(new Error('O canal WebRTC foi fechado antes de conectar.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener('open', onOpen);
      channel.removeEventListener('close', onClose);
    };

    channel.addEventListener('open', onOpen);
    channel.addEventListener('close', onClose);
  });
}
