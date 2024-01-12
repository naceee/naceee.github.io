import pandas as pd
import plotly.graph_objects as go
import numpy as np
import matplotlib
import os

DIR = os.path.dirname(os.path.abspath(__file__))

game_data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
PLAYERS = list(game_data.columns[1:])
cmap = matplotlib.colormaps['Set2']
COLORS = {PLAYERS[i]: f"rgb{(cmap(i)[0], cmap(i)[1], cmap(i)[2])}" for i in range(len(PLAYERS))}
print(COLORS)


def all_time_leaderboard():
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    # for each player, compute the cumulative sum of their played games as the cumsum of the column
    # "st. iger" for all the rows where the player is not NaN
    for player in PLAYERS:
        f = lambda igra, pl: igra if not np.isnan(pl) else 0
        data[f"{player}_games"] = data.apply(lambda x: f(x.st_iger, x[f"{player}"]), axis=1)
        data[f"{player}_games"] = data[f"{player}_games"].cumsum()

    # change Nan to 0
    data = data.fillna(0)
    for player in PLAYERS:
        data[player] = data[player].cumsum()

    # plot the data using plotly
    fig = go.Figure()
    for player in PLAYERS:
        x = data[f"{player}_games"]
        y = data[player]
        fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player,
                                 line=dict(color=COLORS[player])))

    # put the yaxis title on the right sides
    fig.update_layout(
        title='Večna lestvica',
        xaxis_title='Število iger',
        yaxis_title='Število točk',
        plot_bgcolor="white",
        showlegend=False,
        margin=dict(r=50, t=50, b=50, l=20),
        yaxis={'side': 'right'}
    )

    # compute the end score for each player
    end_scores = data.iloc[-1]
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    print(end_scores)
    y_positions = arrange_positions(end_scores)

    # add the end score to the plot
    for player in PLAYERS:
        fig.add_annotation(
            x=data[f"{player}_games"].iloc[-1],
            y=y_positions[player],
            text=player,
            showarrow=False,
            xanchor="left",
            font=dict(
                size=12,
                color=COLORS[player]
            )
        )

    fig.show()
    fig.write_html(f'{DIR}/graphs/all_time_leaderboard.html')


def last_n_leaderboard():
    data = pd.read_csv(f'{DIR}/data/last_n_games.csv')

    # plot the data using plotly
    fig = go.Figure()
    for player in PLAYERS:
        x = data["st_iger"]
        y = data[player]
        fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player,
                                 line=dict(color=COLORS[player])))

    # put the yaxis title on the right sides
    fig.update_layout(
        title='Lestvica forme',
        xaxis_title='Število iger',
        yaxis_title='Število točk',
        plot_bgcolor="white",
        showlegend=False,
        margin=dict(r=50, t=50, b=50, l=20),
        yaxis={'side': 'right'}
    )

    # compute the end score for each player
    end_scores = data.iloc[-1]
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    y_positions = arrange_positions(end_scores)

    # add the end score to the plot
    for player in PLAYERS:
        fig.add_annotation(
            x=list(data["st_iger"])[-1],
            y=y_positions[player],
            text=player,
            showarrow=False,
            xanchor="left",
            yanchor="middle",
            font=dict(
                size=12,
                color=COLORS[player]
            )
        )

    fig.show()
    fig.write_html(f'{DIR}/graphs/last_n_leaderboard.html')


def arrange_positions(end_scores, k=0.04):
    # sort the players by their end score
    end_scores = end_scores.sort_values(ascending=False)
    last_y = 0
    y_positions_dict = {}
    max_y = max(end_scores)
    for player in end_scores.index:
        if last_y == 0:
            last_y = max_y
        else:
            if last_y - end_scores[player] < k * max_y:
                last_y = last_y - k * max_y
            else:
                last_y = end_scores[player]

        y_positions_dict[player] = last_y
    return y_positions_dict


def number_of_places():
    data = pd.read_csv(f'{DIR}/data/wins_by_game.csv')
    data = data[PLAYERS]
    data = data.apply(pd.value_counts)
    counts = data.sum(axis=0)
    # make counts a dict with players as keys
    counts = dict(counts)

    # divide each column by its sum:
    for player in PLAYERS:
        data[player] = data[player] / data[player].sum()
        # round to 2 decimals
        data[player] = data[player].apply(lambda x: round(x * 100, 2))

    players_with_wins = list(zip(list(data.iloc[0]), list(data.columns)))
    players_with_wins.sort(reverse=True)
    sorted_players = [p[1] for p in players_with_wins]
    data = data[sorted_players]

    colors = ["gold", "silver", "peru", "#edebe1"]

    fig = go.Figure(go.Bar(x=sorted_players, y=data.iloc[0],
                           name=f'1. mesto', marker_color=colors[0], hoverinfo="y"))
    for place in range(1, 4):
        fig.add_trace(go.Bar(x=sorted_players, y=data.iloc[place], name=f'{place+1}. mesto',
                             marker_color=colors[place], hoverinfo="y"))
    fig.update_xaxes(showticklabels=False)

    for player in sorted_players:
        fig.add_annotation(
            x=player,
            y=0,
            xanchor="center",
            yref="paper",
            yanchor="top",
            text=f"{player}<br>({int(counts[player])} iger)",
            showarrow=False,
            font=dict(size=14)
        )

    fig.update_layout(
        barmode='stack',
        plot_bgcolor="white",
        yaxis={'visible': False},
        title='Delež uvrstitev posameznika',
    )
    fig.show()
    fig.write_html(f'{DIR}/graphs/number_of_wins.html')


def head_to_head():
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    # for each player, count the number of wins against each other player
    data = data[PLAYERS]
    data = data.iloc[1:]
    matrix = np.zeros((len(PLAYERS), len(PLAYERS)))

    for p1 in PLAYERS:
        for p2 in PLAYERS:
            data[f"{p1}_{p2}"] = data[p1] > data[p2]
            print(PLAYERS, p1, p2)
            matrix[PLAYERS.index(p1), PLAYERS.index(p2)] = data[f"{p1}_{p2}"].sum()

    for i in range(len(PLAYERS)):
        matrix[i, i] = np.nan
        for j in range(i + 1, len(PLAYERS)):
            matrix[i, j] = matrix[i, j] / (matrix[i, j] + matrix[j, i])
            matrix[j, i] = 1 - matrix[i, j]

    order_counts = []
    for i in range(len(PLAYERS)):
        count1 = (matrix[i, :] > 0.5).sum() + 0.5 * (matrix[:, i] == 0.5).sum()
        # count the total values that are not nan
        count2 = matrix[i, ~np.isnan(matrix[i, :])].sum()
        order_counts.append(count1 + count2)

    player_idx = np.array(np.argsort(order_counts), dtype=int)[::-1]

    matrix = matrix * 100

    text = matrix.copy()
    text = np.round(text, 1)
    text = text.astype(str)
    text[text == "nan"] = ""
    for i in range(len(PLAYERS)):
        for j in range(len(PLAYERS)):
            if text[i, j] != "":
                text[i, j] += "%"

    matrix[:, :] = matrix[player_idx, :]
    text[:, :] = text[player_idx, :]

    matrix[:, :] = matrix[:, player_idx]
    text[:, :] = text[:, player_idx]

    # flip the matrix upside down
    matrix = np.flip(matrix, axis=0)
    text = np.flip(text, axis=0)

    PLAYER_NAMES = np.array(PLAYERS.copy())[player_idx]
    print(PLAYER_NAMES)

    fig = go.Figure(data=go.Heatmap(z=matrix, x=PLAYER_NAMES, y=PLAYER_NAMES[::-1],
                    text=text, texttemplate="%{text}", textfont={"size": 16},
                    colorscale=[(0, "red"), (0.5, "white"), (1, "green")]))

    fig.update_layout(
        title='Kdo koga ponavadi nabije',
        showlegend=False,
        plot_bgcolor="white",
        coloraxis_showscale=False,
        xaxis={"visible": False},
        yaxis={"visible": False},
        width=700,
        height=600,
        margin=dict(l=100, r=100, t=50, b=50)
    )
    for player in PLAYER_NAMES:
        fig.add_annotation(
            x=player,
            y=1,
            xanchor="center",
            yref="paper",
            yanchor="bottom",
            text=f"{player}",
            showarrow=False,
            font=dict(size=14)
        )

        fig.add_annotation(
            x=0,
            y=player,
            xanchor="right",
            xref="paper",
            yanchor="middle",
            text=f"{player}",
            showarrow=False,
            font=dict(size=14)
        )
    fig.update_coloraxes(showscale=False)
    fig.update(layout_coloraxis_showscale=False)
    fig.update_xaxes(side="top")

    fig.show()
    fig.write_html(f'{DIR}/graphs/head_to_head.html')


def stevilo_zmag_skozi_cas():
    data = pd.read_csv(f'{DIR}/data/wins_by_game.csv')
    data = data[PLAYERS]
    data[data > 1] = 0
    print(data)
    plot_data = data.copy()
    for player in PLAYERS:
        plot_data[f"{player}_y"] = data[player].cumsum()

    data[data == 0] = 1
    for player in PLAYERS:
        plot_data[f"{player}_x"] = data[player].cumsum()

    plot_data = plot_data[[f"{player}_x" for player in PLAYERS] +
                          [f"{player}_y" for player in PLAYERS]]

    fig = go.Figure()
    for player in PLAYERS:
        x = np.array(plot_data[f"{player}_x"])
        y = np.array(plot_data[f"{player}_y"])
        # remove nan values
        x = x[~np.isnan(x)]
        y = y[~np.isnan(y)]
        # add 0 at the beginning
        x = np.insert(x, 0, 0)
        y = np.insert(y, 0, 0)
        fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name=player, line=dict(color=COLORS[player])))
        fig.add_trace(go.Scatter(x=x, y=y, mode='markers',
                                 name=player, marker=dict(size=6, color=COLORS[player])))

        fig.add_annotation(
            x=x[-1],
            y=y[-1],
            text=player,
            showarrow=False,
            yshift=10,
            xanchor="left",
            font=dict(
                size=12,
                color=COLORS[player]
            )
        )

    fig.update_layout(
        title='Število zmag skozi čas',
        plot_bgcolor="white",
        xaxis_title="Število iger",
        yaxis_title="Število zmag",
        legend_title="Igralci",
        showlegend=False,
        width=800,
        height=500,
        margin=dict(l=50, r=20, t=50, b=50)
    )

    fig.show()
    fig.write_html(f'{DIR}/graphs/number_of_wins_over_time.html')


def create_leaderboard():
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    points_per_player = data[PLAYERS].sum()
    # put all the non nan elements to 1
    igre = data["st_iger"]
    data = data[PLAYERS]
    data[~np.isnan(data)] = 1
    # row by row multiply the number of games with the number of wins
    st_iger = data.multiply(igre, axis=0).sum()
    table_string = '<div class="table-container">\n<table>\n<thead><tr><th>' \
                   'Igralec</th><th>Igre</th><th>Točke</th></tr></thead>\n'

    # sort players by points
    sort_idx = np.argsort(points_per_player)[::-1]
    PLAYERS_sorted = [PLAYERS[i] for i in sort_idx]
    points_per_player = points_per_player[sort_idx]

    for player in PLAYERS_sorted:
        table_string += f"<tr><td>{player}</td><td>{int(st_iger[player])}</td>" \
                        f"<td>{int(points_per_player[player])}</td></tr>\n"
    table_string += "</table>\n</div>\n"
    with open(f'{DIR}/texts/leaderboard.txt', "w") as f:
        f.write(table_string)


def normalizirana_lestvica():
    data = pd.read_csv(f'{DIR}/data/game_by_game_data.csv')
    data["min"] = data[PLAYERS].min(axis=1)
    data["max"] = data[PLAYERS].max(axis=1) - data["min"]
    data[PLAYERS] = data[PLAYERS] - data["min"].values.reshape(-1, 1)
    data[PLAYERS] = data[PLAYERS] / data["max"].values.reshape(-1, 1)
    data[PLAYERS] = data[PLAYERS] * data["st_iger"].values.reshape(-1, 1)

    print(data)
    points_per_player = data[PLAYERS].sum()
    print(points_per_player)


def update_all():
    all_time_leaderboard()
    number_of_places()
    head_to_head()
    stevilo_zmag_skozi_cas()
    create_leaderboard()
    last_n_leaderboard()


if __name__ == '__main__':
    update_all()
