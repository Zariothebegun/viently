import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ShapesSpec } from "./shapes";
import { buildShapesHtml } from "./shapesHtml";

/*
  Na web não há WebView: a mesma cena corre dentro de um iframe, como nos

  Não há temporizador de falha: o iframe não tem canal de mensagens com a app,
  por isso qualquer timeout acabava por esconder uma cena que estava a correr
  bem (acontecia aos 12 s). Se o three.js não carregar, o próprio HTML mostra
  a nota "sem ligação" e a página continua a ensinar.
*/
export function ShapesStage({ spec }: { spec: ShapesSpec }) {
  const html = useMemo(() => buildShapesHtml(spec, "inline"), [spec]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }, 700);
    return () => clearTimeout(t);
  }, [html, fade]);

  return (
    <View style={StyleSheet.absoluteFill}>
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
            pointerEvents: "auto",
          }}
        />
      </Animated.View>
    </View>
  );
}
