import { useEffect } from "react";
import { ARROW_COMBAT_KEYS, HELD_COMBAT_KEYS } from "./combatConstants";

export function useConflictInput({ enabled, mode, keysRef, onExit, onPrimaryAction, onRivalAction, onSwitchMode }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!enabled) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        onExit();
        return;
      }

      if (HELD_COMBAT_KEYS.includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
        return;
      }

      if (ARROW_COMBAT_KEYS.includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
        return;
      }

      if (key === "g") {
        event.preventDefault();
        onSwitchMode("ring");
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onPrimaryAction(mode === "ruleta" ? "gatillo" : "esquive");
        return;
      }

      if (key === "q") {
        event.preventDefault();
        onPrimaryAction(mode === "ruleta" ? "gatillo" : "golpe");
        return;
      }

      if (key === "e") {
        event.preventDefault();
        onPrimaryAction("empujon");
        return;
      }

      if (key === "r") {
        event.preventDefault();
        onPrimaryAction("remate");
        return;
      }

      if (key === "f") {
        event.preventDefault();
        keysRef.current.add("f");
        onPrimaryAction("guardia");
        return;
      }

      if (key === "h") {
        event.preventDefault();
        onRivalAction("golpe");
        return;
      }

      if (key === "u") {
        event.preventDefault();
        onRivalAction("empujon");
        return;
      }

      if (key === "o") {
        event.preventDefault();
        onRivalAction("remate");
      }
    };

    const handleKeyUp = (event) => {
      keysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, keysRef, mode, onExit, onPrimaryAction, onRivalAction, onSwitchMode]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handlePointerDown = (event) => {
      if (event.target?.closest?.(".debate-hint")) return;
      if (event.button === 0) {
        onPrimaryAction(mode === "ruleta" ? "gatillo" : "golpe");
      }
      if (event.button === 2) {
        event.preventDefault();
        keysRef.current.add("rightclick");
        onPrimaryAction("guardia");
      }
    };

    const handlePointerUp = (event) => {
      if (event.button === 2) keysRef.current.delete("rightclick");
    };

    const handleContextMenu = (event) => {
      if (enabled) event.preventDefault();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [enabled, keysRef, mode, onPrimaryAction]);
}
