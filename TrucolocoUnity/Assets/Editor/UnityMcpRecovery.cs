using System;
using System.Linq;
using com.IvanMurzak.Unity.MCP;
using UnityEditor;
using UnityEngine;

namespace Trucoloco.Editor
{
    [InitializeOnLoad]
    internal static class UnityMcpRecovery
    {
        private const string SessionKey = "Trucoloco.UnityMcpRecovery.InitialReconnectDone";

        static UnityMcpRecovery()
        {
            if (SessionState.GetBool(SessionKey, false))
            {
                return;
            }

            SessionState.SetBool(SessionKey, true);
            EditorApplication.delayCall += ForceReconnect;
        }

        [MenuItem("Tools/Trucoloco/Force Unity MCP Reconnect")]
        private static void ForceReconnectMenu()
        {
            ForceReconnect();
        }

        private static void ForceReconnect()
        {
            EditorApplication.delayCall -= ForceReconnect;

            try
            {
                Debug.Log("[Trucoloco] Starting Unity MCP hard reset.");
                UnityMcpPluginEditor.StaticDispose();
                EditorApplication.delayCall += RebuildAfterReset;
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
            }
        }

        private static void RebuildAfterReset()
        {
            EditorApplication.delayCall -= RebuildAfterReset;

            try
            {
                UnityMcpPluginEditor.InitSingletonIfNeeded();

                var plugin = UnityMcpPluginEditor.Instance;
                plugin.BuildMcpPluginIfNeeded();
                plugin.AddUnityLogCollectorIfNeeded(() => new BufferedFileLogStorage());

                var toolCount = plugin.Tools?.GetAllTools()?.Count() ?? -1;
                Debug.Log($"[Trucoloco] Unity MCP rebuilt. Tool count: {toolCount}. State: {UnityMcpPluginEditor.ConnectionState.CurrentValue}");

                _ = UnityMcpPluginEditor.ConnectIfNeeded();
                EditorApplication.delayCall += LogPostReconnectState;
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
            }
        }

        private static void LogPostReconnectState()
        {
            EditorApplication.delayCall -= LogPostReconnectState;

            try
            {
                var toolCount = UnityMcpPluginEditor.Instance.Tools?.GetAllTools()?.Count() ?? -1;
                Debug.Log($"[Trucoloco] Unity MCP reconnect requested. Tool count: {toolCount}. State: {UnityMcpPluginEditor.ConnectionState.CurrentValue}");
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
            }
        }
    }
}
