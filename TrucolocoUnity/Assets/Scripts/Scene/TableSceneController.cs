using System.Collections.Generic;
using Trucoloco.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Trucoloco.Scene
{
    [ExecuteAlways]
    public sealed class TableSceneController : MonoBehaviour
    {
        private sealed class CardData
        {
            public CardData(string label, int strength, string suit, Color color)
            {
                Label = label;
                Strength = strength;
                Suit = suit;
                Tint = color;
            }

            public string Label { get; }
            public int Strength { get; }
            public string Suit { get; }
            public Color Tint { get; }
        }

        private sealed class CardVisual
        {
            public Transform Root;
            public Renderer Renderer;
            public TextMesh Label;
            public Vector3 HomeLocalPosition;
            public Vector3 HomeLocalEulerAngles;
        }

        private CharacterProfile[] characters = MatchState.CreateDefaultCharacters();
        private MatchState matchState;
        private Canvas hudCanvas;
        private Text titleText;
        private Text subtitleText;
        private Text scoreText;
        private Text rosterText;
        private Text eventLogText;
        private Text phaseText;
        private Text highlightText;
        private Text modifierText;
        private Image fxOverlay;
        private Button[] handButtons;
        private Text[] handButtonTexts;
        private Button nextHandButton;
        private Transform tableVisualsRoot;
        private bool builtVisuals;
        private bool runtimeInitialized;
        private float highlightTimer;
        private float fxTimer;
        private bool centerAnimationActive;
        private float centerAnimationTimer;

        private readonly List<CardData> humanHand = new List<CardData>();
        private readonly List<CardData> aiHand = new List<CardData>();
        private readonly List<CardData> deckPool = new List<CardData>();
        private CardVisual[] humanCardVisuals;
        private CardVisual[] aiCardVisuals;
        private CardVisual[] centerCardVisuals;
        private readonly CardData[] lastCenterCards = new CardData[2];
        private int trickNumber;
        private int humanTricks;
        private int aiTricks;
        private int handStake = 2;
        private bool handFinished;
        private string activeModifierName = "Sin caos";
        private string activeModifierDescription = "Mesa calmada por accidente.";
        private Color activeModifierColor = new Color(0.82f, 0.72f, 0.55f);
        private int humanModifierBonus;
        private int aiModifierBonus;
        private string negotiatorLane = "Negociadores: pendiente";
        private string starLane = "Estrellas: pendiente";
        private int sideLaneWinsA;
        private int sideLaneWinsB;
        private readonly Vector3[] centerAnimationStartPositions = new Vector3[2];
        private readonly Vector3[] centerAnimationStartRotations = new Vector3[2];

        public void SetCharacters(CharacterProfile[] value)
        {
            characters = value;
            matchState = new MatchState(characters);
            runtimeInitialized = false;
            BuildHud();
            BuildTableVisuals();
            RefreshHud("Mesa lista para bajar cartas.");
        }

        private void Start()
        {
            matchState ??= new MatchState(characters);
            BuildHud();
            BuildTableVisuals();

            if (Application.isPlaying)
            {
                StartRuntimeMatch();
            }
            else
            {
                RefreshHud("Blockout del antro listo para iterar.");
            }
        }

        private void Update()
        {
            if (!builtVisuals)
            {
                BuildTableVisuals();
            }

            if (!Application.isPlaying)
            {
                return;
            }

            if (!runtimeInitialized)
            {
                StartRuntimeMatch();
                return;
            }

            if (highlightText == null)
            {
                return;
            }

            UpdateRuntimeFx();
            UpdateCenterCardAnimation();

            if (highlightTimer > 0f)
            {
                highlightTimer -= Time.deltaTime;
                var color = highlightText.color;
                color.a = Mathf.Clamp01(highlightTimer / 1.2f);
                highlightText.color = color;
                var scale = 1f + (highlightTimer * 0.08f);
                highlightText.rectTransform.localScale = new Vector3(scale, scale, 1f);
            }
            else if (highlightText.color.a > 0f)
            {
                var color = highlightText.color;
                color.a = 0f;
                highlightText.color = color;
            }
        }

        private void StartRuntimeMatch()
        {
            runtimeInitialized = true;
            matchState ??= new MatchState(characters);
            EnsureEventSystem();
            ConfigureRuntimePresentation();
            BuildHud();
            BuildTableVisuals();
            BeginHand();
        }

        private void BuildHud()
        {
            if (hudCanvas != null)
            {
                return;
            }

            var existing = transform.Find("_HUD");
            if (existing != null)
            {
                hudCanvas = existing.GetComponent<Canvas>();
                titleText = existing.Find("Title")?.GetComponent<Text>();
                subtitleText = existing.Find("Subtitle")?.GetComponent<Text>();
                scoreText = existing.Find("Score")?.GetComponent<Text>();
                rosterText = existing.Find("Roster")?.GetComponent<Text>();
                phaseText = existing.Find("Phase")?.GetComponent<Text>();
                eventLogText = existing.Find("EventLog")?.GetComponent<Text>();
                highlightText = existing.Find("Highlight")?.GetComponent<Text>();
                modifierText = existing.Find("Modifier")?.GetComponent<Text>();
                fxOverlay = existing.Find("FXOverlay")?.GetComponent<Image>();

                var handRoot = existing.Find("HandPanel");
                if (handRoot != null)
                {
                    handButtons = new Button[3];
                    handButtonTexts = new Text[3];
                    for (var i = 0; i < 3; i++)
                    {
                        var button = handRoot.Find($"CardButton_{i + 1}")?.GetComponent<Button>();
                        handButtons[i] = button;
                        handButtonTexts[i] = button != null ? button.GetComponentInChildren<Text>() : null;
                    }
                }

                nextHandButton = existing.Find("NextHandButton")?.GetComponent<Button>();
                var hudIsComplete =
                    hudCanvas != null &&
                    titleText != null &&
                    subtitleText != null &&
                    scoreText != null &&
                    rosterText != null &&
                    phaseText != null &&
                    eventLogText != null &&
                    highlightText != null &&
                    modifierText != null &&
                    fxOverlay != null &&
                    nextHandButton != null &&
                    handButtons != null &&
                    handButtons.Length == 3 &&
                    handButtons[0] != null &&
                    handButtons[1] != null &&
                    handButtons[2] != null;

                if (hudIsComplete)
                {
                    BindHudActions();
                    return;
                }

                if (Application.isEditor && !Application.isPlaying)
                {
                    DestroyImmediate(existing.gameObject);
                }
                else
                {
                    Destroy(existing.gameObject);
                }

                hudCanvas = null;
                titleText = null;
                subtitleText = null;
                scoreText = null;
                rosterText = null;
                phaseText = null;
                eventLogText = null;
                highlightText = null;
                modifierText = null;
                fxOverlay = null;
                handButtons = null;
                handButtonTexts = null;
                nextHandButton = null;
            }

            var hudRoot = new GameObject("_HUD");
            hudRoot.transform.SetParent(transform, false);

            hudCanvas = hudRoot.AddComponent<Canvas>();
            hudCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            hudRoot.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            hudRoot.AddComponent<GraphicRaycaster>();

            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            fxOverlay = CreatePanel("FXOverlay", hudRoot.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(2400f, 1400f), Color.clear);
            fxOverlay.raycastTarget = false;
            fxOverlay.transform.SetAsFirstSibling();

            titleText = CreateText("Title", hudRoot.transform, font, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -22f), 28, FontStyle.Bold, TextAnchor.UpperCenter, new Vector2(760f, 52f));
            subtitleText = CreateText("Subtitle", hudRoot.transform, font, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -56f), 14, FontStyle.Normal, TextAnchor.UpperCenter, new Vector2(760f, 44f));

            CreatePanel("ScorePanel", hudRoot.transform, new Vector2(0.02f, 0.98f), new Vector2(0.02f, 0.98f), new Vector2(8f, -8f), new Vector2(220f, 116f), new Color(0.06f, 0.03f, 0.03f, 0.78f));
            scoreText = CreateText("Score", hudRoot.transform, font, new Vector2(0.02f, 0.98f), new Vector2(0.02f, 0.98f), new Vector2(10f, -10f), 16, FontStyle.Bold, TextAnchor.UpperLeft, new Vector2(204f, 108f));
            CreatePanel("RosterPanel", hudRoot.transform, new Vector2(0.98f, 0.12f), new Vector2(0.98f, 0.12f), new Vector2(-10f, 0f), new Vector2(270f, 110f), new Color(0.06f, 0.03f, 0.03f, 0.78f));
            rosterText = CreateText("Roster", hudRoot.transform, font, new Vector2(0.98f, 0.12f), new Vector2(0.98f, 0.12f), new Vector2(-14f, 0f), 13, FontStyle.Normal, TextAnchor.LowerRight, new Vector2(246f, 98f));
            CreatePanel("PhasePanel", hudRoot.transform, new Vector2(0.5f, 0.23f), new Vector2(0.5f, 0.23f), Vector2.zero, new Vector2(480f, 38f), new Color(0.06f, 0.03f, 0.03f, 0.86f));
            phaseText = CreateText("Phase", hudRoot.transform, font, new Vector2(0.5f, 0.23f), new Vector2(0.5f, 0.23f), Vector2.zero, 16, FontStyle.Bold, TextAnchor.MiddleCenter, new Vector2(456f, 34f));
            CreatePanel("EventLogPanel", hudRoot.transform, new Vector2(0.03f, 0.15f), new Vector2(0.03f, 0.15f), new Vector2(10f, 0f), new Vector2(420f, 84f), new Color(0.06f, 0.03f, 0.03f, 0.86f));
            eventLogText = CreateText("EventLog", hudRoot.transform, font, new Vector2(0.03f, 0.15f), new Vector2(0.03f, 0.15f), new Vector2(14f, 0f), 14, FontStyle.Normal, TextAnchor.LowerLeft, new Vector2(392f, 76f));
            CreatePanel("ModifierPanel", hudRoot.transform, new Vector2(0.5f, 0.9f), new Vector2(0.5f, 0.9f), Vector2.zero, new Vector2(520f, 32f), new Color(0.06f, 0.03f, 0.03f, 0.74f));
            modifierText = CreateText("Modifier", hudRoot.transform, font, new Vector2(0.5f, 0.9f), new Vector2(0.5f, 0.9f), Vector2.zero, 14, FontStyle.Italic, TextAnchor.MiddleCenter, new Vector2(500f, 28f));
            highlightText = CreateText("Highlight", hudRoot.transform, font, new Vector2(0.5f, 0.54f), new Vector2(0.5f, 0.54f), Vector2.zero, 30, FontStyle.Bold, TextAnchor.MiddleCenter, new Vector2(640f, 70f));
            highlightText.color = new Color(0.98f, 0.78f, 0.22f, 0f);

            var handPanel = CreatePanel("HandPanel", hudRoot.transform, new Vector2(0.5f, 0.07f), new Vector2(0.5f, 0.07f), new Vector2(0f, 0f), new Vector2(760f, 110f), new Color(0.08f, 0.04f, 0.04f, 0.92f));
            handButtons = new Button[3];
            handButtonTexts = new Text[3];

            for (var i = 0; i < 3; i++)
            {
                var x = -220f + (i * 220f);
                var button = CreateButton($"CardButton_{i + 1}", handPanel.transform, font, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(x, 0f), new Vector2(190f, 72f), "Carta");
                var index = i;
                button.onClick.AddListener(() => OnHumanCardSelected(index));
                handButtons[i] = button;
                handButtonTexts[i] = button.GetComponentInChildren<Text>();
            }

            nextHandButton = CreateButton("NextHandButton", hudRoot.transform, font, new Vector2(0.82f, 0.23f), new Vector2(0.82f, 0.23f), Vector2.zero, new Vector2(170f, 38f), "Siguiente mano");
            nextHandButton.gameObject.SetActive(false);
            BindHudActions();
        }

        private void BuildTableVisuals()
        {
            var generated = transform.Find("_Generated");
            if (generated == null)
            {
                return;
            }

            tableVisualsRoot = GetOrCreateChild("_TableVisuals", generated);
            ClearChildren(tableVisualsRoot);

            humanCardVisuals = BuildHandFan("PlayerHand_A", new Vector3(0f, 0.42f, -1.85f), -8f, new Color(0.93f, 0.86f, 0.71f));
            aiCardVisuals = BuildHandFan("OppositionHand_B", new Vector3(0f, 0.42f, 1.8f), 172f, new Color(0.73f, 0.78f, 0.88f));
            centerCardVisuals = BuildCenterPile();
            BuildDeckMarkers(!Application.isPlaying);
            if (!Application.isPlaying)
            {
                BuildWallSign(generated);
            }

            builtVisuals = true;
            RefreshCardVisuals();
        }

        private CardVisual[] BuildHandFan(string rootName, Vector3 center, float baseAngle, Color tint)
        {
            var root = new GameObject(rootName);
            root.transform.SetParent(tableVisualsRoot, false);
            root.transform.localPosition = center;

            var visuals = new CardVisual[3];
            for (var i = 0; i < 3; i++)
            {
                var angle = baseAngle + ((i - 1) * 7f);
                var offset = new Vector3((i - 1) * 0.46f, 0f, Mathf.Abs(i - 1) * 0.03f);
                var card = GameObject.CreatePrimitive(PrimitiveType.Cube);
                card.name = $"Card_{i + 1}";
                card.transform.SetParent(root.transform, false);
                card.transform.localPosition = offset;
                card.transform.localEulerAngles = new Vector3(90f, angle, 0f);
                card.transform.localScale = new Vector3(0.72f, 0.025f, 1.05f);

                var renderer = card.GetComponent<Renderer>();
                if (renderer != null)
                {
                    var material = new Material(Shader.Find("Standard"));
                    material.color = tint;
                    renderer.sharedMaterial = material;
                }

                var labelRoot = new GameObject("Label");
                labelRoot.transform.SetParent(card.transform, false);
                labelRoot.transform.localPosition = new Vector3(0f, 0.56f, 0f);
                labelRoot.transform.localRotation = Quaternion.Euler(-90f, 180f, 0f);

                var text = labelRoot.AddComponent<TextMesh>();
                text.anchor = TextAnchor.MiddleCenter;
                text.alignment = TextAlignment.Center;
                text.characterSize = 0.07f;
                text.fontSize = 42;
                text.color = new Color(0.16f, 0.08f, 0.05f);

                visuals[i] = new CardVisual
                {
                    Root = card.transform,
                    Renderer = renderer,
                    Label = text,
                    HomeLocalPosition = offset,
                    HomeLocalEulerAngles = new Vector3(90f, angle, 0f),
                };
            }

            return visuals;
        }

        private CardVisual[] BuildCenterPile()
        {
            var root = new GameObject("CenterCards");
            root.transform.SetParent(tableVisualsRoot, false);
            root.transform.localPosition = new Vector3(0f, 0.43f, 0f);

            var visuals = new CardVisual[2];
            for (var i = 0; i < 2; i++)
            {
                var card = GameObject.CreatePrimitive(PrimitiveType.Cube);
                card.name = $"PlayedCard_{i + 1}";
                card.transform.SetParent(root.transform, false);
                card.transform.localPosition = new Vector3(-0.44f + (i * 0.88f), 0f, 0f);
                card.transform.localEulerAngles = new Vector3(90f, i == 0 ? -14f : 12f, 0f);
                card.transform.localScale = new Vector3(0.82f, 0.03f, 1.12f);

                var renderer = card.GetComponent<Renderer>();
                if (renderer != null)
                {
                    var material = new Material(Shader.Find("Standard"));
                    material.color = new Color(0.18f, 0.08f, 0.08f);
                    renderer.sharedMaterial = material;
                }

                var labelRoot = new GameObject("Label");
                labelRoot.transform.SetParent(card.transform, false);
                labelRoot.transform.localPosition = new Vector3(0f, 0.62f, 0f);
                labelRoot.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f);

                var text = labelRoot.AddComponent<TextMesh>();
                text.anchor = TextAnchor.MiddleCenter;
                text.alignment = TextAlignment.Center;
                text.characterSize = 0.045f;
                text.fontSize = 32;
                text.color = new Color(0.94f, 0.88f, 0.77f);
                text.text = "Esperando";

                visuals[i] = new CardVisual
                {
                    Root = card.transform,
                    Renderer = renderer,
                    Label = text,
                    HomeLocalPosition = new Vector3(-0.44f + (i * 0.88f), 0f, 0f),
                    HomeLocalEulerAngles = new Vector3(90f, i == 0 ? -14f : 12f, 0f),
                };
            }

            return visuals;
        }

        private void BuildDeckMarkers(bool showLabels)
        {
            BuildDeck("MazoTruco", new Vector3(3.15f, 0.43f, -0.95f), new Color(0.87f, 0.82f, 0.67f), "TRUCO", showLabels);
            BuildDeck("MazoTrucoloco", new Vector3(3.05f, 0.43f, 0.15f), new Color(0.7f, 0.36f, 0.92f), "LOCO", showLabels);
            BuildDeck("MazoArmas", new Vector3(3.15f, 0.43f, 1.25f), new Color(0.22f, 0.76f, 0.84f), "ARMAS", showLabels);
        }

        private void BuildDeck(string rootName, Vector3 position, Color tint, string label, bool showLabel)
        {
            var root = new GameObject(rootName);
            root.transform.SetParent(tableVisualsRoot, false);
            root.transform.localPosition = position;

            for (var i = 0; i < 4; i++)
            {
                var card = GameObject.CreatePrimitive(PrimitiveType.Cube);
                card.name = $"DeckCard_{i + 1}";
                card.transform.SetParent(root.transform, false);
                card.transform.localPosition = new Vector3(i * 0.02f, i * 0.01f, -i * 0.02f);
                card.transform.localEulerAngles = new Vector3(90f, 90f, 0f);
                card.transform.localScale = new Vector3(0.64f, 0.025f, 0.92f);
                var renderer = card.GetComponent<Renderer>();
                if (renderer != null)
                {
                    var material = new Material(Shader.Find("Standard"));
                    material.color = tint;
                    renderer.sharedMaterial = material;
                }
            }

            if (showLabel)
            {
                CreateWorldText($"{rootName}_Label", root.transform, label, new Vector3(0.22f, 0.15f, 0f), 0.06f, tint);
            }
        }

        private void BuildWallSign(Transform generated)
        {
            var signRoot = new GameObject("WallSign");
            signRoot.transform.SetParent(generated, false);
            signRoot.transform.localPosition = new Vector3(0f, 3.55f, 4.96f);

            var panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "Panel";
            panel.transform.SetParent(signRoot.transform, false);
            panel.transform.localPosition = Vector3.zero;
            panel.transform.localScale = new Vector3(2.55f, 0.82f, 0.08f);

            var renderer = panel.GetComponent<Renderer>();
            if (renderer != null)
            {
                var material = new Material(Shader.Find("Standard"));
                material.color = new Color(0.09f, 0.02f, 0.02f);
                renderer.sharedMaterial = material;
            }

            CreateWorldText("SignTitle", signRoot.transform, "TRUCOLOCO", new Vector3(0f, 0.09f, -0.08f), 0.11f, new Color(0.95f, 0.78f, 0.28f));
            CreateWorldText("SignSub", signRoot.transform, "La Traicion", new Vector3(0f, -0.12f, -0.08f), 0.06f, new Color(0.85f, 0.3f, 0.2f));
        }

        private void BeginHand()
        {
            if (!Application.isPlaying)
            {
                RefreshHud("La mano jugable aparece al darle Play.");
                return;
            }

            matchState ??= new MatchState(characters);
            trickNumber = 1;
            humanTricks = 0;
            aiTricks = 0;
            handStake = 2;
            handFinished = false;
            centerAnimationActive = false;
            centerAnimationTimer = 0f;
            humanModifierBonus = 0;
            aiModifierBonus = 0;
            lastCenterCards[0] = null;
            lastCenterCards[1] = null;

            RollHandModifier();
            SimulateSideLanes();
            BuildDeckPool();
            DealHand(humanHand);
            DealHand(aiHand);
            RefreshCardVisuals();
            RefreshHandButtons();

            if (nextHandButton != null)
            {
                nextHandButton.gameObject.SetActive(false);
            }

            ClearCenterCards();
            ShowHighlight($"MANO {matchState.HandNumber}", new Color(0.93f, 0.84f, 0.69f, 1f));
            RefreshHud($"Mano {matchState.HandNumber}. Bajá una carta y medí el humo.");
        }

        private void BuildDeckPool()
        {
            deckPool.Clear();
            AddCard("Ancho de Espada", 14, "Espada", new Color(0.93f, 0.82f, 0.66f));
            AddCard("Ancho de Basto", 13, "Basto", new Color(0.86f, 0.8f, 0.64f));
            AddCard("Siete de Espada", 12, "Espada", new Color(0.78f, 0.84f, 0.96f));
            AddCard("Siete de Oro", 11, "Oro", new Color(0.98f, 0.75f, 0.2f));
            AddCard("Tres de Copa", 10, "Copa", new Color(0.88f, 0.34f, 0.31f));
            AddCard("Tres de Basto", 10, "Basto", new Color(0.34f, 0.73f, 0.58f));
            AddCard("Dos de Oro", 9, "Oro", new Color(0.93f, 0.7f, 0.18f));
            AddCard("Dos de Espada", 9, "Espada", new Color(0.48f, 0.7f, 0.95f));
            AddCard("Ancho Falso", 8, "Copa", new Color(0.89f, 0.47f, 0.34f));
            AddCard("Rey de Basto", 7, "Basto", new Color(0.3f, 0.76f, 0.64f));
            AddCard("Caballo de Oro", 6, "Oro", new Color(0.93f, 0.68f, 0.2f));
            AddCard("Sota de Espada", 5, "Espada", new Color(0.47f, 0.74f, 0.96f));
            AddCard("Dragon Blanco", 16, "YuGiOh", new Color(0.78f, 0.9f, 1f));
            AddCard("Mago Oscuro", 15, "YuGiOh", new Color(0.62f, 0.46f, 0.92f));
            AddCard("Kuriboh del Quincho", 4, "YuGiOh", new Color(0.62f, 0.44f, 0.28f));
        }

        private void AddCard(string label, int strength, string suit, Color color)
        {
            deckPool.Add(new CardData(label, strength, suit, color));
        }

        private void DealHand(List<CardData> target)
        {
            target.Clear();
            for (var i = 0; i < 3; i++)
            {
                var index = Random.Range(0, deckPool.Count);
                target.Add(deckPool[index]);
                deckPool.RemoveAt(index);
            }
        }

        private void OnHumanCardSelected(int index)
        {
            if (!Application.isPlaying || handFinished || index < 0 || index >= humanHand.Count)
            {
                return;
            }

            var humanCard = humanHand[index];
            CaptureCenterAnimationStart(true, index, 0);
            humanHand.RemoveAt(index);
            var aiIndex = SelectAiCardIndex();
            var aiCard = aiHand[aiIndex];
            CaptureCenterAnimationStart(false, aiIndex, 1);
            aiHand.RemoveAt(aiIndex);

            lastCenterCards[0] = humanCard;
            lastCenterCards[1] = aiCard;

            var trickWinner = ResolveTrick(humanCard, aiCard);
            trickNumber++;

            RefreshCardVisuals();
            StartCenterCardAnimation();
            RefreshHandButtons();

            if (handFinished)
            {
                if (nextHandButton != null)
                {
                    nextHandButton.gameObject.SetActive(true);
                }
                return;
            }

            RefreshHud($"Baza para {trickWinner}. Seguimos jugando.");
        }

        private string ResolveTrick(CardData humanCard, CardData aiCard)
        {
            var log =
                $"Irvyn baja {humanCard.Label}. " +
                $"Cartachin responde con {aiCard.Label}.";
            var humanStrength = GetEffectiveStrength(humanCard, true);
            var aiStrength = GetEffectiveStrength(aiCard, false);

            if (humanStrength > aiStrength)
            {
                humanTricks++;
                log += $" Fuerza {humanStrength} a {aiStrength}. Highlight: la baza es del equipo A.";
                ShowHighlight("HIGHLIGHT DEL ANTRO", new Color(0.98f, 0.78f, 0.22f, 1f));
                if (humanTricks >= 2 || trickNumber >= 3 && humanTricks > aiTricks)
                {
                    FinishHand("A", log + " Mano cerrada para la banda de Gazpacho.");
                }
                else
                {
                    RefreshHud(log);
                }

                return "equipo A";
            }

            if (aiStrength > humanStrength)
            {
                aiTricks++;
                log += $" Fuerza {aiStrength} a {humanStrength}. El antro se inclina para el equipo B.";
                ShowHighlight("TE LA LEYERON", new Color(0.85f, 0.36f, 0.24f, 1f));
                if (aiTricks >= 2 || trickNumber >= 3 && aiTricks > humanTricks)
                {
                    FinishHand("B", log + " Mano cerrada para la vereda rival.");
                }
                else
                {
                    RefreshHud(log);
                }

                return "equipo B";
            }

            log += " Parda turbia. Nadie se anima a festejar.";
            ShowHighlight("PARDA TURBIA", new Color(0.8f, 0.78f, 0.74f, 1f));
            if (trickNumber >= 3)
            {
                FinishHand("A", log + " Por mano y cara dura, suma el equipo A.");
                return "parda";
            }

            RefreshHud(log);
            return "parda";
        }

        private int SelectAiCardIndex()
        {
            var bestIndex = 0;
            for (var i = 1; i < aiHand.Count; i++)
            {
                if (aiHand[i].Strength > aiHand[bestIndex].Strength)
                {
                    bestIndex = i;
                }
            }

            return bestIndex;
        }

        private void CaptureCenterAnimationStart(bool isHuman, int sourceIndex, int centerIndex)
        {
            if (centerCardVisuals == null || centerIndex >= centerCardVisuals.Length)
            {
                return;
            }

            var xOffset = (sourceIndex - 1) * 0.46f;
            var zOffset = Mathf.Abs(sourceIndex - 1) * 0.03f;

            centerAnimationStartPositions[centerIndex] = isHuman
                ? new Vector3(xOffset, 0f, -1.85f + zOffset)
                : new Vector3(xOffset, 0f, 1.8f + zOffset);

            centerAnimationStartRotations[centerIndex] = isHuman
                ? new Vector3(90f, -18f + (sourceIndex * 4f), 0f)
                : new Vector3(90f, 178f - (sourceIndex * 4f), 0f);
        }

        private void StartCenterCardAnimation()
        {
            if (centerCardVisuals == null)
            {
                return;
            }

            centerAnimationActive = true;
            centerAnimationTimer = 0f;

            for (var i = 0; i < centerCardVisuals.Length; i++)
            {
                var visual = centerCardVisuals[i];
                if (visual?.Root == null)
                {
                    continue;
                }

                visual.Root.localPosition = centerAnimationStartPositions[i];
                visual.Root.localEulerAngles = centerAnimationStartRotations[i];
            }
        }

        private void UpdateCenterCardAnimation()
        {
            if (!centerAnimationActive || centerCardVisuals == null)
            {
                return;
            }

            centerAnimationTimer += Time.deltaTime * 3.8f;
            var t = Mathf.Clamp01(centerAnimationTimer);
            var eased = 1f - Mathf.Pow(1f - t, 3f);

            for (var i = 0; i < centerCardVisuals.Length; i++)
            {
                var visual = centerCardVisuals[i];
                if (visual?.Root == null)
                {
                    continue;
                }

                visual.Root.localPosition = Vector3.Lerp(centerAnimationStartPositions[i], visual.HomeLocalPosition, eased);
                var rotation = Vector3.Lerp(centerAnimationStartRotations[i], visual.HomeLocalEulerAngles, eased);
                visual.Root.localEulerAngles = rotation;
            }

            if (t >= 1f)
            {
                centerAnimationActive = false;
            }
        }

        private void FinishHand(string winnerTeam, string log)
        {
            handFinished = true;
            var bonus = winnerTeam == "A" ? sideLaneWinsA : sideLaneWinsB;
            var totalPoints = handStake + Mathf.Clamp(bonus - 1, 0, 1);
            matchState.AwardPoints(winnerTeam, totalPoints);
            ShowHighlight(winnerTeam == "A" ? "MANO PARA IRVYN" : "MANO PARA CARTACHIN", winnerTeam == "A" ? new Color(0.99f, 0.78f, 0.28f, 1f) : new Color(0.9f, 0.38f, 0.24f, 1f));
            RefreshHud(log + $" Puntaje de mano: {totalPoints}.");
            matchState.AdvanceHand();
        }

        private void RefreshHandButtons()
        {
            if (handButtons == null || handButtonTexts == null)
            {
                return;
            }

            for (var i = 0; i < handButtons.Length; i++)
            {
                var button = handButtons[i];
                if (button == null)
                {
                    continue;
                }

                var active = i < humanHand.Count && !handFinished;
                button.gameObject.SetActive(active);
                if (!active)
                {
                    continue;
                }

                handButtonTexts[i].text = $"{humanHand[i].Label}\nFuerza {humanHand[i].Strength}";
                var colors = button.colors;
                colors.normalColor = humanHand[i].Tint;
                colors.highlightedColor = humanHand[i].Tint * 1.1f;
                colors.pressedColor = humanHand[i].Tint * 0.9f;
                colors.selectedColor = humanHand[i].Tint;
                colors.disabledColor = new Color(0.18f, 0.18f, 0.18f, 0.85f);
                button.colors = colors;
            }
        }

        private void RefreshCardVisuals()
        {
            RefreshHandVisualGroup(humanCardVisuals, humanHand, false, "Esperando");
            RefreshHandVisualGroup(aiCardVisuals, aiHand, true, "Tapada");

            if (centerCardVisuals == null)
            {
                return;
            }

            for (var i = 0; i < centerCardVisuals.Length; i++)
            {
                var visual = centerCardVisuals[i];
                if (visual == null)
                {
                    continue;
                }

                var card = lastCenterCards[i];
                if (card == null)
                {
                    visual.Root.gameObject.SetActive(true);
                    if (visual.Renderer != null)
                    {
                        visual.Renderer.sharedMaterial.color = new Color(0.18f, 0.08f, 0.08f);
                    }

                    if (visual.Label != null)
                    {
                        visual.Label.text = string.Empty;
                    }

                    continue;
                }

                if (visual.Renderer != null)
                {
                    visual.Renderer.sharedMaterial.color = card.Tint;
                }

                if (visual.Label != null)
                {
                    visual.Label.text = card.Strength.ToString();
                }
            }
        }

        private void RefreshHandVisualGroup(CardVisual[] visuals, List<CardData> cards, bool hideNames, string fallbackText)
        {
            if (visuals == null)
            {
                return;
            }

            for (var i = 0; i < visuals.Length; i++)
            {
                var visual = visuals[i];
                if (visual == null)
                {
                    continue;
                }

                var hasCard = i < cards.Count;
                visual.Root.gameObject.SetActive(hasCard);
                if (!hasCard)
                {
                    continue;
                }

                var card = cards[i];
                if (visual.Renderer != null)
                {
                    visual.Renderer.sharedMaterial.color = card.Tint;
                }

                if (visual.Label != null)
                {
                    visual.Label.text = Application.isPlaying ? string.Empty : hideNames ? fallbackText : $"{card.Label}\n{card.Suit}";
                }
            }
        }

        private void ClearCenterCards()
        {
            if (centerCardVisuals == null)
            {
                return;
            }

            for (var i = 0; i < centerCardVisuals.Length; i++)
            {
                var visual = centerCardVisuals[i];
                if (visual?.Renderer != null)
                {
                    visual.Renderer.sharedMaterial.color = new Color(0.18f, 0.08f, 0.08f);
                }

                if (visual?.Label != null)
                {
                    visual.Label.text = string.Empty;
                }
            }
        }

        private void RefreshHud(string eventLog)
        {
            if (titleText == null || matchState == null)
            {
                return;
            }

            titleText.text = "TRUCOLOCO 5.0 - LA TRAICION";
            subtitleText.text = $"Duelo activo: {characters[5].Alias} vs {characters[2].Alias} | Mano {matchState.HandNumber}";
            scoreText.text =
                "Marcador\n" +
                $"Equipo A  {matchState.TeamAScore:00}\n" +
                $"Equipo B  {matchState.TeamBScore:00}\n" +
                $"Objetivo  {MatchState.WinningScore}\n" +
                $"Apuesta  {handStake}";
            rosterText.text =
                $"{negotiatorLane}\n" +
                $"{starLane}\n" +
                $"Bazas: {humanTricks} - {aiTricks}";

            if (modifierText != null)
            {
                modifierText.text = $"{activeModifierName}: {activeModifierDescription}";
                modifierText.color = activeModifierColor;
            }

            if (phaseText != null)
            {
                phaseText.text = handFinished
                    ? "Mano cerrada. Tocá Siguiente mano."
                    : $"Baza {trickNumber}: elegí una carta abajo.";
            }

            if (eventLogText != null)
            {
                eventLogText.text = eventLog;
            }
        }

        private static Text CreateText(string objectName, Transform parent, Font font, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, int fontSize, FontStyle style, TextAnchor alignment, Vector2 size)
        {
            var go = new GameObject(objectName);
            go.transform.SetParent(parent, false);

            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = new Vector2(
                Mathf.Approximately(anchorMin.x, 0.98f) ? 1f : 0.5f,
                Mathf.Approximately(anchorMin.y, 0.05f) || Mathf.Approximately(anchorMin.y, 0.08f) ? 0f : 1f
            );
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var text = go.AddComponent<Text>();
            text.font = font;
            text.fontSize = fontSize;
            text.fontStyle = style;
            text.alignment = alignment;
            text.color = new Color(0.93f, 0.84f, 0.69f);
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        private static Image CreatePanel(string objectName, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size, Color color)
        {
            var go = new GameObject(objectName);
            go.transform.SetParent(parent, false);

            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = new Vector2(
                Mathf.Approximately(anchorMin.x, 0.98f) ? 1f : Mathf.Approximately(anchorMin.x, 0.02f) || Mathf.Approximately(anchorMin.x, 0.03f) ? 0f : 0.5f,
                Mathf.Approximately(anchorMin.y, 0.98f) ? 1f : Mathf.Approximately(anchorMin.y, 0.1f) || Mathf.Approximately(anchorMin.y, 0.12f) || Mathf.Approximately(anchorMin.y, 0.15f) ? 0f : 0.5f
            );
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var image = go.AddComponent<Image>();
            image.color = color;
            return image;
        }

        private static Button CreateButton(string objectName, Transform parent, Font font, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size, string label)
        {
            var go = new GameObject(objectName);
            go.transform.SetParent(parent, false);

            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var image = go.AddComponent<Image>();
            image.color = new Color(0.82f, 0.62f, 0.32f, 0.96f);

            var button = go.AddComponent<Button>();
            var colors = button.colors;
            colors.normalColor = image.color;
            colors.highlightedColor = image.color * 1.05f;
            colors.pressedColor = image.color * 0.92f;
            colors.selectedColor = image.color;
            colors.disabledColor = new Color(0.18f, 0.18f, 0.18f, 0.85f);
            button.colors = colors;

            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(go.transform, false);
            var labelRect = labelGo.AddComponent<RectTransform>();
            labelRect.anchorMin = Vector2.zero;
            labelRect.anchorMax = Vector2.one;
            labelRect.offsetMin = new Vector2(8f, 8f);
            labelRect.offsetMax = new Vector2(-8f, -8f);

            var text = labelGo.AddComponent<Text>();
            text.font = font;
            text.fontSize = 16;
            text.fontStyle = FontStyle.Bold;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = new Color(0.17f, 0.08f, 0.05f);
            text.text = label;

            return button;
        }

        private void BindHudActions()
        {
            if (handButtons != null)
            {
                for (var i = 0; i < handButtons.Length; i++)
                {
                    var button = handButtons[i];
                    if (button == null)
                    {
                        continue;
                    }

                    button.onClick.RemoveAllListeners();
                    var index = i;
                    button.onClick.AddListener(() => OnHumanCardSelected(index));
                }
            }

            if (nextHandButton != null)
            {
                nextHandButton.onClick.RemoveAllListeners();
                nextHandButton.onClick.AddListener(BeginHand);
            }
        }

        private void ConfigureRuntimePresentation()
        {
            var generated = transform.Find("_Generated");
            if (generated == null)
            {
                return;
            }

            var seats = generated.Find("Seats");
            if (seats != null)
            {
                seats.gameObject.SetActive(false);
            }

            var wallSign = generated.Find("WallSign");
            if (wallSign != null)
            {
                wallSign.gameObject.SetActive(false);
            }

            for (var i = 1; i <= 5; i++)
            {
                var smoke = generated.Find($"Smoke_{i}");
                if (smoke != null)
                {
                    smoke.gameObject.SetActive(i <= 2);
                }
            }
        }

        private void ShowHighlight(string message, Color color)
        {
            if (highlightText == null)
            {
                return;
            }

            highlightTimer = 1.2f;
            highlightText.text = message;
            highlightText.color = color;
            highlightText.rectTransform.localScale = Vector3.one;
        }

        private int GetEffectiveStrength(CardData card, bool isHuman)
        {
            var strength = card.Strength + (isHuman ? humanModifierBonus : aiModifierBonus);

            if (card.Label == "Dragon Blanco")
            {
                strength += 2;
            }
            else if (card.Label == "Mago Oscuro")
            {
                strength += 1;
            }
            else if (card.Label == "Kuriboh del Quincho" && activeModifierName == "Gafas Legendarias")
            {
                strength += 5;
            }

            return strength;
        }

        private void RollHandModifier()
        {
            var roll = Random.Range(0, 4);
            switch (roll)
            {
                case 0:
                    activeModifierName = "Sustancia X";
                    activeModifierDescription = "Irvyn entra en modo utoneo y suma +3 a sus cartas.";
                    activeModifierColor = new Color(0.74f, 0.36f, 0.92f);
                    humanModifierBonus = 3;
                    break;
                case 1:
                    activeModifierName = "Gafas Legendarias";
                    activeModifierDescription = "Cartachin ve doble y liga +2, pero Kuriboh se vuelve insoportable.";
                    activeModifierColor = new Color(0.2f, 0.86f, 0.84f);
                    aiModifierBonus = 2;
                    break;
                case 2:
                    activeModifierName = "Tiempo Arena";
                    activeModifierDescription = "La mano se pone espesa y vale 3 puntos.";
                    activeModifierColor = new Color(0.95f, 0.72f, 0.22f);
                    handStake = 3;
                    break;
                default:
                    activeModifierName = "Exodia de Bolsillo";
                    activeModifierDescription = "Gazpacho mete lobby místico: Dragon Blanco y Mago Oscuro pegan más.";
                    activeModifierColor = new Color(0.98f, 0.84f, 0.3f);
                    humanModifierBonus = 1;
                    aiModifierBonus = 1;
                    break;
            }
        }

        private void SimulateSideLanes()
        {
            sideLaneWinsA = 0;
            sideLaneWinsB = 0;

            var negotiatorRoll = Random.Range(0, 100);
            if (negotiatorRoll >= 50)
            {
                negotiatorLane = "Negociadores: Marvyn durmio al Consul";
                sideLaneWinsA++;
            }
            else
            {
                negotiatorLane = "Negociadores: Consul vendio humo y cobro";
                sideLaneWinsB++;
            }

            var starRoll = Random.Range(0, 100);
            if (starRoll >= 40)
            {
                starLane = "Estrellas: Gazpacho se cree dios y gana";
                sideLaneWinsA++;
            }
            else
            {
                starLane = "Estrellas: El Ruso le corto el ego a Gazpacho";
                sideLaneWinsB++;
            }
        }

        private void UpdateRuntimeFx()
        {
            if (fxOverlay == null)
            {
                return;
            }

            fxTimer += Time.deltaTime;
            var color = Color.clear;

            if (activeModifierName == "Sustancia X")
            {
                color = new Color(0.62f, 0.18f, 0.82f, 0.06f + Mathf.Sin(fxTimer * 4.2f) * 0.03f);
            }
            else if (activeModifierName == "Gafas Legendarias")
            {
                color = new Color(0.12f, 0.7f, 0.82f, 0.03f + Mathf.Sin(fxTimer * 5f) * 0.02f);
            }
            else if (activeModifierName == "Exodia de Bolsillo")
            {
                color = new Color(0.92f, 0.74f, 0.18f, 0.05f + Mathf.Sin(fxTimer * 3f) * 0.02f);
            }

            color.a = Mathf.Clamp(color.a, 0f, 0.12f);
            fxOverlay.color = color;
        }

        private static void EnsureEventSystem()
        {
            if (Object.FindFirstObjectByType<EventSystem>() != null)
            {
                return;
            }

            var eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<EventSystem>();
            eventSystem.AddComponent<StandaloneInputModule>();
        }

        private static void CreateWorldText(string objectName, Transform parent, string value, Vector3 localPosition, float size, Color color)
        {
            var go = new GameObject(objectName);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);

            var text = go.AddComponent<TextMesh>();
            text.text = value;
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.characterSize = size;
            text.fontSize = 42;
            text.color = color;
        }

        private static Transform GetOrCreateChild(string objectName, Transform parent)
        {
            var child = parent.Find(objectName);
            if (child != null)
            {
                return child;
            }

            var created = new GameObject(objectName);
            created.transform.SetParent(parent, false);
            return created.transform;
        }

        private static void ClearChildren(Transform parent)
        {
            for (var i = parent.childCount - 1; i >= 0; i--)
            {
                if (Application.isEditor && !Application.isPlaying)
                {
                    Object.DestroyImmediate(parent.GetChild(i).gameObject);
                }
                else
                {
                    Object.Destroy(parent.GetChild(i).gameObject);
                }
            }
        }
    }
}
