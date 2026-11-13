import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Op } from "../board/ops";
import { PolyStage } from "./PolyStage";
import { PresetStage } from "./PresetStage";
import { MODELS, type ModelId } from "./scene";
import { resolveSandflow, type SandflowModel } from "./sandflow";

export type ModelOp = Extract<Op, { op: "model3d" }>;

export type ModelOpen =
  | { kind: "preset"; id: ModelId }
  | { kind: "sandflow"; model: SandflowModel; labels?: string[] };

// imagens 3D pré-renderizadas dos presets locais

/*
  A ilustração 3D de uma página.
  Os presets são desenhados ao vivo no telemóvel (a imagem pré-renderizada
  fica na web e como reserva). Os modelos Sandflow são pesquisados em segundo
  plano, fora do caminho da geração: a página aparece imediatamente e o GLB
  entra quando estiver resolvido. No telemóvel é desenhado a rodar numa
  WebView transparente; na web mostra-se a pré-visualização do Sandflow.
*/
export function LiveModel({
  op,
  visible,
  onOpen,
}: {
  op: ModelOp;
  visible: number;
  onOpen: (target: ModelOpen) => void;
}) {
  const preset = op.model !== "sandflow" && op.model in MODELS;
  const [model, setModel] = useState<SandflowModel | null>(op.ref ?? null);
  const [waiting, setWaiting] = useState(op.model === "sandflow" && !op.ref);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (op.model !== "sandflow" || model) return;
    let alive = true;
    setWaiting(true);
    resolveSandflow(op.query ?? "")
      .then((found) => {
        if (!alive) return;
        if (found) setModel(found);
        setWaiting(false);
      })
      .catch(() => {
        if (alive) setWaiting(false);
      });
    return () => {
      alive = false;
    };
  }, [op.model, op.query, model]);

  useEffect(() => {
    if (!preset && !model) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [preset, model, fade]);

  // O preset também respeita a timeline do quadro: não aparece antes
  // de o lápis chegar à zona reservada para o modelo.
  if (visible <= 0.015) return null;

  if (preset) {
    // Na web a cena vive num iframe que engole os cliques; em vez de
    // depender do Pressable receber o toque, põe-se um overlay clicável
    // por cima — funciona sempre.
    return (
      <View style={styles.fill}>
        <View style={StyleSheet.absoluteFill}>
          <PresetStage id={op.model as ModelId} />
        </View>
        <Pressable
          onPress={() => onOpen({ kind: "preset", id: op.model as ModelId })}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>3D</Text>
        </View>
      </View>
    );
  }

  if (!model) {
    // enquanto a pesquisa corre, uma marca discreta; se falhar, desaparece
    if (!waiting) return null;
    return (
      <View style={[styles.fill, styles.waitBox]}>
        <ActivityIndicator size="small" color="#7c8b80" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.fill, { opacity: fade }]}>
      <Pressable
        onPress={() => onOpen({ kind: "sandflow", model, labels: op.labels })}
        style={styles.fill}
      >
        {Platform.OS === "web" ? (
          <Image
            source={{ uri: model.thumb }}
            style={[styles.fill, { width: "100%", height: "100%" }]}
            resizeMode="contain"
          />
        ) : (
          <PolyStage glb={model.glb} thumb={model.thumb} labels={op.labels} />
        )}
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>3D</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,71,64,0.18)",
  },
  badgeText: {
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#5d655f",
  },
  waitBox: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.55,
  },
});
