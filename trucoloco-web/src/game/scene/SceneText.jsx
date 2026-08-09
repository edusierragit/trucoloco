import { forwardRef, Suspense } from "react";
import { Text as DreiText } from "@react-three/drei";
import oswaldBoldFontUrl from "@fontsource/oswald/files/oswald-latin-700-normal.woff";

// Fuente empaquetada: Brave Shields y redes sin CDN siguen mostrando carteles.
// La suspensión local evita que la preparación de un texto bloquee la escena.
export const SceneText = forwardRef(function SceneText(props, ref) {
  return (
    <Suspense fallback={null}>
      <DreiText ref={ref} font={oswaldBoldFontUrl} {...props} />
    </Suspense>
  );
});
