# Her Life

Projeto web estático preparado para:

- ✅ Deploy imediato no **Netlify**
- ✅ Empacotamento Android via **Capacitor** + **Android Studio**

## 1) Rodar localmente

```bash
npm install
npm run dev
```

## 2) Deploy no Netlify

Este repositório já inclui `netlify.toml` com:

- `publish = "."`
- redirect SPA `/* -> /index.html`

No Netlify basta conectar o repositório e usar:

- **Build command:** `npm run build` (opcional, app estático)
- **Publish directory:** `.`

## 3) Preparar Android Studio

Pré-requisitos:

- Node.js 18+
- Android Studio instalado

Passos:

```bash
npm install
npm run android:init
npm run android:sync
npm run android:open
```

Depois disso, o projeto Android abrirá no Android Studio para gerar APK/AAB.

## Estrutura principal

- `index.html` — entrada da aplicação
- `app.js` — lógica principal
- `styles.css` — estilos
- `capacitor.config.json` — configuração do app Android
- `netlify.toml` — configuração de deploy no Netlify

## 4) Salvamento de localização no back-end (Netlify Functions)

Agora o app salva localização no back-end através de funções serverless:

- `/.netlify/functions/save-location` (POST)
- `/.netlify/functions/get-locations?email=...` (GET)

Persistência é feita usando **Netlify Blobs** (store `locations`).

A localização é salva automaticamente quando:
- mapa encontra posição inicial,
- usuário compartilha localização,
- atividade está em andamento.

## 5) Página de rastreamento em tempo real

Foi criada a página `live.html`, que consulta `get-locations` a cada 5 segundos e atualiza mapa/trilha em tempo real.

Use:

```text
/live.html?email=usuario@email.com
```

## 6) SOS com câmera + microfone e notificação de emergência

Ao acionar SOS:
- app solicita ativação automática de câmera e microfone;
- salva localização no backend (`source: sos`);
- envia mensagem de emergência para contatos (WhatsApp) com:
  - link do mapa,
  - link da página `live.html` para acompanhamento em tempo real.
