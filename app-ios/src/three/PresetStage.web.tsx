import { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { buildModelHtml, type ModelId } from "./scene";

// As imagens pré-renderizadas ficam por baixo: cobrem o arranque da cena e
// continuam visíveis se o three.js não carregar (sem internet).
const MODEL_IMG: Record<string, any> = {
  cell: require("../../assets/models/cell.png"),
  motor: require("../../assets/models/motor.png"),
  atom: require("../../assets/models/atom.png"),
  ram: require("../../assets/models/ram.png"),
  bit: require("../../assets/models/bit.png"),
};

/*
  Na web não há WebView; a mesma cena corre dentro de um iframe transparente.
  É o suficiente para ver o preset a rodar, com as etiquetas coladas, sem
  fundo — e mantém o componente nativo igual.
*/
export function PresetStage({ id }: { id: ModelId }) {
  const html = useMemo(() => buildModelHtml(id, "inline"), [id]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    }, 1200);
    return () => clearTimeout(t);
  }, [id, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={MODEL_IMG[id]}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="contain"
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <iframe
          srcDoc={html}
          scrolling="no"
          tabIndex={-1}
          style={{
            border: "none",
            width: "100%",
            height: "100%",
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      </Animated.View>
    </View>
  );
}
