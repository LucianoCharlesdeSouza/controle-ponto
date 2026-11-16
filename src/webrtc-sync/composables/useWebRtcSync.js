import { ref, computed, onBeforeUnmount } from 'vue';
import {
  createPeerConnection,
  createOffer,
  acceptOfferAndCreateAnswer,
  acceptAnswer,
  waitForDataChannelOpen,
} from '../core/webrtc-peer';
import { createQrSignalFrames, createSignalAssembler } from '../core/qr-signaling';
import { createDataChannelProtocol } from '../core/data-channel';

export function useWebRtcSync(role) {
  const status = ref('idle');
  const error = ref('');
  const progress = ref(null);
  const qrFrames = ref([]);
  const qrIndex = ref(0);
  const receivedData = ref(null);
  const peerInfo = ref('');
  const connected = computed(() => status.value === 'connected');

  let peer = null;
  let channel = null;
  let protocol = null;
  let assembler = createSignalAssembler();
  const dataHandlers = new Set();

  function setError(value) {
    error.value = value instanceof Error ? value.message : String(value);
    status.value = 'error';
  }

  function attachChannel(dataChannel) {
    channel = dataChannel;
    protocol = createDataChannelProtocol(channel, {
      onData: async (payload, metadata) => {
        receivedData.value = payload;
        for (const handler of dataHandlers) await handler(payload, metadata);
      },
      onProgress: value => { progress.value = value; },
      onState: value => {
        if (value.type === 'open') status.value = 'connected';
        if (value.type === 'closed' && status.value !== 'closed') status.value = 'closed';
        if (value.type === 'error') error.value = value.message;
      },
    });
  }

  async function startAsOfferer() {
    if (role !== 'a') throw new Error('Somente o aparelho A pode iniciar a oferta.');
    reset();
    status.value = 'creating-offer';
    try {
      peer = createPeerConnection({ iceServers: [] });
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed') setError('Conexão WebRTC falhou. Verifique a rede Wi-Fi e o isolamento de clientes do roteador.');
        if (peer?.connectionState === 'disconnected') status.value = 'disconnected';
      };
      attachChannel(peer.createDataChannel('p2p-sync-v1', { ordered: true }));
      const offer = await createOffer(peer);
      qrFrames.value = await createQrSignalFrames(offer);
      qrIndex.value = 0;
      status.value = 'showing-offer';
    } catch (e) {
      setError(e);
      throw e;
    }
  }

  async function acceptOffer(signal) {
    if (role !== 'b') throw new Error('Somente o aparelho B aceita a oferta.');
    reset();
    status.value = 'creating-answer';
    try {
      peer = createPeerConnection({ iceServers: [] });
      peer.ondatachannel = event => attachChannel(event.channel);
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed') setError('Conexão WebRTC falhou. Verifique a rede Wi-Fi e o isolamento de clientes do roteador.');
        if (peer?.connectionState === 'disconnected') status.value = 'disconnected';
      };
      const answer = await acceptOfferAndCreateAnswer(peer, signal);
      qrFrames.value = await createQrSignalFrames(answer);
      qrIndex.value = 0;
      status.value = 'showing-answer';
    } catch (e) {
      setError(e);
      throw e;
    }
  }

  async function acceptAnswerSignal(signal) {
    if (role !== 'a') throw new Error('Somente o aparelho A aceita a resposta.');
    if (!peer) throw new Error('Crie uma oferta antes de ler a resposta.');
    status.value = 'connecting';
    try {
      await acceptAnswer(peer, signal);
      await waitForDataChannelOpen(channel);
      status.value = 'connected';
    } catch (e) {
      setError(e);
      throw e;
    }
  }

  async function receiveSignalFrame(raw, expectedType) {
    const result = await assembler.add(raw);
    if (!result.complete) return result;

    if (result.signal.type !== expectedType) {
      throw new Error(`Era esperada uma mensagem ${expectedType}, mas foi recebido ${result.signal.type}.`);
    }

    if (expectedType === 'offer') await acceptOffer(result.signal);
    else await acceptAnswerSignal(result.signal);

    assembler.reset();
    return { complete: true };
  }

  async function sendData(payload) {
    if (!connected.value || !protocol) throw new Error('Conecte os aparelhos antes de enviar dados.');
    return protocol.send(payload);
  }

  function onData(handler) {
    dataHandlers.add(handler);
    return () => dataHandlers.delete(handler);
  }

  function nextQr() {
    if (qrIndex.value < qrFrames.value.length - 1) qrIndex.value++;
  }

  function previousQr() {
    if (qrIndex.value > 0) qrIndex.value--;
  }

  function reset() {
    protocol?.close();
    protocol = null;
    if (channel && channel.readyState !== 'closed') channel.close();
    if (peer) peer.close();
    peer = null;
    channel = null;
    assembler.reset();
    status.value = 'idle';
    error.value = '';
    progress.value = null;
    qrFrames.value = [];
    qrIndex.value = 0;
    receivedData.value = null;
  }

  onBeforeUnmount(reset);

  return {
    status,
    error,
    progress,
    qrFrames,
    qrIndex,
    receivedData,
    peerInfo,
    connected,
    currentQr: computed(() => qrFrames.value[qrIndex.value] || ''),
    startAsOfferer,
    receiveSignalFrame,
    sendData,
    onData,
    nextQr,
    previousQr,
    reset,
  };
}
