import numpy as np
import pandas as pd


def multiplayer_elo_from_rankings(df, K=32, initial_elo=1500):
    """
    df: DataFrame with ranks (1=best, 4=worst), NaN for non-participants
    returns: DataFrame of Elo ratings after each game
    """

    players = df.columns
    elo = pd.Series(initial_elo, index=players, dtype=float)

    elo_history = []

    for _, row in df.iterrows():
        # Copy previous ratings
        new_elo = elo.copy()

        # Players in this game
        active = row.dropna()
        active_players = active.index
        ranks = active.values

        # Actual scores from ranks
        actual = (4 - ranks) / 3.0
        actual = pd.Series(actual, index=active_players)

        # Expected scores
        expected = {}
        for i in active_players:
            Ri = elo[i]
            probs = []
            for j in active_players:
                if i == j:
                    continue
                Rj = elo[j]
                p = 1 / (1 + 10 ** ((Rj - Ri) / 400))
                probs.append(p)
            expected[i] = np.mean(probs)

        expected = pd.Series(expected)

        # Elo update
        for i in active_players:
            new_elo[i] += K * (actual[i] - expected[i])

        # Save state
        elo = new_elo
        elo_history.append(elo.copy())

    return pd.DataFrame(elo_history, columns=players)
