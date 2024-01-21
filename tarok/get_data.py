import matplotlib.pyplot as plt
import requests
import pandas as pd
import numpy as np
from heapq import nlargest
import os

DIR = os.path.dirname(os.path.abspath(__file__))

MERGE_PLAYERS = ["Ostali", "Mica", "Žaži", "Klančar"]


def download_as_csv():
    response = requests.get("https://docs.google.com/spreadsheets/d/"
                            "1Cv9EgP-gcNYhTOR2O9DxDBdSoSLT0iBg5lDCvBdx51E/export?format=csv")
    assert response.status_code == 200, 'Wrong status code'
    # write to file
    with open(f'{DIR}/data/raw_data.csv', 'wb') as f:
        f.write(response.content)


def create_df_from_csv(all_players=False):
    # read the csv file line by line
    with open(f'{DIR}/data/raw_data.csv', 'r') as f:
        lines = f.readlines()
    # remove the first line
    lines = lines[2:]
    lines = [l.split(",")[2:12] for l in lines if l[1] != ","]
    lines[1] = ["", "0", "0", "0", "0", "0", "0", "0", "0", "0"]

    lines_df = pd.DataFrame(lines[1:], columns=lines[0])
    lines_df = lines_df.apply(pd.to_numeric, errors='ignore')
    # from the columns in MERGE_PLAYERS create a new column with the max value of the columns
    if all_players:
        lines_df["Ostali"] = lines_df[MERGE_PLAYERS].max(axis=1)
        # remove all other columns in MERGE_PLAYERS
        lines_df = lines_df.drop(columns=MERGE_PLAYERS[1:])
        # save the dataframe
        lines_df.to_csv(f'{DIR}/data/game_by_game_data.csv', index=False)
    else:
        lines_df.to_csv(f'{DIR}/data/leaderboard_data.csv', index=False)


def create_df_with_wins_by_game():
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    games = data["st_iger"]
    data = data.drop(columns=["st_iger"])
    data = data.iloc[1:]
    data = data.fillna(-np.inf)

    def f(row):
        x = nlargest(4, enumerate(row.to_list()), key=lambda x: x[1])
        for i in range(4):
            row[x[i][0]] = i + 1

    data.apply(f, axis=1)
    data = data.replace(-np.inf, np.nan)
    data["st_iger"] = games

    # save the dataframe
    data.to_csv(f'{DIR}/data/wins_by_game.csv', index=False)


def create_df_with_games_by_one(n=200):
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    PLAYERS = data.columns[1:]

    games = data["st_iger"]
    new_data = {p: None for p in PLAYERS}
    for player in PLAYERS:
        player_points = data[player]
        player_games = data["st_iger"][~np.isnan(player_points)]
        player_points = list(player_points[~np.isnan(player_points)])
        num_games = int(player_games.sum())
        player_games = [0] + list(player_games.cumsum()[1:])

        game_idx = 0
        player_points_by_game = [0]

        for i in range(1, num_games):
            if (not game_idx > len(player_games)) and i == player_games[game_idx + 1]:
                game_idx += 1
                player_points_by_game.append(sum(player_points[:game_idx + 1]))
                continue

            games_diff = player_games[game_idx + 1] - player_games[game_idx]
            new_points = player_points[game_idx + 1] / games_diff
            r = player_points_by_game[-1] + new_points
            player_points_by_game.append(r)

        player_points_by_game.append(sum(player_points))
        new_data[player] = player_points_by_game[-n-1:]

    df = pd.DataFrame(new_data)
    df["st_iger"] = list(range(n+1))
    for p in PLAYERS:
        df[p] = df[p] - df.iloc[0][p]
    df = df[["st_iger"] + list(PLAYERS)]
    df.to_csv(f'{DIR}/data/last_n_games.csv', index=False)


def save_all():
    download_as_csv()
    create_df_from_csv(all_players=True)
    create_df_from_csv(all_players=False)
    create_df_with_wins_by_game()
    create_df_with_games_by_one()


if __name__ == '__main__':
    save_all()
