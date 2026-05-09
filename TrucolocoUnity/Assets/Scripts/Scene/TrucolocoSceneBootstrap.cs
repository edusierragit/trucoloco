using System;
using Trucoloco.Core;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace Trucoloco.Scene
{
    public enum TrucolocoSceneMode
    {
        Blockout,
        Runtime
    }

    [ExecuteAlways]
    public sealed class TrucolocoSceneBootstrap : MonoBehaviour
    {
        [SerializeField] private bool autoRebuildInEditor = false;
        [SerializeField] private TrucolocoSceneMode sceneMode = TrucolocoSceneMode.Blockout;
        [SerializeField] private CharacterProfile[] characters = MatchState.CreateDefaultCharacters();

        private const string GeneratedRootName = "_Generated";
        private bool rebuildQueued;

        private void OnEnable()
        {
            if (!Application.isPlaying && autoRebuildInEditor)
            {
                QueueRebuild();
            }
        }

        private void OnValidate()
        {
            if (!Application.isPlaying && autoRebuildInEditor)
            {
                QueueRebuild();
            }
        }

        [ContextMenu("Rebuild Trucoloco Scene")]
        public void Rebuild()
        {
            rebuildQueued = false;
            EnsureCharacters();
            ConfigureCamera();
            ConfigureLighting();
            ConfigureEnvironment();
            EnsureController();

            var generatedRoot = GetOrCreateChild(GeneratedRootName);
            ClearChildren(generatedRoot.transform);

            var room = CreatePrimitive("Room", PrimitiveType.Cube, generatedRoot.transform, new Vector3(0f, -1.8f, 0f), Vector3.zero, new Vector3(18f, 0.4f, 11f), new Color(0.06f, 0.05f, 0.05f));
            room.name = "Floor";

            CreatePrimitive("BackWall", PrimitiveType.Cube, generatedRoot.transform, new Vector3(0f, 2.8f, 5.2f), Vector3.zero, new Vector3(18f, 8f, 0.35f), new Color(0.08f, 0.04f, 0.03f));
            CreatePrimitive("SideWallLeft", PrimitiveType.Cube, generatedRoot.transform, new Vector3(-8.8f, 2.5f, 0f), Vector3.zero, new Vector3(0.35f, 8f, 11f), new Color(0.05f, 0.03f, 0.03f));
            CreatePrimitive("SideWallRight", PrimitiveType.Cube, generatedRoot.transform, new Vector3(8.8f, 2.5f, 0f), Vector3.zero, new Vector3(0.35f, 8f, 11f), new Color(0.05f, 0.03f, 0.03f));
            CreatePrimitive("RearCanopy", PrimitiveType.Cube, generatedRoot.transform, new Vector3(0f, 6.1f, 2.45f), Vector3.zero, new Vector3(18f, 0.35f, 6.2f), new Color(0.03f, 0.03f, 0.04f));

            var tableRoot = new GameObject("Table");
            tableRoot.transform.SetParent(generatedRoot.transform, false);

            CreatePrimitive("WoodRim", PrimitiveType.Cylinder, tableRoot.transform, new Vector3(0f, 0f, 0f), Vector3.zero, new Vector3(4.55f, 0.34f, 3.35f), new Color(0.22f, 0.11f, 0.05f));
            CreatePrimitive("Felt", PrimitiveType.Cylinder, tableRoot.transform, new Vector3(0f, 0.22f, 0f), Vector3.zero, new Vector3(4.0f, 0.12f, 2.8f), new Color(0.12f, 0.05f, 0.04f));
            CreatePrimitive("CenterPlate", PrimitiveType.Cylinder, tableRoot.transform, new Vector3(0f, 0.31f, 0f), Vector3.zero, new Vector3(1.05f, 0.035f, 1.05f), new Color(0.09f, 0.04f, 0.03f));
            CreatePrimitive("Pedestal", PrimitiveType.Cylinder, tableRoot.transform, new Vector3(0f, -0.85f, 0f), Vector3.zero, new Vector3(1.15f, 0.9f, 1.15f), new Color(0.14f, 0.07f, 0.03f));

            BuildHexagon(tableRoot.transform);
            if (sceneMode == TrucolocoSceneMode.Blockout)
            {
                BuildSeatMarkers(generatedRoot.transform);
            }
            BuildCeilingLights(generatedRoot.transform);
            BuildAtmosphere(generatedRoot.transform);
        }

        private void EnsureCharacters()
        {
            if (characters == null || characters.Length != 6)
            {
                characters = MatchState.CreateDefaultCharacters();
            }
        }

        private void ConfigureCamera()
        {
            var camera = Camera.main;
            if (camera == null)
            {
                var cameraObject = new GameObject("Main Camera");
                camera = cameraObject.AddComponent<Camera>();
                cameraObject.tag = "MainCamera";
                cameraObject.AddComponent<AudioListener>();
            }

            if (sceneMode == TrucolocoSceneMode.Runtime)
            {
                camera.transform.position = new Vector3(0f, 2.45f, -5.3f);
                camera.transform.rotation = Quaternion.Euler(11f, 0f, 0f);
                camera.fieldOfView = 29f;
            }
            else
            {
                camera.transform.position = new Vector3(0f, 3.15f, -6.35f);
                camera.transform.rotation = Quaternion.Euler(15f, 0f, 0f);
                camera.fieldOfView = 33f;
            }
            camera.backgroundColor = new Color(0.02f, 0.02f, 0.025f);
            camera.clearFlags = CameraClearFlags.SolidColor;
        }

        private void ConfigureLighting()
        {
            var light = FindFirstObjectByType<Light>();
            if (light == null)
            {
                var lightObject = new GameObject("Directional Light");
                light = lightObject.AddComponent<Light>();
                light.type = LightType.Directional;
            }

            light.color = new Color(1f, 0.85f, 0.7f);
            light.intensity = 0.7f;
            light.transform.rotation = Quaternion.Euler(35f, -28f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.2f, 0.08f, 0.06f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.08f, 0.05f, 0.05f);
            RenderSettings.fogDensity = 0.018f;
        }

        private void ConfigureEnvironment()
        {
            transform.position = Vector3.zero;
            transform.rotation = Quaternion.identity;
            transform.localScale = Vector3.one;
        }

        private void EnsureController()
        {
            var controllerType = Type.GetType("Trucoloco.Scene.TableSceneController, Assembly-CSharp");
            if (controllerType == null)
            {
                Debug.LogWarning("[Trucoloco] TableSceneController type is not available yet.");
                return;
            }

            var controller = GetComponent(controllerType);
            if (controller == null)
            {
                controller = gameObject.AddComponent(controllerType);
            }

            controllerType.GetMethod("SetCharacters")?.Invoke(controller, new object[] { characters });
        }

        private void BuildHexagon(Transform parent)
        {
            var hexRoot = new GameObject("Hexagono");
            hexRoot.transform.SetParent(parent, false);
            hexRoot.transform.localPosition = new Vector3(0f, 0.34f, 0f);

            for (var i = 0; i < 6; i++)
            {
                var angle = Mathf.Deg2Rad * (i * 60f);
                var block = CreatePrimitive($"Side_{i + 1}", PrimitiveType.Cube, hexRoot.transform,
                    new Vector3(Mathf.Cos(angle) * 0.92f, 0f, Mathf.Sin(angle) * 0.92f),
                    new Vector3(0f, -i * 60f, 0f),
                    new Vector3(0.85f, 0.18f, 0.22f),
                    new Color(0.35f, 0.22f, 0.12f));
                block.transform.LookAt(hexRoot.transform.position);
            }

            CreatePrimitive("Core", PrimitiveType.Cylinder, hexRoot.transform, Vector3.zero, Vector3.zero, new Vector3(0.7f, 0.05f, 0.7f), new Color(0.24f, 0.16f, 0.08f));
        }

        private void BuildSeatMarkers(Transform parent)
        {
            var seatsRoot = new GameObject("Seats");
            seatsRoot.transform.SetParent(parent, false);

            for (var i = 0; i < characters.Length; i++)
            {
                var angle = Mathf.Deg2Rad * (90f - (i * 60f));
                var seatPosition = new Vector3(Mathf.Cos(angle) * 4.95f, -0.55f, Mathf.Sin(angle) * 3.55f);
                var seat = CreatePrimitive($"Seat_{i + 1}", PrimitiveType.Cylinder, seatsRoot.transform, seatPosition, Vector3.zero, new Vector3(0.65f, 0.08f, 0.65f), new Color(0.11f, 0.08f, 0.08f));
                var slotRoot = new GameObject($"{characters[i].Alias}_Slot");
                slotRoot.transform.SetParent(seatsRoot.transform, false);
                slotRoot.transform.localPosition = seatPosition + new Vector3(0f, 0.12f, 0f);

                var pawn = CreatePrimitive($"{characters[i].Alias}_Pawn", PrimitiveType.Capsule, slotRoot.transform, new Vector3(0f, 0.63f, 0f), Vector3.zero, new Vector3(0.55f, 0.75f, 0.55f), characters[i].Accent * 0.85f);
                CreatePrimitive($"{characters[i].Alias}_Aura", PrimitiveType.Cylinder, slotRoot.transform, new Vector3(0f, 0.04f, 0f), Vector3.zero, new Vector3(0.85f, 0.015f, 0.85f), characters[i].Accent * 0.45f);
                CreateLabel(slotRoot.transform, characters[i], seatPosition.normalized, i < 3 ? 1f : -1f);
            }
        }

        private void BuildCeilingLights(Transform parent)
        {
            CreateLamp("LampWarm", parent, new Vector3(-2.6f, 4.4f, -1.4f), new Color(1f, 0.46f, 0.18f), 11f, 6f);
            CreateLamp("LampGold", parent, new Vector3(2.6f, 4.4f, 1.2f), new Color(0.95f, 0.72f, 0.28f), 9f, 5f);
            CreateLamp("LampRed", parent, new Vector3(0f, 3.8f, -3.6f), new Color(0.8f, 0.12f, 0.08f), 7f, 5.5f);
        }

        private void BuildAtmosphere(Transform parent)
        {
            var smokeCount = sceneMode == TrucolocoSceneMode.Runtime ? 2 : 5;
            for (var i = 0; i < smokeCount; i++)
            {
                var puff = CreatePrimitive($"Smoke_{i + 1}", PrimitiveType.Sphere, parent,
                    new Vector3(Mathf.Cos(i * 1.1f) * 1.95f, 2.15f + (i * 0.12f), Mathf.Sin(i * 1.1f) * 1.2f),
                    Vector3.zero,
                    Vector3.one * (0.3f + i * 0.03f),
                    new Color(0.34f, 0.32f, 0.35f, 0.12f));
                var renderer = puff.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                }
            }
        }

        private void CreateLamp(string objectName, Transform parent, Vector3 position, Color color, float intensity, float range)
        {
            var lightObject = new GameObject(objectName);
            lightObject.transform.SetParent(parent, false);
            lightObject.transform.localPosition = position;
            var point = lightObject.AddComponent<Light>();
            point.type = LightType.Point;
            point.color = color;
            point.intensity = intensity;
            point.range = range;
        }

        private void CreateLabel(Transform parent, CharacterProfile profile, Vector3 seatDirection, float sideMultiplier)
        {
            var textObject = new GameObject($"{profile.Alias}_Label");
            textObject.transform.SetParent(parent, false);
            textObject.transform.localPosition = new Vector3(seatDirection.x * 0.5f, 1.02f, seatDirection.z * 0.5f + (0.36f * sideMultiplier));
            textObject.transform.localRotation = Quaternion.Euler(18f, sideMultiplier > 0 ? 180f : 0f, 0f);
            textObject.SetActive(!Application.isPlaying);

            var textMesh = textObject.AddComponent<TextMesh>();
            textMesh.text = $"{profile.Name}\n{profile.Role}";
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.alignment = TextAlignment.Center;
            textMesh.characterSize = 0.06f;
            textMesh.fontSize = 32;
            textMesh.color = profile.Accent;
        }

        private GameObject CreatePrimitive(string objectName, PrimitiveType primitiveType, Transform parent, Vector3 position, Vector3 rotation, Vector3 scale, Color color)
        {
            var instance = GameObject.CreatePrimitive(primitiveType);
            instance.name = objectName;
            instance.transform.SetParent(parent, false);
            instance.transform.localPosition = position;
            instance.transform.localEulerAngles = rotation;
            instance.transform.localScale = scale;

            var renderer = instance.GetComponent<Renderer>();
            if (renderer != null)
            {
                var material = new Material(Shader.Find("Standard"));
                material.color = color;
                renderer.sharedMaterial = material;
            }

            var collider = instance.GetComponent<Collider>();
            if (collider != null)
            {
                DestroyImmediate(collider);
            }

            return instance;
        }

        private GameObject GetOrCreateChild(string objectName)
        {
            var child = transform.Find(objectName);
            if (child != null)
            {
                return child.gameObject;
            }

            var created = new GameObject(objectName);
            created.transform.SetParent(transform, false);
            return created;
        }

        private void QueueRebuild()
        {
#if UNITY_EDITOR
            if (rebuildQueued)
            {
                return;
            }

            rebuildQueued = true;
            EditorApplication.delayCall += DelayedRebuild;
#endif
        }

#if UNITY_EDITOR
        private void DelayedRebuild()
        {
            EditorApplication.delayCall -= DelayedRebuild;
            if (this == null)
            {
                return;
            }

            Rebuild();
        }
#endif

        private static void ClearChildren(Transform parent)
        {
            for (var i = parent.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(parent.GetChild(i).gameObject);
            }
        }
    }
}
