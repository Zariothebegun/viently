import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildPolyHtml } from "./scene";

// o componente WebView muda de tipos entre versões; aqui só usamos
// source/onMessage, por isso tratamos como componente livre
const WV = WebView as unknown as React.ComponentType<any>;

// o WebView precisa de um baseUrl do mesmo sítio que o GLB, senão o ficheiro
// remoto não é mesmo-origem para o three.js
function originOf(url: string): string {
  const m = String(url).match(/^(https?:\/\/[^/]+)\//);
  return m ? m[1] + "/" : "https://polyfork.dev/";
}

/*
  Ilustração 3D viva dentro da página.
  O GLB (modelo real do catálogo Sandflow) é desenhado a rodar, com fundo
  transparente e etiquetas coladas ao modelo. Enquanto carrega, ou se falhar,
  mostra a pré-visualização do Sandflow como recurso de última instância.
  O baseUrl é o do catálogo para o GLB ser same-origin dentro do WebView.
*/
export function PolyStage({
  glb,
  thumb,
  labels,
}: {
  glb: string;
  thumb: string;
  labels?: string[];
}) {
  const html = useMemo(() => buildPolyHtml(glb, labels ?? [], "inline"), [glb, labels]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showThumb, setShowThumb] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const thumbFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(thumbFade, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setShowThumb(false);
    });
  }, [ready, fade, thumbFade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showThumb && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: thumbFade }]}>
          <Image
            source={{ uri: thumb }}
            style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
            resizeMode="contain"
          />
        </Animated.View>
      )}
      {!failed && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <WV
            source={{ html, baseUrl: originOf(glb) }}
            originWhitelist={["*"]}
            style={s.web}
            containerStyle={s.web}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            javaScriptEnabled
            domStorageEnabled={false}
            setSupportMultipleWindows={false}
            textInteractionEnabled={false}
            opaque={false}
            pointerEvents="none"
            onMessage={(e: any) => {
              try {
                const m = JSON.parse(e.nativeEvent.data);
                if (m.type === "ready") setReady(true);
                else if (m.type === "error") setFailed(true);
              } catch {
                /* ignora mensagens que não sejam nossas */
              }
            }}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  web: { flex: 1, backgroundColor: "transparent" },
});
