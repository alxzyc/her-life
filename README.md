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
