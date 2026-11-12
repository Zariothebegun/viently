import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { PAPER, PALETTE } from "../board/geom";
import type { SandflowModel } from "./sandflow";
import { MODELS, buildModelHtml, buildPolyHtml, type ModelId } from "./scene";

// o componente WebView muda de tipos entre versões; aqui só usamos
// source/onMessage/injectJavaScript, por isso tratamos como componente livre
const WV = WebView as unknown as React.ComponentType<any>;

const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

// um modelo local (com partes e rótulos) ou um GLB remoto do catálogo Sandflow
export type ModelTarget =
  | { kind: "preset"; id: ModelId }
  | { kind: "sandflow"; model: SandflowModel; labels?: string[] };

/*
  Painel 3D.
  A cena corre numa WebView (three.js real); os rótulos e as linhas-guia vivem
  dentro da cena, ancorados a pontos do modelo. O React Native só manda o
  estado (explosão, raios X, rotação) e recebe a parte tocada.
*/
export function Model3D({ target, onClose }: { target: ModelTarget; onClose: () => void }) {
  const isPoly = target.kind === "sandflow";
  const html = useMemo(
    () =>
      target.kind === "sandflow"
        ? buildPolyHtml(target.model.glb, target.labels ?? [], "modal")
        : buildModelHtml(target.id),
    [target],
  );
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [explode, setExplode] = useState(0.62);
  const [xray, setXray] = useState(false);
  const [spin, setSpin] = useState(true);
  const [pick, setPick] = useState<{ name: string; note: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = (js: string) => ref.current?.injectJavaScript(`${js};true;`);

  useEffect(() => {
    if (!ready || isPoly) return;
    send(`window.__setExplode(${explode})`);
  }, [explode, ready, isPoly]);

  useEffect(() => {
    if (!ready || isPoly) return;
    send(`window.__setXray(${xray})`);
  }, [xray, ready, isPoly]);

  useEffect(() => {
    if (!ready) return;
    send(`window.__setSpin(${spin})`);
  }, [spin, ready]);

  const meta = target.kind === "sandflow"
    ? { title: target.model.title, hint: "arrasta para rodar · belisca para aproximar" }
    : MODELS[target.id];

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
          source={{
            html,
            // O GLB vem do catálogo remoto, não do antigo host Sandflow.
            // Usar a origem real evita resolver recursos relativos no domínio morto.
            baseUrl: isPoly
              ? target.model.glb.split("/").slice(0, 3).join("/") + "/"
              : "https://cdn.jsdelivr.net/",
          }}
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
            <Text style={s.loadingTxt}>a preparar o modelo…</Text>
          </View>
        )}
        {!!err && (
          <View style={s.loading} pointerEvents="none">
            <Text style={s.errTxt}>{err}</Text>
            <Text style={s.errHint}>o modelo 3D precisa de internet.</Text>
          </View>
        )}
      </View>

      {/* legenda: parte escolhida (presets) ou créditos do autor (Sandflow) */}
      <View style={s.caption}>
        {target.kind === "sandflow" ? (
          <View style={s.creditRow}>
            <Text style={s.capNote} numberOfLines={1}>
              {target.model.author} · {target.model.licence}
            </Text>
            <Pressable onPress={() => Linking.openURL(target.model.page)} hitSlop={10}>
              <Text style={s.creditLink}>ver modelo ↗</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={s.capName} numberOfLines={1}>
              {pick?.name ?? meta.hint}
            </Text>
            {!!pick?.note && (
              <Text style={s.capNote} numberOfLines={2}>
                {pick.note}
              </Text>
            )}
          </>
        )}
      </View>

      {/* controlos */}
      <View style={s.controls}>
        {!isPoly && (
          <View style={s.sliderRow}>
            <Text style={s.end}>montado</Text>
            <View style={s.dots}>
              {STEPS.map((v) => (
                <Pressable key={v} onPress={() => setExplode(v)} hitSlop={7} style={s.dotHit}>
                  <View style={[s.dot, explode >= v - 0.001 && s.dotOn]} />
                </Pressable>
              ))}
            </View>
            <Text style={s.end}>explodido</Text>
          </View>
        )}

        <View style={s.toggles}>
          {!isPoly && (
            <Pressable style={[s.toggle, xray && s.toggleOn]} onPress={() => setXray((v) => !v)}>
              <Text style={[s.toggleTxt, xray && s.toggleTxtOn]}>raios X</Text>
            </Pressable>
          )}
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
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  creditLink: { color: "#5f7a63", fontSize: 12.5, fontWeight: "600" },

  controls: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 4 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  end: { color: "#a2a7b3", fontSize: 10.5 },
  dots: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  dotHit: { paddingVertical: 6, flex: 1, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#d3d0c3" },
  dotOn: { backgroundColor: "#23242a" },

  toggles: { flexDirection: "row", gap: 8, marginTop: 6 },
  toggle: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#ddd9cb" },
  toggleOn: { backgroundColor: "#23242a", borderColor: "#23242a" },
  toggleTxt: { color: "#5b5f68", fontSize: 12.5 },
  toggleTxtOn: { color: PAPER },
});
