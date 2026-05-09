using System;
using UnityEngine;

namespace Trucoloco.Core
{
        public enum TrucolocoRole
        {
        Negociador,
        JugadorEstrella,
        TeamManager
        }

    [Serializable]
    public sealed class CharacterProfile
    {
        public string Name;
        public string Alias;
        public TrucolocoRole Role;
        public string TeamId;
        public string Quote;
        public string SustanciaReaction;
        public Color Accent;

        public CharacterProfile(string name, string alias, TrucolocoRole role, string teamId, string quote, string sustanciaReaction, Color accent)
        {
            Name = name;
            Alias = alias;
            Role = role;
            TeamId = teamId;
            Quote = quote;
            SustanciaReaction = sustanciaReaction;
            Accent = accent;
        }
    }
}
