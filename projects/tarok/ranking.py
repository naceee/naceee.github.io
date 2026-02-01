import numpy as np
import pandas as pd


def multiplayer_elo(
    rank_df, points_df, number_of_games, K=32, tau=128, initial_elo=1500
):
    """
    Multiplayer Elo with logistic point-difference outcomes.

    rank_df   : DataFrame with ranks (1=best, 4=worst, NaN if not played)
    points_df : DataFrame with point scores (same shape as rank_df)
    K         : Elo update factor
    tau       : score difference scale (larger = softer)
    """

    players = rank_df.columns
    elo = pd.Series(initial_elo, index=players, dtype=float)
    elo_history = []

    for idx, rank_row in rank_df.iterrows():
        new_elo = elo.copy()

        # Active players
        active = rank_row.dropna().index
        scores = points_df.loc[idx, active]

        # Expected & actual scores
        actual = {}
        expected = {}

        for i in active:
            Ri = elo[i]
            ai_sum = 0.0
            ei_sum = 0.0

            for j in active:
                if i == j:
                    continue

                Rj = elo[j]

                # Logistic actual outcome from points
                d = scores[i] - scores[j]
                a_ij = 1.0 / (1.0 + np.exp(-d / tau))

                # Elo expected outcome
                e_ij = 1.0 / (1.0 + 10 ** ((Rj - Ri) / 400))

                ai_sum += a_ij
                ei_sum += e_ij

            actual[i] = ai_sum / (len(active) - 1)
            expected[i] = ei_sum / (len(active) - 1)

        # Update Elo
        K_multiplier = number_of_games[idx] / 30
        for i in active:
            new_elo[i] += K * K_multiplier * (actual[i] - expected[i])

        elo = new_elo
        elo_history.append(elo.copy())

    return pd.DataFrame(elo_history, columns=players)
