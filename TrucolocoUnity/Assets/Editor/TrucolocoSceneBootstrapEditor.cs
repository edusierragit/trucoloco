using Trucoloco.Scene;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Trucoloco.Editor
{
    [CustomEditor(typeof(TrucolocoSceneBootstrap))]
    internal sealed class TrucolocoSceneBootstrapEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            DrawDefaultInspector();

            EditorGUILayout.Space(10f);
            EditorGUILayout.HelpBox("Usa Rebuild cuando quieras regenerar la escena sin depender del auto rebuild.", MessageType.Info);

            if (GUILayout.Button("Rebuild Trucoloco Scene", GUILayout.Height(32f)))
            {
                foreach (var targetObject in targets)
                {
                    if (targetObject is TrucolocoSceneBootstrap bootstrap)
                    {
                        bootstrap.Rebuild();
                        EditorSceneManager.MarkSceneDirty(bootstrap.gameObject.scene);
                    }
                }
            }

            serializedObject.ApplyModifiedProperties();
        }
    }
}
