import { forwardRef, Suspense } from "react";
import { Text as DreiText } from "@react-three/drei";

// Drei Text resolves glyph fonts asynchronously. Keeping that suspension local
// prevents one slow CDN/font request from blanking the complete 3D scene.
export const SceneText = forwardRef(function SceneText(props, ref) {
  return (
    <Suspense fallback={null}>
      <DreiText ref={ref} {...props} />
    </Suspense>
  );
});
