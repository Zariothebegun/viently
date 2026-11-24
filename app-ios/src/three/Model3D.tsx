import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { PAPER, PALETTE } from "../board/geom";
import { buildShapesHtml } from "./shapesHtml";
import type { ShapesSpec } from "./shapes";

// o componente WebView muda de tipos entre versões; aqui só usamos
// source/onMessage/injectJavaScript, por isso tratamos como componente livre
const WV = WebView as unknown as React.ComponentType<any>;

// Só existe um tipo de cena 3D: a que é gerada por primitivas. Os presets da
// biblioteca e o catálogo remoto de GLB saíram — o modelo escreve a cena.
export type ModelTarget = { kind: "shapes"; spec: ShapesSpec; title?: string };

/*
  Painel 3D.
  A cena corre numa WebView (three.js real); os rótulos e as linhas-guia vivem
  dentro da cena, ancorados a formas. O React Native só manda o estado
  (rotação) e recebe a forma tocada.
*/
export function Model3D({ target, onClose }: { target: ModelTarget; onClose: () => void }) {
  const html = useMemo(() => buildShapesHtml(target.spec, "modal"), [target]);
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  // com animações na cena a câmara fica quieta; sem animações, roda devagar
  const [spin, setSpin] = useState(target.spec.anims.length === 0);
  const [pick, setPick] = useState<{ name: string; note: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ready || err) return;
    const timeout = setTimeout(() => setErr("o modelo demorou demasiado tempo a carregar"), 12000);
    return () => clearTimeout(timeout);
  }, [ready, err]);

  const send = (js: string) => ref.current?.injectJavaScript(`${js};true;`);

  useEffect(() => {
    if (!ready) return;
    send(`window.__setSpin(${spin})`);
  }, [spin, ready]);

  const meta = {
    title: target.title ?? "Cena 3D",
    hint: target.spec.caption ?? "toca numa forma para saber o que faz",
  };

  return (
    <View style={s.root}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>modelo 3D</Text>
          <Text style={s.title}>{meta.title}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={14} style={s.close}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
      </View>

      <View style={s.stage}>
        <WV
          ref={ref}
          source={{ html, baseUrl: "https://cdn.jsdelivr.net/" }}
          originWhitelist={["*"]}
          style={s.web}
          containerStyle={s.webWrap}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled
          domStorageEnabled={false}
          setSupportMultipleWindows={false}
          textInteractionEnabled={false}
          opaque={false}
          onMessage={(e: any) => {
            try {
              const m = JSON.parse(e.nativeEvent.data);
              if (m.type === "ready") setReady(true);
              else if (m.type === "pick") setPick(m.name ? { name: m.name, note: m.note ?? "" } : null);
              else if (m.type === "error") setErr(String(m.message ?? "erro"));
            } catch {
              /* ignora mensagens que não sejam nossas */
            }
          }}
          onError={() => setErr("não consegui abrir o modelo")}
        />
        {!ready && !err && (
          <View style={s.loading} pointerEvents="none">
            <ActivityIndicator color={PALETTE.gray} />
            <Text style={s.loadingTxt}>a preparar a cena…</Text>
          </View>
        )}
        {!!err && (
          <View style={s.loading} pointerEvents="none">
            <Text style={s.errTxt}>{err}</Text>
            <Text style={s.errHint}>a cena 3D precisa de internet.</Text>
          </View>
        )}
      </View>

      <View style={s.caption}>
        <Text style={s.capName} numberOfLines={1}>
          {pick?.name ?? meta.hint}
        </Text>
        {!!pick?.note && (
          <Text style={s.capNote} numberOfLines={2}>
            {pick.note}
          </Text>
        )}
      </View>

      {/* controlos */}
      <View style={s.controls}>
        <View style={s.toggles}>
          <Pressable style={[s.toggle, spin && s.toggleOn]} onPress={() => setSpin((v) => !v)}>
            <Text style={[s.toggleTxt, spin && s.toggleTxtOn]}>rodar</Text>
          </Pressable>
          <Pressable
            style={s.toggle}
            onPress={() => {
              send("window.__reset()");
              setPick(null);
            }}
          >
            <Text style={s.toggleTxt}>repor vista</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER, paddingTop: 8 },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  kicker: { color: "#a2a7b3", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontFamily: "Caveat_700Bold", fontSize: 30, color: "#23242a", lineHeight: 34 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#efecdf",
  },
  closeTxt: { color: "#5b5f68", fontSize: 15 },

  stage: { flex: 1, marginHorizontal: 8, borderRadius: 18, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
  webWrap: { backgroundColor: "transparent" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(246,244,236,0.85)",
  },
  loadingTxt: { color: "#9aa0ad", fontSize: 12.5 },
  errTxt: { color: "#8d3b31", fontSize: 13 },
  errHint: { color: "#b06a5f", fontSize: 11.5 },

  caption: { paddingHorizontal: 20, paddingTop: 10, minHeight: 52 },
  capName: { fontFamily: "Caveat_600SemiBold", fontSize: 21, color: "#23242a" },
  capNote: { color: "#7d8492", fontSize: 13, lineHeight: 18, marginTop: 1 },

  controls: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 4 },
  toggles: { flexDirection: "row", gap: 8, marginTop: 6 },
  toggle: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#ddd9cb" },
  toggleOn: { backgroundColor: "#23242a", borderColor: "#23242a" },
  toggleTxt: { color: "#5b5f68", fontSize: 12.5 },
  toggleTxtOn: { color: PAPER },
});
