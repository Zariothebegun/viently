import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Op } from "../board/ops";
import { ShapesStage } from "./ShapesStage";
import type { ShapesSpec } from "./shapes";

export type ModelOp = Extract<Op, { op: "model3d" }>;

export type ModelOpen = { kind: "shapes"; spec: ShapesSpec; title?: string };

/*
  A ilustração 3D de uma página.
  Só há um tipo de cena: a que o modelo escreve por primitivas, desenhada a
  rodar numa WebView (telemóvel) ou num iframe (web). Tocar na cena roda-a;
  o selo "3D" abre o painel grande.
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
  const spec = op.model === "shapes" ? op.shapes : undefined;

  // A cena respeita a timeline do quadro: não aparece antes de o lápis
  // chegar à zona reservada para ela.
  if (visible <= 0.015 || !spec) return null;

  return (
    <View style={styles.fill}>
      <View style={StyleSheet.absoluteFill}>
        <ShapesStage spec={spec} />
      </View>
      <Pressable
        onPress={() => onOpen({ kind: "shapes", spec, title: op.title })}
        style={styles.badgeBtn}
        hitSlop={10}
      >
        <Text style={styles.badgeText}>3D</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
  badgeBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d4c8",
  },
  badgeText: {
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#5d655f",
  },
});
