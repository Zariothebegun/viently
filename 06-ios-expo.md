# 06 — iOS: ver a app no iPhone enquanto se desenvolve

## Decisão revista

O plano inicial era **web** (Vite + React). Foi revisto: o produto é **app iOS**, e um site no Safari não conta.

O protótipo web **não foi apagado** — fica como referência visual em `app/`. O código de produção passa a ser `app-ios/`.

## Como se vê no iPhone, a partir de Windows, sem Mac

**Expo Go.**

1. Instalar **Expo Go** na App Store (grátis).
2. No PC: `npx expo start --tunnel`.
3. Lê o QR com a câmara do iPhone, ou abre `exp://…` dentro do Expo Go.

O código corre no telemóvel e recarrega sozinho quando gravas um ficheiro. Não há build, não há Xcode, não há conta de developer.

### Porque `--tunnel ngrok` e não só `--tunnel`

`expo start --tunnel` sozinho exige sessão iniciada numa conta Expo. Com `--tunnel ngrok` (o pacote `@expo/ngrok` já está instalado) funciona sem conta.

### Porque túnel e não Wi-Fi

A firewall do Windows tem regras de **bloqueio** para `node.exe` a entrar. O Metro (porta 8081) ficaria inacessível ao iPhone na mesma Wi-Fi. O túnel contorna isso porque é uma ligação de saída.

## O que muda em relação ao web

| Peça | Web (`app/`) | iOS (`app-ios/`) |
|---|---|---|
| Framework | Vite + React DOM | Expo (React Native) |
| Estilo | CSS | objetos `style` + `StyleSheet` |
| Gráficos | Recharts | `react-native-svg` (barras desenhadas à mão) |
| Fórmulas | KaTeX no DOM | KaTeX dentro de `WebView` |
| 3D | `@react-three/fiber` + drei | `expo-gl` + `@react-three/fiber/native` *(próximo passo)* |
| Voz | Web Speech API | `expo-speech` (voz do sistema iOS) |
| Microfone | `SpeechRecognition` | precisa de módulo nativo — fora do Expo Go |

## O que **não** funciona no Expo Go

- Reconhecimento de voz (microfone). Exige *dev build* com `expo-speech-recognition`.
- Notificações push completas e alguns módulos nativos.

Tudo o resto — SVG, WebView, TTS, animações, gestos — funciona.

## Caminho para a app final

```
Expo Go (agora)  ──►  EAS Build (nuvem)  ──►  TestFlight  ──►  App Store
                        ↑
          conta Apple de developer (99 €/ano) só nesta fase
```

Até lá, desenvolvimento e demonstração da PAP correm inteiramente em Expo Go.
