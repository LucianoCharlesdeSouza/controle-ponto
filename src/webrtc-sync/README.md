# Módulo WebRTC P2P para Vue 3 + Android Chrome

Módulo independente para parear dois PWAs pela leitura de QR Codes e trocar dados diretamente por WebRTC DataChannel.

## Requisitos

- Vue 3
- Navegadores Android Chromium (Chrome recomendado)
- Dependências já existentes no projeto:
  - `qrcode`
  - `html5-qrcode`

Não requer servidor de sinalização. A oferta e a resposta WebRTC são trocadas por QR Code.
A configuração ICE padrão usa somente candidatos locais (`iceServers: []`), apropriado para primeiro teste na mesma rede Wi-Fi. O sucesso depende da rede permitir comunicação direta entre os clientes.

## Arquivos

Copie `src/webrtc-sync` para `src/webrtc-sync` no seu projeto.

As duas páginas de demonstração estão em:
- `AppA.vue`: rota `/app-a`
- `AppB.vue`: rota `/app-b`

Adicione-as às rotas que você já criou, por exemplo:

```js
{
  path: '/app-a',
  component: () => import('@/webrtc-sync/pages/AppA.vue'),
},
{
  path: '/app-b',
  component: () => import('@/webrtc-sync/pages/AppB.vue'),
},
```

Ajuste o alias `@` conforme seu projeto.

## Como testar

1. Publique/execute o mesmo PWA nos dois Android e conecte ambos à mesma rede Wi-Fi.
2. Abra `/app-a` no primeiro e `/app-b` no segundo.
3. No aparelho A, toque em **Criar conexão**.
4. No aparelho B, toque em **Ler QR da oferta** e escaneie os QR Codes apresentados pelo A. Se houver mais de um fragmento, avance os QR Codes no A até completar.
5. No aparelho B, toque em **Ler QR da resposta** no A e escaneie todos os fragmentos da resposta.
6. Aguarde o canal ficar conectado.
7. Use o campo JSON para enviar um objeto de teste em qualquer direção.

O leitor pede permissão de câmera. Use HTTPS ou localhost; PWAs instalados servidos por HTTPS atendem ao requisito de contexto seguro.

## Integração com IndexedDB

O transporte não conhece o seu schema IndexedDB. Quando conectado, use:

```js
const { sendData, onData } = useWebRtcSync();

// Enviar um snapshot/exportação obtido pelo seu repositório IndexedDB:
await sendData({
  kind: 'database-export',
  exportedAt: new Date().toISOString(),
  stores: {
    clientes: clientes,
    produtos: produtos,
    pedidos: pedidos,
  },
});

// Receber e entregar ao seu importador:
const unsubscribe = onData(async (payload) => {
  if (payload.kind === 'database-export') {
    await seuImportadorIndexedDB(payload);
  }
});
```

`sendData()` espera a confirmação de que o outro lado recebeu e validou o conteúdo pelo hash. A gravação no IndexedDB do destino deve ser feita pelo seu `seuImportadorIndexedDB` antes de considerar a importação concluída. Para isso, o receptor deve chamar `acknowledge()` após a persistência; veja a seção abaixo.

### Confirmação após persistência (recomendado)

Por padrão, o transporte confirma após validar a mensagem e entregá-la aos listeners. Para garantir confirmação somente depois da gravação no IndexedDB, configure o listener com `onData(handler)` e faça o handler retornar uma Promise que só resolve após a transação IndexedDB concluir. Exemplo:

```js
onData(async (payload) => {
  await importarNoIndexedDB(payload); // resolver somente após transaction.oncomplete
});
```

Se o handler rejeitar, o remetente recebe erro em vez de ACK de sucesso.

## Limitações e segurança

- `iceServers: []` não usa STUN/TURN. Teste primeiro na mesma Wi-Fi. Redes com isolamento de clientes (AP/client isolation), VLANs ou firewall podem bloquear a conexão.
- O pareamento QR troca SDP; não é autenticação de identidade. Faça o pareamento somente com aparelhos confiáveis e considere exibir um código de confirmação nos dois lados antes de transferir dados sensíveis.
- A conexão WebRTC usa DTLS, mas a aplicação deve validar os dados recebidos e não executar conteúdo recebido.
- O exemplo mantém um envio por vez e limita o payload a 50 MiB por padrão.
- Se o aplicativo for colocado em segundo plano ou a tela bloquear, o navegador pode suspender a página. Mantenha os dois PWAs abertos durante a transferência.
- QR Codes de sinalização podem ser fragmentados. O usuário precisa avançar os fragmentos no aparelho que exibe e manter o leitor ativo no outro.
