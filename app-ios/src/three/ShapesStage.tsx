import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { ShapesSpec } from "./shapes";
import { buildShapesHtml } from "./shapesHtml";

// o componente WebView muda de tipos entre versões; aqui só usamos
// source/onMessage, por isso tratamos como componente livre
const WV = WebView as unknown as React.ComponentType<any>;

/*
  Cena de primitivas dentro da página, com as animações a correr.
  Não recebe toque (o cartão por baixo abre o painel grande). Se o 3D não
  arrancar (sem internet, WebGL indisponível), fica uma nota discreta com as
  etiquetas da cena, para a página continuar a ensinar.
*/
export function ShapesStage({ spec }: { spec: ShapesSpec }) {
  const html = useMemo(() => buildShapesHtml(spec, "inline"), [spec]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [ready, fade]);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(t);
  }, [ready]);

  const names = spec.objects
    .map((o) => o.label)
    .filter((v): v is string => !!v)
    .slice(0, 6);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {failed && (
        <View style={s.fallback}>
          <Text style={s.fallbackTxt}>{names.length ? names.join(" · ") : "cena 3D"}</Text>
          <Text style={s.fallbackHint}>o 3D precisa de internet</Text>
        </View>
      )}
      {!failed && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <WV
            source={{ html, baseUrl: "https://cdn.jsdelivr.net/" }}
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
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  fallbackTxt: { fontFamily: "Caveat_600SemiBold", fontSize: 18, color: "#4c6b53", textAlign: "center" },
  fallbackHint: { fontSize: 10.5, color: "#9aa0ad" },
});
