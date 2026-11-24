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

  Só a cena que está no ecrã é que é montada. Antes, todas as páginas do feed
  ficavam montadas ao mesmo tempo — três ou quatro cenas a desenhar em
  paralelo esgotavam a thread principal e a app parecia bloqueada. Agora a
  cena entra quando a página aparece e sai quando sai do ecrã.

  O three é descarregado uma vez (ver threeAsset.ts) e entra na cena como
  endereço local, para nenhuma página depender do CDN no momento em que abre.
*/
export function ShapesStage({ spec }: { spec: ShapesSpec }) {
  const [sources, setSources] = useState<string[] | null>(null);
  // Começa desligada: se arrancasse a "true", todas as páginas montavam a cena
  // no primeiro render (antes de o observer responder) e voltávamos a ter
  // várias cenas a desenhar ao mesmo tempo.
  const [visivel, setVisivel] = useState(false);
  const box = useRef<any>(null);
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

  // Só desenha quando a caixa do 3D está (ou está quase) à vista.
  useEffect(() => {
    const el: any = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    let live = true;
    let respondeu = false;
    // se o observer não disser nada em 700 ms, mostra na mesma: uma cena que
    // nunca monta é pior do que uma cena a mais
    const t = setTimeout(() => {
      if (live && !respondeu) setVisivel(true);
    }, 700);
    const io = new IntersectionObserver(
      (entradas) => {
        respondeu = true;
        // Monta UMA vez, quando aparece. Se desmontasse ao sair do ecrã, um
        // vaivém de 1 cm a rolar fazia rebuild da cena (57 KB + contexto
        // WebGL novo) dezenas de vezes por segundo e prendia a aba.
        if (live && entradas.some((e) => e.isIntersecting)) setVisivel(true);
      },
      { rootMargin: "60% 0px 60% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => {
      live = false;
      clearTimeout(t);
      io.disconnect();
    };
  }, []);

  const html = useMemo(
    () => (sources && visivel ? buildShapesHtml(spec, "inline", sources) : ""),
    [spec, sources, visivel],
  );

  useEffect(() => {
    if (!html) return;
    fade.setValue(0);
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }, 450);
    return () => clearTimeout(t);
  }, [html, fade]);

  return (
    <View ref={box} style={StyleSheet.absoluteFill}>
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
