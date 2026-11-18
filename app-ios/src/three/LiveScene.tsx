import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ShapesSpec } from "./shapes";
import { buildShapesHtml } from "./shapesHtml";
import { threeSources } from "./threeAsset";

/*
  A cena a ser escrita pelo modelo, à vista.

  Cada vez que chegam peças novas, o desenho é refeito num iframe novo que
  aparece POR CIMA do anterior e só depois de estar carregado. Assim vê-se a
  cena a ganhar peças sem nenhum piscar branco: o que lá estava continua
  visível até o novo estar pronto.
*/

type Layer = { key: number; html: string };

export function LiveScene({ spec }: { spec: ShapesSpec | null }) {
  const [sources, setSources] = useState<string[] | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const nextKey = useRef(1);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    threeSources().then((list) => live && setSources(list));
    return () => {
      live = false;
    };
  }, []);

  const html = useMemo(
    () => (sources && spec && spec.objects.length ? buildShapesHtml(spec, "inline", sources) : ""),
    [spec, sources],
  );

  useEffect(() => {
    if (!html) return;
    setLayers((prev) => [...prev.slice(-1), { key: nextKey.current++, html }]);
  }, [html]);

  const topKey = layers.length ? layers[layers.length - 1].key : -1;

  // a camada nova entra suave, por cima da anterior: nunca há ecrã branco
  useEffect(() => {
    if (topKey < 0) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [topKey, opacity]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {layers.map((l) => (
        <Animated.View
          key={l.key}
          style={[StyleSheet.absoluteFill, { opacity: l.key === topKey ? opacity : 1 }]}
        >
          <iframe
            srcDoc={l.html}
            scrolling="no"
            tabIndex={-1}
            style={{ border: "none", width: "100%", height: "100%", background: "transparent" }}
          />
        </Animated.View>
      ))}
    </View>
  );
}
