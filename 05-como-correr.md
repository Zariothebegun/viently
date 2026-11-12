# 05 — Como correr e ver no telemóvel

## O que foi instalado (sem admin)

| Ferramenta | Versão | Onde | Para quê |
|---|---|---|---|
| Node.js (portátil) | v24.22.2 LTS | `%LOCALAPPDATA%\Programs\nodejs` | Correr Vite/React |
| npm | 11.19.1 | idem | Dependências |
| cloudflared | 2026.10.7 | `%LOCALAPPDATA%\Programs\cloudflared` | Túnel HTTPS para o telemóvel |

Ambos já estão no `PATH` do utilizador. Para remover: apagar as pastas e as duas entradas do PATH.

## Arrancar

```powershell
cd "C:\Users\a4663\OpenBot\Shared\Viently\app"
npm run dev
```

Depois, numa segunda janela:

```powershell
cloudflared tunnel --url http://localhost:5173
```

O cloudflared imprime um link `https://xxxx.trycloudflare.com` — abre esse no telemóvel.
O link **muda sempre** que reinicias o túnel. O servidor tem de ficar a correr no PC.

## Ver no PC como se fosse um telemóvel

Abre `http://localhost:5173`. Em ecrãs largos a app aparece dentro de uma moldura de iPhone (392×820).
No telemóvel ocupa o ecrã todo. É o mesmo código, sem build separado.

## Atalhos

| URL | Efeito |
|---|---|
| `/` | Aula começa no primeiro bloco, revela à medida que narra |
| `/?full=1` | Mostra os 6 blocos de uma vez (bom para screenshots) |

## Extras

- **PWA**: no iPhone, Safari → Partilhar → *Adicionar ao Ecrã Principal*. Fica em ecrã inteiro, sem barra do Safari.
- **Chave OpenRouter**: botão ⚙︎ na app. Fica só no `localStorage` do navegador, nunca no código.
- **Sem chave**: a app mostra a aula de demonstração da mitose.

## Limitações conhecidas

- **Entrada por voz no iPhone**: o Safari iOS não expõe `SpeechRecognition`. A síntese de voz (TTS) funciona; o *microfone* não. Resolver depois com transcrição no servidor (Whisper via OpenRouter) ou usar a app no Chrome do Android.
- **HMR** não passa pelo túnel. Para ver alterações no telemóvel, recarrega a página.
- O túnel rápido da Cloudflare é temporário e sem garantias — serve para desenvolvimento, não para a demo da PAP. Na PAP, correr em `localhost` no portátil.
