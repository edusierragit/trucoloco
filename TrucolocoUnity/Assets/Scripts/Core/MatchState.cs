using UnityEngine;

namespace Trucoloco.Core
{
    public sealed class MatchState
    {
        public const int WinningScore = 30;

        public CharacterProfile[] Characters { get; }
        public int TeamAScore { get; private set; }
        public int TeamBScore { get; private set; }
        public int HandNumber { get; private set; }

        public MatchState(CharacterProfile[] characters)
        {
            Characters = characters;
            TeamAScore = 0;
            TeamBScore = 0;
            HandNumber = 1;
        }

        public void AwardPoints(string teamId, int amount)
        {
            if (teamId == "A")
            {
                TeamAScore += amount;
                return;
            }

            TeamBScore += amount;
        }

        public void AdvanceHand()
        {
            HandNumber++;
        }

        public static CharacterProfile[] CreateDefaultCharacters()
        {
            return new[]
            {
                new CharacterProfile("El Consul", "Consul", TrucolocoRole.Negociador, "B", "\"Los puntos se negocian, no se regalan.\"", "Empieza a cerrar pactos con una nube de humo.", new Color(0.23f, 0.45f, 0.95f)),
                new CharacterProfile("El Ruso", "Ruso", TrucolocoRole.JugadorEstrella, "B", "\"La mejor carta siempre esta en mi mano.\"", "Jura que ya vio el futuro de la baza.", new Color(0.31f, 0.65f, 1f)),
                new CharacterProfile("Cartachin", "Cartachin", TrucolocoRole.TeamManager, "B", "\"Yo no bluffeo, yo ilustro la mano.\"", "Le habla a las cartas como si fueran apostoles del cartoncito.", new Color(0.12f, 0.82f, 0.73f)),
                new CharacterProfile("Marvyn", "Marvyn", TrucolocoRole.Negociador, "A", "\"Un trato es un trato, flaco.\"", "Se pone juridico sin ningun motivo y redacta pactos en el aire.", new Color(0.85f, 0.33f, 0.18f)),
                new CharacterProfile("El Gazpacho", "Gazpacho", TrucolocoRole.JugadorEstrella, "A", "\"El As es mio por derecho divino.\"", "Se declara invencible y exige respeto ceremonial.", new Color(0.97f, 0.77f, 0.23f)),
                new CharacterProfile("Irvyn", "Irvyn", TrucolocoRole.TeamManager, "A", "\"No me toquen el setup, que se cae el antro.\"", "Dice que cada luz del cuarto le revela una jugada distinta.", new Color(0.77f, 0.25f, 0.9f)),
            };
        }
    }
}
