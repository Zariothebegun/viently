import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildModelHtml, type ModelId } from "./scene";

// o componente WebView muda de tipos entre versões; aqui só usamos
// source/onMessage, por isso tratamos como componente livre
const WV = WebView as unknown as React.ComponentType<any>;

// imagens 3D pré-renderizadas dos presets locais: entram enquanto o modelo
// vivo carrega e ficam como recurso se não houver internet
const MODEL_IMG: Record<string, any> = {
  cell: require("../../assets/models/cell.png"),
  motor: require("../../assets/models/motor.png"),
  atom: require("../../assets/models/atom.png"),
  ram: require("../../assets/models/ram.png"),
  bit: require("../../assets/models/bit.png"),
};

/*
  Preset local (célula, motor, átomo…) desenhado a rodar dentro da página.
  A cena é a mesma do painel grande, mas em modo "inline": sem a dica de
  arrastar, etiquetas mais pequenas e fundo transparente. A imagem estática
  cobre o primeiro instante e fica visível se a WebView não conseguir carregar
  o three.js (sem internet).
*/
export function PresetStage({ id }: { id: ModelId }) {
  const html = useMemo(() => buildModelHtml(id, "inline"), [id]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showImg, setShowImg] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const imgFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(imgFade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setShowImg(false);
    });
  }, [ready, fade, imgFade]);

  // se a cena não arrancar (rede em baixo), fica a imagem pré-renderizada
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setFailed(true), 9000);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showImg && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: imgFade }]}>
          <Image
            source={MODEL_IMG[id]}
            style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
            resizeMode="contain"
          />
        </Animated.View>
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
});
