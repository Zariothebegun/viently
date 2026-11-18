import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ShapesSpec } from "./shapes";
import { buildShapesHtml } from "./shapesHtml";
import { threeSources } from "./threeAsset";

// O download do three começa assim que a app abre: quando a primeira cena
// aparecer, a biblioteca já está em memória (antes esperava ~1 s por ela).
void threeSources();

/*
  Na web não há WebView: a mesma cena corre dentro de um iframe, como nos
  outros módulos 3D.

  O three é descarregado uma vez (ver threeAsset.ts) e entra na cena como
  endereço local, para nenhuma página depender do CDN no momento em que abre.
  Se o próprio download falhar, o HTML mostra a nota e a página continua a
  ensinar.
*/
export function ShapesStage({ spec }: { spec: ShapesSpec }) {
  const [sources, setSources] = useState<string[] | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    threeSources().then((list) => {
      if (live) setSources(list);
    });
    return () => {
      live = false;
    };
  }, []);

  const html = useMemo(
    () => (sources ? buildShapesHtml(spec, "inline", sources) : ""),
    [spec, sources],
  );

  useEffect(() => {
    if (!html) return;
    fade.setValue(0);
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }, 700);
    return () => clearTimeout(t);
  }, [html, fade]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        {!!html && (
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
        )}
      </Animated.View>
    </View>
  );
}
