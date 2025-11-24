import matplotlib.pyplot as plt
import requests
import pandas as pd
import numpy as np
from heapq import nlargest
import os
import json

DIR = os.path.dirname(os.path.abspath(__file__))

MERGE_PLAYERS = ["Ostali", "Mica", "Ferjan", "Kocjančič"]


def download_as_csv():
    response = requests.get("https://docs.google.com/spreadsheets/d/"
                            "1Cv9EgP-gcNYhTOR2O9DxDBdSoSLT0iBg5lDCvBdx51E/export?format=csv")
    assert response.status_code == 200, 'Wrong status code'
    # write to file
    with open(f'{DIR}/data/raw_data.csv', 'wb') as f:
        f.write(response.content)


def csv_to_df(merge_players=False):
    # do the same with pandas
    df = pd.read_csv(f'{DIR}/data/raw_data.csv')
    df = df.iloc[:, 1:]

    if merge_players:
        df["Ostali"] = df[MERGE_PLAYERS].max(axis=1)
        # remove all other columns in MERGE_PLAYERS
        df = df.drop(columns=MERGE_PLAYERS[1:])
        # save the dataframe
        df.to_csv(f'{DIR}/data/games_data_merge_players.csv', index=False)
        return list(df.columns[1:])
    else:
        df.to_csv(f'{DIR}/data/leaderboard_data.csv', index=False)
        return list(df.columns[1:])


def wins_by_game_df():
    data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
    games = data["st_iger"]
    data = data.drop(columns=["st_iger"])
    data = data.fillna(-np.inf)

    def f(row):
        # get the 4 largest values and their indices and make sure the numbers are bigger than 0

        x = nlargest(4, enumerate(row.to_list()), key=lambda y: y[1])
        x = [(i, j) for i, j in x if j > -np.inf]
        for i in range(len(x)):
            row[x[i][0]] = i + 1

    data.apply(f, axis=1)
    data = data.replace(-np.inf, np.nan)
    data["st_iger"] = games

    # save the dataframe
    data.to_csv(f'{DIR}/data/wins_by_game.csv', index=False)


def wins_by_game_df_all():
    data = pd.read_csv(f'{DIR}/data/leaderboard_data.csv')
    games = data["st_iger"]
    data = data.drop(columns=["st_iger"])
    data = data.fillna(-np.inf)

    def f(row):
        # get the 4 largest values and their indices and make sure the numbers are bigger than 0

        x = nlargest(4, enumerate(row.to_list()), key=lambda y: y[1])
        x = [(i, j) for i, j in x if j > -np.inf]
        for i in range(len(x)):
            row[x[i][0]] = i + 1

    data.apply(f, axis=1)
    data = data.replace(-np.inf, np.nan)
    data["st_iger"] = games

    # save the dataframe
    data.to_csv(f'{DIR}/data/wins_by_game_all.csv', index=False)


def last_games_by_one_df(n=200):
    data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
    PLAYERS = data.columns[1:]

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


def leaderboard_cumsum_df(players):
    data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
    # for each player, compute the cumulative sum of their played games as the cumsum of the column
    # "st.iger" for all the rows where the player is not NaN
    for player in players:
        f = lambda igra, pl: igra if not np.isnan(pl) else 0
        data[f"{player}_games"] = data.apply(lambda x: f(x.st_iger, x[f"{player}"]), axis=1)
        data[f"{player}_games"] = data[f"{player}_games"].cumsum()

    # change Nan to 0
    data = data.fillna(0)
    for player in players:
        data[player] = data[player].cumsum()

    # save the dataframe
    data.to_csv(f'{DIR}/data/leaderboard_cumsum.csv', index=False)


def number_of_places_df(players):
    data = pd.read_csv(f'{DIR}/data/wins_by_game.csv')
    data = data[players]
    data = data.apply(pd.value_counts)
    counts = data.sum(axis=0)
    # make counts a dataframe with players as columns
    counts = pd.DataFrame(counts).T
    counts.to_csv(f'{DIR}/data/num_played_games.csv', index=False)


    # divide each column by its sum:
    for player in players:
        data[player] = data[player] / data[player].sum()
        # round to 2 decimals
        data[player] = data[player].apply(lambda x: round(x * 100, 2))

    players_with_wins = list(zip(list(data.iloc[0]), list(data.columns)))
    players_with_wins.sort(reverse=True)
    sorted_players = [p[1] for p in players_with_wins]
    data = data[sorted_players]

    # save the dataframe
    data.to_csv(f'{DIR}/data/number_of_places.csv', index=False)


def head_to_head_matrix(players):
    data = pd.read_csv(f'{DIR}/data/games_data_merge_players.csv')
    # for each player, count the number of wins against each other player
    data = data[players]
    data = data.iloc[1:]
    matrix = np.zeros((len(players), len(players)))

    for p1 in players:
        for p2 in players:
            data[f"{p1}_{p2}"] = data[p1] > data[p2]
            matrix[players.index(p1), players.index(p2)] = data[f"{p1}_{p2}"].sum()

    for i in range(len(players)):
        matrix[i, i] = np.nan
        for j in range(i + 1, len(players)):
            matrix[i, j] = matrix[i, j] / (matrix[i, j] + matrix[j, i])
            matrix[j, i] = 1 - matrix[i, j]

    order_counts = []
    for i in range(len(players)):
        count1 = (matrix[i, :] > 0.5).sum() + 0.5 * (matrix[:, i] == 0.5).sum()
        # count the total values that are not nan
        count2 = matrix[i, ~np.isnan(matrix[i, :])].sum()
        order_counts.append(count1 + count2)

    player_idx = np.array(np.argsort(order_counts), dtype=int)[::-1]

    matrix = matrix * 100
    matrix[:, :] = matrix[player_idx, :]
    matrix[:, :] = matrix[:, player_idx]
    matrix = np.flip(matrix, axis=0)
    matrix = np.round(matrix, 1)

    PLAYER_NAMES = np.array(players.copy())[player_idx]

    h2h_df = pd.DataFrame(matrix, columns=PLAYER_NAMES)

    h2h_df.to_csv(f'{DIR}/data/head_to_head.csv', index=False)


def wins_over_time_json(players):
    data = pd.read_csv(f'{DIR}/data/wins_by_game.csv')
    data = data[players]
    data[data > 1] = 0

    plot_data = data.copy()
    for player in players:
        plot_data[f"{player}_y"] = data[player].cumsum()

    plot_data = plot_data[[f"{player}_y" for player in players]]
    data_dict = {}
    for player in players:
        y = np.array(plot_data[f"{player}_y"])
        # remove nan values
        y = y[~np.isnan(y)]
        # add 0 to the beginning
        data_dict[f"{player}_y"] = [0] + y.tolist()

    # save data dict to json:
    with open(f'{DIR}/data/wins_over_time.json', 'w') as f:
        json.dump(data_dict, f, indent=4)


def leaderboard_df():
    data = pd.read_csv(f'{DIR}/data/leaderboard_data.csv')

    players = list(data.columns[1:])
    points_per_player = data[players].sum()
    # put all the non nan elements to 1
    game_lengths = data["st_iger"]
    data = data[players]
    data[~np.isnan(data)] = 1
    # row by row multiply the number of games with the number of wins
    num_games = data.sum()
    num_rounds = data.multiply(game_lengths, axis=0).sum()

    wins = pd.read_csv(f'{DIR}/data/wins_by_game_all.csv')
    wins = wins[wins == 1.0].sum(axis=0)
    wins = wins[players]

    # combine points_per_player, num_games and num_round into a dataframe
    df = pd.DataFrame({"points": points_per_player, "games": num_games, "rounds": num_rounds, "wins": wins})
    # cast to int
    df = df.astype(int)

    # sort players by points
    sort_idx = np.argsort(points_per_player)[::-1]
    df = df.iloc[sort_idx]

    # save
    df.to_csv(f'{DIR}/data/totals.csv')


def save_all():
    download_as_csv()
    players = csv_to_df(merge_players=True)
    all_players = csv_to_df(merge_players=False)
    wins_by_game_df()
    wins_by_game_df_all()
    last_games_by_one_df()
    leaderboard_cumsum_df(players)
    number_of_places_df(players)
    head_to_head_matrix(players)
    wins_over_time_json(players)
    leaderboard_df()


if __name__ == '__main__':
    save_all()
